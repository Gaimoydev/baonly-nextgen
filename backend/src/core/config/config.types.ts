/**
 * 配置系统 —— 类型层
 *
 * 设计背景
 *   上一代把 150+ 个开关塞进 `.env`，改任何行为都要改文件 + 重启，
 *   而且没有任何元数据：不知道某项的取值范围、是不是敏感、改了要不要重启。
 *   这里把「配置项的定义」变成**带元数据的一等公民**，后台配置页由元数据驱动
 *   自动生成表单 —— 加一个配置项只需在 registry 里插一行，不必改前端。
 *
 * 分层约束（CLAUDE.md）
 *   本文件在 core/ 下，**不得** import `@nestjs/*`，也不得 import Prisma。
 *   因此这里的 `ConfigCategory` / `ConfigValueType` 是独立声明的字符串联合，
 *   与 `prisma/schema.prisma` 的同名枚举保持一一对应；
 *   两者的一致性由 `core/repositories/app-config.repository.ts` 做编译期断言
 *   （那一层是唯一允许 import Prisma 的地方）。
 */

/** 配置分类。与 schema.prisma 的 `enum ConfigCategory` 逐一对应。 */
export const CONFIG_CATEGORIES = [
  "SITE",
  "CRAWLER",
  "IMAGE",
  "CDN",
  "NOTIFICATION",
  "ANALYTICS",
  "RATE_LIMIT",
  "MATCHING",
  "SECURITY",
] as const;

export type ConfigCategory = (typeof CONFIG_CATEGORIES)[number];

/** 配置值类型。与 schema.prisma 的 `enum ConfigValueType` 逐一对应。 */
export const CONFIG_VALUE_TYPES = [
  "STRING",
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "JSON",
  "CRON",
  "COLOR",
  "DURATION_MS",
  "TEMPLATE",
  "STRING_LIST",
] as const;

export type ConfigValueType = (typeof CONFIG_VALUE_TYPES)[number];

/**
 * 值类型 → TypeScript 类型的映射。
 * `config.get()` 的返回类型推导就架在这张表上。
 *
 * 注意 CRON / COLOR / TEMPLATE / TEXT 在 TS 层都是 string —— 它们的差别是
 * **后台该用哪个输入控件**和**用哪套校验**，不是运行时类型。
 */
export interface ConfigValueTypeMap {
  STRING: string;
  TEXT: string;
  TEMPLATE: string;
  CRON: string;
  COLOR: string;
  NUMBER: number;
  DURATION_MS: number;
  BOOLEAN: boolean;
  STRING_LIST: readonly string[];
  /** JSON 项的具体类型由 registry 里 defaultValue 的字面量推导（见 ConfigValue） */
  JSON: unknown;
}

/** 写入时的校验约束。后台前端也读同一份约束来做即时校验。 */
export interface ConfigConstraints {
  /** NUMBER / DURATION_MS：闭区间下界 */
  readonly min?: number;
  /** NUMBER / DURATION_MS：闭区间上界 */
  readonly max?: number;
  /** NUMBER：步进，用于后台 InputNumber 控件 */
  readonly step?: number;
  /** 字符串类：正则（字符串形式，便于随行存进 jsonb 并传给前端） */
  readonly pattern?: string;
  /** 字符串类：枚举取值。给了它后台就渲染下拉框而不是文本框 */
  readonly options?: readonly string[];
  readonly minLength?: number;
  readonly maxLength?: number;
  /** STRING_LIST：列表项数上限，防止后台粘贴进一个巨大的名单 */
  readonly maxItems?: number;
}

/** 配置项定义里与值类型无关的公共部分 */
interface ConfigDefinitionBase {
  readonly category: ConfigCategory;
  /** 后台显示的中文名 */
  readonly label: string;
  /** 说明、单位、取值含义。写给运营看，不是写给程序员看 */
  readonly description?: string;
  readonly constraints?: ConfigConstraints;
  /** true = 公共 API 绝不返回，后台以掩码显示 */
  readonly isSecret?: boolean;
  /**
   * true = 改了必须重启才生效。
   * 绝大多数项应为 false —— 需要重启就说明它可能压根不该进数据库。
   */
  readonly requiresRestart?: boolean;
}

/**
 * 单个值类型下的配置项定义。
 * 把 valueType 和 defaultValue 绑在一起，是为了让
 * `{ valueType: "NUMBER", defaultValue: "abc" }` 在**编译期**就报错。
 */
export interface ConfigDefinitionOf<T extends ConfigValueType>
  extends ConfigDefinitionBase {
  readonly valueType: T;
  readonly defaultValue: T extends "JSON" ? unknown : ConfigValueTypeMap[T];
}

/**
 * 配置项定义（所有值类型的联合）。
 * registry 用 `satisfies Record<string, ConfigDefinition>` 校验，
 * 同时靠 `as const` 保住 defaultValue 的字面量类型供推导。
 */
export type ConfigDefinition = {
  [T in ConfigValueType]: ConfigDefinitionOf<T>;
}[ConfigValueType];

/** registry 的形状：key（点分命名）→ 定义 */
export type ConfigRegistryShape = Readonly<Record<string, ConfigDefinition>>;

/**
 * 把 `as const` 产生的字面量类型放宽回普通类型。
 *
 * 为什么需要它：registry 用 `as const` 冻结，于是 `defaultValue: 78` 的类型是
 * 字面量 `78` 而不是 `number`。若直接拿它当 `get()` 的返回类型，
 * `config.get('image.compress.quality')` 会得到 `78` —— 一个只能是 78 的数字，
 * 任何算术赋值都报错。所以对 JSON 类的推导结果要先 widen。
 */
export type Widen<T> = T extends boolean
  ? boolean
  : T extends number
    ? number
    : T extends string
      ? string
      : T extends readonly (infer U)[]
        ? Widen<U>[]
        : T extends object
          ? { -readonly [K in keyof T]: Widen<T[K]> }
          : T;

// ─────────────────────────────────────────────────────────────
// 持久层与广播层的端口（Ports）
//
// core/ 不认识 Prisma，也不认识 ioredis。ConfigService 只依赖下面两个接口，
// 具体实现由 core/repositories/ 和 modules/config/ 注入。
// 这样 ConfigService 可以用内存假实现直接跑 Vitest，不需要起数据库。
// ─────────────────────────────────────────────────────────────

/** 数据库里的一行配置 */
export interface ConfigRecord {
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: Date;
  readonly updatedBy: string | null;
}

/** 写入一行配置时的入参 */
export interface ConfigUpsertInput {
  readonly key: string;
  readonly category: ConfigCategory;
  readonly valueType: ConfigValueType;
  readonly value: unknown;
  readonly defaultValue: unknown;
  readonly label: string;
  readonly description: string | null;
  readonly constraints: unknown;
  readonly isSecret: boolean;
  readonly requiresRestart: boolean;
  readonly sortOrder: number;
}

/** 持久化端口 */
export interface ConfigStore {
  /** 读全表。配置总量是 registry 大小级别（百级），一次读完最划算 */
  loadAll(): Promise<readonly ConfigRecord[]>;
  /** 写单项的 value（不动元数据） */
  updateValue(key: string, value: unknown, updatedBy: string | null): Promise<void>;
  /** 幂等写入元数据 + 首次写入默认值（seed 用） */
  upsertDefinition(input: ConfigUpsertInput): Promise<void>;
  /** 删除 registry 里已不存在的 key（seed 清理用），返回删除条数 */
  deleteKeysNotIn(keys: readonly string[]): Promise<number>;
}

/**
 * 失效广播端口。
 * 多实例部署时，A 实例改了配置要让 B 实例立刻丢弃缓存快照。
 */
export interface ConfigBroadcaster {
  /** 通知所有实例（含自己）：这些 key 变了 */
  publish(keys: readonly string[]): Promise<void>;
  /** 订阅失效通知。返回取消订阅的函数 */
  subscribe(handler: (keys: readonly string[]) => void): Promise<() => void>;
}

/** 校验结果 */
export type ValidationResult<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
