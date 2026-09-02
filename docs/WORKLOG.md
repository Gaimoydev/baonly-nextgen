# 工作日志 / 当前状态

> **给接手的人（含 AI）**:这份文件是跨会话的状态锚点。每完成一个阶段任务就更新它。
> 规范看 `../CLAUDE.md`,计划看 `PLAN.md`。

最后更新:2026-09-03

---

## 本地环境（已就绪）

```
PostgreSQL  17.11   E:\PostgreSQL          127.0.0.1:5432   LISTENING
                    数据目录 E:\PostgreSQL\data
                    数据库 baonly / 应用用户 baonly（非 superuser）
                    编码 UTF8 · locale C · timezone Asia/Shanghai
                    认证已从 initdb 默认的 trust 改为 scram-sha-256
                    lc_messages='C' —— 强制英文日志，避开 Windows GBK 控制台乱码

Redis       8.10.1  E:\Redis               127.0.0.1:6379   LISTENING
                    redis-windows/redis-windows 的 cygwin 构建
                    maxmemory 512mb + allkeys-lru · RDB 快照 · AOF 关闭
                    数据目录 E:\Redis\data（已验证 dump.rdb 落点正确）

pnpm        11.25.0（npm i -g 装的；corepack 因 E:\nodejs 权限失败）
```

### 启动/停止命令

```bash
# Redis（脱离 shell 常驻）
powershell -NoProfile -Command "Start-Process -FilePath 'E:\Redis\redis-server.exe' -ArgumentList 'redis.conf' -WorkingDirectory 'E:\Redis' -WindowStyle Hidden"
E:\Redis\redis-cli.exe shutdown          # 优雅关闭（务必用它，别 kill）

# PostgreSQL
MSYS_NO_PATHCONV=1 /e/PostgreSQL/bin/pg_ctl.exe -D "E:/PostgreSQL/data" -l "E:/PostgreSQL/data/log/startup.log" -w start
MSYS_NO_PATHCONV=1 /e/PostgreSQL/bin/pg_ctl.exe -D "E:/PostgreSQL/data" stop
```

### ⚠ Windows/Git Bash 路径陷阱（踩过）

Git Bash(MSYS2) 会自动转换命令行里的类 Unix 路径。给 **cygwin 编译的程序**（Redis）传
`/cygdrive/e/...` 会被转成 `C:/Program Files/Git/cygdrive/e/...` 导致找不到文件。

**对策**:`cd` 到程序目录用相对路径,或前置 `MSYS_NO_PATHCONV=1`。
配置文件**内部**用正斜杠(`E:/Redis/data`)是安全的。

---

## 进度

### 阶段 0 · 轨道

- [x] `CLAUDE.md` 规范式（硬约束 / import 边界 / 继承教训 / 明确不做的事）
- [x] `pnpm-workspace.yaml` · 根 `package.json` · `.gitignore`
- [x] `backend/prisma/schema.prisma` 29 张表（`prisma validate` 通过）
- [x] 依赖全部安装,`pnpm peers check` 零问题
- [x] 4 项兼容性验证（结论见 PLAN.md 的版本锁定决策表）
- [x] PostgreSQL + Redis 安装/配置/启动
- [x] 应用数据库 + 专用用户 + 最小化 `.env`（只 6 项）
- [x] `prisma migrate dev --name init` → **30 张表 + 11 枚举落库**
- [x] 设计 token 单一来源 `frontend/shared`（TS 真相源 + Tailwind 4 CSS 投影 + AntD 适配器）
- [x] `AppConfig` 配置表 + 种子 → **51 项配置落库**（9 类）
- [x] backend 骨架：`infra/{prisma,redis,config}` · `app.module` / `worker.module` · 两个入口 + 崩溃守卫
- [x] git init + 首次提交（**push 待认证**，见下）
- [ ] `eslint.config.mjs` + `.dependency-cruiser.cjs`（config-agent 进行中）
- [ ] 三个 `tsconfig.json`(strict) + 两个 `vite.config.ts` + `nest-cli.json`（config-agent 进行中）
- [ ] 各层 `README.md`（config-agent 进行中）

### ⚠ GitHub push 需要认证

远端已关联 `https://github.com/Gaimoydev/baonly-nextgen.git`（private），但本机
**没有 GitHub 凭据**（`gh` CLI 未安装，`git ls-remote` 无响应=在等交互式输入）。
需要其一：配置 PAT / 配 SSH key / 装 `gh` 并 `gh auth login`。
本地提交是安全的，`.env` 已确认被 `.gitignore` 排除。

### 阶段 1 · 数据迁移
- [ ] `docs/migration-map.md`
- [ ] 迁移脚本（幂等）
- [ ] 图片迁移（1088 张 → 两级分片 + Image/ImageRef）

### 阶段 2 · 核心资产 + 验收基准
- [ ] `docs/sources.md`（3 个源接口契约，参考资料）
- [ ] `docs/matching.md`（判同需求 + 边界案例）
- [ ] `docs/feature-parity.md`（74 端点 + 14 功能区 + 6 cron + 20 筛选维度）
- [ ] `docs/baseline.json` 业务不变量基准 + Vitest 断言
- [ ] `backend/src/core/matching/` 判同算法重新实现

### 阶段 3-7
见 `PLAN.md`。

---

## 待落实的架构决策

### 配置系统要重构（用户明确要求，2026-09-03）

上一代 `.env` 有 **150+ 个变量**,配置成本极高。新原则:

```
放 .env（极少）    仅【极敏感】或【运行时必需、无法自举】的:
                   DATABASE_URL · REDIS_URL · NODE_ENV · PORT
                   凭据类:CPP 账号密码 · WxPusher token · SCDN token

放数据库（其余全部）  爬虫并发/重试/超时 · 图片压缩质量与尺寸 · 缓存 TTL
                   限流阈值 · SCDN 端点与路由策略 · 通知模板 · SEO 文案
                   分析采样率与保留期 · 变更通知窗口 · 源移除确认次数
                   → 后台随时修改、热生效，不需要重启也不需要改文件
```

**schema 待改**:把 `SiteSetting`(纯 key-value + jsonb) 扩展成完整配置表,需要
`category` 分组、`valueType` 类型元数据（供后台自动生成表单）、`isSecret` 敏感标记
（敏感项不返回给前台）、`defaultValue`、`description`。这样后台配置页可以由元数据驱动生成。

---

## 数据迁移基线（实测 `D:\gaimo\baonly_web\data_e8ktN`）

```
sources/_merged.sqlite   148 个爬取活动（payload 是 v8.serialize 的 BLOB）
  + manual_events 17 个人工登记（旧库独立表，运行时 union）→ 新库共 165 个 Event
sources/bilibili|cpp|dlcomic.sqlite   259 条源记录
  ⚠ 不是 257！257 是按 sources[](去重后的源"种类")算的 44×1+99×2+5×3；
    真实条数看 sourceRecords[] = 259（1 个活动在同一源下有 2 条记录）
  多源合并分布（爬取的 148 个）:单源 44 / 双源 99 / 三源 5  → 多源占 70%
  含票档 124 · 含 fieldSources 148(100%) · 含 changeNotices 102(69%)
  嘉宾 245 位（225 位有简介、231 位有源站 id）
baonly.sqlite  event_overrides 123 · event_tags 66 · manual_events 17
               organizers 11 · disabled_details 11 · site_settings 13
               tag_styles 7 · hidden_events 5 · admin_tokens 2
               announcements 1 · api_keys 1 · source_sessions 1
               analytics_daily_rollups 1519 · analytics_ip_geo 1259
               analytics 明细 664k 行 ← 只迁最近 30 天
               client_blocks / hidden_tickets / removed_source_events 为 0 行
               但【功能是活的】，新 schema 不得省略
images/  1087 张 webp（目录里 1088 个文件，其中 _hosted.json 是索引不是图片）
         ⚠ 旧文件名是 sha256(源 URL) 不是内容哈希 → 迁移时重算内容哈希，
           去重后约 1025 个唯一内容；Image.sourceUrl 保留 URL→图片 反查
calendar.json → Holiday    cache.json 弃（5 月旧快照）
```

**最危险的一步**:时间字段。旧库把 Asia/Shanghai 的 ISO 串存在 `TEXT` 里,
转 `timestamptz` 时同类错误会一次性污染全表且不可逆。迁移脚本必须先在副本上跑,
并断言若干已知活动的时间与线上一致。
