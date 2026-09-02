import { Redis } from "ioredis";

import type { LogSink } from "../logging/log-sink";
import { silentLogSink } from "../logging/log-sink";

/**
 * ioredis 客户端的构造工厂。**纯函数，不含任何 NestJS 依赖。**
 *
 * Redis 在本项目里不是「可选的缓存」而是**唯一的共享状态存储**：
 * session / 限流 / presence / 缓存全在这里（CLAUDE.md 禁止进程内共享状态）。
 * 所以连接参数偏向「快速失败 + 持续重连」，而不是「静默排队」。
 */

/** 全仓统一的 Redis 客户端类型别名。 */
export type AppRedisClient = Redis;

export interface RedisFactoryOptions {
  /** redis://host:port[/db] */
  url: string;
  /** 键名前缀。多环境共用一台 Redis 时用它隔离。 */
  keyPrefix?: string;
  logSink?: LogSink;
}

export function createRedisClient(options: RedisFactoryOptions): AppRedisClient {
  const log = options.logSink ?? silentLogSink;

  const client = new Redis(options.url, {
    // 由调用方在 onModuleInit 里显式 connect()，这样「Redis 连不上」会在启动时
    // 就暴露出来，而不是等第一个请求打进来才发现。
    lazyConnect: true,
    // 默认 20 次重试意味着一个命令可能挂几十秒。3 次足够穿过一次短暂抖动。
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    ...(options.keyPrefix === undefined ? {} : { keyPrefix: options.keyPrefix }),
  });

  // 必须挂 'error' 监听：ioredis 的 error 是 EventEmitter 事件，没人听就会
  // 变成 uncaughtException，进而被崩溃守卫判定为「必须退出」。
  client.on("error", (cause: Error) => log.warn(`redis error: ${cause.message}`));
  client.on("reconnecting", () => log.warn("redis reconnecting"));
  client.on("ready", () => log.info("redis ready"));
  client.on("end", () => log.warn("redis connection closed"));

  return client;
}
