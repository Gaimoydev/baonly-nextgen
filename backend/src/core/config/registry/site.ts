/**
 * 配置清单 · SITE（站点基础 / 前台展示策略 / 备案信息）
 *
 * 对应上一代：
 *   - `.env` 的 PUBLIC_BASE_URL / SEO_SITE_URL / CORS_ORIGINS / DEV_CORS_ORIGINS
 *     / PUBLIC_READ_CACHE_* / SEO_OUTPUT_CACHE_*
 *   - `site_settings` 表里 icpNo / policeNo / featured* / friendLinks 这些运营字段
 *
 * SEO 文案单独放 `./seo.ts`（同属 SITE 分类，只是拆文件以满足 max-lines）。
 */

import type { ConfigDefinition } from "../config.types.js";

/** URL 格式（不含占位符）。带 {id}/{page} 的爬虫模板 URL 不用这个。 */
const HTTP_URL_PATTERN = "^https?://[^\\s{}]+$";

export const SITE_CONFIGS = {
  "site.publicBaseUrl": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "http://localhost:3000",
    label: "后端对外基址",
    description:
      "后端自身的对外可访问地址，用于拼装回调与绝对链接。不含结尾斜杠。",
    constraints: { pattern: HTTP_URL_PATTERN, maxLength: 300 },
  },
  "site.frontendBaseUrl": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "https://www.baonly.cn",
    label: "前台站点地址",
    description:
      "公共站点的对外域名，用于 sitemap、分享链接、通知里的跳转地址。不含结尾斜杠。",
    constraints: { pattern: HTTP_URL_PATTERN, maxLength: 300 },
  },
  "site.corsOrigins": {
    category: "SITE",
    valueType: "STRING_LIST",
    defaultValue: [] as readonly string[],
    label: "允许的跨域来源",
    description:
      "生产环境允许携带凭据跨域访问的来源白名单。留空表示只允许同源。",
    constraints: { maxItems: 32, pattern: HTTP_URL_PATTERN },
  },
  "site.devCorsOrigins": {
    category: "SITE",
    valueType: "STRING_LIST",
    defaultValue: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ] as readonly string[],
    label: "开发环境跨域来源",
    description: "仅在 NODE_ENV=development 时生效，方便两个前端 dev server 直连。",
    constraints: { maxItems: 32 },
  },

  // ── 前台读缓存 ──────────────────────────────────────────────────
  "site.readCache.ttlMs": {
    category: "SITE",
    valueType: "DURATION_MS",
    defaultValue: 120_000,
    label: "前台读缓存有效期",
    description:
      "活动列表等公开读接口的缓存时长（毫秒）。调小会更快反映后台改动，代价是数据库压力上升。",
    constraints: { min: 0, max: 3_600_000, step: 1000 },
  },
  "site.readCache.maxEntries": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 800,
    label: "前台读缓存条目上限",
    description: "不同筛选组合各占一个缓存条目，超过上限按最久未用淘汰。",
    constraints: { min: 0, max: 20_000, step: 50 },
  },
  "site.seoCache.ttlMs": {
    category: "SITE",
    valueType: "DURATION_MS",
    defaultValue: 60_000,
    label: "SEO 输出缓存有效期",
    description: "sitemap.xml / robots.txt 等生成结果的缓存时长（毫秒）。",
    constraints: { min: 0, max: 3_600_000, step: 1000 },
  },
  "site.seoCache.maxEntries": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 80,
    label: "SEO 输出缓存条目上限",
    constraints: { min: 0, max: 5000, step: 10 },
  },

  // ── 备案与页脚（上一代 site_settings）────────────────────────────
  "site.icpNo": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "",
    label: "ICP 备案号",
    description: "页脚展示。留空则不显示该行。",
    constraints: { maxLength: 100 },
  },
  "site.policeNo": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "",
    label: "公安备案号",
    description: "页脚展示。留空则不显示。",
    constraints: { maxLength: 100 },
  },
  "site.policeUrl": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "",
    label: "公安备案查询链接",
    constraints: { maxLength: 300 },
  },
  "site.friendLinks": {
    category: "SITE",
    valueType: "JSON",
    defaultValue: [] as readonly { name: string; url: string }[],
    label: "友情链接",
    description: '页脚友链列表，形如 [{"name":"站名","url":"https://..."}]。',
  },

  // ── 首页推荐位（上一代 site_settings.featured*）──────────────────
  "site.featured.pinned": {
    category: "SITE",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "推荐位固定置顶",
    description:
      "开启后推荐活动始终排在列表最前；关闭则只是打标，仍按正常时间排序。",
  },
  "site.featured.eventIds": {
    category: "SITE",
    valueType: "STRING_LIST",
    defaultValue: [] as readonly string[],
    label: "推荐活动 ID",
    description:
      "手工指定的推荐活动。留空时由「精选」标记（Event.featured）决定。",
    constraints: { maxItems: 50 },
  },

  // ── 公告展示策略 ────────────────────────────────────────────────
  "site.announcement.modalMaxPerVisit": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 1,
    label: "单次访问最多弹几条公告",
    description: "避免多条 MODAL 公告连续弹窗骚扰访客。",
    constraints: { min: 0, max: 5, step: 1 },
  },
  "site.announcement.recentDays": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 30,
    label: "公告视为「新」的天数",
    description: "超过这个天数的公告不再弹窗，只在列表里保留。",
    constraints: { min: 1, max: 365, step: 1 },
  },

  // ── 运行日志 ────────────────────────────────────────────────────
  "site.logBufferSize": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 1800,
    label: "内存日志环形缓冲条数",
    description: "后台「运行日志」面板能回看的最大条数。调大占更多内存。",
    constraints: { min: 100, max: 20_000, step: 100 },
  },
  "site.statusCacheBucketMs": {
    category: "SITE",
    valueType: "DURATION_MS",
    defaultValue: 10_000,
    label: "状态接口缓存粒度",
    description:
      "/status 一类高频轮询接口的结果按此粒度分桶缓存（毫秒），0 表示不缓存。",
    constraints: { min: 0, max: 300_000, step: 1000 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
