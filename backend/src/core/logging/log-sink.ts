/**
 * 日志出口的最小接口。
 *
 * `core/` 不得 import `@nestjs/*`（CLAUDE.md import 边界），所以 core 里的工厂
 * 函数不能直接拿 Nest 的 `Logger`。它们接受一个 LogSink，由 `modules/` 侧用
 * `common/logging/nest-log-sink.ts` 把 Nest Logger 适配进来。
 *
 * 这样 core 的代码在 Vitest 里可以不起框架直接跑，日志也不会变成 console 噪音。
 */
export interface LogSink {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
}

/** 默认出口：什么都不做。用于单测和「调用方没给 logger」的情况。 */
export const silentLogSink: LogSink = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
