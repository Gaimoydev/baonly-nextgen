import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { InfraModule } from "./infra/infra.module";

/**
 * worker 进程的根模块 —— 常驻进程，跑定时任务和重活。
 *
 * 职责（对应上一代的 6 个 cron）：
 *   爬虫刷新 · 图片缓存清理 · analytics 保留期清理 · 日志维护 · 图床保活
 *
 * ★ 与 AppModule 的关键区别：这里注册 ScheduleModule，且**不监听 HTTP 端口**。
 *   sharp（libvips）和爬虫的大 buffer 都在这个进程里，与 API 进程内存隔离。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    InfraModule
    // 任务模块在此逐步加入（crawler / image-maintenance / analytics-rollup / …）
  ]
})
export class WorkerModule {}
