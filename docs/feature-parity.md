# 功能对等清单（Feature Parity Checklist）

> **本清单是"新系统功能与旧系统完全一致"这一验收标准的唯一可执行形式。**
>
> `baonly-nextgen` 是 `baonly_web` 的完全重写：架构、代码、UI 全部换新，但**对外可观察的功能行为必须逐项一致**。
> 判定"重写完成"的依据不是"跑起来了"，而是本清单里每一行的状态列都变成 `✅ 已验证`。
>
> **使用方式**
> 1. 实现一项功能后，回到本文件，填写"新实现位置"，把状态改为 `🟡 已实现`。
> 2. 按"验证方式"列实际操作一遍（不是读代码，是运行），通过后改为 `✅ 已验证`。
> 3. 决定**故意不做**的功能，改为 `❌ 已放弃`，并在该行末尾追加一句放弃理由——空着不算，放弃必须显式留痕。
> 4. 任何一项都不允许"默认它已经好了"。单人 + AI 重写最典型的失败模式，就是上线后陆续发现二十个没人记得的边角功能。
>
> **状态图例**：`⬜ 未开始` · `🟡 已实现` · `✅ 已验证` · `❌ 已放弃`
>
> 旧系统位置以 `baonly_web` 仓库为基准。行号会随旧仓库变动而失效，把它当"大致坐标"而不是精确引用。

---

## 0. 规模概览

| 维度 | 数量 | 说明 |
| --- | --- | --- |
| API 端点 | **74** | 含 SPA catch-all 与 2 个 SEO 路由 |
| 后台功能区（旧为 Dialog） | **14** | 新架构要求改为路由页面，不再是模态框 |
| 定时任务 | **6** | 全部 `Asia/Shanghai` 时区 |
| 前台筛选维度 | **20** | 服务端 14 个查询参数 + GPS/距离 + 状态卡 + 分页 + 标签 + 往期开关 |
| 数据表 | **21** | 见第 8 节 |
| 爬虫数据源 | **4** | bilibili / dlcomic / allcpp，第 4 个 baonlytime 已硬禁用 |
| 鉴权面 | **3** | 内部加密信道 / 公开 API Key / 管理员 HMAC 挑战 |

---

## 1. API 端点（74）

### 1.1 公共数据（前台 SPA 读取）

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 活动列表（GET，兼容 API Key 走公开格式） | `GET /api/events` · `routes/public-events.js:212` | `backend/src/modules/events/` | ⬜ 未开始 | 前台首页能加载列表；带 `x-api-key` 请求同一路径返回公开格式 |
| 活动列表（POST 查询体，加密信道） | `POST /api/events/query` · `public-events.js:220` | `backend/src/modules/events/` | ⬜ 未开始 | 前台改筛选条件后列表变化，请求体为加密载荷 |
| 活动详情（GET by id） | `GET /api/events/:id` | `backend/src/modules/events/` | ⬜ 未开始 | 访问 `/event/<id>` 能出详情 |
| 活动详情（POST，加密信道主路径） | `POST /api/events/detail` · `public-events.js:271` | `backend/src/modules/events/` | ⬜ 未开始 | 前台点开详情弹层，抓包确认走 POST 且加密 |
| 建立公开加密会话（ECDH 握手） | `POST /api/session/public` · `public-events.js:196` | `backend/src/modules/session/` | ⬜ 未开始 | 首次进站自动握手成功；清 storage 后重新握手 |
| 前台可见性过滤（hidden / sourceRemoved 一律不出现） | `filterEvents` 前的 `visible` 计算 | `backend/src/core/events/visibility.ts` | ⬜ 未开始 | 后台隐藏一个活动，前台列表与详情都拿不到 |

### 1.2 导出（6 种，见第 7 节高危项）

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| CSV 导出 | `GET /api/export.csv` | `backend/src/modules/export/` | ⬜ 未开始 | 下载后用 Excel 打开，中文不乱码、列齐全 |
| ICS 日历导出（全量） | `GET /api/export.ics` | `backend/src/modules/export/` | ⬜ 未开始 | 导入系统日历，事件时间为 Asia/Shanghai |
| JSON 导出 | `GET /api/export.json` | `backend/src/modules/export/` | ⬜ 未开始 | 下载文件为合法 JSON，字段与列表接口一致 |
| XLSX 导出（全量） | `GET /api/export.xlsx` | `backend/src/modules/export/` | ⬜ 未开始 | Excel 能打开，无损坏提示 |
| **单活动 ICS** | `GET /api/events/:id/ics` | `backend/src/modules/export/` | ⬜ 未开始 | 详情页"加入日历"按钮下载单条 ics 并可导入 |
| **按当前筛选导出 XLSX** | `POST /api/events/export.xlsx` · `public-events.js:226` | `backend/src/modules/export/` | ⬜ 未开始 | 先筛出 3 条，导出的 xlsx 恰好 3 行 |
| 导出冷却限流（同一身份短时间内二次导出 429） | `exportCooldownState` / `rejectExportCooldown` · `public-events.js:72-110` | `backend/src/modules/export/cooldown.ts` | ⬜ 未开始 | 连点两次导出，第二次返回 429 且前台显示倒计时 |

### 1.3 图片

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 图片代理（外链取图 + 压缩） | `GET /api/image` · `routes/images.js` | `backend/src/modules/images/` | ⬜ 未开始 | 传一个外部图 URL 能正常返回图片 |
| 本地图片缓存读取 | `GET /api/image-cache/:file` | `backend/src/modules/images/` | ⬜ 未开始 | 二次访问同图命中缓存（响应更快 / 日志显示 hit） |
| 后台上传图片 | `POST /api/admin/upload-image` | `backend/src/modules/images/` | ⬜ 未开始 | 后台编辑活动时上传封面成功并回显 |
| 图片上传队列处理（手动触发） | `POST /api/admin/image-upload-queue/process` | `backend/src/modules/images/` | ⬜ 未开始 | 队列有积压时点一次，积压数下降 |
| 图片缓存清理（手动触发） | `POST /api/admin/image-cache/cleanup` | `backend/src/modules/images/` | ⬜ 未开始 | 触发后返回清理数量，磁盘占用下降 |
| 图床可用性/路由信息 | `GET /api/admin/image-hosts` · `images.js:298` | `backend/src/modules/images/` | ⬜ 未开始 | 后台能看到两个 CDN 域名及其状态 |

### 1.4 公开 API（第三方集成）

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 公开活动列表 | `GET /api/public/events` | `backend/src/modules/public-api/` | ⬜ 未开始 | 带有效 key 返回数据；不带 key 返回 404（不是 401） |
| 公开活动详情 | `GET /api/public/events/:id` | `backend/src/modules/public-api/` | ⬜ 未开始 | 同上；无效 key 同样 404 |
| API Key 鉴权（`x-api-key` / `Bearer`） | `api_keys` 表 + 中间件 | `backend/src/core/auth/api-key.ts` | ⬜ 未开始 | 两种传参方式都能通过；禁用的 key 立刻失效 |

### 1.5 访客交互

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 拉取待执行的访客控制指令 | `POST /api/presence/actions` · `public-events.js:205` | `backend/src/modules/presence/` | ⬜ 未开始 | 后台下发"弹窗"，前台在数秒内弹出 |
| 指令幂等（已执行的不重复下发） | 同上，`seen` 集合去重 | `backend/src/modules/presence/` | ⬜ 未开始 | 同一条指令刷新页面后不再重复执行 |

### 1.6 SEO

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 动态 robots.txt（内容来自站点设置） | `GET /robots.txt` | `backend/src/modules/seo/` | ⬜ 未开始 | 改后台 SEO 设置里的 robotsTxt，刷新即生效 |
| 动态 sitemap.xml（首页/地图/活动/往期分别可开关、各自 changefreq 与 priority） | `GET /sitemap.xml` + `defaultSiteSettings.seo` · `db.js:37-64` | `backend/src/modules/seo/` | ⬜ 未开始 | 关掉"包含往期"后 sitemap 里往期活动消失 |
| 页面 meta 模板（首页/地图/活动详情标题描述模板、`{title}` 等占位符） | `defaultSiteSettings.seo.*Template` | `frontend/client/` + SSR/预渲染或注水 | ⬜ 未开始 | 查看活动页 `<title>`，占位符已被替换 |

### 1.7 管理员鉴权

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 取登录挑战 | `POST /api/admin/auth/challenge` | `backend/src/modules/admin-auth/` | ⬜ 未开始 | 打开后台登录页拿到 challenge |
| HMAC 证明登录（令牌不过网） | `POST /api/admin/auth/login` | `backend/src/modules/admin-auth/` | ⬜ 未开始 | 抓包确认请求体里没有明文令牌，仍能登录成功 |
| 登出 | `POST /api/admin/auth/logout` | `backend/src/modules/admin-auth/` | ⬜ 未开始 | 登出后刷新即回到登录页 |
| 会话检查 | `GET /api/admin/auth/check` | `backend/src/modules/admin-auth/` | ⬜ 未开始 | 已登录返回有效，未登录返回 404 |
| 滑动续期会话（旧为 36h） | `createAdminSession` · `index.js:2362` | `backend/src/core/auth/admin-session.ts` | ⬜ 未开始 | 持续操作不掉线；长时间空闲后过期 |
| 未授权一律 404（不用 401） | `requireAdmin` · `index.js:2656` | `backend/src/core/auth/` | ⬜ 未开始 | 未登录直接请求任一 `/api/admin/*`，返回 404 |

### 1.8 活动管理

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 后台活动列表（含隐藏项与隐藏元信息） | `GET /api/admin/events` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 后台能看到前台看不到的隐藏活动 |
| 编辑活动（字段覆盖） | `PUT /api/admin/events/:id` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 改标题后前台立即变化，且下次爬虫刷新不被覆盖回去 |
| 显示/隐藏活动 | `PATCH .../:id/visibility` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 隐藏后前台列表与详情均不可见 |
| 置顶/推荐 | `PATCH .../:id/featured` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 置顶后出现在前台推荐位 |
| 打标签 | `PATCH .../:id/tags` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 加标签后前台标签筛选能筛到 |
| **票档级可见性** | `PATCH .../:id/tickets/:ticketId/visibility` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 隐藏单个票档，详情页只少这一档、其他票档仍在 |
| **详情访问开关（独立于隐藏的第二个开关）** | `PATCH .../:id/detail-access` · `admin-events.js:146` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 关掉后：活动仍在列表里，但点进详情被拒 |
| **手动判同/合并来源** | `POST .../:id/source-match` · `admin-events.js:160` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 见第 7 节——旧实现只允许合并 baonlytime 补充源，而该源已禁用，需先决定新语义 |
| 手动触发爬虫刷新（可指定源） | `POST /api/refresh` · `admin-events.js:223` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 指定 `source=bilibili` 能刷新；指定已禁用源返回 410 |

### 1.9 手动活动（人工录入，非爬虫）

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 新建手动活动 | `POST /api/events/manual` · `admin-events.js:98` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 录一条，前台能查到且带"手动"来源标识 |
| 编辑手动活动 | `PUT /api/events/manual/:id` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 改完前台同步变化 |
| 删除手动活动 | `DELETE /api/events/manual/:id` | `backend/src/modules/admin-events/` | ⬜ 未开始 | 删除后前台消失，且不影响同城其他活动 |
| 手动活动与爬虫活动同池排序/筛选 | `mergeEventRecords` 后统一进 cache | `backend/src/core/events/merge.ts` | ⬜ 未开始 | 手动活动参与价格、时间、城市筛选，与爬虫活动无差别 |

### 1.10 内容管理

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 公告：列表 / 新建 / 编辑 / 删除 | `GET·POST /api/admin/announcements`、`PUT·DELETE .../:id` | `backend/src/modules/admin-content/` | ⬜ 未开始 | 发一条公告，前台按其展示方式出现 |
| 公告展示方式（`display` 字段：弹窗 / 公告中心） | `announcements.display` · `db.js:380` | `backend/src/modules/admin-content/` | ⬜ 未开始 | 弹窗型进站即弹；中心型只在公告中心列表里 |
| 公告发布时间按 Asia/Shanghai 解析 | 旧修复记录（提交 `d93d697`） | `backend/src/core/time/` | ⬜ 未开始 | 设 23:30 发布，不会因时区偏移变成次日 |
| 主办方：列表 / 新建 / 编辑 / 删除（含主办颜色） | `/api/admin/organizers` 四个方法 | `backend/src/modules/admin-content/` | ⬜ 未开始 | 建一个主办方并设颜色，前台对应活动显示该色 |
| 标签样式：读取 / 按标签更新（含"彩虹"特殊色） | `GET /api/admin/tag-styles`、`PUT .../:tag` | `backend/src/modules/admin-content/` | ⬜ 未开始 | 把某标签设为彩虹，前台该标签有渐变效果 |
| 标签排序位置（tagPositions） | `tagListPayload(events, tagStyles, tagPositions)` | `backend/src/modules/admin-content/` | ⬜ 未开始 | 调整顺序后前台标签筛选下拉顺序随之变化 |
| 站点设置（备案号、公安备案及链接、友情链接、推荐位、SEO、通知模板） | `PUT /api/admin/site` + `defaultSiteSettings` · `db.js:8-71` | `backend/src/modules/admin-content/` | ⬜ 未开始 | 逐个字段改一遍，前台页脚/推荐位/SEO 都跟着变 |

### 1.11 系统管理与运维

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 后台元信息（源状态、版本、刷新态） | `GET /api/meta` · `admin-dashboard.js:36` | `backend/src/modules/admin-dashboard/` | ⬜ 未开始 | 后台首页显示各源最后刷新时间与错误 |
| 访问统计仪表盘 | `GET /api/admin/analytics` | `backend/src/modules/analytics/` | ⬜ 未开始 | 有访问后图表出数；注意旧实现是慢查询（见第 7 节） |
| 清空统计明细 | `POST /api/admin/analytics/details/clear` | `backend/src/modules/analytics/` | ⬜ 未开始 | 清空后明细为空、汇总仍保留 |
| 统计维护策略：读取 / 保存 / 立即执行 | `GET·PUT /api/admin/analytics/maintenance`、`POST .../run` | `backend/src/modules/analytics/` | ⬜ 未开始 | 设保留 31 天并立即执行，超期数据被清 |
| 日志查看（按级别 all/info/warn/error/debug、按频道 access/admin/security/app/crawler/seo/performance、关键字） | `GET /api/admin/logs` + `admin.jsx:138-152` | `backend/src/modules/admin-logs/` | ⬜ 未开始 | 逐个级别与频道筛一遍，结果符合预期 |
| 清空日志 | `POST /api/admin/logs/clear` | `backend/src/modules/admin-logs/` | ⬜ 未开始 | 清空后列表为空 |
| 日志维护策略：读取 / 保存 / 立即执行（含"保留错误日志"开关） | `GET·PUT /api/admin/logs/maintenance`、`POST .../run` + `db.js:17-28` | `backend/src/modules/admin-logs/` | ⬜ 未开始 | 开启 keepErrors 后执行清理，error 级日志仍在 |
| 管理员令牌：列表 / 新建 / 编辑 / 删除 | `/api/admin/tokens` 四个方法 | `backend/src/modules/admin-auth/` | ⬜ 未开始 | 新建一个令牌，用它能登录；删除后不能 |
| 令牌长度校验（生产 ≥32 位） | `adminTokenMinLength` · `db.js:97` | `backend/src/core/auth/` | ⬜ 未开始 | 生产模式提交短令牌被 400 拒绝 |
| API Key：列表 / 新建 / 编辑（启停） / 删除 | `/api/admin/api-keys` 四个方法 | `backend/src/modules/public-api/` | ⬜ 未开始 | 新建 key 可用；禁用后立即 404；删除后同样 |
| API Key 使用痕迹（最后使用时间 / IP） | `api_keys.last_used_at/last_used_ip` · `db.js:354` | `backend/src/modules/public-api/` | ⬜ 未开始 | 用 key 请求一次，后台看到刚才的时间与 IP |

### 1.12 访客管控

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 实时在线访客列表 | 后台 WS `broadcastAdminState` + presence | `backend/src/modules/presence/` | ⬜ 未开始 | 另开一个浏览器访问前台，后台在线列表出现该访客 |
| **远程控制访客浏览器（12 种动作）** | `POST /api/admin/presence/actions` + `admin.jsx:967-981` | `backend/src/modules/presence/` | ⬜ 未开始 | 见第 7 节，12 种逐一实测 |
| 封禁规则：列表 / 新建 / 启停 / 删除 | `GET·POST /api/admin/presence/blocks`、`POST .../:id/enable`、`DELETE .../:id` | `backend/src/modules/presence/` | ⬜ 未开始 | 封自己的指纹，前台被拒；解封后恢复 |
| 封禁维度（指纹 / 网络指纹 / 请求 IP / 浏览器上报 IP / WebRTC IP） | `presenceBlockOptions` · `admin.jsx:950-960` | `backend/src/modules/presence/` | ⬜ 未开始 | 5 个维度各封一次，都能生效 |
| 代理嫌疑标记 | `webRtcProxyLikely` · `admin.jsx:1074,1770` | `backend/src/modules/presence/` | ⬜ 未开始 | 挂代理访问，后台标出"疑似代理" |

---

## 2. 后台功能区（旧 14 个 Dialog → 新 14 个路由页）

> **架构要求**：旧系统把整个后台塞在 `src/app/pages/admin.jsx`（约 4.8k 行），全部是模态框、没有 URL。
> 新后台必须是**真正的路由**：可直接粘贴 URL 打开、可前进后退、可刷新保持、深层状态进 query string。
> 这一条本身就是验收项——"能不能把某个活动的编辑页链接发给自己"。

| 旧 Dialog | 职责 | 新实现位置（路由） | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| `EventFormDialog` | 活动完整表单（新建/编辑核心） | `frontend/dashboard/` → `/events/:id/edit` | ⬜ 未开始 | 刷新页面表单状态仍在正确活动上 |
| `EditDialog` | 活动字段快速编辑 | `/events/:id` 内联编辑 | ⬜ 未开始 | 改单字段即时保存并回显 |
| `ManualDialog` | 手动活动录入 | `/events/manual/new`、`/events/manual/:id` | ⬜ 未开始 | 录入后可直接用 URL 回到该条 |
| `QuickRegisterDialog` | 快速登记（简化录入流） | `/events/quick-register` | ⬜ 未开始 | 走一遍最短录入路径能出一条活动 |
| `RegisterMethodDialog` | 报名/购票方式维护 | `/events/:id/register-method` | ⬜ 未开始 | 设置后前台详情显示对应购票入口 |
| `SiteSettingsDialog` | 站点设置（备案/友链/推荐/SEO/通知模板） | `/settings` | ⬜ 未开始 | 每个分组都能存并生效 |
| `AnnouncementManagerDialog` | 公告管理 | `/announcements` | ⬜ 未开始 | 增删改查四个操作 |
| `OrganizerManagerDialog` | 主办方管理 | `/organizers` | ⬜ 未开始 | 增删改查 + 颜色 |
| `TagStyleManagerDialog` | 标签样式与排序 | `/tags` | ⬜ 未开始 | 改色/改序，前台同步 |
| `TokenManagerDialog` | 管理员令牌管理 | `/settings/tokens` | ⬜ 未开始 | 新令牌可登录 |
| `ApiKeyManagerDialog` | 公开 API Key 管理 | `/settings/api-keys` | ⬜ 未开始 | 新 key 可调公开 API |
| `AnalyticsDashboardDialog` | 访问统计（含在线访客与控制） | `/analytics` | ⬜ 未开始 | 图表出数 + 在线列表可控制 |
| `LogViewerDialog` | 日志查看与筛选 | `/logs` | ⬜ 未开始 | 级别/频道/关键字三种筛选 |
| `DataMaintenanceDialog` | 数据维护（统计/日志清理策略、图片缓存） | `/maintenance` | ⬜ 未开始 | 策略可存、可立即执行 |

---

## 3. 定时任务（6，全部 Asia/Shanghai）

> 旧系统全部挂在 `server/index.js:10868-10925`（`scheduleCron`）。新系统入口为 `backend/src/worker.ts`。
> **注意**：旧系统是单进程内嵌 cron。若新系统多实例部署，必须保证这些任务只有一个执行者，否则会重复刷新、重复清理。

| 任务 | cron | 做什么 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| 数据源刷新 | `0 0,12 * * *` | 每天 0 点与 12 点：先刷新加速 hosts 文件，再跑全量爬虫刷新 | `backend/src/worker.ts` | ⬜ 未开始 | 改 cron 为每分钟观察一次真实执行，日志有刷新记录 |
| 图片缓存清理 | `30 3 * * *` | 凌晨 3:30 清理过期/超量图片缓存 | `backend/src/worker.ts` | ⬜ 未开始 | 手动灌入过期缓存，跑一次后被清 |
| 会话与在线态清理 | `0 0 * * *` | 每天 0 点清理过期管理员会话，并广播一次在线态 | `backend/src/worker.ts` | ⬜ 未开始 | 过期会话失效；后台在线列表刷新 |
| 统计数据维护 | 可配置（`analyticsMaintenanceCron`） | 按站点设置里的保留天数清理统计明细、写维护记录 | `backend/src/worker.ts` | ⬜ 未开始 | 配置生效；`analytics_maintenance_runs` 有新行 |
| 日志维护 | `17 4 * * *` | 凌晨 4:17 按策略清理日志（可保留 error） | `backend/src/worker.ts` | ⬜ 未开始 | 超期普通日志被清、error 保留 |
| WAL Checkpoint | `37 */6 * * *` | 每 6 小时把 SQLite WAL 落盘，防止 WAL 无限增长 | `backend/src/worker.ts` 或数据库层 | ⬜ 未开始 | 若新系统换 Postgres，此项标 `❌ 已放弃` 并写明原因 |
| 图床保活 | 启动后延时触发（非 cron，但属周期任务） | `scheduleHostedImageKeepalive` · `index.js:10933` | `backend/src/worker.ts` | ⬜ 未开始 | 长时间不访问后图床首图仍然秒开 |

---

## 4. 前台筛选与列表（20 个维度）

> 服务端权威过滤在 `server/index.js:9346 filterEvents` 与 `9551 publicSortEvents`；
> UI 在 `src/app/components/shared.jsx:638 Filters`；状态与分页在 `src/app/pages/public.jsx:141`。
> **关键**：筛选必须是服务端过滤 + 服务端分页。旧系统前端只持有当前页，不是"全量拉下来本地筛"。

| # | 维度 | 行为要点 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| 1 | 关键字 `q` | 同时匹配标题、场馆、城市、主办方、标签；大小写不敏感 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 用主办方名搜索能命中（不只是标题） |
| 2 | 省份 `province` | 需归一化：直辖市→`北京市`、自治区全称、去后缀 | `backend/src/core/regions/` | ⬜ 未开始 | 输入"广西"能匹配到"广西壮族自治区"的活动 |
| 3 | 城市 `city` | 归一化：去"市/地区/自治州/特别行政区"后缀 | `backend/src/core/regions/` | ⬜ 未开始 | "上海市"与"上海"结果一致 |
| 4 | 大区 / 省市联动 | 选省后城市下拉只剩该省城市（facets 联动） | `frontend/client/` | ⬜ 未开始 | 选江苏，城市下拉不出现广州 |
| 5 | 标签 `tag` | 精确匹配活动标签数组 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 选一个标签，结果全部含该标签 |
| 6 | 最低价 `minPrice` | 单位是**元**，服务端乘 100 转分；与 `priceHigh` 比较 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 填 50，票价上限低于 50 的活动被排除 |
| 7 | 最高价 `maxPrice` | 同上，与 `priceLow` 比较 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 填 30，起价高于 30 的活动被排除 |
| 8 | 价格区间语义 | 是"区间重叠"而非"区间包含"；价格为 null 时不参与排除 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 一个 20-100 元的活动，在 50-60 筛选下应出现 |
| 9 | 状态 `status` | `upcoming` / `ongoing` / `past` / `all`；默认 `upcoming` | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 不传参数时只出未开始场次 |
| 10 | 状态统计卡（4 张，可点击当筛选器） | 总数/已结束/未开始/已开始，点击即切 status | `frontend/client/` | ⬜ 未开始 | 点"已结束"卡片，列表切到往期且卡片高亮 |
| 11 | 含往期 `includePast` | 独立开关；未显式给 status 且未开此项时强制 `upcoming` | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 打开后往期活动混入列表 |
| 12 | 日期模式 `dateMode` | 三选一：`holiday` / `day` / `range`，空为全部 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 三种模式各切一次，表单字段随之切换 |
| 13 | 节假日名 `holidayName` | 仅 `dateMode=holiday` 时生效；选项来自活动的 `dateType.name` | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 选"国庆节"，只出国庆期间活动 |
| 14 | 指定某天 `dateValue` | 按 Asia/Shanghai 该日 00:00:00–23:59:59.999 与活动区间**重叠**判定 | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 一个跨 3 天的活动，选其中任意一天都应出现 |
| 15 | 时间段 `dateFrom`/`dateTo` | **支持单边**（只填起始或只填终止） | `backend/src/core/events/filter.ts` | ⬜ 未开始 | 只填起始日期，返回该日之后所有活动 |
| 16 | 排序（6 种） | 离现在最近 / 时间正序 / 时间倒序 / 价格低到高 / 价格高到低 / 距离最近 | `backend/src/core/events/sort.ts` | ⬜ 未开始 | 6 种逐一切换，首条结果符合预期 |
| 17 | GPS 定位 + 距离排序 | 浏览器定位取坐标，Haversine 算距离；无定位时该排序项禁用并提示"需定位" | `frontend/client/` + `backend/src/core/geo/` | ⬜ 未开始 | 未授权定位时该选项显示"需定位"；授权后按距离排序 |
| 18 | 分页（页码 + 每页条数） | 每页条数记忆到本地存储 | `frontend/client/` + 服务端分页 | ⬜ 未开始 | 改每页 50 条，刷新后仍是 50 |
| 19 | 移动端筛选面板折叠 | 窄屏默认折叠，折叠时摘要显示当前状态 | `frontend/client/` | ⬜ 未开始 | 手机视口下面板默认收起且显示"默认未开始" |
| 20 | 筛选变更重置到第 1 页 | 任一筛选条件变化后回到首页（`public.jsx:515-543` 的依赖数组） | `frontend/client/` | ⬜ 未开始 | 翻到第 3 页后改筛选，页码回到 1 |

---

## 5. 前台页面与展示功能

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| 首页列表 | `src/app/pages/public.jsx` | `frontend/client/` → `/` | ⬜ 未开始 | 能出列表、能筛、能翻页 |
| 活动详情（弹层 + 独立 URL 双形态） | `PublicApp` 详情 + `/event/<id>` | `frontend/client/` → `/event/:id` | ⬜ 未开始 | 列表点开是弹层；直接访问 URL 是独立页 |
| 聚焦卡（Spotlight：下一场 / 当前场次 / 最近场次） | `spotlightEvents` · `public.jsx:138,671-678` | `frontend/client/` | ⬜ 未开始 | 三种状态下标题分别为"下一场""当前场次""最近场次" |
| 多个进行中场次的轮播切换（`当前场次 2/5`） | `ongoingSpotlightIndex` · `public.jsx:177,896-924` | `frontend/client/` | ⬜ 未开始 | 有多场进行中时可左右切换且显示序号 |
| 时间轴视图（stack / mixed 两种布局） | `timelineLayout` · `public.jsx:709` | `frontend/client/` | ⬜ 未开始 | 宽屏与窄屏布局不同且都不错版 |
| 倒计时 / 进度条（含结束后进度） | `CountdownProgress` · `shared.jsx:723` | `frontend/client/` | ⬜ 未开始 | 未开始显示倒计时；进行中显示进度；结束后显示"距结束多久" |
| 共享 1Hz 时钟（叶子组件订阅，根组件不重渲染） | `public.jsx:125` 注释 + 共享 ticker | `frontend/client/` | ⬜ 未开始 | 页面挂 100 张卡片，性能面板无每秒整树重渲染 |
| **客户端时钟偏移告警** | `clockWarning` · `public.jsx:162,1128` | `frontend/client/` | ⬜ 未开始 | 把系统时间改偏 1 小时，前台出现时钟异常提示 |
| 全国地图页 | `src/app/pages/map.jsx`（497 行） | `frontend/client/` → `/map` | ⬜ 未开始 | 地图能渲染、省份可 hover/点选 |
| 地图：省 → 市 下钻 | `selectedProvince` / `selectedCityKey` · `map.jsx:306-307` | `frontend/client/` | ⬜ 未开始 | 点省份进入该省城市视图，可返回 |
| 地图：省份活动数着色 | `provinceCityMap` · `map.jsx:304` | `frontend/client/` | ⬜ 未开始 | 活动多的省颜色更深 |
| 公告弹窗 + 公告中心 | `modalAnnouncement` / `showAnnouncementCenter` · `public.jsx:168-169` | `frontend/client/` | ⬜ 未开始 | 弹窗型进站弹出且可关闭不再弹；中心型在列表可查 |
| 关注/收藏活动（本地存储） | `useInterests` · `core.js:634` | `frontend/client/` | ⬜ 未开始 | 关注后刷新仍在；清 storage 后消失 |
| 标签彩虹样式 | `TagPill` + `tag-rainbow` · `shared.jsx:605` | `frontend/client/` | ⬜ 未开始 | 设为彩虹的标签有渐变 |
| 主办方颜色渗透到标签/卡片 | `tagStyle` · `shared.jsx:598` | `frontend/client/` | ⬜ 未开始 | 改主办颜色，相关卡片配色跟着变 |
| 深浅色主题 | `theme` prop 贯穿两个 App | `frontend/client/` | ⬜ 未开始 | 切换主题，地图与列表都正确跟随 |
| 回到顶部按钮 | `showBackToTop` · `public.jsx:174` | `frontend/client/` | ⬜ 未开始 | 下滑一段后出现，点击回顶 |
| 实时更新提示条（有新数据时提示） | `realtimeNotice` · `public.jsx:175` | `frontend/client/` | ⬜ 未开始 | 后台改数据，前台出现"有更新"提示 |
| 页脚备案信息 + 友情链接 | `defaultSiteSettings.icpNo/policeNo/policeUrl/friendLinks` | `frontend/client/` | ⬜ 未开始 | 三项备案与友链都能从后台配出来 |
| Markdown 渲染（公告/详情富文本） | `markdownToHtml` · `core.js:776` | `frontend/client/` | ⬜ 未开始 | 公告里的列表、加粗、链接正确渲染且无 XSS |
| 外链安全化（只允许 http/https） | `safeExternalUrl` · `core.js:183` | `frontend/client/` | ⬜ 未开始 | 构造 `javascript:` 链接不被渲染为可点 |

---

## 6. 数据源与合并

| 功能 | 旧系统位置 | 新实现位置 | 状态 | 验证方式 |
| --- | --- | --- | --- | --- |
| Bilibili 会展爬虫 | `fetchBilibiliEvents` · `index.js:6334` | `backend/src/sources/bilibili/` | ⬜ 未开始 | 刷新后有 bilibili 来源活动入库 |
| dlcomic（叮铃铃）爬虫 | `fetchDlcomicEvents` · `index.js:6508` | `backend/src/sources/dlcomic/` | ⬜ 未开始 | 同上 |
| allcpp（CPP）爬虫 | `fetchCppEvents` · `index.js:7175` | `backend/src/sources/allcpp/` | ⬜ 未开始 | 同上 |
| baonlytime 爬虫 | `fetchBaonlytimeEvents` · `index.js:8046`，**已硬禁用** | — | ⬜ 未开始 | 决定是否重建；若不建则标 `❌ 已放弃` |
| 刷新编排（多源并发、单源失败不拖垮整体） | `refreshEventCache` · `index.js:8097`、`runRefreshSource` · `index.js:1797` | `backend/src/sources/orchestrator.ts` | ⬜ 未开始 | 断网一个源，其余源仍刷新成功 |
| 跨源判同与合并 | `mergeEventRecords` · `index.js:5678` | `backend/src/core/matching/` | ⬜ 未开始 | 同一场活动在两个源都有时，前台只出现一条 |
| 归一化为统一活动模型 | 各 normalizer | `backend/src/core/events/normalize.ts` | ⬜ 未开始 | 三个源的活动字段结构完全一致 |
| 价格以**分**为单位存储 | 全服务端；后台 UI 读 ÷100、提交 ×100 | `backend/src/core/events/` | ⬜ 未开始 | 后台填 88 元，库里是 8800，前台显示 88 |
| 封面图重托管到 CDN | `cacheImage` · `index.js:4392` | `backend/src/modules/images/` | ⬜ 未开始 | 活动封面 URL 指向自有 CDN 而非源站 |
| 图片压缩 | `compressImageBuffer` · `index.js:3976` | `backend/src/modules/images/` | ⬜ 未开始 | 大图入库后体积明显下降且不失真 |
| 节假日类型标注（`dateType`） | 节假日 API 拉取 · `index.js:8887-8889` | `backend/src/core/holidays/` | ⬜ 未开始 | 国庆期间的活动被标为 holiday 且带节日名 |

---

## 7. 最容易在重写中丢掉的隐性功能（**重点**）

> 这一节是全文最有价值的部分。以下每一项都满足三个条件：**旧系统真的有** · **不看代码想不起来** · **漏了不会立刻报错，而是上线后被用户发现**。
> 每条写清：旧系统在哪、为什么容易漏、新实现要注意什么。

### 7.1 六种导出，尤其是两种"非全量"导出

- **旧系统位置**：`GET /api/export.{csv,ics,json,xlsx}`、`GET /api/events/:id/ics`、`POST /api/events/export.xlsx`
- **为什么容易漏**：做导出时很自然只做"导出全部"。而实际最常用的两个恰恰是**单活动 ICS**（详情页"加入日历"）和**按当前筛选导出 XLSX**（后者是 POST，因为筛选条件要放在加密请求体里，扫路由表时容易被当成重复项跳过）。
- **新实现注意**：
  - 单活动 ICS 与全量 ICS 要共用同一套 VEVENT 生成逻辑，否则两个入口的时区/时长处理会分叉。
  - 筛选导出必须复用列表接口那份**服务端过滤 + 排序**代码，不能另写一份，否则"导出结果和我看到的列表不一样"。
  - 二进制/纯文本响应不能被统一的加密响应包装器二次处理（旧系统靠一份白名单，见 `secureJsonResponses` allowlist）。新系统要在响应管道里显式区分。
  - 导出冷却限流也别忘（连点两次要 429，且前台显示剩余秒数）。

### 7.2 节假日筛选依赖外部 API

- **旧系统位置**：`HOLIDAY_API_BASE_URL`（默认 `https://api.jiejiariapi.com/v1`），拉取 `/holidays/{year}`、`/weekends/{year}`、`/workdays/{year}` 三个接口（`index.js:8887`）
- **为什么容易漏**：`dateType` 字段在活动数据里看起来是"自带属性"，不翻爬虫代码不会意识到它来自第三方接口，也不会意识到节假日选项列表是从现有活动里**反推**出来的。
- **新实现注意**：三个接口都要（不只是 holidays——周末与调休工作日决定了"某天是不是假期"的正确判定）；必须缓存并容错，外部 API 挂掉时降级为"无节假日标注"而不是整个刷新失败；跨年时要预取次年数据。

### 7.3 GPS 距离排序

- **旧系统位置**：`Filters` 的定位按钮（`shared.jsx:706`）+ `distanceKm` Haversine（`index.js:9464`）+ `sort=distance`
- **为什么容易漏**：它是唯一一个**依赖浏览器权限**的筛选维度。功能清单里写"排序"一行时很容易只列时间和价格。而且未授权时该选项文案会变成"距离最近（需定位）"——这个降级提示本身也是功能。
- **新实现注意**：坐标要传到服务端参与排序（不是前端对当前页重排，否则跨页排序错乱）；拒绝授权/超时/HTTP 非安全上下文三种失败都要有提示；活动缺坐标时的排序兜底位置要定义清楚。

### 7.4 浏览器通知提醒（3 种触发 + 可配置模板）

- **旧系统位置**：`useInterests` · `core.js:634-774`；模板存在站点设置 `notificationTemplates`（`db.js:65-69`）
- **三种触发**：
  1. `eventDayBefore` — 距开始 ≤24h 且 >0 时发一次（按日期去重）
  2. `eventStart` — 活动状态变为 ongoing 时发一次
  3. `ticketAvailable` — 某票档由"非可售"变为"可售"时发（需要持久化上一次的票档状态快照）
- **为什么容易漏**：整条链路横跨四处——本地存储的关注记录、60 秒轮询定时器、去重键、后台可配置的文案模板。做通知时最容易只做"活动开始提醒"，漏掉**票档开售**这个最有价值的触发（它需要 diff 前后票档状态，是三者里唯一有状态的）。
- **新实现注意**：
  - 去重键要写进本地记录（旧系统用 `sent[dayBefore:日期]` / `sent[start:日期]`），否则每分钟重复弹窗。
  - 票档状态快照必须持久化，否则刷新页面后"从缺货变可售"永远检测不到。
  - Android Chrome 页面上下文禁止 `new Notification()`，必须走 `ServiceWorkerRegistration.showNotification`（旧系统 `safeNotify` 已踩过这个坑，`core.js:624`）。
  - 定时器不能依赖 events/site 作为 effect 依赖，否则每次列表刷新都重置计时器，提醒被永久饿死（旧代码专门为此加了 ref + 空依赖数组）。
  - 模板占位符：`{title}` `{startAt}` `{venueName}` `{ticketName}` `{ticketStatus}`。

### 7.5 字段级来源追踪 —— 前台有三块独立 UI

- **旧系统位置**：服务端 `fieldSources` / `mergeFieldSourcesForEvents`（`index.js:5559-5590`）；前台 `SourceUsageSection`（`shared.jsx:1245`）、`SourceDiffSection`、`changeNotices`（`shared.jsx:1815`）、`SourceRecordsSection`
- **修正一点**：前台并没有"疑似地点变更"这个字样。真实呈现的是**四块**内容，比预想的更多：
  1. **资料来源**（`sourceUsage`）— 逐字段列出"这个字段来自哪几个源"，并标注是否含管理员修订
  2. **源差异**（`sourceDiff`）— 同一字段在不同源之间的取值差异
  3. **变更提示**（`changeNotices`）— 带关联记录列表的变更说明
  4. **多源原始记录切换**（`sourceRecords` + `selectedSourceKeys`）— 用户可以手动切换查看某个源的原始记录
- **为什么容易漏**：`fieldSources` 这个字段名在 `src/` 里搜不到（服务端会把它转换成 `sourceUsage` / `sourceDiff` 再下发），所以按字段名搜索会得出"前台没用到"的错误结论，进而在新系统里把它简化成一个 `sources: string[]`，四块 UI 一起消失。
- **新实现注意**：合并逻辑必须保留**每个字段各自的来源集合**，不能退化为整条活动一个来源列表；管理员编辑要作为一个特殊来源（`admin`）参与追踪，这样前台才能显示"含管理员修订"。

### 7.6 源端下架的"多次确认"机制

- **旧系统位置**：`sourceMissingStreak` + `SOURCE_REMOVAL_CONFIRMATIONS`（默认 2，`source-constants.js:42`）；`markSourceRemovedConfirmed` · `index.js:5440`；`removed_source_events` 表
- **为什么容易漏**：这是一个纯防抖设计——源站接口偶发抽风返回空列表时，**不能立刻**把活动判定为已下架。旧系统要求连续 N 次抓取都缺失才确认下架。新写爬虫时最自然的写法是"这次没抓到就标记删除"，于是源站一次超时就会导致全站活动集体消失。
- **新实现注意**：streak 计数要持久化（不能只在内存）；确认阈值可配置；确认下架的活动进入独立表而不是直接删除（要能恢复、要能在后台看到"曾经存在过"）；下架确认后前台打上"已删除/已取消"标签而不是静默消失（旧系统 `tag-deleted` 样式，`shared.jsx:607`）。

### 7.7 手动判同/合并 —— 旧实现已半死，需先决定新语义

- **旧系统位置**：`POST /api/admin/events/:id/source-match` · `admin-events.js:160-196`
- **实测发现（重要）**：这个接口有两道校验，只允许把 **baonlytime 补充源**的活动合并进目标活动——而 baonlytime 已被硬禁用。也就是说这个功能**在当前生产环境实际不可用**（源是 baonlytime 则 410，不是 baonlytime 则 400，两条路都走不通）。
- **为什么容易漏 / 为什么要单独说**：照抄会得到一个同样不可用的接口；直接不做则失去"自动判同失败时人工兜正"的唯一手段——而跨源判同是这个系统最容易出错的环节。
- **新实现注意**：**先决定语义**，再实现。建议放开为"任意两条活动都可人工合并"，并补上反向操作（拆分/取消合并）——旧系统没有撤销手段，合错了只能改数据库。合并前要有 diff 预览。

### 7.8 票档级可见性

- **旧系统位置**：`PATCH /api/admin/events/:id/tickets/:ticketId/visibility`；`hidden_tickets` 表
- **为什么容易漏**：可见性控制的常见粒度是"活动"，很少有人想到还有"活动内某一个票档"。这是运营在源站放出错误票档、或某档次不希望展示时的实际操作手段。
- **新实现注意**：隐藏票档不能影响该活动的价格区间计算口径（要明确定义：隐藏的票档算不算进 priceLow/priceHigh？旧系统的行为需要实测确认后在新系统固化）；票档 ID 来自源站，跨刷新要稳定，否则隐藏记录会失效。

### 7.9 详情访问开关（独立于隐藏的第二个开关）

- **旧系统位置**：`PATCH /api/admin/events/:id/detail-access`；`disabled_details` 表；`setDetailDisabled`
- **为什么容易漏**：和"隐藏活动"看起来重复，实际语义完全不同——**活动仍在列表里可见、可搜索、可统计，但点进去看不到详情**。用于源站详情有问题但仍想保留活动条目的场景。做权限模型时几乎必然被合并成一个 `hidden` 布尔值。
- **新实现注意**：两个开关必须独立存储、独立控制；四种组合（可见+可看详情 / 可见+禁详情 / 隐藏+可看 / 隐藏+禁）都要有确定行为；被禁详情的活动其 `sitemap` 与 SEO 收录策略要一并想清楚。

### 7.10 访客实时在线 + 远程控制浏览器（12 种动作）

- **旧系统位置**：`POST /api/admin/presence/actions`；动作列表 `admin.jsx:967-981`；前台执行侧 `POST /api/presence/actions`
- **12 种动作**：弹窗 `alert` · 通知 `notify` · 刷新 `reload` · 临时阻断 `blocked` · 解除临时阻断 `unblock` · 禁用交互 `interactions{disabled:true}` · 恢复交互 `interactions{disabled:false}` · 跳转 `navigate` · 清理存储 `clear-storage` · 到顶部 `scroll-top` · 到底部 `scroll-bottom` · 改标题 `set-title`
- **为什么容易漏**：这是整个系统里最不寻常的功能，写在"访客统计"页面的一个折叠面板里（`<details>` 标签，默认收起，标题是"控制用户浏览器"）。不逐行读 4.8k 行的 admin.jsx 根本发现不了。做统计页时只会做图表。
- **新实现注意**：需要一条服务端 → 特定访客的下行通道（旧系统靠前台轮询 `POST /api/presence/actions` + `seen` 集合幂等，也有 WS 通道 `presence:action`）；每种动作要有幂等键，否则刷新页面重复执行；`clear-storage` 和 `navigate` 是破坏性动作，后台应二次确认。

### 7.11 访客封禁（5 个维度 + 启停）

- **旧系统位置**：`GET·POST /api/admin/presence/blocks`、`POST .../:id/enable`、`DELETE .../:id`；`client_blocks` 表；维度列表 `admin.jsx:950-960`
- **5 个维度**：浏览器指纹 `fingerprint` · 网络指纹 `network_fingerprint` · 请求 IP `request_ip` · 浏览器上报 IP `browser_ip` · WebRTC IP `webrtc_ip`
- **为什么容易漏**：容易简化成"封 IP"。而实际有 5 个维度，其中 WebRTC IP 用于穿透代理，`browser_ip` 与 `request_ip` 分开是为了识别代理场景（对应"疑似代理"标记 `webRtcProxyLikely`）。
- **新实现注意**：封禁规则要能**停用而不删除**（保留历史）；**指纹与 IP 都是攻击者可控输入**，封禁是提高成本而非身份认证，不能把它当安全边界（旧系统 CLAUDE.md 明确写了这一点）；旧系统封禁状态在内存 Map 里，多实例部署会失效。

### 7.12 管理员令牌吊销名单

- **旧系统位置**：`ADMIN_REVOKED_TOKEN_HASHES` 环境变量（逗号分隔的 sha256）· `db.js:127-133`
- **为什么容易漏**：它是一个**环境变量**，不是数据库表、不在后台 UI 里。做令牌管理时只会实现数据库里的增删改，漏掉这条"数据库之外的紧急吊销通道"。它的用途是：令牌泄露时，即使数据库还没改，也能靠部署配置立刻封掉。
- **新实现注意**：保留这条通道（或用等价的紧急吊销机制），并在文档里写明；吊销要对**已签发的活跃会话**也生效，而不只是拦截新登录。旧系统还有一个 `LEGACY_DEFAULT_ADMIN_TOKEN_HASH` 常量（`db.js:73`）用于识别默认令牌——新系统应改为"检测到默认令牌就拒绝启动"。

### 7.13 图片双 CDN 路由 + 客户端选路

- **旧系统位置**：`SCDN_CF_DOMAIN` / `SCDN_ESA_DOMAIN`（`image-host.js:12-13`）；协议式 URL `scdn://cf=...&esa=...`；客户端选路 `preferredScdnProvider` / `imageUrl` · `core.js:58-181`
- **机制**：图片在数据库里存成 `scdn://cf=<url>&esa=<url>` 的**双地址协议 URL**，由客户端在渲染时决定用哪个域名。默认策略是"中国大陆用 ESA、海外用 CloudFlare"，判定依据是 Client Hints（`isChinaLikelyByClientHints`），也可由服务端下发的 `imageRoutePreference` 覆盖。切换时会清空 URL 缓存并派发事件让已渲染的图片重新取址。
- **为什么容易漏**：数据库里的图片字段不是普通 URL，是自定义协议。新系统若直接把它当 URL 用，所有图片 404；若只存单个 URL，就静默失去了双 CDN 容灾与地区优化。
- **新实现注意**：保留双地址存储（或等价的多源地址方案）；保留运行时选路与切换后的缓存失效；`imageUrl()` 还兼容三种其他形态（`/api/` 前缀、站内绝对路径、外部裸 URL 走代理），四条分支都要在。

### 7.14 WxPusher 管理员通知

- **旧系统位置**：`server/noti.js`；`adminMutationNotifier` 中间件（在中间件栈末端）
- **为什么容易漏**：它不是一个端点，而是**挂在中间件链上的副作用**——任何管理员写操作都会触发一条微信推送。扫路由表发现不了，只有读中间件栈才知道。
- **新实现注意**：新架构里应做成事件订阅（领域事件 → 通知模块），不要再塞进请求管道；通知失败绝不能影响主操作成功；需要能配置"哪些操作要通知"，否则批量操作会刷屏。

### 7.15 公开 API（第三方集成）与内部 API 是两套格式

- **旧系统位置**：`api_keys` 表；`publicApiEvent()` vs `frontendEvent()` 两个序列化函数；`GET /api/events` 会**根据是否带 API Key 返回不同格式**（`public-events.js:212-217`）
- **为什么容易漏**：同一个路径两种响应格式这件事，只有读到那个 `if (req.apiKeyAuth)` 分支才知道。新系统若统一成一种格式，已接入的第三方全部炸掉。另外公开 API 是**双重门禁**——没有 API Key 时，前置的内部签名校验会直接把 `/api/public/*` 判为 404，而不是返回"缺少鉴权"。
- **新实现注意**：明确两种输出契约并分别锁定（公开契约要视为对外承诺，改动需要版本化）；保留"无 key 返回 404 而非 401"的行为，否则等于对外暴露了端点存在性；`api_keys` 目前**没有过期与作用域**，新系统建议补上，但要保证旧 key 继续可用。

### 7.16 WebSocket 实时推送（公共频道 + 后台频道）

- **旧系统位置**：`realtimePayload` · `index.js:758`；`broadcastAdminState`；`app.listen` 后的 upgrade 桥接（`index.js:10927+`）；客户端 `realtimeUrl` / `core.js:18,450-503`
- **为什么容易漏**：有 HTTP 轮询兜底，所以 WS 没做也"能用"，问题只在实时性变差、后台在线列表变空。做完 REST 后很容易认为已完工。另外**实时帧是加密的**——服务端用会话密钥封装每一帧（`core.js:488` 注释），不是明文 JSON。
- **新实现注意**：两个频道语义不同（公共频道推数据版本变更让前台提示"有更新"；后台频道推完整状态用于在线列表与联动刷新）；`realtimeVersion` 单调递增 + 120ms 防抖合并广播；帧加密与 HTTP 兜底要都保留；每次 mutation 之后要广播（旧约定：mutation → `broadcastAdminState(reason)` + 刷新全局缓存）。

### 7.17 其余隐性项（较小但同样容易漏）

| 功能 | 旧系统位置 | 为什么容易漏 | 新实现位置 | 状态 |
| --- | --- | --- | --- | --- |
| 日志 7 个频道分类 | `admin.jsx:145-152`（access/admin/security/app/crawler/seo/performance） | 做日志时只做级别，不做频道 | `backend/src/core/logging/` | ⬜ 未开始 |
| "保留错误日志"清理开关 | `logMaintenance.keepErrors` · `db.js:24` | 清理策略里最容易被简化掉的一个布尔 | `backend/src/modules/admin-logs/` | ⬜ 未开始 |
| 统计维护执行记录表 | `analytics_maintenance_runs` 表 | 只做清理不做审计，事后查不到"上次清了多少" | `backend/src/modules/analytics/` | ⬜ 未开始 |
| IP 地理信息缓存 | `analytics_ip_geo` 表 | 统计页显示地区需要它，否则每次现查外部服务 | `backend/src/modules/analytics/` | ⬜ 未开始 |
| 推荐位双机制（单个 + 多个 + 是否置顶） | `featuredEventId` / `featuredEventIds` / `featuredPinned` / `featuredPinnedEventIds` · `db.js:12-15` | 四个字段共同决定推荐位，只实现一个会导致行为不一致 | `backend/src/modules/admin-content/` | ⬜ 未开始 |
| 每页条数记忆 | `readStoredPageSize` · `public.jsx:171` | 小而明显的体验退化 | `frontend/client/` | ⬜ 未开始 |
| 源站会话保持 | `source_sessions` 表 + `sourceSessionKey` · `db.js:75` | 某些源需要携带会话才能抓取，新写爬虫容易只做无状态请求 | `backend/src/sources/` | ⬜ 未开始 |
| 加速 hosts 文件改写 | `fast-host-router` / `refreshFastHostsFile` | 需要管理员权限，Windows 下会 EPERM 失败；它影响图床与源站解析 | 建议改为应用层 DNS/IP 直连，不动系统文件 | ⬜ 未开始 |
| 隐藏元信息回传 | `compactEvent(..., { includeHiddenMeta: true })` | 后台需要看到"为什么被隐藏"，前台不能看到 | `backend/src/modules/admin-events/` | ⬜ 未开始 |
| 系统标签自动附加 | `withSystemTags` · `admin-events.js:178` | 如"已删除/已取消"这类系统标签由代码注入，不是人工打的 | `backend/src/core/events/tags.ts` | ⬜ 未开始 |
| 全部时间按 Asia/Shanghai | 全仓库约定 | 服务器 UTC 时会导致"某一天"筛选整体偏移 | `backend/src/core/time/` | ⬜ 未开始 |

---

## 8. 数据表（21 张）

新系统可以重新设计表结构，但**每张表承载的能力必须有对应落点**。这张表用于反查"有没有哪块数据在新设计里无处安放"。

| 旧表 | 承载能力 | 新实现位置 | 状态 |
| --- | --- | --- | --- |
| `admin_tokens` | 管理员令牌（哈希存储） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `api_keys` | 第三方 API Key + 使用痕迹 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `site_settings` | 全站配置（备案/SEO/维护策略/通知模板） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `announcements` | 公告（含展示方式） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `organizers` | 主办方（含颜色） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `tag_styles` | 标签样式 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `event_tags` | 活动标签关联 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `event_overrides` | 管理员字段覆盖（刷新不被冲掉） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `manual_events` | 手动录入活动 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `hidden_events` | 活动隐藏 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `hidden_tickets` | **票档级隐藏** | `backend/src/core/repositories/` | ⬜ 未开始 |
| `disabled_details` | **详情访问禁用** | `backend/src/core/repositories/` | ⬜ 未开始 |
| `removed_source_events` | 源端已下架活动留档 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `source_sessions` | 源站会话保持 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `client_blocks` | 访客封禁规则 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_events` | 统计事件明细 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_access_events` | 访问明细 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_event_catalog` | 统计事件类型目录 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_daily_rollups` | 日聚合（用于快速出图） | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_ip_geo` | IP 地理缓存 | `backend/src/core/repositories/` | ⬜ 未开始 |
| `analytics_maintenance_runs` | 统计维护执行记录 | `backend/src/core/repositories/` | ⬜ 未开始 |

---

## 9. 明确要求"不一致"的部分

功能对等不等于实现对等。以下是**故意与旧系统不同**的地方，列出来避免被当成遗漏而"改回去"：

| 项 | 旧系统 | 新系统 | 理由 |
| --- | --- | --- | --- |
| 后台形态 | 14 个模态框，无 URL | 14 个路由页，可分享可刷新 | 旧后台无法定位、无法回退 |
| 后端结构 | 单文件 10.9k 行 | NestJS 模块化 | 可测试、可维护 |
| 前台 UI | 自研 + 一份 8.8k 行全局 CSS | HeroUI | 一致性与可维护性 |
| 后台 UI | 自研 | AntD | 表单/表格密集场景 |
| 客户端加密 | 混淆后的手写 crypto VM，不可调试 | 待定 | 旧方案在生产构建里无法调试 |
| 定时任务 | 内嵌 API 进程 | 独立 `worker.ts` | 慢任务不再拖垮 API |
| 状态存储 | 全进程内存 Map（会话/限流/在线/封禁） | 待定（若要多实例必须外置） | 旧方案横向扩展会静默破坏鉴权 |
| 崩溃行为 | `uncaughtException` 只记录不退出 | 退出并由进程守护重启 | 旧方案可能带着损坏状态继续运行 |

---

## 10. 验收流程

功能对等**不能靠读代码判定**。旧系统没有任何测试，新系统的每一项都要实际跑。

1. **逐节走查**：按第 1–6 节顺序，每行按"验证方式"实操，状态改为 `✅ 已验证`。
2. **重点复验第 7 节**：这 17 组隐性功能是本清单存在的理由，建议单独排一轮，且**由"忘记自己写过什么"的状态去验**（隔一天，只看"验证方式"列，不看实现）。
3. **数据对照**：同一时刻分别调用旧系统与新系统的列表接口，比对活动条数、字段完整度、排序结果。差异必须能解释。
4. **导出对照**：6 种导出各导一份新旧对比，字段与行数一致。
5. **第三方兼容**：用现有 API Key 调新系统的公开 API，响应结构不变。
6. **收尾**：确认没有 `⬜ 未开始` 残留；所有 `❌ 已放弃` 都写了理由。

> 只要还有一行是 `⬜`，"功能与旧系统完全一致"这句话就还没有被证明。
