# 施工进度

> 供跨会话 / 跨 subagent 同步状态用。每完成一项就更新，别依赖对话上下文。
> 最后更新：2026-09-03

## 环境（本机 Windows）

```
Node        22.13.1        pnpm 11.25.0
PostgreSQL  17.11          E:\PostgreSQL   数据目录 E:\PostgreSQL\data   端口 5432
Redis       8.10.1         E:\Redis        数据目录 E:\Redis\data        端口 6379
数据库       baonly / 用户 baonly（连接串见 backend/.env，非 superuser）
仓库        https://github.com/Gaimoydev/baonly-nextgen  (private, main)
迁移数据源   D:\gaimo\baonly_web\data_e8ktN
```

### 服务启停

```powershell
powershell -NoProfile -File scripts\dev-services.ps1 start|stop|status|restart
```

**踩过的坑（别重蹈）**
- `pg_ctl start` 在 Windows 下阻塞且**持有服务进程树** → 停掉调用方会连带杀死 PostgreSQL。必须用 `postgres.exe` + `Start-Process` 脱离父进程
- Redis 是 **cygwin 构建**：命令行传 `/cygdrive/e/...` 会被 Git Bash 的路径转换改成 `C:/Program Files/Git/cygdrive/...` → 必须用工作目录 + 相对路径 `redis.conf`；但**配置文件内部**用正斜杠绝对路径没问题
- Redis 进程偶尔自行退出，跑长任务前先 `dev-services.ps1 status`
- PG 的 Windows 二进制输出 **GBK**，控制台显示乱码 → 已设 `lc_messages = 'C'` 强制英文。**这正是上一代"mojibake 疑云"的根源**：把 GBK 控制台输出误判成源码编码损坏
- `prisma migrate dev` 在 Prisma 7 里**没有** `--skip-generate` 参数了

### 待解决

- ⚠ **GitHub 推送不可用**：本机无 `gh` CLI、无 credential helper，`git ls-remote` 无响应。需要配置凭据（gh auth login 或 PAT）才能 push。目前所有提交只在本地

## 并行施工的教训（已发生，不是假设）

**Prisma / Redis 各被两个 agent 平行实现了两套**，且根模块、基础设施聚合模块也各有两份：

| 组件 | A 套（nest-skeleton） | B 套（config-system） | 裁决 |
|---|---|---|---|
| Prisma | `core/prisma/factory` + `modules/prisma/{module,service,tokens}` | `infra/prisma/prisma.service.ts` | **A 胜**，搬去 `infra/` |
| Redis | 同构 | `infra/redis/redis.service.ts` | **A 胜** |
| 根模块 | `modules/app.module.ts` | `src/app.module.ts` | 内容取 A，**位置取 B** |
| 聚合 | `modules/infrastructure.module.ts` | `infra/infra.module.ts` | 合并进 `infra/infra.module.ts` |
| AppConfig | — | `infra/config/app-config.service.ts` | **B 独有，保留** |

A 套胜出的实质理由（不是先来后到）：
- `onPoolError` 把 pg 空闲连接错误降级为日志 —— 否则事件冒泡成 `uncaughtException`，
  被崩溃守卫一杀，**一次网络抖动就重启进程**
- 连接串 `?schema=` 剥离（pg 不认这个 Prisma 自有参数）
- DI token 独立成文件，避开 module↔service 循环 import
- 而且 `main.ts` / `worker.ts` 实际 import 的就是 A 套，B 套是死代码

**避免复发**：给 agent 派活时必须写明**独占的文件路径**，基础设施类文件（Prisma/Redis/根模块/lint 配置）只能有一个 owner。已按此重新分工。

### 一个骗过整轮验证的命令陷阱

```
depcruise --config X --validate backend/src frontend   → ✔ no violations (7 modules)   ❌ 骗人
depcruise --config X          backend/src frontend     → x 2 violations (48 modules)   ✅ 真相
```

`--validate` 在 dependency-cruiser 18 里**不是有效选项**，会静默吞掉紧跟的路径参数。
两条真实的 `core-no-framework` error（`core/prisma/factory` → `@prisma/client`、
`core/redis/factory` → `ioredis`）因此漏了整轮。**统一只用 `pnpm lint` / `pnpm lint:deps`，不手敲。**

## 阶段 0 · 轨道

| 项 | 状态 |
|---|---|
| CLAUDE.md（规范式：硬约束 / import 边界 / 继承教训 / 配置架构 / 明确不做的事） | ✅ |
| pnpm-workspace.yaml · 根 package.json · .gitignore | ✅ |
| backend/prisma/schema.prisma（29 张表，`prisma validate` 通过） | ✅ |
| docs/PLAN.md（实测锁定版本 + 版本决策表 + 基线数字更正） | ✅ |
| 依赖安装（4 个 workspace，`pnpm peers check` 零问题） | ✅ |
| 4 项兼容性验证 | ✅ |
| PostgreSQL 17.11 安装 + 配置（scram-sha-256 · Asia/Shanghai · lc_messages=C） | ✅ |
| Redis 8.10.1 安装 + 配置（512MB + allkeys-lru · 持久化已验证） | ✅ |
| prisma.config.ts（Prisma 7 破坏性变更已处理） | ✅ |
| 应用数据库 + 专用用户 baonly | ✅ |
| backend/.env（DATABASE_URL · REDIS_URL · PORT · TZ） | ✅ |
| **prisma migrate（29 张业务表已建，migration `20260902194925_init`）** | ✅ |
| scripts/dev-services.ps1（服务启停） | ✅ |
| git init + remote 关联 + 本地提交 | ✅ |
| eslint.config.mjs + .dependency-cruiser.cjs | 🔄 lint-guard |
| tsconfig ×3 + vite.config ×2 + nest-cli.json | 🔄 build-config |
| 设计 token 单一来源 + 各层 README | 🔄 design-system |
| git push 到 GitHub | ⛔ 缺凭据 |

## 阶段 1 · 数据迁移

| 项 | 状态 |
|---|---|
| docs/migration-map.md + 迁移脚本 + 图片迁移 | 🔄 migrator |

## 阶段 2 · 核心资产 + 验收基准

| 项 | 状态 |
|---|---|
| backend/src/core/matching/（重新实现 + Vitest） | 🔄 matcher |
| docs/matching.md | 🔄 matcher |
| docs/sources.md（3 个源接口契约） | 🔄 sources-doc |
| docs/feature-parity.md（74 端点 + 14 功能区 + 6 cron + 20 筛选维度） | 🔄 parity-doc |
| docs/baseline.json + verify-baseline.ts | 🔄 baseline |

## 阶段 3 · backend API

| 项 | 状态 |
|---|---|
| NestJS 骨架（两个入口 / Prisma / Redis / Swagger / health） | 🔄 nest-skeleton |
| 配置系统（AppConfig registry + service + seed） | 🔄 config-system |

## 数据量基线（实测更正版）

```
165 个 Event          148 个爬取 + 17 个人工登记(manual_events)
259 条 SourceRecord   bilibili 132 · cpp 116 · dlcomic 9
                      ⚠ 不是 257 —— 257 是按去重后的源“种类”算的
                        (44×1+99×2+5×3)，真实条数 259（1 个活动在同一源下有 2 条记录）
爬取活动的源构成       单源 44 / 双源 99 / 三源 5 → 多源合并占 70%
含票档 124 (84%) · 含 fieldSources 148 (100%) · 含 changeNotices 102 (69%)

event_overrides 123 · event_tags 66 · manual_events 17 · site_settings 13
organizers 11 · disabled_details 11 · tag_styles 7 · hidden_events 5
admin_tokens 2 · announcements 1 · api_keys 1 · source_sessions 1
client_blocks 0 · hidden_tickets 0 · removed_source_events 0   ← 表 0 行但功能是活的，不可省

analytics_daily_rollups 1519 · analytics_ip_geo 1259          ← 全迁
analytics_events 314738 · analytics_access_events 349464      ← 只迁最近 30 天
images/ 1087 张（目录 1088 个文件，_hosted.json 不是图片）
calendar.json → Holiday · cache.json 弃（5 月旧快照）
```

## schema 的一处演进

`SiteSetting` 已改为 **`AppConfig`**（表 `app_configs`），带 `category` / `valueType` /
`constraints` / `label` / `isSecret` / `requiresRestart` 元数据 —— 目的是让后台配置页
**由元数据驱动自动生成表单**，加配置项只需往 registry 插一行。这落实了"配置去 .env 化"。

## 待定的设计决策

1. **Event 规范字段物化 vs 视图** — 倾向物化（爬虫一天跑 2 次）
2. **Tag 变实体、EventTag 加外键** — 迁移时需为无样式的标签自动建 Tag 记录
3. **ApiKey 的 expiresAt/scopes** — 超出功能对等的新增，迁移阶段留空不启用
4. **analytics 明细迁多少天** — 倾向 30 天
