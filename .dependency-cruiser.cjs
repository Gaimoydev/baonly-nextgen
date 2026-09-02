/**
 * BAOnly Nextgen — dependency-cruiser 18 配置
 *
 * 这份文件是 CLAUDE.md「import 边界」那张表的可执行版本。ESLint 的
 * `no-restricted-imports` 在编辑器里给即时反馈，但它只看**写出来的字符串**；
 * dependency-cruiser 看的是**解析后的真实文件**，能抓到经由中转文件的间接依赖
 * （`modules/ → 某个 util → @prisma/client` 这种绕路，ESLint 抓不到）。
 * 两者都要有，这份是权威。
 *
 * ── 分层（2026-09-03 修正版）────────────────────────────────────────
 *
 *   core/       纯领域逻辑。零框架、零 IO，能脱框架直接跑 Vitest
 *   infra/      基础设施。允许 NestJS DI + Prisma + Redis + 外部客户端
 *   sources/    爬虫解析器。尽量纯函数，IO 由调用方注入
 *   modules/    controller + service（HTTP 层）
 *   contracts/  DTO + class-validator
 *
 * 最初的版本把 repositories/ 放在 core/ 下，与「core 不得 import @nestjs/*」
 * 直接冲突（仓储必须 DI 注入 Prisma）。现在 IO 和框架依赖全部下沉到 infra/。
 *
 * ── 匹配规则的两个前提（改规则前必读）────────────────────────────────
 *
 * 1. 路径是**相对于运行 depcruise 的目录**（本项目是仓库根），所以
 *    `from.path` 写 `^backend/src/core/`。
 *
 * 2. `to.path` 匹配的是**解析后的路径**。pnpm 的真实路径长这样：
 *       node_modules/.pnpm/@nestjs+common@11.2.3_.../node_modules/@nestjs/common/index.js
 *    所以用 `node_modules/@nestjs/` 这个片段去匹配就够了。
 *    而**解析不到**的依赖（比如 client 里 `import "antd"`，antd 根本没装在
 *    client 的 node_modules 里），`resolved` 会退化成裸模块名 `antd`。
 *    因此每条 npm 禁令都要同时覆盖这两种形态，否则会出现
 *    「规则看起来配了，实际只报了个 not-to-unresolvable」的假阳性通过。
 */

/**
 * 生成一条同时匹配「已解析路径」和「裸模块名」的正则。
 * @param {string} pkg 包名或包名前缀，如 "antd" / "@heroui" / "@nestjs"
 */
const npmPkg = (pkg) => `(^|/)node_modules/${pkg}(/|$)|^${pkg}(/|$)`;

/** core/ 一律不得触碰的 IO 类 Node 内置模块（denylist，不是 allowlist）。 */
const IO_BUILTINS =
  "^(node:)?(fs|fs[/]promises|net|http|https|http2|dns|tls|dgram|cluster|" +
  "child_process|worker_threads|readline|repl|inspector|process)(/|$)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ═══════════════════════════════════════════════════════════════════
    // CLAUDE.md 的 import 边界矩阵
    // ═══════════════════════════════════════════════════════════════════

    {
      name: "core-no-framework",
      severity: "error",
      comment:
        "core/ 是纯函数层：不得依赖 NestJS / Prisma / Redis / class-validator。" +
        "这是整套边界里最重要的一条 —— 它保证判同算法能脱离框架和数据库直接跑 Vitest，" +
        "而「判同不可单测」正是上一代最缺的能力。" +
        "需要依赖注入时：把接口定义在 core/，在 infra/ 或 modules/ 里包一层 provider 提供实现。",
      from: { path: "^backend/src/core/" },
      to: {
        path: [
          npmPkg("@nestjs"),
          npmPkg("@prisma"),
          npmPkg("\\.prisma"),
          npmPkg("ioredis"),
          npmPkg("pg"),
          npmPkg("sharp"),
          npmPkg("cheerio"),
          npmPkg("class-validator"),
          npmPkg("class-transformer"),
          npmPkg("reflect-metadata"),
        ],
      },
    },

    {
      name: "core-no-io",
      severity: "error",
      comment:
        "core/ 是纯函数层：零 IO。需要读文件/发请求的逻辑属于 infra/ 或 sources/，" +
        "core 只接收已经取回来的数据。这样判同才能用固定样本做确定性测试。",
      from: { path: "^backend/src/core/" },
      to: { dependencyTypes: ["core"], path: IO_BUILTINS },
    },

    {
      name: "core-no-upper-layers",
      severity: "error",
      comment:
        "core/ 位于最底层，不得反向依赖 infra/ · modules/ · sources/ · contracts/。" +
        "依赖方向必须始终指向 core，否则「纯函数层」这件事名存实亡。",
      from: { path: "^backend/src/core/" },
      to: {
        path: [
          "^backend/src/infra/",
          "^backend/src/modules/",
          "^backend/src/sources/",
          "^backend/src/contracts/",
        ],
      },
    },

    {
      name: "infra-no-modules",
      severity: "error",
      comment:
        "infra/(Prisma/Redis/Config/Repositories/Storage)不得反向依赖 modules/(HTTP 层)。" +
        "基础设施若知道业务模块，分层就塌了 —— 而且会立刻产生循环依赖。",
      from: { path: "^backend/src/infra/" },
      to: { path: "^backend/src/modules/" },
    },

    {
      name: "modules-no-prisma",
      severity: "error",
      comment:
        "modules/(controller + service)不得直连 Prisma。数据访问一律经 infra/repositories/。" +
        "否则查询会散落在 HTTP 层，换存储/加缓存/写单测都要动全仓库 —— " +
        "上一代 3,200 行的 db.js 里塞了所有查询，就是这么来的。",
      from: { path: "^backend/src/modules/" },
      to: {
        path: [
          npmPkg("@prisma"),
          npmPkg("\\.prisma"),
          "backend/src/generated/prisma",
        ],
      },
    },

    {
      name: "sources-no-modules",
      severity: "error",
      comment:
        "sources/(3 个爬虫解析器)不得依赖 modules/(HTTP 层)。解析器应当是" +
        "「HTML/JSON 进，SourceRecord 出」的函数，这样才能拿固定样本做回归测试。" +
        "共享逻辑请下沉到 core/。",
      from: { path: "^backend/src/sources/" },
      to: { path: "^backend/src/modules/" },
    },

    {
      name: "sources-minimal-framework",
      severity: "error",
      comment:
        "sources/ 只允许用 @nestjs/common（为了 @Injectable / Logger），" +
        "不得引入 HTTP、WebSocket、Swagger、Throttler 等框架件。IO 由调用方注入。",
      from: { path: "^backend/src/sources/" },
      to: {
        path: npmPkg("@nestjs"),
        pathNot: "node_modules/@nestjs/common(/|$)",
      },
    },

    {
      name: "frontend-no-backend",
      severity: "error",
      comment:
        "前端不得 import 后端的运行时代码（含仅类型的 import —— 本配置开了 " +
        "tsPreCompilationDeps，type-only 也算）。跨端唯一合法的共享物是 " +
        "`pnpm api:types` 生成的 OpenAPI 类型。直连会把 Nest/Prisma 拖进浏览器产物。",
      from: { path: "^frontend/" },
      to: { path: "^backend/" },
    },

    {
      name: "client-no-antd",
      severity: "error",
      comment:
        "frontend/client 只用 HeroUI。混用两套组件库 = 两套设计 token、" +
        "两套无障碍语义、翻倍的包体，而且主题永远对不齐。",
      from: { path: "^frontend/client/" },
      to: { path: [npmPkg("antd"), npmPkg("@ant-design")] },
    },

    {
      name: "dashboard-no-heroui",
      severity: "error",
      comment: "frontend/dashboard 只用 Ant Design。理由同上，反向。",
      from: { path: "^frontend/dashboard/" },
      to: { path: [npmPkg("@heroui"), npmPkg("framer-motion")] },
    },

    {
      name: "shared-is-leaf",
      severity: "error",
      comment:
        "@baonly/shared 是被两个前端共用的叶子包：谁都能依赖它，它不依赖任何人。" +
        "一旦它 import 了 React 或某个组件库，两个前端就被强行绑在同一套依赖上了。" +
        "它只导出纯数据（设计 token）和纯函数（token 适配器）。",
      from: { path: "^frontend/shared/" },
      to: {
        path: [
          "^frontend/client/",
          "^frontend/dashboard/",
          "^backend/",
          npmPkg("react"),
          npmPkg("react-dom"),
          npmPkg("antd"),
          npmPkg("@ant-design"),
          npmPkg("@heroui"),
        ],
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // 通用卫生规则
    // ═══════════════════════════════════════════════════════════════════

    {
      name: "no-circular",
      severity: "error",
      comment:
        "循环依赖。它让「这个模块归谁管」失去答案，也是把文件越写越大的主要借口之一" +
        "（拆不开 → 就地加 → 更拆不开）。请用依赖倒置，或把公共部分提到更低的层。",
      from: {},
      to: { circular: true },
    },

    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "依赖解析不到。要么是 import 路径写错了，要么是包没装进这个 workspace " +
        "（pnpm 是严格隔离的，根目录装了不等于子包能用）。",
      from: {},
      to: { couldNotResolve: true },
    },

    {
      name: "not-to-spec",
      severity: "error",
      comment:
        "生产代码 import 了测试文件。测试里若有别处要用的东西，把它提取成正经的 " +
        "helper / fixture 模块，而不是从 spec 里往外导出。",
      from: { pathNot: "[.](?:spec|test)[.](?:ts|tsx|js|mjs)$" },
      to: { path: "[.](?:spec|test)[.](?:ts|tsx|js|mjs)$" },
    },

    {
      name: "no-deprecated-core",
      severity: "warn",
      comment: "用了已废弃的 Node 核心模块，找替代品。",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: ["^punycode$", "^domain$", "^sys$", "^constants$", "^querystring$"],
      },
    },
  ],

  options: {
    // node_modules 里的东西**不往里追**，但仍保留在图里 ——
    // 这点很关键：上面那些 npm 禁令要靠图里有这些节点才能匹配上。
    // 换成 exclude 会把节点整个删掉，规则就永远不会命中了。
    doNotFollow: { path: "node_modules" },

    // 生成物不参与边界检查
    exclude: {
      path: "(^|/)(dist|build|coverage|[.]vite)/|backend/src/generated/|backend/prisma/migrations/",
    },

    moduleSystems: ["cjs", "es6"],

    // 关键：把「仅类型」的 import 也算作依赖。
    // 否则 `import type { EventDto } from "../../backend/src/..."` 会被无视，
    // frontend-no-backend 这条形同虚设。
    tsPreCompilationDeps: true,

    // pnpm 的 workspace 依赖是 symlink；不解引用的话 @baonly/shared 会被当成
    // node_modules 里的第三方包，from.path 的 ^frontend/shared/ 匹配不上。
    preserveSymlinks: false,

    // monorepo：向上合并 package.json，这样子包里的依赖能被正确归类
    combinedDependencies: true,

    enhancedResolveOptions: {
      exportsFields: ["exports"],
      // 顺序有意义：workspace 内部包（@baonly/shared）的 exports 直接指向 .ts 源文件，
      // 所以 "types" 必须在候选条件里，否则解析不到。
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main", "types", "typings"],
    },

    // 只做规则校验需要的分析，跳过其余度量，快很多
    skipAnalysisNotInRules: true,

    reporterOptions: {
      text: { highlightFocused: true },
      dot: { collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)" },
    },
  },
};
