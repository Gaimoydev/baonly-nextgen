/**
 * 证据权重与阈值。**判同里所有可调的数字都在这个文件里**，
 * 每一个都写明依据，禁止在别处出现裸魔法数。
 *
 * 需要说明设计取舍：置信度不是判定依据。
 * 上一代把一切压进一个加权和再和 `0.6` 比较（`titleScore >= 0.34`、
 * `scheduleScore >= 0.2`、`score >= 0.6`），结果是没人能解释某两条为什么合并了——
 * 分数相同的两对记录可能出于完全不同的原因。
 *
 * 本实现改成：**判定由 `compare.ts` 里一串有序的具名规则给出**（结果里带 ruleId），
 * 这里的权重只用来算一个 0..1 的置信度刻度，给后台「判同审查台」排序和标色用。
 * 唯一真正参与判定的阈值是 {@link ACCEPT_SCORE_THRESHOLD}，
 * 它服务于兜底规则 `ACCEPT_SCORE`（前面所有具名规则都没命中时才轮到它）。
 */

import type { MatchEvidenceItem, MatchEvidenceKind } from './types';

/**
 * 各维证据对置信度的贡献。
 *
 * 标定思路：
 *   - 门槛证据（同城 + 同日）合计 0.28。它们是必要条件，单独出现不足以判同，
 *     但必须计入置信度，否则审查台上看不到「凭什么进入比较」。
 *   - 标题内核相等 0.45：单维最强证据。跨源标题内核相等基本不会是巧合。
 *   - 「双方都是蔚蓝档案 only 展」0.26：本项目最高频的合并依据。
 *     配合同城同日共 0.54 —— 刻意压在 {@link ACCEPT_SCORE_THRESHOLD} 之下，
 *     使它只能经由具名规则 `ACCEPT_BA_ONLY_CONTEXT` 合并（那条规则受场馆冲突封锁），
 *     不会从兜底分数路径偷偷溜过去。
 *   - 场馆冲突 -0.30：足以把任何单维正证据拉回阈值以下。
 */
export const EVIDENCE_WEIGHTS: Readonly<Record<MatchEvidenceKind, number>> = {
  cityMatch: 0.1,
  cityConflict: -1,
  cityUnknown: -1,
  dayOverlap: 0.18,
  dayDisjoint: -1,
  dayMissing: -1,
  titleKernelIdentical: 0.45,
  titleKernelContainment: 0.34,
  titleKernelSimilar: 0.24,
  titleTokenOverlap: 0.2,
  titleKernelDegenerate: -0.05,
  editionMatch: 0.22,
  editionConflict: -0.2,
  baOnlyContext: 0.26,
  venueSame: 0.28,
  venueConflict: -0.3,
  venueUnknown: 0,
  startTimeClose: 0.12,
  crossSource: 0.04,
};

/**
 * 兜底规则 `ACCEPT_SCORE` 的阈值。
 *
 * 取 0.62 的依据：门槛(0.28) + 标题内核高度相似(0.24) + n-gram 重合(0.20) = 0.72 可过；
 * 而门槛(0.28) + 单独一维中等证据 ≤ 0.54 不过。也就是说兜底路径要求
 * **至少两维独立的标题证据**，用于捞回既非 only 展、场馆也没写全的边缘记录
 * （咖啡联动、签售会这类）。
 */
export const ACCEPT_SCORE_THRESHOLD = 0.62;

/* ── 标题内核相似度分档 ────────────────────────────────────────────────
 * 依据：真实跨源标题内核相等的占多数，剩下的差异来自「多一个副标题」。
 * 0.72 对应「一方是另一方加了 2-3 个修饰字」；0.55 以下开始出现无关标题，
 * 所以只保留高档一个档位参与计分，低档不计分（只在证据里陈述）。 */
export const KERNEL_SIMILARITY_STRONG = 0.72;

/** n-gram 重合度阈值。0.40 对应「词序颠倒但用词基本一致」。 */
export const TOKEN_OVERLAP_STRONG = 0.4;

/**
 * 内核包含判定的最小被包含长度。
 *
 * 依据：2 字内核（如「夏日」）做子串命中假阳性太高；3 字起才有判别力。
 * 注意这和 `normalize.ts` 的退化守卫是两道独立的闸：
 * 退化守卫挡的是**空内核**，这里挡的是**过短内核**。
 */
export const KERNEL_CONTAINMENT_MIN_LENGTH = 3;

/**
 * 开场时刻视为「同一场」的最大间隔（小时）。
 *
 * 依据：同一场展会在不同平台登记的开场时间常有 1-2 小时差
 * （入场时间 vs 开展时间）。超过 6 小时基本是上午场/下午场两场不同活动，
 * 所以只对 ≤6h 给分，且不作为否定证据（很多源只给日期不给时刻）。
 */
export const START_TIME_CLOSE_HOURS = 6;

/** 求和并夹到 0..1。 */
export function confidenceFrom(items: readonly MatchEvidenceItem[]): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return Math.min(1, Math.max(0, Number(total.toFixed(4))));
}

/** 构造一条证据项，权重从权重表取，避免调用方手写数字。 */
export function evidence(kind: MatchEvidenceKind, detail: string): MatchEvidenceItem {
  return { kind, weight: EVIDENCE_WEIGHTS[kind], detail };
}
