# 数据源接口契约 · sources.md

> **这份文档是「逆向换来的事实」，不是旧代码的搬运。**
> 三个票务源的 endpoint、参数、字段语义、格式陷阱，都是上一代项目在生产环境跑了一年多试出来的。
> 新实现（`backend/src/sources/`）**不得复制旧代码**，但**必须满足这里记录的事实**——否则就是把同样的坑再踩一遍。
>
> 事实来源:旧项目 `server/index.js` + `server/module/source-constants.js`,
> 以及对 `data_e8ktN/sources/{bilibili,cpp,dlcomic}.sqlite` 线上真实落库数据(2026-09-02 快照)的解包实测。
> 标注「**(推断)**」的条目是从代码行为反推、未被直接证明的。
>
> 校验日期:2026-09-03。**接口随时可能变,上线前须重新抓一次实际响应对照。**

---

## 0. 三源速览

| | **bilibili 会展** | **dlcomic(叮铃铃)** | **allcpp(CPP)** |
|---|---|---|---|
| 形态 | JSON API | JSON API | JSON 列表 + **HTML 详情** |
| 登录态 | 不需要,完全匿名 | 不需要,完全匿名 | **需要账号密码登录**,Cookie `token` |
| 分页 | 有,`pagesize=20` | **无**,一次全量 | **无**,URL 写死 `pageSize=9178` |
| 详情请求 | 必需(列表缺坐标/票档/主办/简介) | 必需(列表字段极少) | 必需,但**解析结果大半被丢弃** |
| 价格单位 | **分** | **元**(需 ×100) | **不提供** |
| 时间格式 | 本地串 `"Y-M-D H:m:s"` + Unix **秒** | Unix **毫秒** | 混合:时间戳/中文日期串 |
| 票档 | **真票档**,两层 screen→ticket | 合成的 1 条伪票档 | **无**(解析器存在但未启用) |
| 省/市 | 有,但列表带「市」详情不带 | **恒空** | 有(`provName`/`cityName`) |
| 坐标 | 有,`"经度,纬度"` | 字段存在但实测 100% 空 | 无 |
| 主办方 | 有,但 75% 是占位「个人主办」 | **恒空** | 有(列表 + 详情 DOM) |
| 嘉宾 | 有(实测 133 场 232 位) | **恒空** | 无 |
| 线上实测条数 | 133 | 9 | 115 |
| 字段取舍优先级 | **4**(最高) | **1**(最低) | 2 |

> 优先级另有 `manual`(手动登记)=5 最高、`baonlytime`=3。`baonlytime` 已永久禁用,不在新实现范围内(它的抓取依赖逆向 CDNfly 反爬 + 改写 OS hosts 文件,脆弱且法律敏感)。
> 另有已退役源 `yunmanzhan`,新实现不需要。

**优先级的用途**:同一活动被多个源命中时,逐字段决定「采信谁的值」。新实现应把它做成显式配置而不是硬编码常量。

---

## 1. 通用约定(三源统一)

### 1.1 统一活动模型的目标字段

三个解析器的输出必须收敛到同一形状。旧实现的字段集(可作为新 DTO 的起点,但**建议重新设计,不要照抄**——旧模型把 `bilibiliId`、`cachedCover` 之类源特定/实现细节泄露到了统一模型里):

```
标识    remoteSourceId(源侧 id) · sourceUrl(人类可访问的活动页)
基本    title · description
时间    startAt · endAt · timeLabel(源给的展示文本,不可解析)
地点    province · city · district · venueName · address · coordinate
价格    priceLow · priceHigh(单位:分) · priceLabel(展示串) · saleFlag(状态文案)
票务    tickets[] { ticketId, screenName, name, price(分), priceLabel,
                    saleStart, saleEnd, saleFlag, clickable }
        pcTicketUrl · mobileTicketUrl
媒体    cover · banner · detailImages[]
其它    organizer(+ organizerUrl) · baseInfo[]{title,content} · guests[]{name,description,image}
        refundDesc
```

### 1.2 时区

**所有源给的「无时区时间」一律按 Asia/Shanghai 解释**,入库统一 `timestamptz`。

- 本地字符串(`"2026-08-27 20:00:00"`)→ 拼 `+08:00` 再解析。
- 只给到「日」的源(dlcomic、CPP 的纯日期串):开始补 `00:00:00`,结束补 `23:59:59.999`,**按上海时区算,不是服务器本地时区**。
- `endAt` 缺失时的业务兜底:视为「开始当天的上海 24:00」。这条规则同时被状态计算(进行中/已结束)和前台倒计时使用,**必须前后端一致**。

### 1.3 价格

库内一律**分**(整数)。bilibili 原生就是分;dlcomic 是元需 ×100;CPP 不提供。
展示串由分推导(整数元省略小数,否则两位),**不要反过来解析源给的 `priceLabel`**。

### 1.4 关键词过滤

三个源的服务端搜索都不可靠(要么返回噪声,要么 `search=` 留空),**必须在本地对标题再过滤一次**。

旧实现的三条正则**互不一致,这是已知缺陷**:

| 源 | 正则 | 缺陷 |
|---|---|---|
| bilibili | `/蔚蓝档案\|blue archive\|bao\|only/i` | `bao` 裸子串会误命中任意含 "bao" 的英文 |
| dlcomic | `/蔚蓝档案\|Blue\s*Archive\|BAO/i` | **缺 `only`** |
| CPP | `/蔚蓝档案\|Blue\s*Archive\|碧蓝档案\|BAO(?:nly)?/i` | 只有它带「碧蓝档案」 |

**新实现:一份关键词配置、一个匹配函数,三源共用**(放数据库配置表,后台可改)。裸 `bao` 要加词边界或至少标记为低置信。命中低置信关键词的活动打「可能的非 only 展」标记交人工复核——这个标记在旧系统里是真实存在且有用的。

### 1.5 请求头基线

三源共用一套伪装头(旧实现 `CRAWLER_BASE_HEADERS`):

```
user-agent:         Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
                    (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0
accept-language:    zh-CN,zh;q=0.9,en;q=0.8
cache-control:      no-cache
pragma:             no-cache
sec-ch-ua:          "Chromium";v="148", "Microsoft Edge";v="148", "Not=A?Brand";v="24"
sec-ch-ua-mobile:   ?0
sec-ch-ua-platform: "Windows"
sec-fetch-site:     same-origin      ← 见下方警告
sec-fetch-mode:     cors
sec-fetch-dest:     empty
```
JSON 请求追加 `accept: application/json,text/plain,*/*`;
HTML 请求改 `accept: text/html,...` + `sec-fetch-mode: navigate` + `sec-fetch-dest: document` + `upgrade-insecure-requests: 1`;
图片请求改 `accept: image/avif,image/webp,...` + `sec-fetch-dest: image`。

> ⚠ **`sec-fetch-site: same-origin` 是写死的**,跨 origin 时(如 `user.allcpp.cn` → `www.allcpp.cn`)语义上应为 `same-site`。目前没触发风控,但这是个定时炸弹。新实现应按 referer 与目标 host 的关系动态计算。

### 1.6 Referer 必须按源分派 ⚠

旧实现只有一个 `fetchJson`,**Referer 硬编码为 `https://show.bilibili.com/`**,于是 **dlcomic 的所有请求都带着 bilibili 的 Referer**(`DLCOMIC_REFERER_URL` 常量定义了却从未在爬虫里使用)。这既是反爬风险(随时可能 403),也是「看起来像伪造」的合规风险。

**新实现必须做:每个源自己的 Referer / Origin。**

| 源 | Referer | Origin |
|---|---|---|
| bilibili | `https://show.bilibili.com/` | — |
| dlcomic | `https://dlcomic.com/` | — |
| CPP 业务接口 | `https://www.allcpp.cn/` | `https://www.allcpp.cn` |
| CPP 登录接口 | `https://user.allcpp.cn/` | `https://user.allcpp.cn` |

### 1.7 旧实现完全缺失、新实现必须补上的能力

这四条不是优化,是**旧系统真实存在的隐性故障源**:

1. **每请求超时**。旧 `fetchJson` 没有 `AbortController`,一个挂住的 socket 卡死整轮刷新(三源是串行的)。
2. **请求间节流**。bilibili 列表分页是零间隔紧凑循环;dlcomic 详情是零间隔串行 `for`。
3. **业务错误码识别**——**最隐蔽的失败模式**。旧实现只看 `response.ok`。如果上游返回 `HTTP 200` + `{code:-412}`(风控),`json.data.result` 为 `undefined` → 列表变空数组 → **被当成「没有更多数据」静默 break**,整轮抓 0 条却"成功"。叠加下架检测(连续 2 轮抓不到就标记),**一次接口结构变更就能把全站活动标记成「已取消」**。
   → 新实现:必须区分「正常空结果」与「异常空结果」。抓到 0 条时**拒绝写入**并报警。
4. **单请求重试**。旧实现只有源级重试(整个 fetcher 从头重跑,含全部详情),粒度太粗。

### 1.8 旧实现的编排参数(可作起点)

```
活跃源      bilibili, cpp, dlcomic      —— 严格串行,不并行
源级重试    2 次重试(共 3 次尝试),线性退避 1500ms × attempt → 1.5s / 3.0s
失败语义    单源三次全败 → 该源标 error,沿用上一轮缓存,不影响其他源
            本轮所选全部源都失败 → 整体抛错
定时        每天 00:00 与 12:00(Asia/Shanghai)
手动        管理端按源触发
```

**建议新实现改成:源之间并行(它们互不依赖)、每源内部限流、单请求重试 + 源级重试两层。**

### 1.9 图片再托管

源图不能直接给前台(防盗链 + 稳定性),必须落地再托管。

- **下载白名单**(旧实现的正则,新实现应做成配置):
  `i{N}.hdslb.com` / `*.hdslb.com`(bilibili)、`dlcomic.com`、`imagecdn{N}.allcpp.cn`、`statics.nyanket.cn` / `*.nyanket.cn`。
  不在名单内 → 不下载。
- **下载时按 host 分派 Referer**(与 1.6 同一张表;另有 `https://www.nyanket.cn/` 用于 nyanket 图)。
- 压缩:WebP q78 / 最长边 1600px;**GIF 原样透传不压缩**(旧实现上限 12MB 全量读进内存,新实现应流式 + 限额)。
- 旧实现三处 host 白名单已经漂移(代理用一份、落盘用一份、URL 输出用一份),`gamekee.wiki`/`kivo.wiki` 允许代理但不允许落盘。**新实现:一份白名单,三处消费。**

---

## 2. bilibili 会展(会员购票务)

### 2.1 Endpoint

```
列表  GET https://show.bilibili.com/api/ticket/search/list
        ?version=134&keyword=%E8%94%9A%E8%93%9D%E6%A1%A3%E6%A1%88
        &pagesize=20&page={page}&platform=web

详情  GET https://show.bilibili.com/api/ticket/project/getV2
        ?version=134&id={id}&project_id={id}&requestSource=pc-new

PC 购票页(不是 API,存为 sourceUrl/pcTicketUrl)
      https://show.bilibili.com/platform/detail.html?id={id}
移动购票页
      https://mall.bilibili.com/neul-next/ticket-renovation/detail.html?id={id}&noTitleBar=1
```

参数语义:
- `version=134` — 客户端版本号,固定值。**(推断)** 是 show.bilibili.com 前端 bundle 版本;改小可能被拒。
- `keyword` — URL-encoded「蔚蓝档案」。
- `pagesize=20` — 每页 20 条。**与停止条件耦合**(见 2.3),改它必须同步改判断。
- `page` — **1-based**。
- 详情要**同时**传 `id` 和 `project_id`(同值)。

### 2.2 请求头 / 登录态

`CRAWLER_JSON_HEADERS` + `referer: https://show.bilibili.com/`。
**无 Cookie、无 Origin、无 SESSDATA/bili_jct/buvid,完全匿名。** 全仓库搜不到任何 bilibili 凭据配置。

### 2.3 分页策略与停止条件

```
最大页数    80      (旧 env: BILIBILI_SEARCH_MAX_PAGES)
停滞页阈值   5      (旧 env: BILIBILI_SEARCH_STAGNANT_PAGES)
每页条数    20      (由 URL 的 pagesize 决定)
详情并发    2       (旧 env: BILIBILI_DETAIL_CONCURRENCY)
```

四个停止条件,按判定顺序:

1. 本页 0 条 → 立即停。
2. **页签名去重**:把本页所有 `item.id` 拼成签名存 Set;签名重复出现(服务端翻页失效、反复返回同一页)→ 计一次「停滞」。
3. 本页新增 0 条(全是见过的 id)或页签名重复 → `stagnant += 1`;否则归零。`stagnant >= 5` → 停。
4. 本页不足 20 条 **且** 已有停滞计数 → 停。

> 页签名去重是踩坑换来的:该接口在深页会开始重复返回同一页,单靠「不足一页就停」会无限翻。

### 2.4 列表字段 → 统一模型

响应体 `json.data.result` 是数组(必须 `Array.isArray` 保护)。

| 列表字段 | 统一模型 | 实测事实 |
|---|---|---|
| `id` (number) | `remoteSourceId` | **number 类型**,比较前须 `String()` |
| `project_name` ‖ `title` | `title` | 兜底「未命名活动」 |
| `cover` / `banner` | `cover` / `banner` | 可能是 `//` 开头的协议相对 URL,须补 `https:` |
| `start_time` ‖ `start_unix` | `startAt` | `start_time` 是本地串优先;回退 `start_unix`(**秒**) |
| `end_time` | `endAt` | 缺失则 `null` |
| `sale_end` | **故意不用** | ⚠ 售票结束 ≠ 活动结束,用它会把活动误判成已结束 |
| `tlabel` | `timeLabel` | 展示串。实测 `"2026.10.05"` / `"2025.08.02 - 09.14"` / `"2023.12.01 - 2024.01.31"` |
| `province` | `province` | 实测 `"广东"`(**无「省」后缀**) |
| `city` | `city` | 实测 `"广州市"`(**带「市」后缀**) |
| `venue_name` | `venueName` | 实测 `"祈福会展中心"` |
| `areas` | `address` | 实测 `"钟村街道迎福路9号"`(**只到街道级,不含省市**) |
| `price_low` / `price_high` | `priceLow` / `priceHigh` | **单位:分**。实测 `7800`=78 元 / `34100`=341 元 |
| `is_free` | → `priceLabel` | 两个价格都空且 `is_free` 为真 → 「免费」 |
| `sale_flag` | `saleFlag` | 实测取值:`已结束` / `预售中` / `未开售` |
| `wish` | 想看数 | ⚠ **实测是字符串**(`"172"`),不是 number |

### 2.5 详情(`getV2`)字段 → 统一模型

响应 `json.data`。

| 详情字段 | 统一模型 | 实测事实 |
|---|---|---|
| `merchant.company` | `organizer` | ⚠ **实测 100/133 是占位值「个人主办」**,见 2.8 |
| `description` | `description` | ⚠ **实测 133 条全部无效**(全是「bilibili会员购票务」样板),见 2.8 |
| `venue_info.name` | `venueName` | |
| `venue_info.province_name` | `province` | 实测 `"广东"` |
| `venue_info.city_name` | `city` | 实测 `"广州"` — ⚠ **与列表的 `"广州市"` 不一致** |
| `venue_info.district_name` | `district` | 实测常为空 |
| `venue_info.address_detail` | `address` | 覆盖列表的 `areas` |
| `venue_info.coordinate.coor` | `coordinate` | 实测 `"113.334848,22.970605"` = **「经度,纬度」**,**(推断)** GCJ-02 |
| `performance_image` | `cover`/`banner` 兜底 | ⚠ **是 JSON 字符串不是对象**,须容错解析;取 `.banner.url` / `.first.url` |
| `performance_desc.list[]` 中 `module=="base_info"` 的 `.details` | `baseInfo[]` | `[{title, content}]` |
| `performance_desc.list[]` 中 `module=="activity_content"` 的 `.details` | `detailImages[]` | ⚠ **是 HTML 字符串**,只能正则抽 `<img src>`。若上游改 `data-src` 懒加载则全部丢失 |
| `screen_list[]` → `.ticket_list[]` | `tickets[]` | 见 2.6 |
| `guests[]` | `guests[]` | `{name, description, image}`。实测 133 场共 232 位 |
| `refund_desc` | `refundDesc` | |

`baseInfo` 的 `title` 实测分布(可当字段字典):
`活动日期`133 · `场馆地址`133 · `入场说明`133 · `退换说明`133 · `入场次数`131 · `儿童说明`130 · `限购说明`46 · `实名认证`14 · `限购方式`9 · `限购规则`8 · `座位类型`2 · **`" 儿童说明"`1(带前导空格,脏数据)**。
→ 比对 `baseInfo.title` 前必须先去掉所有空白。

**详情失败不应清空已有详情。** 旧实现:详情请求失败只记 `detailError`,然后逐字段从上一轮缓存回填 `organizer`/`organizerUrl`/`coordinate`/`description` 等。新实现须保留这个行为,否则一次瞬时失败就会让活动详情"变空"。

### 2.6 票档结构(bilibili 是唯一有真票档的源)

两层:`screen_list[]`(场次)→ 每个 `screen.ticket_list[]`(票档),拍平成一维。

| 源字段 | 归一字段 | 实测事实 |
|---|---|---|
| `screen.name` ‖ `ticket.screen_name` | `screenName` | ⚠ **格式完全不统一**:`"7月5日"` / `"12月01日  11:00-12:30"`(**双空格**) / `"08月02日  11:00开场-12:30结束"`。**纯展示文本,不可解析** |
| `ticket.id` | `ticketId` | **number**。这是**稳定主键**,票档的隐藏标记必须绑它(旧实现前台按数组下标绑定导致增删行后错位——这是新 schema 给 `Ticket` 独立主键的原因) |
| `ticket.desc` | `name` | 兜底「票档」。实测:早鸟票/预售票/特典票/普通票/现场票/预约券/VIP票/`入场券30元（可抵扣）`/`宫叶Miyaba签售票`/`现场票(无周边)` |
| `ticket.price` | `price` | **单位:分**。实测 428 条票档**无一为 null 或 0** |
| `ticket.sale_start` ‖ `saleStart` | `saleStart` | ⚠ **同一字段两种格式并存**:`sale_start` 是**无时区本地串** `"2026-08-27 20:00:00"`;camelCase `saleStart` 是 **Unix 秒**。旧实现把本地串原样存了下来(没转 ISO),这是 bug |
| `ticket.sale_end` ‖ `saleEnd` | `saleEnd` | 同上 |
| `ticket.sale_flag.display_name` | `saleFlag` | ⚠ **嵌套对象,取 `.display_name`**。实测:`已停售`373 / `不可售`26 / `预售中`15 / `未开售`14 |
| `ticket.clickable` | `clickable` | 布尔 |
| — | 库存 | ⚠ **接口的库存字段旧实现完全没读**。"能不能买"只靠 `saleFlag` + `clickable` 判断 |

> `saleStart` 是「票档开售提醒」这个前台功能的唯一数据来源,格式必须在解析层就统一成 `timestamptz`。

### 2.7 时间格式

- `start_time` / `end_time`:本地串,**(推断)** `"YYYY-MM-DD HH:mm:ss"`。旧实现只做 `replace(" ", "T")` 后拼 `+08:00`。
- `start_unix`:**Unix 秒**(×1000)。
- 票档 `sale_start`/`sale_end`:见 2.6,**两种格式并存**。
- 实测落库 `"2026-10-05T01:00:00.000Z"` = 上海 09:00,验证 +08:00 假设正确。

### 2.8 已知数据坑(每条都有旧代码里的兜底作为证据)

1. **列表 `city` 带「市」,详情 `city_name` 不带**(`广州市` vs `广州`)。城市字段必须归一后再用于判同/筛选。
2. **`description` 几乎永远无效**:全是 `bilibili会员购票务...` 样板前缀,旧实现有专门正则把它清空。**不要指望这个字段**,简介靠 CPP 或人工补。
3. **`merchant.company` 75% 是占位「个人主办」**(实测 100/133;判定前先去空白,还要兼容「个人主办方」)。当同一活动有其他源时应**丢弃 bilibili 的主办方**改用别源——这条规则在判同的字段择优里是硬需求。
4. **`performance_image` 是 JSON 字符串**,解析必须容错(失败返回空而不是抛)。
5. **详情图埋在 HTML 里**,正则抽 `<img src>`。脆。
6. **`baseInfo.title` 可能带前导空格**。
7. **`screenName` 格式三种以上**,不可解析。
8. **`wish` 是字符串**。
9. **`sale_end` ≠ 活动结束**(旧代码有显式注释警告)。
10. **HTML 实体**:`baseInfo.content` 等字段会带 `&nbsp; &amp; &lt; &gt; &quot; &#39;`,还有 `<br>`/`</p>`/`<li>` 需转成换行和列表符号。
11. **风控静默失效**:HTTP 200 + 业务错误码会被当成"没有更多数据"。见 1.7 第 3 条。

---

## 3. dlcomic(叮铃铃)

**纯 JSON API,不是 HTML 抓取。** 没有 DOM 选择器。

### 3.1 Endpoint

```
列表  GET https://dlcomic.com/api/v1/events
        ?before=end&search=&subject_type=4
        &include_pending=true&include_cancelled=true

详情  GET https://dlcomic.com/api/v1/events/{id}

图片      https://dlcomic.com/api/v1/images/{hash}?format=webp&q=60&size=s

活动页(存为 sourceUrl / pcTicketUrl / mobileTicketUrl —— 三者同值)
      https://dlcomic.com/events/{id}
```

参数语义:
- `before=end` — **(推断)** 时间游标/排序基准,语义未知。
- `search=` — **留空**。关键词过滤 100% 在本地做。
- `subject_type=4` — **(推断)** 题材分类 id(同人展)。
- `include_pending=true` — 含未审核/待定活动。
- `include_cancelled=true` — ⚠ **含已取消活动**,必须靠响应里的 `cancelled` 字段自行剔除/标记,否则会展示死活动。
- 图片 `{hash}` 是 64 位 hex(**(推断)** sha256);`size=s` 意味着**抓的是小图**,想要高清必须改这个参数。

### 3.2 请求头 / 登录态

无 Cookie、无 Origin、匿名。
⚠ 旧实现给它发的是 **bilibili 的 Referer**,见 1.6——新实现必须改。

### 3.3 分页

**无分页。** 一次请求拿全量,没有 page/limit/offset。

响应容器:实测直接返回**裸数组**。旧实现有三重兜底 `Array.isArray(x) ? x : x?.results || x?.data || []`——保留这种防御是合理的,但**空数组必须当异常处理**(见 1.7)。

### 3.4 字段 → 统一模型

详情成功时几乎所有字段都从详情取,列表项只作兜底。

| 源字段 | 统一模型 | 实测事实 |
|---|---|---|
| `id` | `remoteSourceId` | |
| `name` | `title` | 关键词过滤**只看这个字段** |
| `main_image` ‖ `image` | `cover` **和** `banner` | ⚠ **同一张图**,且 `size=s` 是小图 |
| `begin` | `startAt` | **Unix 毫秒**(不乘 1000)。实测值就是「上海当日 00:00」的毫秒时间戳 |
| `end` | `endAt` | 毫秒;按上海时区取当日 **23:59:59.999**。⚠ **`end` 缺失时旧实现回退成 `startAt`(零长度区间),而不是当日 24:00** ——与通用规则 1.2 不一致,新实现应统一 |
| `location.details` | `venueName` **和** `address` | ⚠ **同一个字符串,粒度不一致**:有时 `"广州国际轻纺城1号馆"`(场馆名),有时 `"上海市宝山区蕰川路6号智慧湾科创园"`(完整地址) |
| `location.lat_lon` (Array) | `coordinate` | ⚠ 顺序是**「纬度,经度」**(与 bilibili 相反)**(推断,依字段名)**;**实测 9/9 全空,该字段实际从不返回** |
| — | `province` / `city` | ⚠ **接口不提供,恒空**。城市只能从 `title + venueName + address` 里用城市名表推断 |
| `attendee_fee.base` ‖ `application_info.attendee_fee.base` | 价格首选 | **单位:元**。⚠ 字段可能在顶层也可能嵌在 `application_info` 下 |
| `attendee_fee.booth`(同上两处) | 价格次选 | `base > 0` 用 base,否则用 booth |
| 上述 | `priceLow` | 元 **× 100** 存为分 |
| — | `priceHigh` | ⚠ **恒 null**。dlcomic 只有「起价」概念 |
| 派生 | `priceLabel` | `"{N}元起"` ‖ (`tickets_available` 为真时)`"票务开放"` ‖ `""`。实测:`票务开放`6 / `""`2 / `200元起`1 |
| `cancelled` / `tickets_available` / `tickets_status` | `saleFlag` | 三元:`cancelled`→「已取消」;`tickets_available`→「可购票」;否则原样 `tickets_status`。实测:`可购票`6 / `""`2 / `已取消`1 |
| `description` ‖ `features_text` | `description` | 带换行的纯文本(含全角、`【】`、QQ 群号)。⚠ **可能只有换行符**(实测一条是 `"\n\n\n"`),判空必须 `trim()` |
| `features_images[]` + 从 `description` 正则抽的 hash | `detailImages[]` | 见 3.5 |
| `capacity` | `baseInfo` 的「容量」项 | 实测 `"600"` / `"1000"` |
| `agreement` | `refundDesc` | |
| — | `organizer` / `guests` | ⚠ **接口不提供,恒空**。只能靠其他源补(dlcomic 优先级最低=1) |
| — | `timeLabel` | 恒空 |

### 3.5 详情图:两路合并 + 去重

1. `features_images[]` 是 hash 数组;
2. **再从 `description` 文本里正则捞出内嵌的 `/api/v1/images/<hex>` 路径**——说明简介文本里会混图片链接。

两路合并后按 URL 去重。

### 3.6 票档:合成的伪票档

dlcomic **没有票档接口**。旧实现在 `priceLabel` 非空时合成**恰好一条**:
```
{ ticketId: "dl-<id>", screenName: "", name: "票务",
  price: 元×100 或 null, priceLabel, saleFlag: tickets_status }
```
- 实测 7 条中 **6 条 `price` 为 null**(因为 `attendee_fee` 通常不返回)。
- 无 `saleStart`/`saleEnd`/`clickable`/库存。
- ⚠ 票档里的 `saleFlag` 实测是**英文原始枚举 `"available"`**,而同一条活动顶层的 `saleFlag` 是中文「可购票」——**同一语义两种表示**。

**新实现建议:不要合成假票档。** 把它建模成「活动级价格下限 + 票务状态」,`Ticket` 表只放真票档。否则票档统计、价格区间、票档开售提醒都会被这条噪声污染。

### 3.7 已知数据坑

1. **`province`/`city` 恒空** → 城市靠城市名表从标题/场馆/地址里推断。旧实现的表只有 **29 个城市**(北京 上海 天津 重庆 广州 深圳 武汉 成都 杭州 南京 苏州 无锡 长春 嘉兴 长沙 西安 郑州 青岛 济南 厦门 福州 沈阳 大连 哈尔滨 合肥 南昌 昆明 贵阳 南宁),**不在表内的城市永远为空**。新实现应换成完整的省市区字典。
2. **`venueName` 与 `address` 同值、粒度不一**。判同用场馆信号时要意识到 dlcomic 的"场馆"可能是一整条地址。
3. **`cover` 与 `banner` 同值,且是小图。**
4. **`coordinate` 实测 100% 空。**
5. **`organizer` / `guests` 恒空。**
6. **价格单位是元,而 bilibili 是分** —— 跨源最容易写错的地方。
7. **票档 `saleFlag` 未汉化。**
8. **`description` 可能全是空白。**
9. **`attendee_fee` 位置不稳定**(顶层 / `application_info` 下)。
10. **`include_cancelled=true` 会带回死活动。**
11. 详情失败须沿用上一轮缓存(同 bilibili)。

---

## 4. allcpp(CPP)

三个源里唯一**需要登录**的,也是唯一**详情是 HTML 页面**的。

### 4.1 Endpoint

```
登录      POST https://user.allcpp.cn/api/login/normal
登录态校验 GET https://user.allcpp.cn/rest/my
列表      GET https://www.allcpp.cn/allcpp/event/eventMainListV2.do
            ?&keyword=%E8%94%9A%E8%93%9D%E6%A1%A3%E6%A1%88&pageNo=1&pageSize=9178
详情      GET https://www.allcpp.cn/allcpp/event/event.do?event={id}   ← 返回 HTML 页面
图片前缀      https://imagecdn3.allcpp.cn/upload/
```

- ⚠ 列表 URL 里 `?&keyword=` 有个**多余的 `&`**(照抄浏览器抓包留下的),不影响功能。
- ⚠ **`pageSize=9178` 写死在 URL 里,靠一次请求拿全量**。没有真正的分页逻辑。这意味着单次响应巨大(旧实现还要在上面做深度 6 的递归遍历)。**新实现应改成真分页。**

### 4.2 登录态维持机制

#### 登录请求

```
POST https://user.allcpp.cn/api/login/normal
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Accept: application/json, text/plain, */*
Origin:  https://user.allcpp.cn
Referer: https://user.allcpp.cn/
redirect: manual

body (urlencoded):
  account=<账号>
  password=<明文密码>
  phoneAccountBindToken=undefined      ← 字面字符串 "undefined",不是空值
  thirdAccountBindToken=undefined
```

- **凭证来自响应的 `Set-Cookie`,唯一关心的 cookie 名是 `token`。**
- 成功判定:`response.ok` **且** cookie jar 里拿到了 `token`。**响应 JSON 的内容被完全忽略。**
- ⚠ 密码明文、每次登录重发。凭据必须放 `.env`(这是 CLAUDE.md 允许留在 env 的少数几项之一)。

#### 凭证存储

旧实现存在一张 3 列表里(新 schema 对应 `SourceSession` 之类):

```
source      主键,恒为 "cpp"
payload     加密后的 JSON 字符串
updated_at  ISO 时间
```

`payload` 明文结构:
```json
{ "token": "<token cookie 值>",
  "cookie": "<整串 Cookie header,name=value; 拼接>",
  "updatedAt": "<ISO>" }
```

**至rest加密是硬需求**(旧实现用 AES-256-GCM,密钥由专用 secret 派生;首次运行会把历史明文行就地加密)。新实现同样必须加密——这是可以直接冒用他人 allcpp 账号的凭证。

#### 凭证注入

```
cookie: <cookie jar 全量 name=value; 拼接>
origin:  https://www.allcpp.cn
referer: https://www.allcpp.cn/
```
**只用 Cookie header,没有 Bearer、没有自定义头。** 每次响应都要把 `Set-Cookie` 合并回 jar(`Max-Age=0` 视为删除)。

#### 过期检测与重登录

```
启动/每轮抓取前:
  加载已存 cookie → GET /rest/my 校验
    HTTP 401        → 失效,重新登录
    2xx             → 有效,顺便把最新 cookie 续存
    其它非 2xx      → 抛错(不重登)     ← ⚠ 旧实现如此,过于严格
  无已存 cookie      → 直接登录

每个业务请求:
  若返回 401 → 重登一次并重放该请求(仅一次,不循环)
  仍非 2xx  → 抛错
```

关键事实:
- ⚠ **唯一的失效判据是 HTTP 401。不看业务 `code` 字段。**
- ⚠ **所有请求都用 `redirect: "manual"`**,所以**302 会被当成非 2xx 直接抛错**。登录失效在 allcpp 上很可能表现为 302 跳登录页,而旧实现没有专门处理这种情况——**(推断)** 会表现为莫名的 `HTTP 302`。**新实现必须把 302→登录页也当成失效信号。**
- ⚠ **没有任何定时刷新 token 的任务。** token 有效期完全由 allcpp 决定,靠 401 惰性发现。也不存在 refreshToken 概念。
- 凭据缺失时该源抓取失败,不影响其他源。

### 4.3 列表响应:结构不稳定,不能按固定路径取值

⚠ 这是 CPP 最大的坑:**响应的 JSON 结构和字段名都不稳定**。旧实现放弃了固定 path,改成**深度遍历**:

- DFS,**深度上限 6**,带对象环检测;
- 优先下钻的 key:`data / result / rows / list / items / events / eventList / eventMainList / eventMainListV2`;
- 「看起来像一个活动」的判据:有 id **且** 有标题 **且**(有时间样字段 **或** 有地点样字段)。

字段读取全部走「多候选名 fallback」(先精确匹配、再小写匹配)。**这份候选名清单本身就是字段映射表**:

| 统一模型 | CPP 候选字段名(按序 fallback) |
|---|---|
| `remoteSourceId` | `event`, `eventId`, `event_id`, `eventMainId`, `eventMainID`, `event_main_id`, `mainId`, `id` |
| `title` | `eventName`, `event_name`, `name`, `title`, `mainName`, `activityName`, `activity_name` |
| `startAt` | `startTime`, `start_time`, `eventStartTime`, `eventStartDate`, `beginTime`, `begin`, `startDate` |
| `endAt` | `endTime`, `end_time`, `eventEndTime`, `eventEndDate`, `finishTime`, `finish`, `endDate` |
| 时间兜底串 | `eventTime`, `eventTimeStr`, `eventDate`, `date`, `time`, `timeRange` |
| `province` | `provName`, `provinceName`, `province`, `eventProvince`, `province_name` |
| `city` | `cityName`, `city`, `eventCity`, `city_name` |
| `district` | `areaName`, `districtName`, `district`, `area`, `eventDistrict`, `district_name` |
| `address` | `enterAddress`, `address`, `eventAddress`, `placeAddress`, `venueAddress`, `addr`, `detailAddress` |
| `venueName` | `eventPlace`, `venueName`, `venue`, `placeName`, `addressName`, `siteName` — ⚠ **全空时兜底成 `城市 + 区县` 拼串** |
| `cover` | `appLogoPicUrl`, `logoPicUrl`, `logo`, `picUrl`, `cover`, `image`, `poster`, `posterUrl` |
| `organizer` | `organizer`, `organizerName`, `sponsor`, `host`, `clubName` |

> **新实现建议**:仍然保留多候选名映射(这是真实需要的),但**用 zod/class-validator 定义一个宽松 schema 做校验并落原始 payload 留档**,而不是无边界 DFS。同时给「实际命中了哪个候选名」打日志——上游改字段名时能第一时间发现。

### 4.4 详情:HTML + JSON-LD

- URL:`.../event.do?event={id}`,用 HTML 请求头。
- **只对未结束的活动拉详情**(已结束的跳过)。
- 重试 **3 次**,退避 `500ms × attempt`(500 / 1000)。
- 并发 **2**(夹在 1–5)。详情之间无额外 sleep。

解析主要吃 **JSON-LD**(`<script type="application/ld+json">`):
`name` / `description` / `startDate` / `endDate` / `image` / `organizer.name` ‖ `performer.name` / `location.name` / `location.address.streetAddress`。
补充 DOM 规则(选择器,上游改版即失效):
- 简介:`#des` 内的 `.text`
- 主办:`#event-user-con` / `#event-user` 内的 `h1.textDian a[title]`,或 `.event-user-info a`

⚠ **重要:旧实现故意丢弃了详情解析出的地点和票档**——详情返回的 `venue` 置空、`detailImages` 置空、`tickets` 置空。**CPP 的地点完全依赖列表接口。** 详情最终只贡献 `title` / `startAt` / `endAt` / `organizer` / `description` / `cover`。

⚠ **详情页会返回「系统异常」伪页面**:文本含「提示信息」且含「发生未知错误 / 系统异常 / 页面将在3秒后自动跳转」→ 判为失败并重试。下游还有两层清洗防止把报错页文案存成活动简介。**新实现必须保留这个判据**,否则简介会变成一堆错误提示。

### 4.5 票档与价格:CPP 完全不提供

旧实现里有一个「从详情文本正则捞票价」的函数(匹配 `票|价格|售价|¥|￥|N元`,最多 8 条),但**它在主流程里从未被调用**——归一化时硬写 `tickets: []`,价格强制 `priceLow=null / priceHigh=null / priceLabel="" / saleFlag="待补充"`。

**结论:CPP 源不提供任何价格/票档数据,全部靠运营在后台手工补。** 新实现照此处理即可,不必尝试从 HTML 里猜价格(会猜错)。

### 4.6 时间解析:混合格式

```
纯数字 10–13 位  → 时间戳(> 10^10 视为毫秒,否则秒 ×1000)
否则文本          → 预处理「年月」→「-」、「日」→空格、「.」→「-」
                    再匹配 (\d{4})[-/](\d{1,2})[-/](\d{1,2})(\s+HH:mm(:ss)?)?
无时分            → 开始补 00:00:00,结束补 23:59:59
最后              → 一律按 +08:00 解释
```

区间解析的兜底:先试第 1、2 个候选值直接解析;失败则把所有候选值拼成一个字符串,用全局正则 `/\d{4}[年./-]\d{1,2}[月./-]\d{1,2}(日)?(\s+H:mm(:ss)?)?/g` 提取,取第 1、2 个当 start / end。缺 end 时 end = start(当日末);**若 end < start 则强制 end = start**。

### 4.7 稳定 ID:CPP 的 remote id 不可信

⚠ **allcpp 的 event id 会被复用/变更**,旧实现因此自造了稳定 ID:

```
稳定 id = "<remoteId>-<sha1(remoteId | 指纹种子).slice(0,12)>"
指纹种子 = 标题指纹 | 月日 | 归一城市 | 归一场馆
标题指纹 = 小写化 + 删 URL + 删 ·・空格_-—:：,，.。!！?？()（）【】[]"'""&＆/\
```

含义:**同一个 allcpp event id,若标题/日期/城市/场馆变了,就会生成新的内部 id,被当成新活动。**

这套机制解决了「id 复用导致把 A 活动的数据挂到 B 活动」的问题,但代价是:
- 上游微调标题 → 判同要重新做一遍;
- 旧的非稳定 id 遗留数据需要清洗(旧实现有专门逻辑把它们的 description/tickets/detailImages/购票链接全清空重来)。

**新实现建议**:`SourceRecord` 上同时存 `remoteId`(源侧原始 id)和一个内容指纹,把「是不是同一条源记录」的判断显式化,而不是把指纹拌进主键。这样上游改标题时不会丢历史。

### 4.8 已知数据坑

1. **响应结构 + 字段名双重不稳定** → 4.3 的多候选映射。
2. **详情页返回伪错误页** → 必须有识别与重试。
3. **详情丢失时保留旧数据**:旧实现仅在「新 id 是稳定 id」且「旧记录有有用详情」且「新记录没有」时,才回填 organizer / description / baseInfo / guests / refundDesc。
4. **场馆字段常缺失** → 兜底成 `城市 + 区县` 拼串。这种"假场馆"会污染判同的场馆信号,**判同时必须能区分「真场馆名」和「城市区县拼串」**。
5. **`baseInfo` 污染**:要过滤掉 title 为「原始ID / 联系方式 / 联系 / 客服」的条目;另外三源共用一条过滤规则,剔除 title 归一后等于「数据源 / 信息源 / 数据来源 / 来源 / source / datasource」的条目(这些是旧实现自己塞进去的源标记,不是真内容)。
6. **届数写法与其他源不一致**:CPP 写 `ONLY-02` / `ONLY·2` / `ONLY 二`,bilibili 写「第二届」或「2.0」。归一规则见 `matching.md`。
7. **HTML 实体**:所有 HTML 抽取都要先剥标签再解实体。
8. **价格/票档不可信** → 全链路清空。
9. 图片 URL:已是 `http(s)`/`//` 开头则直接用;否则剥掉前导 `upload/` 与 `/`,拼图片前缀。

---

## 5. 跨源差异矩阵(重写时最容易写错的地方)

| 维度 | bilibili | dlcomic | CPP |
|---|---|---|---|
| 价格单位 | **分** | **元**(×100) | 无 |
| `priceHigh` | 有 | **恒 null** | 无 |
| 时间戳 | 本地串 + Unix **秒** | Unix **毫秒** | 时间戳 / 中文日期串混合 |
| 票档 `saleStart` | **本地串 与 Unix 秒并存** | 无 | 无 |
| 坐标顺序 | `经度,纬度` | `纬度,经度`(实测恒空) | 无 |
| 城市 | 列表带「市」/ 详情不带 | **恒空**,靠 29 城名表推断 | 有,较规范 |
| 场馆 | 真场馆名 | 与地址同值,粒度不一 | 常缺失,兜底成「城市+区县」 |
| 主办方 | 75% 是占位「个人主办」 | **恒空** | 有 |
| 简介 | **实测全部无效** | 有(可能全空白) | 有(可能是错误页文案) |
| 嘉宾 | 有 | 无 | 无 |
| id 稳定性 | 稳定 | 稳定 | ⚠ **不稳定,需内容指纹** |
| 关键词正则 | 含 `only` | **不含 `only`** | 含「碧蓝档案」 |
| 分页 | 80 页 / 5 页停滞 / 每页 20 | 无 | 无(`pageSize=9178`) |
| 详情并发 | 2 | 1(串行) | 2 |
| Referer(旧实现) | ✓ bilibili | ✗ **误用 bilibili** | ✓ allcpp |

---

## 6. 附录

### 6.1 字段级来源追踪的字段集

多源合并后,每个字段记录「值来自哪个源」。旧实现追踪的 14 个字段(带 UI 文案):

```
title 标题 · schedule 开展时间 · location 地点/场馆 · cover 封面图 · banner 顶图
detailImages 详情图 · description 漫展简介 · organizer 主办信息
baseInfo QQ群/联系信息 · tickets 票档 · price 票价 · status 状态文案
ticketUrl 购票链接 · guests 嘉宾阵容
```

语义详见 `matching.md`。**实测 148/148 个活动都在用这个功能,不可简化掉。**

### 6.2 节假日日历(不是票务源,但属于外部依赖)

```
GET https://api.jiejiariapi.com/v1/holidays/{year}
GET https://api.jiejiariapi.com/v1/weekends/{year}
GET https://api.jiejiariapi.com/v1/workdays/{year}
```

- 三个接口并行请求,按年缓存;**同一年的缓存超过 7 天视为过期**并重新拉取。
- 需要抓取的年份 = 所有活动 `startAt`/`endAt` 的年份 ∪ 当前年。
- 派生到活动上的 `dateType`:
  - 命中 `holidays[YYYY-MM-DD]`:若该条 `is_workday` 为真 → `{type:"workday", name:"调休工作日"}`,否则 `{type:"holiday", name: 节假日名}`;
  - 命中 `workdays[...]` → `{type:"workday"}`;
  - 命中 `weekends[...]` → `{type:"weekend"}`;
  - 都不命中 → 无。
- 判定用**活动开始日**,开始日无结果时回退到结束日。
- 前台「节假日筛选」= `dateType.type === "holiday"`,可再按 `dateType.name` 细分;可选项由当前数据集里出现过的节假日名去重得出。

### 6.3 源记录快照

多源合并要能让运营逐字段选源,所以每条源记录必须保留**该源原始值的完整快照**。旧实现快照的 26 个字段:

```
title startAt endAt province city district venueName address coordinate
cover banner description organizer organizerTitle organizerColor organizerUrl
baseInfo[] tickets[] guests[] detailImages[]
priceLabel priceLow priceHigh saleFlag ticketUrl refundDesc
```

新 schema 里对应 `SourceRecord.rawPayload`(原始响应留档)+ 规范化后的列。**留档是硬需求**:上游改字段名时,只有原始 payload 能救回历史数据。

### 6.4 旧实现的持久化格式警告

旧的源缓存把活动对象用 Node 的 `v8.serialize()` 存成 BLOB。**数据迁移时必须用 Node 反序列化**,换语言就读不出来了。新实现不要再用运行时专属的序列化格式。
