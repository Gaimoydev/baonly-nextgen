/**
 * 配置清单 · CRAWLER（通用抓取策略 / 调度 / 请求头伪装）
 *
 * 各源专属的 URL 与并发放 `./crawler-sources.ts`（同属 CRAWLER 分类，拆文件仅为行数）。
 *
 * 「某个源开不开」不在这里 —— 那是 `Source.enabled` 列，
 * 与 `Source.priority`（判同择优的同分兜底）一样属于数据而非配置，
 * 放在这里会出现两个真相源。
 */

import type { ConfigDefinition } from "../config.types.js";

export const CRAWLER_CONFIGS = {
  // ── 调度 ────────────────────────────────────────────────────────
  "crawler.schedule.cron": {
    category: "CRAWLER",
    valueType: "CRON",
    defaultValue: "0 4,16 * * *",
    label: "定时抓取计划",
    description:
      "标准 5 段 cron，按 Asia/Shanghai 解释。默认每天 04:00 与 16:00 各跑一次。仅 worker 进程读取。",
    constraints: { maxLength: 100 },
  },
  "crawler.schedule.runOnStartup": {
    category: "CRAWLER",
    valueType: "BOOLEAN",
    defaultValue: false,
    label: "启动时立即抓一次",
    description:
      "开发调试用。生产建议关闭，否则每次重启都会对三个源发起全量抓取。",
  },
  "crawler.schedule.enabled": {
    category: "CRAWLER",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "启用定时抓取",
    description: "关闭后只能在后台手动触发抓取。",
  },

  // ── 通用重试与下架判定 ──────────────────────────────────────────
  "crawler.refresh.retries": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 2,
    label: "单源抓取重试次数",
    description: "整源抓取失败后的重试次数（不含首次）。",
    constraints: { min: 0, max: 10, step: 1 },
  },
  "crawler.refresh.retryDelayMs": {
    category: "CRAWLER",
    valueType: "DURATION_MS",
    defaultValue: 1500,
    label: "重试间隔",
    description: "两次重试之间的等待时长（毫秒）。",
    constraints: { min: 0, max: 60_000, step: 100 },
  },
  "crawler.sourceRemovalConfirmations": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 2,
    label: "判定下架所需的连续缺席次数",
    description:
      "一条源记录连续几次抓取都没出现，才判定「源端真的下架」。设为 1 会把单次抓取失败误判成下架。",
    constraints: { min: 1, max: 10, step: 1 },
  },
  "crawler.requestTimeoutMs": {
    category: "CRAWLER",
    valueType: "DURATION_MS",
    defaultValue: 15_000,
    label: "单次请求超时",
    description: "对源站单个 HTTP 请求的超时时长（毫秒）。",
    constraints: { min: 1000, max: 120_000, step: 500 },
  },

  // ── 请求头伪装 ──────────────────────────────────────────────────
  // 这四项是最典型的「必须能随时改、改了不该重启」的配置：
  // 源站升级反爬时，运营改一下 UA 就能恢复抓取，不必发版。
  "crawler.headers.userAgent": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
    label: "User-Agent",
    description: "对三个源站发请求时使用的 UA。源站升级反爬时改这里。",
    constraints: { minLength: 10, maxLength: 500 },
  },
  "crawler.headers.acceptLanguage": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "zh-CN,zh;q=0.9,en;q=0.8",
    label: "Accept-Language",
    constraints: { maxLength: 200 },
  },
  "crawler.headers.secChUa": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      '"Chromium";v="148", "Microsoft Edge";v="148", "Not=A?Brand";v="24"',
    label: "Sec-CH-UA",
    description: "客户端提示头，需与 User-Agent 的版本号保持一致，否则容易被识别。",
    constraints: { maxLength: 300 },
  },
  "crawler.headers.secChUaPlatform": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: '"Windows"',
    label: "Sec-CH-UA-Platform",
    description: '含引号，如 "Windows" / "macOS"。',
    constraints: { maxLength: 50 },
  },

  // ── 外部数据源（非票务）────────────────────────────────────────
  "crawler.holiday.apiBaseUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://api.jiejiariapi.com/v1",
    label: "节假日 API 基址",
    description: "拉取法定节假日与调休安排，供前台「节假日」筛选使用。不含结尾斜杠。",
    constraints: { pattern: "^https?://[^\\s{}]+$", maxLength: 300 },
  },
  "crawler.holiday.refreshCron": {
    category: "CRAWLER",
    valueType: "CRON",
    defaultValue: "0 5 1 * *",
    label: "节假日刷新计划",
    description: "节假日数据一年只变几次，默认每月 1 日 05:00 拉一次。",
    constraints: { maxLength: 100 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
