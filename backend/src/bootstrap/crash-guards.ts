import { Logger } from "@nestjs/common";

/**
 * 进程级崩溃处理。
 *
 * ★ 上一代最严重的运行时缺陷之一（RISKS.md B2）：
 *   `uncaughtException` / `unhandledRejection` 只写日志、**不退出**，
 *   于是进程可以带着损坏状态继续对外服务 —— 表现为"服务还活着但行为错乱"，
 *   排查成本极高。
 *
 * 正确做法：记录足够的诊断信息后**立即非零退出**，由 PM2/systemd 拉起。
 * 崩溃要响亮，不要沉默。
 */
export function installCrashGuards(processName: string): void {
  const logger = new Logger(`${processName}:crash`);

  const die = (kind: string, error: unknown): never => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`FATAL ${kind}: ${err.message}`, err.stack);
    // 给日志一个刷盘的机会，但不要无限等
    setTimeout(() => process.exit(1), 100).unref();
    process.exitCode = 1;
    return undefined as never;
  };

  process.on("uncaughtException", (e) => die("uncaughtException", e));
  process.on("unhandledRejection", (e) => die("unhandledRejection", e));
}

/** 注册优雅退出：收到信号时让 Nest 跑完 onModuleDestroy（关连接、flush 队列） */
export function installShutdownHandlers(close: () => Promise<void>, processName: string): void {
  const logger = new Logger(`${processName}:shutdown`);
  let closing = false;

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      logger.log(`${signal} received, shutting down`);
      close()
        .then(() => process.exit(0))
        .catch((e) => {
          logger.error(`shutdown failed: ${e.message}`);
          process.exit(1);
        });
    });
  }
}
