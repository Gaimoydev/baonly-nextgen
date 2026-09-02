/**
 * 配置清单 · CDN（SCDN 图床接入 / CF·ESA 双路由 / 保活）
 *
 * SCDN 是外部免费图床，有两个显著约束：
 *   ① 有请求频率限制 —— 故有 *MinIntervalMs 一族节流参数；
 *   ② 长期不访问的图会被回收 —— 故有 keepalive 一族保活参数。
 * 这两类阈值只能靠观察实际表现来调，是典型的"必须能随时改"的配置。
 *
 * 上一代还有一套 fast-host 机制（自行 DNS 解析 + TCP 测速 + **改写系统 hosts 文件**）。
 * 它需要管理员权限、在 Windows 开发机上必然 EPERM 失败，且污染全机网络状态。
 * nextgen 改为「双域名交给前端测速选择」（schema 的 Image.remoteCfUrl / remoteEsaUrl
 * 已为此预留），因此 *_FAST_IP_* / *_DNS_SERVERS / *_TCP_PING_* / FAST_HOSTS_* 一族
 * 共 17 项**不进本清单**。详见 docs/config-inventory.md。
 */

import type { ConfigDefinition } from "../config.types.js";

/** 裸域名（不含协议与路径） */
const HOSTNAME_PATTERN = "^[a-z0-9.-]+$";

export const CDN_CONFIGS = {
  // ── 图床接口 ────────────────────────────────────────────────────
  "cdn.scdn.apiUrl": {
    category: "CDN",
    valueType: "STRING",
    defaultValue: "https://img.scdn.io/api/v1.php",
    label: "SCDN 接口地址",
    description: "上传与查询都走这个端点。API Key 在环境变量 SCDN_API_KEY，不入库。",
    constraints: { pattern: "^https?://\\S+$", maxLength: 400 },
  },
  "cdn.scdn.enabled": {
    category: "CDN",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "启用图床转存",
    description:
      "关闭后图片只留本地、不再上传外部图床。图床故障时可临时关闭止血。",
  },
  "cdn.scdn.fetchTimeoutMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 15_000,
    label: "图床请求超时",
    constraints: { min: 1000, max: 120_000, step: 500 },
  },
  "cdn.scdn.uploadMinIntervalMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 1200,
    label: "上传最小间隔",
    description: "两次上传之间强制等待的时长（毫秒），用于避开图床的频率限制。",
    constraints: { min: 0, max: 60_000, step: 100 },
  },
  "cdn.scdn.infoMinIntervalMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 1200,
    label: "查询最小间隔",
    description: "两次查询之间强制等待的时长（毫秒）。",
    constraints: { min: 0, max: 60_000, step: 100 },
  },

  // ── 双域名路由 ──────────────────────────────────────────────────
  "cdn.route.cfDomain": {
    category: "CDN",
    valueType: "STRING",
    defaultValue: "cloudflareimg.cdn.sn",
    label: "Cloudflare 线路域名",
    description: "图床的 CF 出口域名。前端会在两条线路间测速择优。",
    constraints: { pattern: HOSTNAME_PATTERN, maxLength: 200 },
  },
  "cdn.route.esaDomain": {
    category: "CDN",
    valueType: "STRING",
    defaultValue: "esaimg.cdn1.vip",
    label: "ESA 线路域名",
    description: "图床的阿里 ESA 出口域名，国内通常更快。",
    constraints: { pattern: HOSTNAME_PATTERN, maxLength: 200 },
  },
  "cdn.route.preferred": {
    category: "CDN",
    valueType: "STRING",
    defaultValue: "auto",
    label: "线路选择策略",
    description:
      "auto = 前端测速自选；cf / esa = 强制走指定线路（某条线路出问题时用）。",
    constraints: { options: ["auto", "cf", "esa"] },
  },
  "cdn.route.probeTimeoutMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 2500,
    label: "前端测速超时",
    description: "前端探测单条线路的超时（毫秒）。超时即判定该线路不可用。",
    constraints: { min: 300, max: 15_000, step: 100 },
  },

  // ── 保活与校验 ──────────────────────────────────────────────────
  "cdn.host.verifyIntervalHours": {
    category: "CDN",
    valueType: "NUMBER",
    defaultValue: 24,
    label: "远端图片校验间隔",
    description: "多久核对一次「图床上的图是否还在」（小时）。",
    constraints: { min: 1, max: 720, step: 1 },
  },
  "cdn.host.keepaliveEnabled": {
    category: "CDN",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "启用图片保活",
    description: "定期访问老图片，避免被图床按「长期无访问」回收。",
  },
  "cdn.host.keepaliveIntervalHours": {
    category: "CDN",
    valueType: "NUMBER",
    defaultValue: 24,
    label: "保活间隔",
    constraints: { min: 1, max: 720, step: 1 },
  },
  "cdn.host.keepaliveStartDelayMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 600_000,
    label: "保活启动延迟",
    description:
      "进程启动后等多久才开始第一轮保活（毫秒，默认 10 分钟），避免和启动期的其他任务抢带宽。",
    constraints: { min: 0, max: 3_600_000, step: 10_000 },
  },
  "cdn.host.keepaliveMinAgeDays": {
    category: "CDN",
    valueType: "NUMBER",
    defaultValue: 45,
    label: "保活起始年龄",
    description: "只对上传超过这么多天的图片做保活，新图不必浪费请求。",
    constraints: { min: 1, max: 365, step: 1 },
  },
  "cdn.host.keepaliveBatchSize": {
    category: "CDN",
    valueType: "NUMBER",
    defaultValue: 240,
    label: "单轮保活数量",
    description: "一轮保活最多访问多少张图。受图床频率限制，调大会拉长单轮耗时。",
    constraints: { min: 1, max: 5000, step: 10 },
  },
  "cdn.host.manifestMaxEntries": {
    category: "CDN",
    valueType: "NUMBER",
    defaultValue: 50_000,
    label: "远端清单最大条目",
    description: "本地保存的图床文件清单上限，防止无限增长。",
    constraints: { min: 1000, max: 1_000_000, step: 1000 },
  },
  "cdn.host.maxRetryDelayMs": {
    category: "CDN",
    valueType: "DURATION_MS",
    defaultValue: 300_000,
    label: "退避重试上限",
    description: "图床连续失败时指数退避的最长等待（毫秒，默认 5 分钟）。",
    constraints: { min: 1000, max: 3_600_000, step: 1000 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
