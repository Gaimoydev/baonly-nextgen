/**
 * 判同算法的输入 / 输出类型。
 *
 * 这一层是纯数据契约：不依赖 NestJS、不依赖 Prisma、不依赖任何 IO。
 * 采集层拿到的 `SourceRecord` 需要先投影成 {@link MatchRecord} 再喂进来，
 * 好处是判同可以脱离数据库单测，也可以拿历史快照回放。
 */

/** 判同算法的输入：一条来源记录的最小视图。字段与 `SourceRecord` 同名。 */
export interface MatchRecord {
  /** 在本次输入内唯一。约定用 `${source}:${sourceId}`。 */
  readonly id: string;
  /** 来源标识：bilibili / cpp / dlcomic / manual …… */
  readonly source: string;
  readonly title: string;
  /** ISO 字符串或 Date。null 表示来源没给时间，此时该记录不参与日期证据。 */
  readonly startAt: string | Date | null;
  readonly endAt?: string | Date | null;
  readonly city?: string | null;
  readonly province?: string | null;
  readonly venueName?: string | null;
  readonly address?: string | null;
}

/**
 * 单项证据的种类。
 *
 * 命名规则：`xxxSame` / `xxxMatch` 为正证据，`xxxConflict` / `xxxMissing` 为反证据。
 * 审查台按 kind 决定图标与配色，所以这是一个稳定的对外枚举——**只允许追加**。
 */
export type MatchEvidenceKind =
  | 'cityMatch'
  | 'cityConflict'
  | 'cityUnknown'
  | 'dayOverlap'
  | 'dayDisjoint'
  | 'dayMissing'
  | 'titleKernelIdentical'
  | 'titleKernelContainment'
  | 'titleKernelSimilar'
  | 'titleTokenOverlap'
  | 'titleKernelDegenerate'
  | 'editionMatch'
  | 'editionConflict'
  | 'baOnlyContext'
  | 'venueSame'
  | 'venueConflict'
  | 'venueUnknown'
  | 'startTimeClose'
  | 'crossSource';

/** 一条可解释的证据。审查台直接展示 `detail`。 */
export interface MatchEvidenceItem {
  readonly kind: MatchEvidenceKind;
  /** 对置信度的贡献，负数为反证。权重表见 `score.ts`。 */
  readonly weight: number;
  /** 中文说明，含具体取值（例如「同城：上海」）。 */
  readonly detail: string;
}

/**
 * 判定规则 id。判同结果一定能追溯到**恰好一条**触发规则，
 * 这样运营在审查台看到的永远是「因为 X 所以合并」而不是一个裸分数。
 */
export type MatchRuleId =
  /* —— 门槛（不满足直接判否）—— */
  | 'REJECT_CITY_MISMATCH'
  | 'REJECT_NO_SHARED_DAY'
  /* —— 决定性证据（无视场馆冲突，用于支持「疑似地点变更」）—— */
  | 'ACCEPT_TITLE_KERNEL'
  /* —— 封锁 —— */
  | 'REJECT_VENUE_CONFLICT'
  /* —— 常规证据路径 —— */
  | 'ACCEPT_EDITION'
  | 'ACCEPT_BA_ONLY_CONTEXT'
  | 'ACCEPT_VENUE_MATCH'
  | 'ACCEPT_SCORE'
  | 'REJECT_INSUFFICIENT';

/** 一次两两判定的完整结果。写入 `SourceRecord.matchEvidence`。 */
export interface MatchEvidence {
  readonly ruleId: MatchRuleId;
  readonly same: boolean;
  /** 0..1 的置信度。**不是**判定依据，是给人看的强弱刻度。 */
  readonly score: number;
  readonly items: readonly MatchEvidenceItem[];
  /** 是否属于「无视场馆冲突也成立」的决定性证据。聚类时用它压制冲突否决。 */
  readonly decisive: boolean;
  /** 双方都写明了具体场馆且明显不同。 */
  readonly venueConflict: boolean;
}

/** 促成两条记录进同一簇的连边。 */
export interface MatchLink {
  readonly a: string;
  readonly b: string;
  readonly evidence: MatchEvidence;
}

/** 簇级提示，对应上一代的 `changeNotices`。 */
export type MatchWarningKind = 'venueChanged' | 'dateSpread';

export interface MatchWarning {
  readonly kind: MatchWarningKind;
  readonly message: string;
  readonly recordIds: readonly string[];
}

/** 一个聚类结果 = 一个活动。 */
export interface MatchCluster {
  /** 稳定 key：簇内 recordId 排序后拼接，不依赖输入顺序。 */
  readonly key: string;
  readonly recordIds: readonly string[];
  readonly links: readonly MatchLink[];
  readonly warnings: readonly MatchWarning[];
  /** 簇内所有连边置信度的最小值；单条记录的簇为 1。 */
  readonly confidence: number;
}

export interface MatchResult {
  readonly clusters: readonly MatchCluster[];
}
