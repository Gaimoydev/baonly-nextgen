# BAOnly Nextgen — 阶段计划

> **总目标**:功能与上一代(`baonly_web`)**完全一致**,架构 / 代码 / UI **全新**,旧代码零带入。
> **总约束**:开发期旧系统必须持续运行(活动数据每天在变,用户在用),不存在停机窗口。

## 技术栈定稿(实测锁定版本,2026-09-03)

```
── backend ──────────────────────────────────────────
NestJS              11.2.3      @nestjs/swagger 11.4.7 · schedule 5.0.1
                                throttler 6.5.0 · config 4.0.4
Prisma              7.10.0      + @prisma/adapter-pg 7.10.0 · pg 8.23.0
Redis 客户端         ioredis 6.0.0
校验                 class-validator 0.15.1 + class-transformer
图片                 sharp 0.35.4        爬虫解析 cheerio 1.2.0
TypeScript          5.9.3       测试 vitest 4.1.11
两个入口             main.ts(API) / worker.ts(cron + 爬虫 + sharp + SCDN)

── frontend/client ──────────────────────────────────
React 19.2.8 · Vite 8.2.2 · TypeScript 5.9.3
HeroUI              3.2.4       Tailwind 4.3.3(HeroUI 3 强制要求 >=4)
framer-motion       13.1.1      lucide-react 1.39.0
React Router        8.3.1       TanStack Query 5.102.8
React Hook Form     7.87.0      Zod 4.5.4 · Sonner 2.0.8 · ECharts 6.1.0

── frontend/dashboard ───────────────────────────────
React 19.2.8 · Vite 8.2.2 · TypeScript 5.9.3
Ant Design          6.6.2       @ant-design/icons 6.3.4
React Router        8.3.1       TanStack Query 5.102.8
ECharts             6.1.0       dayjs

── root ─────────────────────────────────────────────
pnpm 11.25.0 · ESLint 10.9.1 · typescript-eslint 8.69.0
dependency-cruiser 18.2.0 · prettier 3.9.6 · openapi-typescript 7.13.0

契约    OpenAPI → openapi-typescript 生成前端类型(零手写)
测试    Vitest(判同算法 / API 契约) + Playwright(UI 回归)
不做    应用层加密通道 · 内容级 SEO · Refine · BullMQ
```

`pnpm peers check` → **No peer dependency issues found**;`prisma validate` → **29 张表全部合法**。

### 版本锁定决策(别随手升级)

| 决策 | 理由 |
|---|---|
| **NestJS 锁 11,不用 12** | `@nestjs/throttler@6.5.0` 的 peer 只到 `^11`,装 12 会 unmet。更重要的是 **AI 训练资料里 NestJS 11/10 远多于 12**,用 12 会增加 AI 出错概率,与"用成熟框架约束 AI"的目标相悖 |
| **TypeScript 锁 5.9,拒绝 7.x** | TS 7 是 Go 重写的原生编译器,刚发布。NestJS 用 `tsc` 编译且重度依赖装饰器元数据,typescript-eslint 8 对 TS 7 的支持也未验证。稳定优先 |
| **@types/node 锁 22** | 默认装到 26,但运行时是 Node 22.13.1,类型必须匹配运行时 |
| **Prisma 锁 7.10,不用 8.0-rc** | 8.0 尚是 release candidate,不适合作为新项目地基 |
| **不装 cache-manager 三件套** | `cache-manager-redis-yet` 已 deprecated(cache-manager v7 改为基于 Keyv)。我们的需求(session/限流/presence/缓存)用 **ioredis 直接操作**更直接可控,少一层抽象和版本不确定性 |
| **AntD 6 不需要 React 19 补丁** | `@ant-design/v5-patch-for-react-19` 是**专为 AntD 5** 补 `ReactDOM.render` 的。AntD 6 peer 为 `react>=18`,原生支持 19,`config-provider` 内无 `ReactDOM.render` 痕迹。已移除该 patch |
| **Tailwind 必须 4.x** | HeroUI 3 的 peer 明确要求 `tailwindcss>=4.0.0`,走 CSS-first 配置 + `@tailwindcss/vite` 插件,**不再需要 postcss/autoprefixer** |
| **@scarf/scarf 禁止执行安装脚本** | 遥测收集包,`pnpm-workspace.yaml` 里已设 `false`;`prisma`/`@prisma/engines`/`sharp` 则**必须**允许(要下载原生二进制) |

### Prisma 7 的破坏性变更(已处理)

`datasource.url` **不能再写在 schema.prisma 里**,必须移到 `prisma.config.ts`:

- schema 的 `datasource db` 只保留 `provider`
- `backend/prisma.config.ts` 用 `defineConfig` 提供 `datasource.url`(给 Migrate)
- 环境变量**不自动加载**,配置文件首行需 `import "dotenv/config"`
- 用 `process.env.DATABASE_URL!` 而非 `env()` 助手——后者在变量缺失时抛错,会让不需要数据库的命令(`generate`/`validate`)也失败
- config 里的 `adapter` 属性在 v7 **已移除**(迁移自动处理);运行时连接仍需在 `new PrismaClient({ adapter })` 注入 `@prisma/adapter-pg`

## 阶段依赖图

```
阶段 0 轨道
   ↓
阶段 1 数据迁移 ──┐
   ↓              │
阶段 2 核心资产 + 验收基准
   ↓
   ├── 阶段 3 backend API ──┐
   └── 阶段 4 backend worker┤   (3、4 可并行)
                            ↓
   ├── 阶段 5 dashboard ────┐
   └── 阶段 6 client ───────┤   (5、6 可并行,建议先 5)
                            ↓
                      阶段 7 切流上线
```

---

## 阶段 0 · 轨道

**目标**:铺好约束,让后续每一次 AI 改动都在轨道内。**约束是追溯不了的**——等 `client/` 里有 30 个页面了再上 `no-inline-styles`,就是几百个 lint 错误和一次大返工。

| 产出 | 状态 |
|---|---|
| `CLAUDE.md` 规范式(硬约束 / import 边界 / 继承教训 / 明确不做的事) | ✓ 完成 |
| `pnpm-workspace.yaml` · 根 `package.json` · `.gitignore` | ✓ 完成 |
| `backend/prisma/schema.prisma` 29 张表 | ✓ 完成 |
| 依赖安装 + **4 项兼容性验证** | 待做 |
| 三个 `tsconfig.json`(strict) + 两个 `vite.config.ts` + `nest-cli.json` | 待做 |
| `eslint.config.mjs` + `.dependency-cruiser.cjs` | 待做 |
| 设计 token 单一来源 → Tailwind/HeroUI theme + AntD theme token 双接入 | 待做 |
| 各层 `README.md`(告诉 AI 什么该放这里) | 待做 |
| PostgreSQL + Redis 起来 · `prisma migrate dev` 建库 | 待做 |

**必须验证的 4 项兼容性**(已知踩坑点,装完立刻验,别等写了几十个页面):

1. **AntD 5 + React 19** — 需要 `@ant-design/v5-patch-for-react-19`
2. **HeroUI + Tailwind 版本** — HeroUI 2.x 主要针对 Tailwind 3;Tailwind 4 是 CSS-first 配置。不兼容就锁 Tailwind 3
3. **HeroUI + React 19** — 底层 React Aria 支持良好,HeroUI 自身要确认
4. **NestJS 11 + Node 22** — NestJS 11 用 Express 5

**验收**:`pnpm lint && pnpm typecheck` 全绿;三个空壳应用能启动;**故意违反一条硬约束(如写个 401 行的文件)能被 ESLint 拦住**。

---

## 阶段 1 · 数据迁移

**目标**:新库拥有完整生产数据。数据源 = `D:\gaimo\baonly_web\data_e8ktN`(2026-09-03 拉取)。

| 产出 | 说明 |
|---|---|
| `docs/migration-map.md` | 旧 21 表 + BLOB → 新 29 表的字段级映射,含时区/布尔/价格转换规则与校验断言 |
| 迁移脚本 | 读 `data_e8ktN` → 写 PG。可重复执行(幂等) |
| 图片迁移 | 1088 张 → 两级分片 `ab/cd/<sha256>.webp` + `Image`/`ImageRef` 索引 |

**数据量基线**(实测):

```
sources/_merged.sqlite    148 个 Event
sources/{bilibili,cpp,dlcomic}.sqlite   257 条 SourceRecord
baonly.sqlite  event_overrides 123 · event_tags 66 · manual_events 17
               organizers 11 · disabled_details 11 · site_settings 13
               tag_styles 7 · hidden_events 5 · admin_tokens 2
               announcements 1 · api_keys 1 · source_sessions 1
               analytics_daily_rollups 1519 · analytics_ip_geo 1259
               analytics 明细 664k 行 ← 只迁最近 30 天
images/        1088 张
calendar.json  → Holiday 表
cache.json     弃(5 月旧快照)
```

**最危险的一步是时间字段。** 旧库把 Asia/Shanghai 的 ISO 串存在 `TEXT` 里,迁 `timestamptz` 时同类错误会**一次性污染全表历史数据且不可逆**。迁移脚本必须先在副本上跑,并断言若干已知活动的时间与线上完全一致。

**验收**:148 Event / 257 SourceRecord / 123 Override / 1088 Image 全部落库;抽样活动 `startAt` 零偏移;`SourceRecord.eventId IS NULL` 的孤儿数为 0。

---

## 阶段 2 · 核心资产 + 验收基准

**目标**:判同算法可用,并建立"功能完全一致"的可验证基准。

| 产出 | 说明 |
|---|---|
| `docs/sources.md` | 3 个源的接口契约:endpoint、参数、响应字段 → 统一模型的映射、反爬要点、边界情况。**纯参考文档,不含旧实现** |
| `docs/matching.md` | 判同业务需求 + 边界案例清单 |
| `docs/feature-parity.md` | 74 端点 + 14 后台功能区 + 6 cron + 20 筛选维度逐项清单,每项标注新实现位置 / 状态 / 验证方式 |
| `backend/src/core/matching/` | 判同算法**重新实现**(不搬旧代码),配 Vitest |
| `docs/baseline.json` + Vitest 断言 | **业务不变量基准**(取代原先的"端点 fixture"方案) |

### 为什么不录端点 fixture

原计划是录下 74 个端点的真实响应做契约基准。**这个思路是错的**——它把"功能对等"混淆成了"响应对等"。旧响应本身就是历史包袱:单个 event 38 个字段,`cachedCover`/`cachedBanner` 与 `cover`/`banner` 并存、`bilibiliId` 源特定字段泄进统一模型、`fieldSources`/`sourceRecords`/`sourceMissingStreak` 等内部数据直接暴露给前台。新 API 的 DTO 要重新设计,拿旧响应当基准等于把债当成标准。而且公共端点是加密的,录制成本也高。

### 改用业务不变量基准

比对**与响应格式无关的业务事实**,直接从 `data_e8ktN` 提取:

```
计数    可见 / 隐藏 / 详情禁用 / 源端下架的活动数
        各源记录数 · 多源合并分布(44 单源 / 99 双源 / 5 三源)
        票档总数 · 有票档的活动数 · 标签分布 · 主办方分布
分布    各城市 / 省份活动数 · 各状态(进行中 / 即将开始 / 已结束)计数
映射    判同聚类:257 条源记录 → 148 个活动的归属关系(核心断言)
抽样    若干具体活动的关键字段(标题 / 时间 / 场馆 / 价格区间 / 票档名列表)
```

好处:不依赖 API 格式 · 不需要解密 · 不受响应包袱影响 · **数据已在本地,无时间窗口压力**。

**判同必须通过的边界案例**(踩坑换来的):

```
上海 2025 咖啡联动  ≠  2026 only        年份必须参与判定
bilibili「第二届」  =  cpp「ONLY-02」    届数跨源归一
「上海·蔚蓝档案同人only·」归一化后只剩「上海」→ 不得靠标题子串判同
两边都写明具体场馆且不同 → 场馆冲突,封锁弱标题合并路径
+ merge-harness 里那 6 组已知正确的跨源合并
```

**验收**:Vitest 全绿;用新算法重跑 257 条源记录,聚类结果与线上 148 个活动**完全一致**。

---

## 阶段 3 · backend API

**目标**:74 个端点功能对等(去掉加密层)。

```
core/repositories/     数据访问,唯一允许 import PrismaClient 的地方
contracts/             DTO + class-validator → @nestjs/swagger 自动出 OpenAPI
modules/               controller + service,按资源分组(约 15 个 module)
鉴权                   session cookie(httpOnly + Secure + SameSite) + CSRF
                       替代上一代自造的 HMAC 挑战应答
限流                   @nestjs/throttler + Redis storage
实时                   @nestjs/websockets
```

**端点分组**(74 个):

```
公共数据 6   events / events/:id / events/query / events/detail / meta / session
导出     6   export.csv/.ics/.json/.xlsx · events/export.xlsx · events/:id/ics
图片     2   image · image-cache/:file
公开 API 2   public/events · public/events/:id
访客     1   presence/actions
SEO      2   robots.txt · sitemap.xml
管理鉴权 4   challenge / check / login / logout
活动管理 9   列表 · 编辑 · visibility / featured / tags / detail-access
             / tickets/:id/visibility · source-match
手动活动 3   POST / PUT / DELETE events/manual
内容管理 11  organizers · announcements · tag-styles
系统管理 11  tokens · api-keys · site
运维     13  logs · analytics · image-cache · image-hosts · upload-queue · refresh
访客管控 5   presence/blocks CRUD + enable
```

**验收**:对阶段 2 的 fixture 跑契约测试全绿;`/openapi.json` 完整,`pnpm api:types` 能生成前端类型。

---

## 阶段 4 · backend worker

**目标**:爬虫与定时任务跑起来,数据质量与线上一致。

```
sources/       3 个解析器(bilibili / cpp / dlcomic;baonlytime 保持禁用)
worker.ts      6 个 cron:
               0 0,12 * * *   爬虫刷新
               30 3  * * *    图片缓存清理
               0 0   * * *    日常任务
               25 3  * * *    analytics 保留期清理
               17 4  * * *    日志维护
               (WAL checkpoint 迁 PG 后不再需要)
图片管线       sharp 压缩 → SCDN 上传(CF/ESA 双路由) → keepalive
analytics      日聚合写 AnalyticsDailyRollup
SourceRun      每次运行的统计(fetched/created/updated/markedRemoved/耗时)
```

**关键:并行跑对比。** 新 worker 写**新库**,线上旧系统继续写旧库,两边独立。跑几个周期后比对判同聚类差异。**绝不让新旧爬虫同时写同一个库。**

**验收**:连续 3 个爬取周期,新旧聚类结果差异为零;`SourceRun` 有完整统计记录。

---

## 阶段 5 · dashboard(后台 UI)

**目标**:14 个功能区**路由化**(上一代是 14 个 modal,不能深链接/后退/多标签对照)。

**功能对等的 14 区**:

```
活动管理(Table + 批量操作)   手动登记      主办方管理     公告管理
标签样式管理                 站点设置       管理员令牌     API Key
分析仪表盘                   日志查看       数据维护       图片管理
访客管控(实时在线 + 封禁)    爬虫手动触发
```

**新增能力**(旧架构做不到,新 schema 让它们几乎免费):

```
判同审查台      SourceRecord 树形 Table + matchScore/matchEvidence
                + 孤儿记录(eventId IS NULL) + 手工锁定(matchLocked)
爬虫运行监控    SourceRun 时间序列 + 成功率 + 新增/变更/移除统计
图片引用管理    ImageRef —— "这张图属于谁" / "哪些图没人引用" 各一条 SQL
地域热力图      IpGeoCache + ECharts 省市下钻
```

**分析仪表盘只读 `AnalyticsDailyRollup`**,明细钻取强制时间窗上限——上一代直接扫 66 万行明细,而 DB worker 是串行的,于是打开后台就卡住整站。

**验收**:`feature-parity.md` 后台部分逐项打勾;每个页面可深链接、可后退、可多标签对照。

---

## 阶段 6 · client(前台 UI)

**目标**:全新 UI,功能对等。

```
列表        20 个筛选维度:城市 / 省份 / 大区 / GPS 距离 / 节假日 / 关键词
            / 价格区间 / 状态 / 排序 / 含往期 …
            分页(可选页大小,持久化)
详情        独立路由 /event/:id
地图        中国地图省市下钻(ECharts)
导出        6 种:CSV / ICS / JSON / XLSX / 单活动 ICS / 筛选结果 XLSX
关注提醒    3 种触发:开始前一天 / 开始时 / 票档开售
            走 ServiceWorker 通知(Android Chrome 页面上下文会抛错)
公告        列表 / 置顶 / 弹窗三种展示 + 公告中心
其他        主题切换(明/暗/跟随) · prefers-reduced-motion · 变更通知提示
SEO         站点级静态:index.html meta + JSON-LD + /about 静态页
            sitemap.xml 只列 / · /map · /about,不列 /event/:id
```

**验收**:`feature-parity.md` 前台部分逐项打勾;Playwright 视觉回归基线建立(列表/详情/地图,明暗两套)。

---

## 阶段 7 · 切流上线

```
1. 部署        PM2 两进程(api / worker) + PostgreSQL + Redis + nginx
2. 最终迁移    停旧爬虫 → 增量迁移最后一批数据 → 校验
3. 灰度        CF 按路径切流,先切读接口,观察
4. 全量        切换全部流量
5. 观察期      对比新旧 analytics 指标,确认无功能缺失
6. 旧系统下线
```

**回滚预案**:改 CF 路由指回旧后端,秒级生效。因此**旧系统在观察期结束前不得下线**。

---

## 全程注意事项

| 事项 | 说明 |
|---|---|
| 开发数据 | 用 `data_e8ktN` 的副本喂开发,**不要**让新代码连生产库 |
| 旧系统 | 保持运行,只修致命 bug,不加新功能 |
| fixture | 阶段 2 尽早录,唯一不可补救的时间窗口 |
| 时区 | 全链路 `timestamptz` + Asia/Shanghai;后台 `datetime-local` 必须显式解析 |
| 价格 | 库存分(Int),UI 显示元 |
| 硬约束 | 每阶段结束跑 `pnpm lint`,`max-lines`/import 边界不得放宽 |
