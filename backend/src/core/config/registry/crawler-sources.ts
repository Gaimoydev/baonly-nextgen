/**
 * 配置清单 · CRAWLER / 三个源的接口地址与并发
 *
 * 这些 URL 上一代全在 `.env` 里。它们**必须**可热改：
 * 源站换接口路径、加版本号参数、调整分页参数时，改配置就能恢复抓取，不用发版。
 *
 * 占位符约定（沿用上一代，解析器按此替换）：
 *   `{id}`   源站记录 ID
 *   `{page}` 页码
 *   `{hash}` dlcomic 图片哈希
 * 因此这些项的 valueType 是 STRING 而非某种「URL」类型 —— 带占位符的串
 * 不是合法 URL，任何 URL 校验器都会拒绝它。校验只做「以 http(s):// 开头」。
 *
 * baonlytime 源不在此清单：上一代已把它硬禁用（DISABLED_REFRESH_SOURCES），
 * nextgen 只做 bilibili / dlcomic / cpp 三源。详见 docs/config-inventory.md。
 */

import type { ConfigDefinition } from "../config.types.js";

/** 允许带 {} 占位符的 http(s) 地址 */
const URL_TEMPLATE_PATTERN = "^https?://\\S+$";

export const CRAWLER_SOURCE_CONFIGS = {
  // ── bilibili 会展 ───────────────────────────────────────────────
  "crawler.bilibili.searchUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://show.bilibili.com/api/ticket/search/list?version=134&keyword=%E8%94%9A%E8%93%9D%E6%A1%A3%E6%A1%88&pagesize=20&page={page}&platform=web",
    label: "bilibili 搜索接口",
    description: "分页搜索接口，{page} 会被替换为页码。keyword 已 URL 编码。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 600 },
  },
  "crawler.bilibili.detailUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://show.bilibili.com/api/ticket/project/getV2?version=134&id={id}&project_id={id}&requestSource=pc-new",
    label: "bilibili 详情接口",
    description: "{id} 会被替换为项目 ID。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 600 },
  },
  "crawler.bilibili.webDetailUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://show.bilibili.com/platform/detail.html?id={id}",
    label: "bilibili PC 购票页",
    description: "写入活动的 PC 端购票链接。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.bilibili.mobileDetailUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://mall.bilibili.com/neul-next/ticket-renovation/detail.html?id={id}&noTitleBar=1",
    label: "bilibili 移动端购票页",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.bilibili.refererUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://show.bilibili.com/",
    label: "bilibili Referer",
    description: "请求头 Referer。源站校验来源时必须与之匹配。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },
  "crawler.bilibili.searchMaxPages": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 80,
    label: "bilibili 搜索最大翻页数",
    description: "硬上限，防止源站分页异常时无限翻页。",
    constraints: { min: 1, max: 500, step: 1 },
  },
  "crawler.bilibili.searchStagnantPages": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 5,
    label: "bilibili 连续无新增即停页数",
    description: "连续这么多页都没有新记录就提前结束翻页。",
    constraints: { min: 1, max: 50, step: 1 },
  },
  "crawler.bilibili.detailConcurrency": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 2,
    label: "bilibili 详情并发数",
    description: "同时拉取几个详情页。调大更快但更容易被限流。",
    constraints: { min: 1, max: 16, step: 1 },
  },

  // ── dlcomic 叮铃铃 ──────────────────────────────────────────────
  "crawler.dlcomic.eventsUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://dlcomic.com/api/v1/events?before=end&search=&subject_type=4&include_pending=true&include_cancelled=true",
    label: "dlcomic 列表接口",
    description: "一次返回全量，无需翻页。subject_type=4 是同人展类目。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 600 },
  },
  "crawler.dlcomic.detailUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://dlcomic.com/api/v1/events/{id}",
    label: "dlcomic 详情接口",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.dlcomic.imageUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://dlcomic.com/api/v1/images/{hash}?format=webp&q=60&size=s",
    label: "dlcomic 图片地址",
    description: "{hash} 为图片哈希。参数控制格式与尺寸。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.dlcomic.webEventUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://dlcomic.com/events/{id}",
    label: "dlcomic 活动页",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.dlcomic.refererUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://dlcomic.com/",
    label: "dlcomic Referer",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },

  // ── allcpp（CPP）需登录态，账号密码在 .env ─────────────────────
  "crawler.cpp.loginUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://user.allcpp.cn/api/login/normal",
    label: "CPP 登录接口",
    description: "账号密码来自环境变量 CPP_ACCOUNT / CPP_PASSWORD，不入库。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.cpp.authCheckUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://user.allcpp.cn/rest/my",
    label: "CPP 登录态校验接口",
    description: "抓取前先用它确认 Cookie 还有效，失效则重新登录。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.cpp.webOrigin": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://www.allcpp.cn",
    label: "CPP 站点 Origin",
    description: "不含结尾斜杠。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },
  "crawler.cpp.userOrigin": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://user.allcpp.cn",
    label: "CPP 用户中心 Origin",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },
  "crawler.cpp.eventsUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue:
      "https://www.allcpp.cn/allcpp/event/eventMainListV2.do?&keyword=%E8%94%9A%E8%93%9D%E6%A1%A3%E6%A1%88&pageNo=1&pageSize=9178",
    label: "CPP 列表接口",
    description: "pageSize 给得极大以一次取全；源站若加了上限需相应调小。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 600 },
  },
  "crawler.cpp.detailUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://www.allcpp.cn/allcpp/event/event.do?event={id}",
    label: "CPP 详情接口",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 400 },
  },
  "crawler.cpp.imageBaseUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://imagecdn3.allcpp.cn/upload/",
    label: "CPP 图片基址",
    description: "图片相对路径的前缀，需以斜杠结尾。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },
  "crawler.cpp.detailRetries": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 3,
    label: "CPP 详情重试次数",
    constraints: { min: 0, max: 10, step: 1 },
  },
  "crawler.cpp.detailConcurrency": {
    category: "CRAWLER",
    valueType: "NUMBER",
    defaultValue: 2,
    label: "CPP 详情并发数",
    constraints: { min: 1, max: 16, step: 1 },
  },
  "crawler.nyanket.refererUrl": {
    category: "CRAWLER",
    valueType: "STRING",
    defaultValue: "https://www.nyanket.cn/",
    label: "nyanket Referer",
    description:
      "部分 CPP 活动的图片托管在 nyanket，取图时需带此 Referer 才不被拒。",
    constraints: { pattern: URL_TEMPLATE_PATTERN, maxLength: 300 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
