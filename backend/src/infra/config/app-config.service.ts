import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { AppConfig, ConfigCategory } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

/** 配置变更的 Pub/Sub 频道 —— 多实例时用它广播失效 */
const INVALIDATE_CHANNEL = "baonly:config:invalidate";

/**
 * 应用配置读取服务。
 *
 * ★ 这是"配置去 .env 化"的运行时支撑。
 *   上一代把 150+ 项配置塞进 .env，改任何一项都要改文件 + 重启 + 重新部署。
 *   现在只有【极敏感】或【运行时必需、无法自举】的留在 .env
 *   （DATABASE_URL / REDIS_URL / PORT / 凭据类），其余全在 AppConfig 表里，
 *   后台改完立即热生效。
 *
 * 缓存策略（三层）：
 *   1. 实例级 Map    —— 读路径零 IO
 *   2. Redis Pub/Sub —— 任一实例改了配置，广播让所有实例失效重载
 *   3. PostgreSQL    —— 真相源
 *
 * 关于实例级 Map 与 CLAUDE.md 的"禁止进程内共享状态"：
 *   那条禁令针对的是"本该跨实例共享的状态"（session / 限流计数 / presence）——
 *   上一代 17 个无上限 Map 的教训。这里的 Map 是**只读投影**，有 Pub/Sub 失效
 *   机制且容量等于配置项数（几十条，有界），真相源在数据库，不属于被禁的场景。
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly cache = new Map<string, unknown>();
  private loaded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();

    // 订阅失效广播：其他实例（或后台）改了配置就重载
    const sub = this.redis.getSubscriber();
    await sub.subscribe(INVALIDATE_CHANNEL);
    sub.on("message", (channel) => {
      if (channel !== INVALIDATE_CHANNEL) return;
      void this.reload().catch((e) => this.logger.error(`config reload failed: ${e.message}`));
    });
  }

  /** 全量重载。配置项只有几十条，全量比增量简单且不会漏 */
  async reload(): Promise<void> {
    const rows = await this.prisma.appConfig.findMany();
    this.cache.clear();
    for (const row of rows) this.cache.set(row.key, row.value);
    this.loaded = true;
    this.logger.log(`loaded ${rows.length} config entries`);
  }

  /**
   * 读配置。
   *
   * `fallback` 是**必需**的 —— 配置项可能还没种子进库（比如新增代码先上线），
   * 强制传兜底值可以避免运行时因缺配置而崩。
   */
  get<T>(key: string, fallback: T): T {
    if (!this.loaded) {
      this.logger.warn(`config read before load: ${key}, using fallback`);
      return fallback;
    }
    const value = this.cache.get(key);
    return (value === undefined || value === null ? fallback : value) as T;
  }

  getNumber(key: string, fallback: number): number {
    const v = this.get<unknown>(key, fallback);
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  getBoolean(key: string, fallback: boolean): boolean {
    const v = this.get<unknown>(key, fallback);
    return typeof v === "boolean" ? v : fallback;
  }

  getString(key: string, fallback: string): string {
    const v = this.get<unknown>(key, fallback);
    return typeof v === "string" ? v : fallback;
  }

  /** 写配置 + 广播失效。后台配置页调这个 */
  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    await this.prisma.appConfig.update({
      where: { key },
      data: { value: value as never, updatedBy: updatedBy ?? null }
    });
    this.cache.set(key, value);
    await this.redis.client.publish(INVALIDATE_CHANNEL, key);
  }

  /** 恢复某项的默认值 */
  async resetToDefault(key: string, updatedBy?: string): Promise<void> {
    const row = await this.prisma.appConfig.findUniqueOrThrow({ where: { key } });
    await this.set(key, row.defaultValue, updatedBy);
  }

  /**
   * 供后台配置页使用：按分组列出配置项**及其元数据**，
   * 后台据此自动生成表单（加配置项不需要改前端代码）。
   */
  async listForAdmin(category?: ConfigCategory): Promise<AppConfig[]> {
    return this.prisma.appConfig.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
    });
  }

  /**
   * 供前台使用的公开配置子集。
   * **绝不包含 isSecret 项** —— 凭据类配置不能出现在公共响应里。
   */
  async listPublic(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.appConfig.findMany({
      where: { isSecret: false, category: { in: ["SITE"] } }
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
