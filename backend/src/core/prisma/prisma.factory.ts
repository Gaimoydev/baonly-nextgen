import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import type { LogSink } from "../logging/log-sink";
import { silentLogSink } from "../logging/log-sink";

/**
 * PrismaClient 的构造工厂。**纯函数，不含任何 NestJS 依赖。**
 *
 * Prisma 7 起运行时必须走 driver adapter：`datasource` 块里已经没有 `url`
 * （移到了 `prisma.config.ts`，那份只给 Migrate 用），所以连接串必须在这里注入。
 *
 * 本文件是 `@prisma/client` 在整个后端的**唯一构造点**。`modules/` 被 ESLint
 * 禁止 import `@prisma/**`，需要客户端类型时从这里取 `AppPrismaClient`。
 */

/** 全仓统一的 PrismaClient 类型别名。modules/ 只认这个名字。 */
export type AppPrismaClient = PrismaClient;

export interface PrismaFactoryOptions {
  /** postgresql://… 完整连接串 */
  connectionString: string;
  /** pg 连接池上限。API 与 worker 是两个进程，各自独立计数。 */
  maxConnections?: number;
  /** 打印每条 SQL。只在开发期开，生产会淹掉日志。 */
  logQueries?: boolean;
  logSink?: LogSink;
}

export function createPrismaClient(options: PrismaFactoryOptions): AppPrismaClient {
  const log = options.logSink ?? silentLogSink;
  const schema = readSchemaParam(options.connectionString);

  const adapter = new PrismaPg(
    {
      connectionString: options.connectionString,
      max: options.maxConnections ?? 10,
      // ★ 必须强制 session 时区为 UTC，否则全库 timestamptz 偏 8 小时。
      //
      // Prisma 6 及以前的 Rust 引擎自己就会这么做；Prisma 7 换成 driver adapter
      // 之后这个责任转移给了调用方。本机 postgresql.conf 里 timezone='Asia/Shanghai'，
      // 不覆盖的话读写各偏 8 小时。
      //
      // ⚠ 这个 bug **过不了任何基于 Prisma 的自校验** —— 写偏 -8h、读偏 +8h，
      //   方向相反互相抵消，「Prisma 写 → Prisma 读」的往返测试完全正常。
      //   只有原生 SQL、导出、ICS、analytics 的 AT TIME ZONE 分组、
      //   以及别的客户端才看得见错误。实测方法：EXTRACT(EPOCH) 绕开客户端解析。
      //
      // 我们全链路存 timestamptz（绝对时刻），业务时区换算一律在应用层用
      // core/time/shanghai.ts 做 —— 驱动层就该是 UTC。别改这一行。
      options: "-c timezone=UTC",
    },
    {
      ...(schema === undefined ? {} : { schema }),
      // pg 的 Pool 会在「空闲连接出错」时 emit 'error'。不接这个回调的话事件
      // 会冒泡成 uncaughtException，而我们的崩溃守卫会让进程退出 —— 一次网络抖动
      // 就重启进程是不可接受的。这里降级为日志。
      onPoolError: (cause: Error) => log.error("pg pool error", cause),
      onConnectionError: (cause: Error) => log.warn(`pg connection error: ${cause.message}`),
    },
  );

  return new PrismaClient({ adapter, log: resolveLogLevels(options.logQueries === true) });
}

/**
 * 连接串里的 `?schema=public` 是 Prisma 的自有参数，pg 不认识它。
 * adapter 通过 options.schema 读取，所以要把它从 URL 里取出来单独传。
 */
function readSchemaParam(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).searchParams.get("schema") ?? undefined;
  } catch {
    // 连接串格式异常交给 pg 去报错，这里不抢着抛。
    return undefined;
  }
}

function resolveLogLevels(logQueries: boolean): Prisma.LogLevel[] {
  return logQueries ? ["query", "info", "warn", "error"] : ["warn", "error"];
}
