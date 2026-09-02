import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Redis 客户端。承载 session / 限流计数 / presence / 缓存。
 *
 * 为什么不用 @nestjs/cache-manager：
 *   cache-manager v7 改为基于 Keyv，其 Redis 适配器 cache-manager-redis-yet 已 deprecated。
 *   我们的用法都是直接的 KV/计数/集合操作，多一层抽象只带来版本不确定性。
 *
 * ★ 上一代的教训：所有状态放在 17 个进程内 Map 里，导致内存无上限增长（线上 1.5GB）
 *   且只能单实例。凡是"重启后不该丢"或"多实例要共享"的状态，一律放这里。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** 主连接：普通命令 */
  readonly client: Redis;

  /** 订阅专用连接 —— Redis 的 subscribe 会把连接切进订阅模式，不能再发普通命令 */
  private subscriber?: Redis;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required (see backend/.env.example)");

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false
    });
    this.client.on("error", (e) => this.logger.error(`redis error: ${e.message}`));
    this.client.on("connect", () => this.logger.log("Redis connected"));
  }

  /** 惰性创建订阅连接（只有真正需要 Pub/Sub 的地方才多开一条） */
  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on("error", (e) => this.logger.error(`redis sub error: ${e.message}`));
    }
    return this.subscriber;
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
    await this.client.quit().catch(() => undefined);
  }
}
