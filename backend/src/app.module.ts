import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { InfraModule } from "./infra/infra.module";

/**
 * API 进程的根模块。
 *
 * ★ 这里**不注册** ScheduleModule —— 定时任务只属于 worker 进程（见 worker.module.ts）。
 *   上一代把 HTTP API、4 个爬虫、sharp 图片处理、analytics 聚合全塞进一个进程，
 *   结果它们互相抢内存（线上常驻 1.5GB，PM2 重启 20 次）。进程隔离是硬要求。
 */
@Module({
  imports: [
    // @nestjs/config 只负责读 .env 里那少数几项（DATABASE_URL / REDIS_URL / PORT）。
    // 业务配置一律走 AppConfigService（数据库 + 后台可改），不走这里。
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    InfraModule
    // 业务模块在此逐步加入（events / admin / analytics / …）
  ]
})
export class AppModule {}
