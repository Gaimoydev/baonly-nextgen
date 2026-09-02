import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 起，datasource 的连接 URL 由本文件提供给 Migrate（不再写在 schema.prisma）。
// 运行时连接走 driver adapter，在 PrismaClient 构造时注入。
//
// 这里用 process.env 而不是 prisma/config 的 env() 助手：env() 在变量缺失时直接抛错，
// 会让不需要数据库的命令（prisma generate / validate）也一起失败。
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: process.env.DATABASE_URL!
  }
});
