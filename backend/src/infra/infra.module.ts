import { Global, Module } from "@nestjs/common";

import { AppConfigService } from "./config/app-config.service";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.service";

/**
 * 基础设施模块。声明为 @Global 是因为 Prisma / Redis / AppConfig 属于横切关注点，
 * 几乎每个业务模块都要用；让它们各自 import 一遍只是噪音。
 *
 * 注意这是**唯一**允许 @Global 的模块 —— 业务模块必须显式声明依赖，
 * 否则依赖关系会隐形，就变回上一代那种"什么都能拿到什么"的状态。
 */
@Global()
@Module({
  providers: [PrismaService, RedisService, AppConfigService],
  exports: [PrismaService, RedisService, AppConfigService]
})
export class InfraModule {}
