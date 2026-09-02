import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { installCrashGuards, installShutdownHandlers } from "./bootstrap/crash-guards";

/** 入口 1：HTTP API 进程。不跑定时任务、不跑爬虫、不跑 sharp。 */
async function bootstrap(): Promise<void> {
  installCrashGuards("api");

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger("api");

  // 全局校验：DTO 上的 class-validator 装饰器由此生效
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 剥掉 DTO 未声明的字段
      forbidNonWhitelisted: true, // 出现未声明字段直接 400，避免静默忽略
      transform: true, // 按 DTO 类型自动转换（string → number 等）
      transformOptions: { enableImplicitConversion: false }
    })
  );

  // OpenAPI 自动生成 —— 前端的类型由此产出（pnpm api:types），零手写契约。
  // 顺带解决上一代"公开 API 给第三方用但没有文档"的问题。
  const openapi = new DocumentBuilder()
    .setTitle("BAOnly API")
    .setDescription("蔚蓝档案同人展会聚合站 API")
    .setVersion("1.0")
    .addCookieAuth("baonly_session")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "apiKey")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openapi), {
    jsonDocumentUrl: "openapi.json"
  });

  app.enableShutdownHooks();
  installShutdownHandlers(() => app.close(), "api");

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "127.0.0.1");
  logger.log(`API listening on http://127.0.0.1:${port}  ·  OpenAPI: /openapi.json`);
}

void bootstrap();
