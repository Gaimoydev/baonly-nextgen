import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { installCrashGuards, installShutdownHandlers } from "./bootstrap/crash-guards";
import { WorkerModule } from "./worker.module";

/**
 * 入口 2：常驻 worker 进程。爬虫 + 定时任务 + sharp + SCDN 上传。
 *
 * 用 createApplicationContext 而不是 create —— 它**不监听端口**，
 * 只跑 DI 容器和 ScheduleModule 的定时器。
 */
async function bootstrap(): Promise<void> {
  installCrashGuards("worker");

  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: false });
  const logger = new Logger("worker");

  app.enableShutdownHooks();
  installShutdownHandlers(() => app.close(), "worker");

  logger.log("worker started (cron + crawlers + image pipeline)");
}

void bootstrap();
