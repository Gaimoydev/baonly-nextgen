/**
 * 配置清单 · SITE / SEO 文案与 sitemap 策略
 *
 * 对应上一代 `site_settings.seo` —— 那是一整块 jsonb，改一个标题要读出来
 * 合并再写回，且没有任何校验和字段说明。这里拍平成独立配置项，
 * 每项各自带 label / 约束，后台能逐项编辑。
 *
 * 注意（与 CLAUDE.md 的「明确不做的事」对齐）：
 *   nextgen **不做内容级 SEO** —— sitemap 不列 `/event/:id`，展会数据不进 HTML。
 *   因此上一代的 eventTitleTemplate / sitemapIncludeEvents / sitemapEvent* 等
 *   与单个活动相关的项**不在本清单内**（见 docs/config-inventory.md 的「取消」列）。
 *   保留的是站点级 meta 与站点级 sitemap 条目。
 */

import type { ConfigDefinition } from "../config.types.js";

/** sitemap 的 changefreq 合法取值 */
const CHANGEFREQ_OPTIONS = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

export const SEO_CONFIGS = {
  "site.seo.enabled": {
    category: "SITE",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "启用 SEO 输出",
    description: "关闭后 robots.txt 变为全站禁止收录，且不再输出 sitemap。",
  },
  "site.seo.siteName": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "BaoOnly",
    label: "站点名称",
    description: "出现在 <title> 尾部与结构化数据里。",
    constraints: { minLength: 1, maxLength: 60 },
  },
  "site.seo.homeTitle": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "BaoOnly - 蔚蓝档案 ONLY / BAO 同人展查询",
    label: "首页标题",
    description: "搜索结果里显示的首页标题，建议不超过 60 字。",
    constraints: { minLength: 1, maxLength: 120 },
  },
  "site.seo.homeDescription": {
    category: "SITE",
    valueType: "TEXT",
    defaultValue:
      "BaoOnly 提供蔚蓝档案 ONLY、BAO 同人展活动查询，支持按城市、时间、票价和标签浏览场次信息。",
    label: "首页描述",
    description: "搜索结果摘要，建议 80~160 字。",
    constraints: { maxLength: 320 },
  },
  "site.seo.keywords": {
    category: "SITE",
    valueType: "TEXT",
    defaultValue:
      "蔚蓝档案ONLY,BAO,BA only,蔚蓝档案同人展,蓝档only,BaoOnly,bao,蔚蓝档案,碧蓝档案,bluearchive",
    label: "关键词",
    description: "逗号分隔。现代搜索引擎权重极低，保留主要为兼容。",
    constraints: { maxLength: 500 },
  },
  "site.seo.mapTitle": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "全国 BAO 地图 - 蔚蓝档案 ONLY 场次地图 | BaoOnly",
    label: "地图页标题",
    constraints: { maxLength: 120 },
  },
  "site.seo.mapDescription": {
    category: "SITE",
    valueType: "TEXT",
    defaultValue:
      "BaoOnly 全国 BAO 地图按城市展示蔚蓝档案 ONLY / BAO 同人展场次，方便快速查看附近活动。",
    label: "地图页描述",
    constraints: { maxLength: 320 },
  },
  "site.seo.defaultImage": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "/placeholder.svg",
    label: "默认社交分享图",
    description: "og:image 的兜底图片，可填站内相对路径或完整 URL。",
    constraints: { maxLength: 300 },
  },
  "site.seo.robotsMeta": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "index,follow",
    label: "robots meta 指令",
    description: "写入页面 <meta name=\"robots\">。",
    constraints: {
      options: [
        "index,follow",
        "index,nofollow",
        "noindex,follow",
        "noindex,nofollow",
      ],
    },
  },
  "site.seo.robotsTxt": {
    category: "SITE",
    valueType: "TEXT",
    defaultValue:
      "User-agent: *\nAllow: /\nDisallow: /api/\n",
    label: "robots.txt 内容",
    description:
      "直接作为 /robots.txt 返回。Sitemap 行会自动追加，不用手写。",
    constraints: { maxLength: 4000 },
  },

  // ── sitemap ─────────────────────────────────────────────────────
  "site.seo.sitemap.enabled": {
    category: "SITE",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "输出 sitemap.xml",
  },
  "site.seo.sitemap.includeHome": {
    category: "SITE",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "sitemap 收录首页",
  },
  "site.seo.sitemap.includeMap": {
    category: "SITE",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "sitemap 收录地图页",
  },
  "site.seo.sitemap.homeChangefreq": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "hourly",
    label: "首页更新频率",
    constraints: { options: CHANGEFREQ_OPTIONS },
  },
  "site.seo.sitemap.mapChangefreq": {
    category: "SITE",
    valueType: "STRING",
    defaultValue: "hourly",
    label: "地图页更新频率",
    constraints: { options: CHANGEFREQ_OPTIONS },
  },
  "site.seo.sitemap.homePriority": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 1,
    label: "首页优先级",
    description: "sitemap 的 priority，0~1。",
    constraints: { min: 0, max: 1, step: 0.1 },
  },
  "site.seo.sitemap.mapPriority": {
    category: "SITE",
    valueType: "NUMBER",
    defaultValue: 0.8,
    label: "地图页优先级",
    constraints: { min: 0, max: 1, step: 0.1 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
