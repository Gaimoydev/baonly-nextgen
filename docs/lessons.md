# 从上一代继承的教训

> 这些不是代码，是**约束**。每条都是上一代（`D:\gaimo\baonly_web`）踩出来的，
> 新实现必须满足。写代码前对照一遍，比事后修便宜得多。
>
> 每条格式：**现象 → 根因 → 新项目怎么避免**。带 ✅ 的是新架构里已经从设计上排除的。

---

## 一、架构级

### A1. 11,034 行的单文件 ✅

**现象** `server/index.js` 一个文件 11,034 行，同时是 DI 容器、4 个爬虫、加密通道、图片管线、SEO、WebSocket 和路由装配。

**根因** 没有"新代码该放哪"的约定。每次加功能就往同一个文件追加，因为那是唯一确定能跑的地方。

**避免** ESLint `max-lines: 400` 硬拦截 + `backend/src/{core,sources,modules,contracts}` 目录职责明确 + 每层一份 README。`max-lines` 这一条就能根治：它让"再往这个文件加"变成报错，AI 必须去建新文件，而建新文件就必须遵守目录约定。

### A2. 导入即绑定端口和定时器

**现象** `import` `server/index.js` 会立刻 `app.listen()` 并注册 5 个 cron —— 所以它无法被测试。

**根因** 没有 `createApp()` / `startServer()` 工厂分离。

**避免** NestJS 的 `AppModule` 天然可测（`Test.createTestingModule`）。`main.ts` / `worker.ts` 只做 bootstrap，业务逻辑一律在可注入的 service 和 `core/` 的纯函数里。

### A3. 一个进程干五件事 → 线上 1.5GB / PM2 重启 20 次 ✅

**现象** HTTP API、4 个爬虫、`sharp` 图片压缩、analytics 聚合、WS 推送全在同一个 Node 进程。线上常驻 1.5GB，`max_memory_restart` 设的 2048M，PM2 已重启 20 次。

**根因** `sharp`（libvips）本身是内存大户，爬虫持有大 buffer，它们和 API 抢同一个堆。

**避免** **两个入口**：`main.ts`（API，不注册 `ScheduleModule`）和 `worker.ts`（cron + 爬虫 + sharp + SCDN）。PM2 起两个进程，内存隔离。这是新架构最重要的单项决定。

### A4. 59 个进程内 Map，只 21 个带上限 ✅

**现象** session、nonce、rate-limit、presence、blocklist、缓存全在模块级 `Map`。全文件只有 4 个 `setInterval` 做清理，覆盖不全。

**根因** 每次需要缓存就 `new Map()`，没有统一的状态层。

**后果** 内存单向增长（A3 的直接成因），而且**只能单实例** —— 横向扩展会静默破坏鉴权、防重放和在线状态。

**避免** ESLint 禁止模块级 `new Map()` / `new Set()` 作状态；session / 限流 / presence / 缓存一律 Redis，且 Redis 本身设 `maxmemory 512mb` + `allkeys-lru`（把状态搬走只是换地方，不设上限同样会重演）。

### A5. 崩溃不退出，带着损坏状态继续跑

**现象** `uncaughtException` / `unhandledRejection` 只记日志，从不 `exit`。

**避免** 记录后 `process.exit(1)`，交给 PM2/systemd 重启。宁可重启，不要半死状态。

### A6. DB 层串行且永不重生

**现象** SQLite 跑在一个 worker 线程里，所有查询串行。一个慢查询（典型是 `getAnalyticsDashboard` 扫 66 万行明细）阻塞**全部** DB 流量；worker 崩了之后每个 `callDb` 永久挂起，只能重启后端。

**根因** 为了绕开实验性 `node:sqlite` 阻塞事件循环而自造 worker，代价是把并发变成了串行。

**避免** PostgreSQL + Prisma（连接池天然并发）。分析仪表盘**只读 `AnalyticsDailyRollup`**，明细钻取强制时间窗上限。

### A7. 部署产物无版本记录

**现象** 生产是 tarball 解包部署，`/www/wwwroot/baonly-backend` 没有 `.git`。实测线上后端与本地工作区**字节级一致**，而那份代码当时**从未提交**过 —— 生产代码只存在于一台开发机的未提交工作区里。

**避免** 从第一天就 git + 远端仓库；部署走 CI 或至少记录 commit hash。

### A8. 部署绕过启动护栏

**现象** PM2 的 `ecosystem.config.cjs` 里 `script: "index.js"`，直接跑入口而非启动器脚本 —— 绕过了密钥占位符校验和构建产物存在性检查。没出事只是因为 ecosystem 的 `env` 里手工列全了变量。

**避免** 启动校验放进应用自身的 bootstrap（NestJS `ConfigModule` 的 schema 校验），而不是外挂脚本。这样无论怎么启动都逃不掉。

---

## 二、数据模型

### D1. 核心实体不在数据库里 ✅

**现象** 主库 21 张表里**没有活动表**。活动存在 `sources/_merged.sqlite` 的 `events(id, source, start_at, payload BLOB)` —— 38 个字段全塞在一个 `payload` 里，只有 3 个字段可查。

**后果** 无法按城市/价格/标签/场馆查询 → 必须**全量载入内存**再用 JS 过滤排序分页。这解释了 `refreshGlobalEventsCache`、`publicReadCache`、`fetchEventsAll`、`adminEventFacets` 这一整套内存计算的存在，以及随之而来的内存占用。

**避免** 凡需查询/排序/筛选的字段一律**真列 + 索引**。`Event` 的规范字段物化存储，前台查询是纯 SQL 无计算。jsonb 只用于 `SourceRecord.rawPayload`（原始留档）和 `EventOverride.extra`（稀疏覆盖）。

### D2. 四张表每张只存一个布尔 ✅

**现象** `hidden_events`（5 行）、`hidden_tickets`（0 行）、`disabled_details`（11 行）、`removed_source_events`（0 行）。

**避免** `Event.visibility` / `detailState` / `sourceState` 枚举 + `Ticket.hidden` 字段。
⚠ **注意**：那几张 0 行的表**功能是活的**，不能因为没数据就在新 schema 里砍掉。

### D3. 判同用不含年份的月日 → 跨年误并

**现象** `eventsShareDay` / `eventExactKey` / `eventDateCityKeys` 都用 `monthDayKey`（MM-DD，无年份），导致「上海 2025 咖啡联动」和「2026 only」被判为同一活动。

**避免** `EventDate.date` 是含年份的 `@db.Date`；判同的时间证据必须比对完整日期。测试用例必须覆盖这个案例。
⚠ 旧代码里 `monthDayKey` 仍保留给 `cppStableSourceId` 的指纹用 —— 改它会导致全部 cpp 事件换 ID。新实现别复用这个函数做判同。

### D4. 退化标题子串命中同城所有场次

**现象** 「上海·蔚蓝档案同人only·」经 `normalizeTitleForMatch` 归一化后只剩「上海」，于是它作为子串命中该城市的每一个标题。

**避免** 判同必须有**退化标题守卫**：标题去掉城市名后的"内核"少于 2 字时，不得用相等/包含作为依据，必须回退到场馆和时间证据。

### D5. 跨源届数表述不统一

**现象** bilibili 写「第二届」，cpp 写「ONLY-02」，还有「ONLY·2」。原正则不容忍分隔符，也不转中文数字。

**避免** 届数归一化模块：容忍 `- _ · .` 分隔符 + 中文数字转阿拉伯数字。

### D6. 票档按数组下标绑定 → 增删行后价格错位 ✅

**现象** `parseEditableTickets` 用 `currentTickets[index]` 定位，后台增删或重排票档行后，隐藏标记（按 ticketId 存）和价格会**错位到别的票上**。

**避免** `Ticket` 表有稳定主键；后台表单用 AntD `Form.List`（它的 key 机制从设计上排除下标错位）。

### D7. 时间存 TEXT，无时区语义

**现象** 全部时间以 Asia/Shanghai 的 ISO 串存在 `TEXT` 列。公告的 `publishedAt` 从后台 `datetime-local`（无时区）传来后被当 UTC 解析，UTC 部署上整体 +8h。

**避免** 全链路 `timestamptz`；后台传来的无时区串**必须显式按 Asia/Shanghai 解析**。
⚠ **迁移时这是最危险的一步** —— 同类错误会一次性污染全表历史且不可逆。迁移脚本必须带断言校验。

### D8. 图片平铺单目录、无索引 ✅

**现象** 1087 张 `.webp` 平铺在 `data/images/`，文件名是 sha256，数据库里**没有任何索引**。所以需要 `cleanup-unreferenced-images.js` 去启发式地猜哪些没人引用，而"这张图属于哪个活动"根本回答不了。

**避免** `Image`（sha256 唯一 + 元数据 + storageKey 两级分片 `ab/cd/<sha>.webp`）+ `ImageRef`（谁引用了它）。两个痛点各变成一条 SQL。

### D9. 手动活动独立成表

**现象** `manual_events` 与爬取活动分离，导致查询要 union、判同要特判 `source === "manual"`。

**避免** manual 就是一个 `Source`，同一张 `Event` 表，无特例。

### D10. 分析模块自己存活动快照

**现象** `analytics_event_catalog`（207 行）是活动元数据的冗余副本 —— 因为主库没有活动表，分析模块只好自己存一份。

**避免** 直接外键引用 `Event`，这张表取消。

---

## 三、前端

### F1. 8,894 行 CSS，只有 7 个注释块 ✅

**现象** 单个全局 `styles.css` 8,894 行，全文只有 7 个顶层注释，且都是针对具体 bug 的说明，**不存在按页面/组件的分节**。

**后果** 无法靠阅读判断哪条规则属于哪个页面 —— 所以"按页迁移并删除对应旧 CSS"这条常规重构路线走不通。

**避免** 组件库 + 设计 token 单一来源 + ESLint 禁止字面量色值/间距。

### F2. 无障碍靠事后手修

**现象** 暗色主题的 `--accent`（`#79a9ff`）配白字对比度只有 ~2.3:1；浅色主题的 `--accent-2`（`#0f8c82`）做 12px 小字只有 ~3.6:1。都低于 WCAG AA，事后逐个打补丁。

**避免** 设计 token 阶段就标注每对前景/背景的对比度（正文 ≥4.5:1、大字 ≥3:1）；前台用 HeroUI（基于 React Aria），无障碍行为开箱。

### F3. 14 个 modal 不是路由 ✅

**现象** 后台整个控制台是 `AdminConsole` hub + ~20 个 modal dialog，**不是路由**。4,880 行单文件里 99 个 `useState`。

**后果** 不能深链接、不能后退、不能开两个标签对照数据、状态全挤在一个组件里。数据后台的基本诉求"把这个筛选状态发给同事"做不到。

**避免** 每个功能区一条路由（React Router）；服务端状态交给 TanStack Query（配合已有的 WS 失效通知，`invalidateQueries` 精准失效而非整页 reload）。

### F4. 手写路由只读一次 location

**现象** `App.jsx` 在渲染时读一次 `window.location`，不监听 `popstate` —— 浏览器前进/后退不触发重新路由，只有整页刷新才生效。

**避免** 用正经路由库。

### F5. 倒计时让整棵树 1Hz 重渲染

**现象** 根组件持有每秒变化的 `now` state，导致整个应用树以 1Hz 重渲染。后来用 `useSyncExternalStore` 做共享 ticker + 叶子订阅才修好，且已结束的卡片冻结快照不订阅。

**避免** 时间订阅**下沉到叶子组件**，根组件不持有高频变化的 state。

### F6. 后端不可达时无限重试打爆握手

**现象** 列表加载 effect 把 `error` 作为依赖，而请求开始时 `setError("")`、失败时 `setError(msg)` —— `error` 每次尝试都翻转，effect 因此重新触发，对着挂掉的后端无限重试。后来加了熔断器（3 次尝试 + 3 秒间隔 + 开路）才止住。

**避免** TanStack Query 的 `retry` + `retryDelay`（有界 + 指数退避）。**不要**把会被请求自身修改的 state 放进 effect 依赖。

### F7. 通知在 setState updater 内部发射

**现象** 浏览器通知在 `setInterests` 的 updater 函数里 `new Notification()`。updater 必须是纯函数 —— StrictMode / 并发渲染下可能被调用两次，导致重复通知。

**避免** 副作用移出 updater。

### F8. Android Chrome 页面上下文构造 Notification 会抛错

**现象** Android Chrome 禁止在页面上下文 `new Notification()`（只能经 `ServiceWorkerRegistration.showNotification`），直接构造抛 `TypeError`，会连带崩掉整个提醒循环并丢失记账状态。

**避免** 走 ServiceWorker 通知；或至少保留这个 try/catch 认知。

---

## 四、安全与运维

### S1. 自造加密通道，收益不抵成本 ✅

**现象** 22 个提交实现了 ECDH P-256 + HKDF + AES-CTR + keystream 白化 + 自定义封帧 + 截断 HMAC 的应用层通道，客户端还配了重型混淆（`public-api` chunk 373KB）。

**代价** 首屏多一个 RTT（所有请求等握手）；session 在进程内存 → **后端重启全体用户掉线**；三类用户可见的专属错误（请求过期 / 会话过期 / 409 replay）；±180s 时钟窗导致要做客户端时钟校正；纯 JS 加解密占主线程。

**关键判断** 站点前面挂着 Cloudflare，**Bot Fight / challenge 在 TLS 层就把批量抓取挡掉了** —— 比应用层 HMAC 有效得多。这套是第二道防线，撑不起它的复杂度。

**避免** 不做应用层加密通道。反爬交给 CDN。真要加也**不得**再用握手式全通道方案（改成服务端签发的短期 token，或字段级加密，或纯响应字段混淆）。

### S2. 密钥在工作树里且从未轮换

**现象** `.env` 含真实的 `ADMIN_TOKEN`、`INTERNAL_API_SECRET`、`CPP_ACCOUNT/PASSWORD`、WxPusher token，长期躺在开发目录。RISKS.md 里"把密钥移出工作树并轮换"这条一直是未解决状态。

**避免** `.gitignore` 严格排除；仓库即使 private 也不存密钥；`.env.example` 只放占位符。

### S3. 编辑 .env 可能完全无效

**现象** 启动器遇到已存在于 `process.env` 的键会跳过（`if (process.env[key] !== undefined) continue`）。实测那 8 个变量**已经导出在 shell 环境里**，所以 `.env` 报告 `loaded: none` —— 改文件不生效，而且没有任何警告。

**避免** 尽量少用 env（见"配置去 .env 化"）；启动时打印**每个配置项的最终来源**，让覆盖关系可见。

### S4. 图片代理 SSRF 未闭合

**现象** 校验了主机名，但连接时未固定到已校验的 IP（存在 DNS rebinding 空间）。

**避免** 校验解析后的 IP 并把 socket 固定到该 IP；拒绝私网地址段。

### S5. 把客户端指纹当作身份

**现象** `req.baonlyClient` 的指纹和 IP 是攻击者可控的，但被用在封禁和限流判定里。

**避免** 指纹只用于提高成本和统计，**不作为鉴权依据**。真正的身份靠 session cookie。

### S6. Windows 控制台 GBK 引发的"编码损坏"误报

**现象** 一份风险报告称多处中文字面量和一个正则存在 GBK-as-UTF8 损坏，其中包括判同用的 `isSourceInfoItem`（被描述为"真实逻辑 bug"）。字节级复核后发现：**那些字面量一直是干净的 UTF-8**，报告是把 GBK 控制台的渲染结果误当成了源码内容。真正损坏的只有一处（后台的一个计划任务标签）。

**避免** 判断编码问题一律**字节级验证**（Node `Buffer`），不信控制台渲染。新项目已把 PostgreSQL 的 `lc_messages` 设为 `C`（强制英文消息），从源头消除这类噪音。

---

## 五、开发流程

### P1. 唯一的数据质量防线是一个跑不起来的脚本

**现象** 判同逻辑的验证靠 `scripts/dev/merge-harness.mjs`（离线夹具，含 6 组已知正确合并 + 1 个误并复现）。但它的 fixtures 默认路径指向一个已消失的临时目录，**现在跑不起来**。

**后果** 70% 的活动是多源合并的，而这条防线是失效的。

**避免** 判同算法配正式的 Vitest 用例，fixtures 入库；改判同规则**必须先加/改测试**。

### P2. 没有测试就重构 = 没有网

**现象** 除了 secure-channel 的 7 个测试，全项目无测试。而重构对象是 11k 行后端 + 6.8k 行 JSX + 8.9k 行 CSS。

**避免** 核心资产（判同算法、时区转换、契约）先有测试；UI 建 Playwright 视觉回归基线。

### P3. 文档的行号锚点会漂

**现象** 上一代 CLAUDE.md 要求"按行号锚点导航"，但实测每个锚点都漂了 +11 到 +115 行。

**避免** 文档引用**函数名/符号名**而不是行号。目录职责 + README 比锚点更耐久。
