// BAOnly Nextgen — ESLint 10 flat config
//
// 这份文件是 CLAUDE.md「硬约束」一节的可执行版本。文字规范说服不了 AI，报错可以。
// 改这里等于改项目的轨道宽度 —— 放宽任何一条前先去 CLAUDE.md 把理由写清楚。
//
// 版本前提（2026-09-03 实测锁定）：
//   ESLint 10.9.1 · typescript-eslint 8.69.0 · eslint-plugin-react-hooks 7.1.1
//   ESLint 10 已彻底移除 eslintrc，只有 flat config；本文件是唯一配置入口。
//
// 类型感知（type-aware）linting 的分层：
//   · 三个 src/ 目录 → projectService，能用到 no-floating-promises 这类需要类型的规则
//   · 各种 *.config.ts / prisma.config.ts → 不在任何 tsconfig 的 include 里，
//     所以显式走「无类型」块，否则 projectService 会报 "file not found in project"

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { globalIgnores } from "eslint/config";

// ── 文件分组 ────────────────────────────────────────────────────────────────
//
// ⚠ flat config 陷阱：`files` 里的**非通用**模式（不以 `**/*` 结尾的）会把匹配到的文件
//   加进「待检查文件集合」。写成 `frontend/shared/**` 会让 ESLint 去解析 tokens.css 并
//   报 parse error。所以下面每一条都必须显式带扩展名。
const BACKEND_SRC = ["backend/src/**/*.ts"];
const FRONTEND_SRC = ["frontend/{client,dashboard}/src/**/*.{ts,tsx}"];
const SHARED_SRC = ["frontend/shared/**/*.{ts,tsx,mts}"];
const ALL_SRC = [...BACKEND_SRC, ...FRONTEND_SRC, ...SHARED_SRC];
const TESTS = [
  "**/*.{test,spec}.{ts,tsx,js,mjs}",
  "**/__tests__/**/*.{ts,tsx,js,mjs}",
  "**/tests/**/*.{ts,tsx,js,mjs}",
];
// 设计 token 的落地点：只有这里允许出现字面量色值，其余地方必须引用 token。
// CSS 侧的真相源是 frontend/shared/tokens.css —— ESLint 不检查 CSS（没装 @eslint/css），
// 所以那边天然不受色值规则约束；TS 侧的真相源是 frontend/shared/design-tokens.ts。
const TOKEN_FILES = [
  ...SHARED_SRC,
  "frontend/{client,dashboard}/src/theme/**/*.{ts,tsx}",
];

// ── no-restricted-syntax 的三组选择器 ──────────────────────────────────────
// esquery 的正则字面量不支持 `/` 字符、只支持 `i` 标志，所以下面刻意写死大小写字符类。

/** 禁止进程内共享状态：模块级 / 静态字段上的空 Map/Set。 */
const NEW_STATE = "[callee.name=/^(Map|Set|WeakMap|WeakSet)$/][arguments.length=0]";
const STATE_MSG =
  "禁止用模块级 new Map()/new Set() 存进程内共享状态（session / 限流 / presence / 缓存一律走 Redis）。" +
  "上一代有 59 个进程内 Map、只有 21 个带上限，结果是内存持续增长且无法多实例部署。" +
  "如果这确实是一张不可变查表，请用带初始值的 new Map([...]) 或普通对象字面量。";

const RESTRICT_STATE = [
  {
    selector: `Program > VariableDeclaration > VariableDeclarator > NewExpression${NEW_STATE}`,
    message: STATE_MSG,
  },
  {
    selector: `Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > NewExpression${NEW_STATE}`,
    message: STATE_MSG,
  },
  {
    selector: `PropertyDefinition[static=true] > NewExpression${NEW_STATE}`,
    message: STATE_MSG,
  },
];

/** 禁止字面量色值：强制走设计 token。上一代累积出 8,894 行无结构 CSS。 */
const COLOR_MSG =
  "禁止字面量颜色值。颜色只能来自设计 token（client 走 Tailwind/HeroUI theme，" +
  "dashboard 走 AntD theme token）。需要新颜色时先加 token，不要就地写死。";

const RESTRICT_COLOR = [
  // #fff / #ffffff / #ffffffff（\b 让 "#feedback" 这类锚点不会误报）
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
    message: COLOR_MSG,
  },
  {
    selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
    message: COLOR_MSG,
  },
  // rgb() / rgba() / hsl() / oklch() / color-mix() ...
  {
    selector:
      "Literal[value=/(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color-mix)[ ]*\\(/]",
    message: COLOR_MSG,
  },
  {
    selector:
      "TemplateElement[value.raw=/(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color-mix)[ ]*\\(/]",
    message: COLOR_MSG,
  },
];

/** 禁止 inline style：同上，视觉决策必须落在组件库 / token 里。 */
const RESTRICT_INLINE_STYLE = [
  {
    selector: "JSXAttribute[name.name='style']",
    message:
      "禁止 inline style。样式走组件库 variant / Tailwind class（client）或 AntD token（dashboard）。" +
      "确需动态尺寸（如 ECharts 容器）时，用 CSS 变量或 className 切换，不要写 style={{...}}。",
  },
];

export default tseslint.config(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.vite/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "backend/prisma/migrations/**",
    // 生成物一律豁免：Prisma client 动辄上万行，max-lines 对它没有意义
    "**/generated/**",
    "**/*.generated.*",
    "tmp/**",
    // openapi-typescript 生成物，不手写也不该被规范约束
    "frontend/shared/api-types.d.ts",
  ]),

  // ── 0 · 基线：所有 JS/TS 都吃 eslint:recommended ─────────────────────────
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  // ── 1 · 硬约束：三个 src/ 一视同仁 ──────────────────────────────────────
  // max-lines 计「有效代码行」（跳过空行和注释），所以写注释是免费的、堆代码不是。
  {
    files: ALL_SRC,
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "no-restricted-syntax": [
        "error",
        ...RESTRICT_STATE,
        ...RESTRICT_COLOR,
        ...RESTRICT_INLINE_STYLE,
      ],
      // 顺手拦住几类会长成技术债的东西
      "max-params": ["error", { max: 5 }],
      "max-depth": ["error", { max: 4 }],
      complexity: ["error", { max: 15 }],
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // ── 2 · TypeScript（类型感知）───────────────────────────────────────────
  {
    files: ALL_SRC,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // 未 await 的 Promise 是后端最容易静默吞掉错误的地方
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },

  // ── 3 · backend（NestJS：ESM 语法 → CommonJS 产物 + 装饰器）──────────────
  // 注意 sourceType 必须是 "module"：NestJS 源码写 ESM import，只是 tsc 编成 CJS。
  {
    files: BACKEND_SRC,
    languageOptions: { sourceType: "module" },
    rules: {
      // ① 装饰器场景必须放宽的：
      // @Module({}) 常常就是个空类，no-extraneous-class 会误伤
      "@typescript-eslint/no-extraneous-class": "off",
      // constructor(private readonly x: Foo) {} 是 NestJS 的注入写法，不是"无用构造器"
      "no-useless-constructor": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      // ！！不要打开 consistent-type-imports ！！
      // emitDecoratorMetadata 依赖构造器参数的运行时类型；一旦被改写成
      // `import type { FooService }`，design:paramtypes 就变成 Object，DI 直接解析失败。
      "@typescript-eslint/consistent-type-imports": "off",
      // 装饰器工厂返回 any，class-validator / swagger 大量如此
      "@typescript-eslint/no-unsafe-call": "off",
      // ② Map/Set 的约束只针对**模块顶层与 static 字段**（即真正的进程内共享状态）。
      //    有意 **不** 管类的实例字段：带 Redis Pub/Sub 失效机制的实例级缓存
      //    （如 AppConfigService）是正当用法 —— 规则本意是禁止"用进程内 Map 存
      //    本该跨实例共享的状态"，不是禁止一切 Map。
      "no-restricted-syntax": ["error", ...RESTRICT_STATE, ...RESTRICT_COLOR],
    },
  },

  // ── 3a · import 边界 ────────────────────────────────────────────────────
  //
  // dependency-cruiser 是**权威**（它看解析后的真实文件，能抓到经中转文件的间接依赖）；
  // 这里的 no-restricted-imports 只是为了在编辑器里即时报错，别等到 pnpm lint。
  //
  // 分层（2026-09-03 修正版，见 CLAUDE.md）：
  //   core/       纯函数层。零框架、零 IO
  //   infra/      基础设施。允许 NestJS DI + Prisma + Redis
  //   sources/    爬虫解析器。只允许 @nestjs/common
  //   modules/    controller + service
  {
    files: ["backend/src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@nestjs",
                "@nestjs/*",
                "@prisma/*",
                ".prisma/*",
                "ioredis",
                "pg",
                "sharp",
                "cheerio",
                "class-validator",
                "class-transformer",
                "reflect-metadata",
              ],
              message:
                "core/ 是纯函数层：零框架、零 IO。这是整套边界里最重要的一条 —— 它保证判同算法能脱离框架和数据库直接跑 Vitest。需要注入时把接口定义在 core/，由 infra/ 或 modules/ 提供实现。",
            },
            {
              group: [
                "node:fs",
                "node:fs/*",
                "fs",
                "node:net",
                "net",
                "node:http",
                "http",
                "node:https",
                "https",
                "node:dns",
                "dns",
                "node:child_process",
                "child_process",
                "node:worker_threads",
                "worker_threads",
              ],
              message:
                "core/ 不得做 IO。读文件/发请求属于 infra/ 或 sources/，core 只处理已经取回来的数据 —— 这样判同才能用固定样本做确定性测试。",
            },
            {
              group: [
                "**/infra/**",
                "**/modules/**",
                "**/sources/**",
                "**/contracts/**",
              ],
              message:
                "core/ 在最底层，依赖方向必须始终指向它。不得反向依赖 infra/ · modules/ · sources/ · contracts/。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/src/infra/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/**"],
              message:
                "infra/ 不得反向依赖 modules/。基础设施若知道业务模块，分层就塌了，而且会立刻产生循环依赖。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@prisma/*", ".prisma/*"],
              message:
                "modules/ 不得直连 Prisma。数据访问一律经 infra/repositories/（controller 和 service 里不得出现 prisma.xxx）。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/src/sources/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/**", "**/modules"],
              message: "sources/ 是爬虫解析层，不得依赖 HTTP 层。共享逻辑下沉到 core/。",
            },
            {
              // `!` 是 no-restricted-imports 的取反语法：禁 @nestjs/* 但放行 @nestjs/common
              group: ["@nestjs/*", "!@nestjs/common"],
              message:
                "sources/ 只允许 @nestjs/common（为了 @Injectable / Logger），不得引入 HTTP / WebSocket / Swagger / Throttler 等框架件。IO 由调用方注入。",
            },
          ],
        },
      ],
    },
  },

  // ── 4 · 前端共用（React 19 + JSX）───────────────────────────────────────
  {
    files: FRONTEND_SRC,
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/backend/**", "@baonly/backend", "@baonly/backend/*"],
              message:
                "前端不得 import backend 的运行时代码。API 类型只能来自 openapi-typescript 生成的 frontend/shared/api-types.d.ts。",
            },
          ],
        },
      ],
    },
  },

  // ── 5 · client：只用 HeroUI ─────────────────────────────────────────────
  {
    files: ["frontend/client/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "antd", message: "前台只用 HeroUI，不引入 Ant Design。" },
          ],
          patterns: [
            {
              group: ["antd/*", "@ant-design/*"],
              message: "前台只用 HeroUI，不引入 Ant Design。",
            },
            {
              group: ["**/backend/**", "@baonly/backend", "@baonly/backend/*"],
              message: "前端不得 import backend 的运行时代码。",
            },
          ],
        },
      ],
    },
  },

  // ── 6 · dashboard：只用 AntD ────────────────────────────────────────────
  {
    files: ["frontend/dashboard/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@heroui", "@heroui/*", "framer-motion"],
              message: "后台只用 Ant Design，不引入 HeroUI。",
            },
            {
              group: ["**/backend/**", "@baonly/backend", "@baonly/backend/*"],
              message: "前端不得 import backend 的运行时代码。",
            },
          ],
        },
      ],
    },
  },

  // ── 7 · 设计 token 落地点：唯一允许写字面量色值的地方 ────────────────────
  {
    files: TOKEN_FILES,
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICT_STATE, ...RESTRICT_INLINE_STYLE],
    },
  },

  // ── 8 · 声明文件：只有类型，行数/函数长度约束无意义 ──────────────────────
  {
    files: ["**/*.d.ts"],
    rules: {
      "max-lines": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // ── 9 · 测试：允许长文件（用例多是正常的），但函数长度仍然管 ──────────────
  {
    files: TESTS,
    rules: {
      "max-lines": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  // ── 10 · 构建/工具配置文件：不走类型感知（它们不在任何 tsconfig 的 include 里）─
  {
    files: [
      "**/*.config.{ts,mts,cts}",
      "backend/prisma.config.ts",
      "**/vitest.config.{ts,mts}",
    ],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: { process: "readonly", console: "readonly" },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // ── 11 · 根目录的 JS 配置文件本身 ───────────────────────────────────────
  {
    files: ["*.{js,mjs,cjs}", "scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        URL: "readonly",
      },
    },
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },
);
