/**
 * 配置清单 · NOTIFICATION（WxPusher 推送 / 消息模板）
 *
 * `WXPUSHER_APP_TOKEN` 是凭据，留在 `.env`，**不在本清单**。
 * 收件人（uids / topicIds）不算凭据 —— 它们是运营要频繁增删的名单，进数据库。
 *
 * 模板项用 TEMPLATE 类型，后台可以给出可插入的变量提示。
 * 变量以 `{name}` 形式书写；渲染时未提供的变量替换为空串而非报错
 * （运营写错变量名不该让推送整条失败）。
 */

import type { ConfigDefinition } from "../config.types.js";

export const NOTIFICATION_CONFIGS = {
  // ── 通道开关与端点 ──────────────────────────────────────────────
  "notification.wxpusher.enabled": {
    category: "NOTIFICATION",
    valueType: "BOOLEAN",
    defaultValue: false,
    label: "启用 WxPusher 推送",
    description: "需先在 .env 配好 WXPUSHER_APP_TOKEN，否则开了也发不出。",
  },
  "notification.wxpusher.sendUrl": {
    category: "NOTIFICATION",
    valueType: "STRING",
    defaultValue: "https://wxpusher.zjiecode.com/api/send/message",
    label: "WxPusher 发送接口",
    constraints: { pattern: "^https?://\\S+$", maxLength: 400 },
  },
  "notification.wxpusher.usersUrl": {
    category: "NOTIFICATION",
    valueType: "STRING",
    defaultValue: "https://wxpusher.zjiecode.com/api/fun/wxuser/v2",
    label: "WxPusher 用户列表接口",
    description: "用于自动发现已关注的收件人。",
    constraints: { pattern: "^https?://\\S+$", maxLength: 400 },
  },

  // ── 收件人 ──────────────────────────────────────────────────────
  "notification.wxpusher.uids": {
    category: "NOTIFICATION",
    valueType: "STRING_LIST",
    defaultValue: [] as readonly string[],
    label: "收件人 UID",
    description: "定向推送的用户 UID 列表。与「主题」二者至少配一个才能收到消息。",
    constraints: { maxItems: 200 },
  },
  "notification.wxpusher.topicIds": {
    category: "NOTIFICATION",
    valueType: "STRING_LIST",
    defaultValue: [] as readonly string[],
    label: "推送主题 ID",
    description: "按主题群发。订阅了该主题的用户都会收到。",
    constraints: { maxItems: 50, pattern: "^[0-9]+$" },
  },
  "notification.wxpusher.autoDiscoverUsers": {
    category: "NOTIFICATION",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "自动发现收件人",
    description: "开启后会把所有已关注应用的用户加入收件范围，无需手工维护 UID。",
  },

  // ── 节流与去重 ──────────────────────────────────────────────────
  "notification.wxpusher.timeoutMs": {
    category: "NOTIFICATION",
    valueType: "DURATION_MS",
    defaultValue: 8000,
    label: "推送请求超时",
    constraints: { min: 1000, max: 60_000, step: 500 },
  },
  "notification.wxpusher.minIntervalMs": {
    category: "NOTIFICATION",
    valueType: "DURATION_MS",
    defaultValue: 1500,
    label: "推送最小间隔",
    description: "两条消息之间强制等待（毫秒），避开服务方的频率限制。",
    constraints: { min: 0, max: 60_000, step: 100 },
  },
  "notification.wxpusher.dedupeWindowMs": {
    category: "NOTIFICATION",
    valueType: "DURATION_MS",
    defaultValue: 60_000,
    label: "重复消息抑制窗口",
    description:
      "同一条内容在此窗口内只发一次（毫秒）。防止爬虫连续失败时刷屏。",
    constraints: { min: 0, max: 3_600_000, step: 1000 },
  },

  // ── 通知总开关（按事件类型）──────────────────────────────────────
  "notification.events.adminMutation": {
    category: "NOTIFICATION",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "推送后台改动",
    description: "有人在后台修改数据时通知。多人协作时有用，单人运维可关。",
  },
  "notification.events.crawlerFailure": {
    category: "NOTIFICATION",
    valueType: "BOOLEAN",
    defaultValue: true,
    label: "推送抓取失败",
    description: "某个源抓取失败时通知。建议保持开启。",
  },
  "notification.events.newEvent": {
    category: "NOTIFICATION",
    valueType: "BOOLEAN",
    defaultValue: false,
    label: "推送新活动",
    description: "抓到新活动时通知。活动多时会比较吵。",
  },

  // ── 消息模板 ────────────────────────────────────────────────────
  "notification.template.eventDayBefore": {
    category: "NOTIFICATION",
    valueType: "TEMPLATE",
    defaultValue: "你感兴趣的活动 {title} 将于明天开始，时间 {startAt}",
    label: "开展前一天提醒",
    description: "可用变量：{title} {startAt} {venueName} {cityName}",
    constraints: { maxLength: 500 },
  },
  "notification.template.eventStart": {
    category: "NOTIFICATION",
    valueType: "TEMPLATE",
    defaultValue: "{title} 已开始，地点 {venueName}",
    label: "开展当天提醒",
    description: "可用变量：{title} {startAt} {venueName} {cityName}",
    constraints: { maxLength: 500 },
  },
  "notification.template.ticketAvailable": {
    category: "NOTIFICATION",
    valueType: "TEMPLATE",
    defaultValue: "{title} 的票务状态有更新：{ticketName} {ticketStatus}",
    label: "票务状态变更",
    description: "可用变量：{title} {ticketName} {ticketStatus} {priceLabel}",
    constraints: { maxLength: 500 },
  },
  "notification.template.crawlerFailure": {
    category: "NOTIFICATION",
    valueType: "TEMPLATE",
    defaultValue: "[BaoOnly] 源 {sourceKey} 抓取失败：{errorMessage}",
    label: "抓取失败告警",
    description: "可用变量：{sourceKey} {errorMessage} {startedAt} {fetched}",
    constraints: { maxLength: 500 },
  },
  "notification.template.adminMutation": {
    category: "NOTIFICATION",
    valueType: "TEMPLATE",
    defaultValue: "[BaoOnly] {actor} 执行了 {action}：{summary}",
    label: "后台改动通知",
    description: "可用变量：{actor} {action} {summary} {at}",
    constraints: { maxLength: 500 },
  },
} as const satisfies Readonly<Record<string, ConfigDefinition>>;
