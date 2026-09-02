/**
 * 配置清单 · IMAGE（上传限制 / 代理取图 / 压缩 / 本地缓存清理）
 *
 * 上一代这些全在 `.env`：调一次封面压缩质量要改文件重启，
 * 而"改质量"恰恰是需要反复试的事 —— 是最该热改的一类配置。
 *
 * 注意 `image.proxy.allowedHosts` 是**安全边界**：它决定后端愿意代抓哪些域名的图。
 * 上一代这里存在 SSRF 风险（见 baonly_web docs/dev/RISKS.md 第 3 条）。
 * 允许后台改它是有意的（运营要能加新图源），但它必须留白名单形态，
 * 不得提供"允许全部"的开关。
 */

import type { ConfigDefinition } from "../config.types.js";

export const IMAGE_CONFIGS = {
  // ── 后台上传 ────────────────────────────────────────────────────
  "image.upload.maxBytes": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 8_388_608,
    label: "后台上传大小上限",
    description: "单张图片的字节上限，默认 8 MiB。",
    constraints: { min: 65_536, max: 67_108_864, step: 65_536 },
  },
  "image.upload.allowedMimes": {
    category: "IMAGE",
    valueType: "STRING_LIST",
    defaultValue: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ] as readonly string[],
    label: "允许上传的图片类型",
    description: "按实际解码结果判定，不信任文件扩展名与请求头。",
    constraints: { maxItems: 16 },
  },

  // ── 代理取图（把源站图片抓回来再转存 CDN）──────────────────────
  "image.proxy.maxBytes": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 12_582_912,
    label: "代理取图大小上限",
    description: "从源站抓图时允许的最大字节数，默认 12 MiB。超出即中断下载。",
    constraints: { min: 65_536, max: 67_108_864, step: 65_536 },
  },
  "image.proxy.timeoutMs": {
    category: "IMAGE",
    valueType: "DURATION_MS",
    defaultValue: 10_000,
    label: "代理取图超时",
    constraints: { min: 1000, max: 60_000, step: 500 },
  },
  "image.proxy.allowedHosts": {
    category: "IMAGE",
    valueType: "STRING_LIST",
    defaultValue: [
      "cdnstatic.gamekee.com",
      "kivo.wiki",
    ] as readonly string[],
    label: "允许代理的图片域名",
    description:
      "安全白名单：只有这些域名的图片后端才会代抓。加域名前请确认它不是内网地址。",
    constraints: { maxItems: 64, pattern: "^[a-z0-9.-]+$" },
  },

  // ── 压缩 ────────────────────────────────────────────────────────
  "image.compress.maxDimension": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 1600,
    label: "压缩后最长边",
    description: "长边超过此值按比例缩小（像素）。不放大小图。",
    constraints: { min: 320, max: 4096, step: 16 },
  },
  "image.compress.quality": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 78,
    label: "WebP 压缩质量",
    description: "1~100。78 是体积与画质的经验平衡点，低于 60 会出现明显色带。",
    constraints: { min: 1, max: 100, step: 1 },
  },
  "image.compress.concurrency": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 4,
    label: "压缩并发数",
    description:
      "同时跑几个 sharp 转码任务。sharp 自身还有线程池，调太大会把 CPU 打满并拖慢 API。",
    constraints: { min: 1, max: 32, step: 1 },
  },

  // ── 本地缓存清理 ────────────────────────────────────────────────
  "image.cache.maxBytes": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 536_870_912,
    label: "本地图片缓存总量上限",
    description: "默认 512 MiB。超出后按最久未访问顺序清理。",
    constraints: { min: 16_777_216, max: 107_374_182_400, step: 16_777_216 },
  },
  "image.cache.maxAgeDays": {
    category: "IMAGE",
    valueType: "NUMBER",
    defaultValue: 90,
    label: "本地缓存保留天数",
    description: "已上传到 CDN 且超过此天数的本地副本可清理。",
    constraints: { min: 1, max: 3650, step: 1 },
  },
  "image.cache.unreferencedMinAgeMs": {
    category: "IMAGE",
    valueType: "DURATION_MS",
    defaultValue: 86_400_000,
    label: "无引用图片的最短保护期",
    description:
      "刚生成但还没被任何记录引用的图片，至少保留这么久才允许清理（毫秒，默认 1 天）。防止把正在编辑中的图删掉。",
    constraints: { min: 60_000, max: 2_592_000_000, step: 60_000 },
  },
  "image.cache.cleanupIntervalMs": {
    category: "IMAGE",
    valueType: "DURATION_MS",
    defaultValue: 86_400_000,
    label: "缓存清理间隔",
    description: "多久跑一次清理（毫秒，默认 1 天）。仅 worker 进程读取。",
    constraints: { min: 300_000, max: 604_800_000, step: 300_000 },
  },
  "image.cache.hostProvider": {
    category: "IMAGE",
    valueType: "STRING",
    defaultValue: "scdn",
    label: "图片托管方式",
    description:
      "scdn = 转存到外部图床并由前端直连；local = 只用本地文件由后端出图（流量走自己）。",
    constraints: { options: ["scdn", "local"] },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
