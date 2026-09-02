# CLAUDE.md — BAOnly Nextgen

> **这是一份规范文件,不是说明文件。** 下面的「必须 / 禁止」是硬约束,违反即视为缺陷。
> 上一代项目(`baonly_web`)之所以变成 11,034 行单文件 + 8,894 行无结构 CSS,
> 根因不是"写得烂",而是**没有轨道**——每个决策都从零开始。这份文件就是轨道。

## 项目是什么

蔚蓝档案(碧蓝档案)同人展会聚合站。从 3 个票务源采集 → 判同合并成统一活动 → 运营人工干预 → 对外提供公共站点、管理后台、第三方 API。

**这是对上一代项目的完全重写**:架构、代码、UI 全新,**功能与上一代完全一致**。功能对等清单见 `docs/feature-parity.md`,它是唯一的验收标准。

## 目录与职责

```
backend/                  NestJS + Prisma。唯一的后端服务
  prisma/schema.prisma    数据模型单一真相源(29 张表)
  src/
    core/                 业务逻辑。不得 import 任何 HTTP/框架层的东西
      matching/           判同算法(纯函数,必须可单测)
      repositories/       数据访问。唯一允许 import PrismaClient 的地方
    sources/              3 个爬虫解析器(bilibili / cpp / dlcomic)
    modules/              NestJS 功能模块(controller + service + dto)
    contracts/            DTO + class-validator 装饰器 → 自动生成 OpenAPI
    main.ts               入口 1:HTTP API
    worker.ts             入口 2:常驻进程(cron + 爬虫 + sharp + SCDN)

frontend/client/          Vite + React + HeroUI。公共前台
frontend/dashboard/       Vite + React + Ant Design。管理后台
docs/                     feature-parity.md · migration-map.md · sources.md · matching.md · lessons.md
```

**新代码必须有明确归属地。** 找不到该放哪时,读对应目录的 README,而不是就近塞进现有文件。

## 硬约束(ESLint 强制,违反即报错)

| 规则 | 目的 |
|---|---|
| `max-lines: 400` | 从架构上阻止单文件膨胀。上一代 `index.js` 是 11,034 行 |
| `max-lines-per-function: 80` | 阻止巨型函数 |
| 禁止 inline style / 字面量色值 | 强制走设计 token。上一代累积出 8,894 行无结构 CSS |
| import 边界(dependency-cruiser) | 见下 |
| `no-restricted-syntax`: `new Map()` / `new Set()` 作模块级状态 | 上一代有 59 个进程内 Map,只 21 个带上限,导致内存增长 + 无法多实例 |

### import 边界

```
core/          不得 import  @nestjs/*  ← 保持纯业务,可单测
modules/       不得 import  PrismaClient  ← 必须经 core/repositories/
sources/       不得 import  modules/      ← 爬虫不依赖 HTTP 层
frontend/*     不得 import  backend/ 的运行时代码  ← 只用生成的 OpenAPI 类型
client/        不得 import  antd          ← 前台只用 HeroUI
dashboard/     不得 import  @heroui/*     ← 后台只用 AntD
```

## 后端规范

- **必须**:新端点 = 在 `src/modules/<domain>/` 加 controller 方法 + `contracts/` 里的 DTO。DTO 用 class-validator 装饰器,OpenAPI 自动生成,**不手写文档**。
- **必须**:数据访问只经 `core/repositories/`。controller 和 service 里**不得**出现 `prisma.xxx`。
- **必须**:判同算法写在 `core/matching/`,是纯函数,配 Vitest 用例。改判同规则必须先加/改测试用例。
- **禁止**:在 `main.ts`(API 进程)里注册 `ScheduleModule`。定时任务只属于 `worker.ts`。
- **禁止**:进程内共享状态。session / 限流 / presence / 缓存一律 Redis。
- **禁止**:`uncaughtException` 里只记日志不退出。崩溃必须退出,由 PM2/systemd 重启。
- **时间**:全链路 `timestamptz`,业务时区 Asia/Shanghai。后台传来的无时区 `datetime-local` 串**必须**显式按 Shanghai 解析。
- **价格**:数据库存**分**(Int),UI 显示元(÷100 读、×100 写)。

## 前端规范(两个 app 通用)

- **必须**:所有服务端数据经 TanStack Query,不裸 `fetch`,不用 `useEffect` 拉数据。
- **必须**:API 类型来自 `openapi-typescript` 生成的文件,**不手写** interface。
- **必须**:每个功能区是一条**路由**(React Router 7)。
- **禁止**:用 modal 承载主要功能。上一代后台 14 个 dialog 不是路由,导致不能深链接、不能后退、不能多标签对照。
- **禁止**:在页面文件里定义新的视觉原语。页面只能**组合**组件库 + `components/` 里已登记的业务组件。
- **禁止**:字面量颜色 / 间距 / 圆角 / 字号。只能取设计 token。
- **无障碍**:前台走 HeroUI(React Aria)默认行为;自定义交互必须可键盘操作。文本对比度须过 WCAG AA。

## 数据模型要点

`backend/prisma/schema.prisma` 是单一真相源。三层显式建模:

```
① 采集层  Source · SourceRecord · SourceRun
② 实体层  Event · EventDate · Ticket · Venue · City · EventFieldOrigin · ChangeNotice
③ 干预层  EventOverride + Event 上的 visibility / detailState / sourceState 枚举
```

**实测依据(2026-08-31)**:257 条源记录 → 148 个活动,多源合并占 **70%**;`fieldSources` **100%** 在用、`changeNotices` **69%** 在用、票档 **84%** 在用。因此 `SourceRecord` / `EventFieldOrigin` / `ChangeNotice` / `Ticket` 都不可简化掉。

- `Event` 的规范字段是**物化**的(爬虫跑完写入),前台查询为纯 SQL 无计算。改判同规则后需重跑物化。
- 状态用枚举字段,**不再**用"每张只存一个布尔"的标记表(上一代有 4 张)。
- jsonb 只用于 `SourceRecord.rawPayload`(原始留档)和 `EventOverride.extra`(稀疏覆盖)。**凡需查询的字段一律真列。**

## 从上一代继承的教训(不是代码,是约束)

这些是踩坑换来的,新实现必须满足:

| 教训 | 落地方式 |
|---|---|
| 判同用不含年份的 MM-DD,导致同月同日不同年被误并 | `EventDate.date` 含年份;测试用例覆盖"2025 咖啡联动 ≠ 2026 only" |
| 退化标题(`上海·蔚蓝档案同人only·` 归一化后只剩「上海」)子串命中同城所有场次 | 判同必须有退化标题守卫 |
| 跨源届数不统一(bilibili「第二届」vs cpp「ONLY-02」) | 届数归一化 + 测试用例 |
| 票档按数组下标绑定,增删行后隐藏标记和价格错位 | `Ticket` 有稳定主键;表单用 AntD `Form.List` |
| `datetime-local` 无时区,UTC 部署整体 +8h | 显式按 Shanghai 解析 |
| 倒计时让整棵组件树 1Hz 重渲染 | 时间订阅下沉到叶子组件 |
| 后端不可达时前端无限重试打爆握手 | TanStack Query 的 `retry`/`retryDelay` |
| Android Chrome 页面上下文 `new Notification()` 抛错 | 走 ServiceWorker 通知 |
| 图片平铺在单目录、无索引,无法知道图属于谁 | `Image` + `ImageRef` 表;存储路径两级分片 |
| 分析仪表盘直接扫 66 万行明细,阻塞整个 DB | 仪表盘只读 `AnalyticsDailyRollup`,明细钻取强制时间窗 |

## 明确不做的事

- **不做应用层加密通道**。上一代自造 ECDH + AES-CTR 通道(22 个提交),代价是首屏多一个 RTT、后端重启全体掉线、三类专属错误。反爬交给 Cloudflare 的 Bot 防护。将来若要加,**不得**再用握手式全通道方案。
- **不做内容级 SEO**。只做站点级静态 meta;`sitemap.xml` 不列 `/event/:id`。展会数据不进 HTML。
- **不引入 Refine**。API 非标准,data/auth provider 都要自定义;非 CRUD 页面用它是负担。
- **不引入 BullMQ**。148 个活动、一天 2 次爬取用不上队列。真需要时再加(Redis 已在栈里)。
