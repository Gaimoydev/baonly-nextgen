# 施工进度

> 供跨会话 / 跨 subagent 同步状态用。每完成一项就更新，别依赖对话上下文。

## 环境（本机 Windows）

```
Node        22.13.1        pnpm 11.25.0
PostgreSQL  17.11          E:\PostgreSQL      数据目录 E:\PostgreSQL\data    端口 5432
Redis       8.10.1         E:\Redis           数据目录 E:\Redis\data         端口 6379
仓库        https://github.com/Gaimoydev/baonly-nextgen  (private, main)
迁移数据源   D:\gaimo\baonly_web\data_e8ktN
```

### 启动服务（必须 detach，否则被 Claude Code 任务清理杀掉）

```powershell
Start-Process -FilePath 'E:\Redis\redis-server.exe' -ArgumentList 'redis.conf' -WorkingDirectory 'E:\Redis' -WindowStyle Hidden
Start-Process -FilePath 'E:\PostgreSQL\bin\postgres.exe' -ArgumentList '-D','E:\PostgreSQL\data' -WindowStyle Hidden
```

**踩过的坑**
- `pg_ctl start` 在 Windows 下阻塞且持有服务进程树，停掉任务会连带杀死 PG → 用 `postgres.exe` + detach
- Redis 是 cygwin 构建：命令行传 `/cygdrive/e/...` 会被 Git Bash 的路径转换搞坏 → 用工作目录 + 相对路径 `redis.conf`
- PG 的 Windows 二进制输出 GBK，控制台显示乱码 → 已设 `lc_messages = 'C'` 强制英文消息

## 阶段 0 · 轨道

| 项 | 状态 |
|---|---|
| CLAUDE.md（规范式：硬约束 / import 边界 / 继承教训 / 明确不做的事） | ✅ |
| pnpm-workspace.yaml · 根 package.json · .gitignore | ✅ |
| backend/prisma/schema.prisma（29 张表，`prisma validate` 通过） | ✅ |
| docs/PLAN.md（含实测锁定版本 + 版本决策表） | ✅ |
| 依赖安装（4 个 workspace，`pnpm peers check` 零问题） | ✅ |
| 4 项兼容性验证（AntD6/React19 · HeroUI3/Tailwind4 · HeroUI3/React19 · NestJS11/Node22） | ✅ |
| PostgreSQL 17.11 安装 + 配置（scram-sha-256 · Asia/Shanghai · lc_messages=C） | ✅ |
| Redis 8.10.1 安装 + 配置（512MB + allkeys-lru · 持久化到 E:\Redis\data 已验证） | ✅ |
| prisma.config.ts（Prisma 7 破坏性变更已处理） | ✅ |
| 应用数据库 + 专用用户 baonly | ⬜ |
| backend/.env（DATABASE_URL · REDIS_URL） | ⬜ |
| prisma migrate（建 29 张表） | ⬜ |
| eslint.config.mjs + .dependency-cruiser.cjs（硬约束落地） | ⬜ |
| tsconfig ×3 + vite.config ×2 + nest-cli.json | ⬜ |
| 设计 token 单一来源（Tailwind/HeroUI + AntD 双接入） | ⬜ |
| 各层 README | ⬜ |
| git init + 关联 remote + 首次提交 | ⬜ |

## 阶段 1 · 数据迁移

| 项 | 状态 |
|---|---|
| docs/migration-map.md | ⬜ |
| 迁移脚本（data_e8ktN → PG） | ⬜ |
| 图片迁移（1088 张 → 两级分片 + Image/ImageRef） | ⬜ |

## 阶段 2 · 核心资产 + 验收基准

| 项 | 状态 |
|---|---|
| docs/sources.md（3 个源接口契约，参考资料） | ⬜ |
| docs/matching.md（判同需求 + 边界案例） | ⬜ |
| docs/feature-parity.md（74 端点 + 14 功能区 + 6 cron + 20 筛选维度） | ⬜ |
| backend/src/core/matching/（重新实现 + Vitest） | ⬜ |
| docs/baseline.json（业务不变量基准） | ⬜ |

## 数据量基线（实测，来自 data_e8ktN）

```
148 个 Event          源构成：单源 44 / 双源 99 / 三源 5 → 多源合并占 70%
257 条 SourceRecord   bilibili 132 · cpp 116 · dlcomic 9
含票档 124 (84%) · 含 fieldSources 148 (100%) · 含 changeNotices 102 (69%)

event_overrides 123 · event_tags 66 · manual_events 17 · site_settings 13
organizers 11 · disabled_details 11 · tag_styles 7 · hidden_events 5
admin_tokens 2 · announcements 1 · api_keys 1 · source_sessions 1
client_blocks 0 · hidden_tickets 0 · removed_source_events 0   ← 表 0 行但功能是活的，不可省

analytics_daily_rollups 1519 · analytics_ip_geo 1259   ← 全迁
analytics_events 314738 · analytics_access_events 349464   ← 只迁最近 30 天
images/ 1088 张 · calendar.json → Holiday · cache.json 弃（5 月旧快照）
```

## 待定的设计决策

1. **Event 规范字段物化 vs 视图** — 倾向物化（爬虫一天跑 2 次）
2. **Tag 变实体、EventTag 加外键** — 迁移时需为无样式的标签自动建 Tag 记录
3. **ApiKey 的 expiresAt/scopes** — 超出功能对等的新增，迁移阶段留空不启用
4. **analytics 明细迁多少天** — 倾向 30 天
5. **配置去 .env 化**（用户 2026-09-03 提出）— 只有极敏感信息和运行时必需项留 env，
   其余进数据库 + 后台可改。需要设计 SiteSetting 的分组/类型/校验方案
