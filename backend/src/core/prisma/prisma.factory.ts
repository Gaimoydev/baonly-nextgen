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
