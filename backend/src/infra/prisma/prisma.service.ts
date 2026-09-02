import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma 7 起**必须**通过 driver adapter 连接 —— 内置的 Rust query engine
 * 连接方式已移除，`datasource.url` 也不能再写在 schema.prisma 里
 * （连接串移到 prisma.config.ts 供 Migrate 使用，运行时走这里注入）。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // 这是少数几个必须在 .env 的配置之一 —— 没有它无法自举去读数据库里的配置
      throw new Error("DATABASE_URL is required (see backend/.env.example)");
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("PostgreSQL connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
