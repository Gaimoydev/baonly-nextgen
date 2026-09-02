/**
 * AppConfig 种子 —— 把上一代散落在 .env 里的 150+ 个配置项收进数据库。
 *
 * 判断标准（决定一项该进 .env 还是这里）：
 *   进 .env    运行时必需且无法自举（DATABASE_URL / REDIS_URL / PORT）
 *              或极敏感凭据（CPP 账号密码 / WxPusher token / SCDN token）
 *   进这里     其余全部 —— 只要是"运营可能想调"或"调了不该重新部署"的
 *
 * 每项都带 category / valueType / label / description / constraints，
 * 后台配置页据此**自动生成表单**，加配置项不需要改前端代码。
 *
 * 执行：pnpm --filter @baonly/backend exec tsx prisma/seed-config.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ConfigCategory, ConfigValueType } from "@prisma/client";
import "dotenv/config";

type Seed = {
  key: string;
  category: ConfigCategory;
  valueType: ConfigValueType;
  value: unknown;
  label: string;
  description?: string;
  constraints?: Record<string, unknown>;
  isSecret?: boolean;
  requiresRestart?: boolean;
};

const seeds: Seed[] = [
  // ══════════════════════════════ 爬虫 ══════════════════════════════
  {
    key: "crawler.schedule.cron",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.CRON,
    value: "0 0,12 * * *",
    label: "爬虫运行计划",
    description: "上一代固定为每天 00:00 和 12:00（Asia/Shanghai）"
  },
  {
    key: "crawler.retries",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 2,
    label: "源抓取重试次数",
    constraints: { min: 0, max: 10 }
  },
  {
    key: "crawler.retryDelayMs",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.DURATION_MS,
    value: 3000,
    label: "重试间隔",
    constraints: { min: 500, max: 60000 }
  },
  {
    key: "crawler.fetchTimeoutMs",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.DURATION_MS,
    value: 15000,
    label: "单次请求超时",
    description: "上一代没有 per-request 超时（RISKS.md B4），是已知缺陷，新实现必须有",
    constraints: { min: 1000, max: 120000 }
  },
  {
    key: "crawler.sourceRemovalConfirmations",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 2,
    label: "源端下架确认次数",
    description: "连续几次抓取都不出现才判定为下架，用于区分「真下架」和「本次抓取失败」",
    constraints: { min: 1, max: 10 }
  },
  {
    key: "crawler.bilibili.maxPages",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 20,
    label: "B站 搜索最大翻页数",
    constraints: { min: 1, max: 100 }
  },
  {
    key: "crawler.bilibili.stagnantPages",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 3,
    label: "B站 连续无新增页数后停止",
    constraints: { min: 1, max: 20 }
  },
  {
    key: "crawler.bilibili.detailConcurrency",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 4,
    label: "B站 详情抓取并发",
    constraints: { min: 1, max: 16 }
  },
  {
    key: "crawler.cpp.detailConcurrency",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 4,
    label: "CPP 详情抓取并发",
    constraints: { min: 1, max: 16 }
  },
  {
    key: "crawler.cpp.detailRetries",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.NUMBER,
    value: 2,
    label: "CPP 详情重试次数",
    constraints: { min: 0, max: 10 }
  },
  {
    key: "crawler.userAgent",
    category: ConfigCategory.CRAWLER,
    valueType: ConfigValueType.STRING,
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    label: "爬虫 User-Agent",
    description: "对方站点更新反爬策略时可能需要调整"
  },

  // ══════════════════════════════ 判同 ══════════════════════════════
  // ★ 上一代这些是硬编码在 11k 行文件里的魔法数字，改一次要发版。
  //   提到配置里，运营可以直接调合并松紧并在审查台观察效果。
  {
    key: "matching.titleScoreThreshold",
    category: ConfigCategory.MATCHING,
    valueType: ConfigValueType.NUMBER,
    value: 0.34,
    label: "标题相似度阈值",
    description: "旧实现的经验值。调低=更容易合并（可能误并），调高=更保守（可能漏并）",
    constraints: { min: 0, max: 1, step: 0.01 }
  },
  {
    key: "matching.scheduleScoreThreshold",
    category: ConfigCategory.MATCHING,
    valueType: ConfigValueType.NUMBER,
    value: 0.2,
    label: "时间匹配阈值",
    constraints: { min: 0, max: 1, step: 0.01 }
  },
  {
    key: "matching.totalScoreThreshold",
    category: ConfigCategory.MATCHING,
    valueType: ConfigValueType.NUMBER,
    value: 0.6,
    label: "综合判同阈值",
    constraints: { min: 0, max: 2, step: 0.01 }
  },
  {
    key: "matching.venueConflictMinLength",
    category: ConfigCategory.MATCHING,
    valueType: ConfigValueType.NUMBER,
    value: 3,
    label: "场馆冲突判定的最小字数",
    description: "场馆名归一化后至少这么长才算「写明了具体场馆」，避免「上海 普陀」这类区级文本触发冲突",
    constraints: { min: 1, max: 10 }
  },
  {
    key: "matching.degenerateTitleMinLength",
    category: ConfigCategory.MATCHING,
    valueType: ConfigValueType.NUMBER,
    value: 2,
    label: "退化标题的内核最小长度",
    description:
      "标题去掉城市名后剩余内核短于此值即视为「退化标题」，不得用子串匹配判同。防止「上海·蔚蓝档案同人only·」命中同城所有场次",
    constraints: { min: 1, max: 10 }
  },

  // ══════════════════════════════ 图片 ══════════════════════════════
  {
    key: "image.compressMaxDimension",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.NUMBER,
    value: 1920,
    label: "压缩后最大边长(px)",
    constraints: { min: 320, max: 4096 }
  },
  {
    key: "image.compressQuality",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.NUMBER,
    value: 82,
    label: "WebP 压缩质量",
    constraints: { min: 40, max: 100 }
  },
  {
    key: "image.uploadMaxBytes",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.NUMBER,
    value: 10485760,
    label: "后台上传单文件上限(字节)",
    constraints: { min: 102400, max: 104857600 }
  },
  {
    key: "image.proxyMaxBytes",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.NUMBER,
    value: 20971520,
    label: "图片代理抓取上限(字节)",
    constraints: { min: 102400, max: 104857600 }
  },
  {
    key: "image.proxyTimeoutMs",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.DURATION_MS,
    value: 15000,
    label: "图片代理超时",
    constraints: { min: 1000, max: 60000 }
  },
  {
    key: "image.proxyAllowedHosts",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.JSON,
    value: [],
    label: "图片代理允许的域名",
    description:
      "★ 安全项：上一代只校验域名不校验解析后的 IP，存在 SSRF 缺口（RISKS.md A3）。新实现必须同时校验解析 IP 并锁定 socket"
  },
  {
    key: "image.cleanupCron",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.CRON,
    value: "30 3 * * *",
    label: "图片缓存清理计划"
  },
  {
    key: "image.cacheMaxAgeDays",
    category: ConfigCategory.IMAGE,
    valueType: ConfigValueType.NUMBER,
    value: 90,
    label: "图片缓存保留天数",
    constraints: { min: 1, max: 3650 }
  },

  // ══════════════════════════════ CDN ══════════════════════════════
  {
    key: "cdn.provider",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.STRING,
    value: "scdn",
    label: "图床提供商"
  },
  {
    key: "cdn.cfDomain",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.STRING,
    value: "",
    label: "Cloudflare 线路域名"
  },
  {
    key: "cdn.esaDomain",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.STRING,
    value: "",
    label: "阿里云 ESA 线路域名"
  },
  {
    key: "cdn.routeStrategy",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.STRING,
    value: "client-measured",
    label: "双线路选路策略",
    description: "client-measured=客户端测速选路（上一代行为）；cf-only / esa-only 强制单线",
    constraints: { options: ["client-measured", "cf-only", "esa-only"] }
  },
  {
    key: "cdn.keepaliveEnabled",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.BOOLEAN,
    value: true,
    label: "图床保活开启"
  },
  {
    key: "cdn.keepaliveIntervalHours",
    category: ConfigCategory.CDN,
    valueType: ConfigValueType.NUMBER,
    value: 12,
    label: "保活间隔(小时)",
    constraints: { min: 1, max: 168 }
  },

  // ══════════════════════════════ 分析 ══════════════════════════════
  {
    key: "analytics.maintenanceCron",
    category: ConfigCategory.ANALYTICS,
    valueType: ConfigValueType.CRON,
    value: "25 3 * * *",
    label: "分析数据维护计划"
  },
  {
    key: "analytics.detailRetentionDays",
    category: ConfigCategory.ANALYTICS,
    valueType: ConfigValueType.NUMBER,
    value: 30,
    label: "明细数据保留天数",
    description:
      "★ 上一代明细积累到 66 万行、占数据库 581MB 的 99%。超期明细清理后，趋势分析靠日聚合表",
    constraints: { min: 1, max: 365 }
  },
  {
    key: "analytics.accessSampleRate",
    category: ConfigCategory.ANALYTICS,
    valueType: ConfigValueType.NUMBER,
    value: 1,
    label: "访问日志采样率",
    constraints: { min: 0, max: 1, step: 0.01 }
  },
  {
    key: "analytics.publicSampleRate",
    category: ConfigCategory.ANALYTICS,
    valueType: ConfigValueType.NUMBER,
    value: 1,
    label: "公共事件采样率",
    constraints: { min: 0, max: 1, step: 0.01 }
  },
  {
    key: "analytics.geoLookupEnabled",
    category: ConfigCategory.ANALYTICS,
    valueType: ConfigValueType.BOOLEAN,
    value: true,
    label: "IP 地理查询开启",
    description: "关闭后地域热力图不再更新（已缓存的仍可用）"
  },

  // ══════════════════════════════ 限流 ══════════════════════════════
  {
    key: "rateLimit.public.windowMs",
    category: ConfigCategory.RATE_LIMIT,
    valueType: ConfigValueType.DURATION_MS,
    value: 60000,
    label: "公共接口限流窗口",
    constraints: { min: 1000, max: 3600000 }
  },
  {
    key: "rateLimit.public.max",
    category: ConfigCategory.RATE_LIMIT,
    valueType: ConfigValueType.NUMBER,
    value: 120,
    label: "公共接口窗口内请求上限",
    constraints: { min: 1, max: 10000 }
  },
  {
    key: "rateLimit.export.windowMs",
    category: ConfigCategory.RATE_LIMIT,
    valueType: ConfigValueType.DURATION_MS,
    value: 300000,
    label: "导出接口限流窗口",
    description: "导出是批量数据出口，应比普通接口严格得多",
    constraints: { min: 1000, max: 3600000 }
  },
  {
    key: "rateLimit.export.max",
    category: ConfigCategory.RATE_LIMIT,
    valueType: ConfigValueType.NUMBER,
    value: 5,
    label: "导出接口窗口内上限",
    constraints: { min: 1, max: 1000 }
  },

  // ══════════════════════════════ 安全 ══════════════════════════════
  {
    key: "security.adminSessionTtlHours",
    category: ConfigCategory.SECURITY,
    valueType: ConfigValueType.NUMBER,
    value: 36,
    label: "后台会话有效期(小时)",
    constraints: { min: 1, max: 720 }
  },
  {
    key: "security.changeNoticeWindowDays",
    category: ConfigCategory.SECURITY,
    valueType: ConfigValueType.NUMBER,
    value: 14,
    label: "变更通知展示窗口(天)",
    description: "活动的时间/地点变更在前台提示多少天",
    constraints: { min: 1, max: 180 }
  },

  // ══════════════════════════════ 通知 ══════════════════════════════
  {
    key: "notification.template.eventDayBefore",
    category: ConfigCategory.NOTIFICATION,
    valueType: ConfigValueType.TEMPLATE,
    value: "「{title}」明天开始啦！{startAt} · {venueName}",
    label: "活动前一天提醒模板",
    description: "可用变量：{title} {startAt} {venueName}"
  },
  {
    key: "notification.template.eventStart",
    category: ConfigCategory.NOTIFICATION,
    valueType: ConfigValueType.TEMPLATE,
    value: "「{title}」已经开始！{venueName}",
    label: "活动开始提醒模板",
    description: "可用变量：{title} {startAt} {venueName}"
  },
  {
    key: "notification.template.ticketAvailable",
    category: ConfigCategory.NOTIFICATION,
    valueType: ConfigValueType.TEMPLATE,
    value: "「{title}」的{ticketName}开售了！",
    label: "票档开售提醒模板",
    description: "可用变量：{title} {ticketName} {ticketStatus}"
  },
  {
    key: "notification.wxpusher.enabled",
    category: ConfigCategory.NOTIFICATION,
    valueType: ConfigValueType.BOOLEAN,
    value: false,
    label: "WxPusher 推送开启"
  },
  {
    key: "notification.wxpusher.minIntervalMs",
    category: ConfigCategory.NOTIFICATION,
    valueType: ConfigValueType.DURATION_MS,
    value: 3000,
    label: "WxPusher 最小发送间隔",
    constraints: { min: 0, max: 600000 }
  },

  // ══════════════════════════════ 站点 ══════════════════════════════
  {
    key: "site.name",
    category: ConfigCategory.SITE,
    valueType: ConfigValueType.STRING,
    value: "BAONLY",
    label: "站点名称"
  },
  {
    key: "site.seo.homeTitle",
    category: ConfigCategory.SITE,
    valueType: ConfigValueType.STRING,
    value: "BAONLY - 蔚蓝档案同人展会查询站",
    label: "首页标题"
  },
  {
    key: "site.seo.homeDescription",
    category: ConfigCategory.SITE,
    valueType: ConfigValueType.TEXT,
    value:
      "BAONLY 提供蔚蓝档案 ONLY / BAO 同人展活动查询，支持按城市、时间、票价和标签浏览全国场次信息。",
    label: "首页描述",
    description: "只做站点级 SEO —— 展会数据不进 HTML，sitemap 也不列 /event/:id"
  },
  {
    key: "site.seo.keywords",
    category: ConfigCategory.SITE,
    valueType: ConfigValueType.STRING,
    value: "蔚蓝档案ONLY,BAO,BA only,蔚蓝档案同人展,BaoOnly,碧蓝档案,bluearchive",
    label: "关键词"
  },
  {
    key: "site.publicPageSizeOptions",
    category: ConfigCategory.SITE,
    valueType: ConfigValueType.JSON,
    value: [4, 6, 10, 20, 50],
    label: "前台可选每页条数"
  }
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let skipped = 0;
  for (const s of seeds) {
    // 幂等：已存在的不覆盖运营改过的值，只补 defaultValue 和元数据
    const existing = await prisma.appConfig.findUnique({ where: { key: s.key } });
    if (existing) {
      await prisma.appConfig.update({
        where: { key: s.key },
        data: {
          category: s.category,
          valueType: s.valueType,
          defaultValue: s.value as never,
          label: s.label,
          description: s.description ?? null,
          constraints: (s.constraints ?? null) as never,
          isSecret: s.isSecret ?? false,
          requiresRestart: s.requiresRestart ?? false
        }
      });
      skipped += 1;
      continue;
    }
    await prisma.appConfig.create({
      data: {
        key: s.key,
        category: s.category,
        valueType: s.valueType,
        value: s.value as never,
        defaultValue: s.value as never,
        label: s.label,
        description: s.description ?? null,
        constraints: (s.constraints ?? null) as never,
        isSecret: s.isSecret ?? false,
        requiresRestart: s.requiresRestart ?? false,
        sortOrder: created
      }
    });
    created += 1;
  }

  console.log(`AppConfig 种子完成：新建 ${created} 项，更新元数据 ${skipped} 项`);
  const byCategory = await prisma.appConfig.groupBy({
    by: ["category"],
    _count: true
  });
  for (const g of byCategory) console.log(`  ${g.category.padEnd(14)} ${g._count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
