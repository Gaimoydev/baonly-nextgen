/**
 * 两两判同的规则引擎。
 *
 * 判定是一串**有序的具名规则**，第一条命中的规则即为结论，其 id 写进
 * `MatchEvidence.ruleId`。这样后台审查台展示的永远是「因为 X 所以合并」，
 * 而不是一个无从解释的加权和。
 *
 * 规则顺序（顺序本身承载业务语义，改动前先改测试）：
 *   1. REJECT_CITY_MISMATCH    门槛：城市必须能确定且相同
 *   2. REJECT_NO_SHARED_DAY    门槛：必须有含年份的日期重合（规则 1 + 规则 5）
 *   3. ACCEPT_TITLE_KERNEL     决定性：标题内核相等或包含 —— 无视场馆冲突，
 *                              这样「同一场展会换了场地」仍能合并并给出变更提示
 *   4. REJECT_VENUE_CONFLICT   封锁：双方都写明具体场馆且不同（规则 4）
 *   5. ACCEPT_EDITION          同届（规则 3）+ 同为 BA only 语境
 *   6. ACCEPT_BA_ONLY_CONTEXT  双方都是蔚蓝档案 only 展（最高频的合并依据）
 *   7. ACCEPT_VENUE_MATCH      场馆对上 + 任一维标题亲和
 *   8. ACCEPT_SCORE            兜底：置信度过阈（需两维独立标题证据）
 *   9. REJECT_INSUFFICIENT     证据不足
 */

import { compareEditions, extractEdition } from './edition';
import {
  isKernelDegenerate,
  resolveCity,
  sharesBaOnlyContext,
  titleKernel,
} from './normalize';
import { isDateOnly, sharedDayKeys, startTimeGapHours } from './schedule';
import {
  ACCEPT_SCORE_THRESHOLD,
  KERNEL_CONTAINMENT_MIN_LENGTH,
  KERNEL_SIMILARITY_STRONG,
  START_TIME_CLOSE_HOURS,
  TOKEN_OVERLAP_STRONG,
  confidenceFrom,
  evidence,
} from './score';
import { containsWithMinLength, similarityRatio, tokenOverlapRatio } from './similarity';
import type { MatchEvidence, MatchEvidenceItem, MatchRecord, MatchRuleId } from './types';
import { compareVenues } from './venue';

/** 判定所需的全部中间信号，抽出来是为了让规则表只做判断、不做计算。 */
interface Signals {
  readonly items: MatchEvidenceItem[];
  readonly kernelIdentical: boolean;
  readonly kernelContainment: boolean;
  readonly kernelSimilar: boolean;
  readonly tokenOverlapStrong: boolean;
  readonly editionMatch: boolean;
  readonly baOnly: boolean;
  readonly venueSame: boolean;
  readonly venueConflict: boolean;
}

function reject(
  ruleId: MatchRuleId,
  items: readonly MatchEvidenceItem[],
  venueConflict = false,
): MatchEvidence {
  return { ruleId, same: false, score: confidenceFrom(items), items, decisive: false, venueConflict };
}

/** 收集标题维度的证据。内核退化时相等/包含两条路径整体禁用（业务规则 2）。 */
function collectTitleSignals(
  left: MatchRecord,
  right: MatchRecord,
  cityHints: readonly string[],
  items: MatchEvidenceItem[],
): Pick<Signals, 'kernelIdentical' | 'kernelContainment' | 'kernelSimilar' | 'tokenOverlapStrong'> {
  const leftKernel = titleKernel(left.title, cityHints);
  const rightKernel = titleKernel(right.title, cityHints);
  const degenerate = isKernelDegenerate(leftKernel) || isKernelDegenerate(rightKernel);

  if (degenerate) {
    items.push(
      evidence(
        'titleKernelDegenerate',
        `标题内核过短（「${leftKernel || '空'}」/「${rightKernel || '空'}」），已禁用标题相等与包含判定`,
      ),
    );
    return {
      kernelIdentical: false,
      kernelContainment: false,
      kernelSimilar: false,
      tokenOverlapStrong: false,
    };
  }

  const identical = leftKernel === rightKernel;
  const containment =
    !identical &&
    containsWithMinLength(leftKernel, rightKernel, KERNEL_CONTAINMENT_MIN_LENGTH);
  const ratio = similarityRatio(leftKernel, rightKernel);
  const overlap = tokenOverlapRatio(leftKernel, rightKernel);
  const similar = !identical && !containment && ratio >= KERNEL_SIMILARITY_STRONG;
  const tokenStrong = !identical && overlap.ratio >= TOKEN_OVERLAP_STRONG;

  if (identical) items.push(evidence('titleKernelIdentical', `标题内核相等：「${leftKernel}」`));
  else if (containment) {
    items.push(
      evidence('titleKernelContainment', `标题内核互相包含：「${leftKernel}」⊃⊂「${rightKernel}」`),
    );
  }
  if (similar) {
    items.push(
      evidence('titleKernelSimilar', `标题内核高度相似（${ratio.toFixed(2)}）：「${leftKernel}」/「${rightKernel}」`),
    );
  }
  if (tokenStrong) {
    items.push(
      evidence(
        'titleTokenOverlap',
        `标题关键词重合 ${overlap.ratio.toFixed(2)}：${overlap.shared.slice(0, 3).join('、')}`,
      ),
    );
  }
  return {
    kernelIdentical: identical,
    kernelContainment: containment,
    kernelSimilar: similar,
    tokenOverlapStrong: tokenStrong,
  };
}

/** 收集届数 / only 语境 / 场馆 / 时刻 / 跨源这几维证据。 */
function collectContextSignals(
  left: MatchRecord,
  right: MatchRecord,
  cityHints: readonly string[],
  items: MatchEvidenceItem[],
): Pick<Signals, 'editionMatch' | 'baOnly' | 'venueSame' | 'venueConflict'> {
  const editionRelation = compareEditions(left.title, right.title);
  if (editionRelation === 'match') {
    items.push(evidence('editionMatch', `届数一致：第 ${extractEdition(left.title)} 届`));
  } else if (editionRelation === 'conflict') {
    items.push(
      evidence(
        'editionConflict',
        `届数不同：${extractEdition(left.title)} vs ${extractEdition(right.title)}`,
      ),
    );
  }

  const baOnly = sharesBaOnlyContext(left.title, right.title);
  if (baOnly) items.push(evidence('baOnlyContext', '双方均为蔚蓝档案 only 展'));

  const venue = compareVenues(left, right, cityHints);
  if (venue.relation === 'same') {
    items.push(evidence('venueSame', `场馆一致：${venue.shared.join('、')}`));
  } else if (venue.relation === 'conflict') {
    items.push(
      evidence(
        'venueConflict',
        `场馆冲突：「${venue.leftLandmarks.join('、')}」vs「${venue.rightLandmarks.join('、')}」`,
      ),
    );
  } else {
    items.push(evidence('venueUnknown', '至少一方未写明具体场馆，场馆维度不参与判定'));
  }

  const gap = startTimeGapHours(left, right);
  if (gap !== null && gap <= START_TIME_CLOSE_HOURS) {
    items.push(evidence('startTimeClose', `开场时刻相差 ${gap.toFixed(1)} 小时`));
  } else if (gap === null && (isDateOnly(left) || isDateOnly(right))) {
    // 只给日期不给时刻的源（cpp 大量如此）不因此扣分，仅陈述。
  }

  if (left.source !== right.source) {
    items.push(evidence('crossSource', `跨源印证：${left.source} / ${right.source}`));
  }

  return {
    editionMatch: editionRelation === 'match',
    baOnly,
    venueSame: venue.relation === 'same',
    venueConflict: venue.relation === 'conflict',
  };
}

/** 按规则表得出结论。返回 [ruleId, same, decisive]。 */
function applyRules(signals: Signals, score: number): [MatchRuleId, boolean, boolean] {
  if (signals.kernelIdentical || signals.kernelContainment) {
    return ['ACCEPT_TITLE_KERNEL', true, true];
  }
  if (signals.venueConflict) return ['REJECT_VENUE_CONFLICT', false, false];
  if (signals.editionMatch && signals.baOnly) return ['ACCEPT_EDITION', true, false];
  if (signals.baOnly) return ['ACCEPT_BA_ONLY_CONTEXT', true, false];
  if (signals.venueSame && (signals.kernelSimilar || signals.tokenOverlapStrong)) {
    return ['ACCEPT_VENUE_MATCH', true, false];
  }
  if (score >= ACCEPT_SCORE_THRESHOLD) return ['ACCEPT_SCORE', true, false];
  return ['REJECT_INSUFFICIENT', false, false];
}

/** 判定两条来源记录是否为同一活动，并给出可解释的证据。 */
export function compareRecords(left: MatchRecord, right: MatchRecord): MatchEvidence {
  const cityHints = [left.city, left.province, right.city, right.province].filter(
    (hint): hint is string => Boolean(hint),
  );
  const leftCity = resolveCity(left);
  const rightCity = resolveCity(right);

  if (!leftCity || !rightCity) {
    return reject('REJECT_CITY_MISMATCH', [
      evidence('cityUnknown', `无法确定城市（${leftCity || '未知'} / ${rightCity || '未知'}）`),
    ]);
  }
  if (leftCity !== rightCity) {
    return reject('REJECT_CITY_MISMATCH', [
      evidence('cityConflict', `城市不同：${leftCity} vs ${rightCity}`),
    ]);
  }

  const shared = sharedDayKeys(left, right);
  if (!shared.length) {
    const kind = left.startAt && right.startAt ? 'dayDisjoint' : 'dayMissing';
    const detail =
      kind === 'dayDisjoint' ? '日期无重合（含年份比较）' : '至少一方缺少开始时间';
    return reject('REJECT_NO_SHARED_DAY', [evidence('cityMatch', `同城：${leftCity}`), evidence(kind, detail)]);
  }

  const items: MatchEvidenceItem[] = [
    evidence('cityMatch', `同城：${leftCity}`),
    evidence('dayOverlap', `日期重合：${shared.join('、')}`),
  ];
  const titleSignals = collectTitleSignals(left, right, cityHints, items);
  const contextSignals = collectContextSignals(left, right, cityHints, items);
  const signals: Signals = { items, ...titleSignals, ...contextSignals };
  const score = confidenceFrom(items);
  const [ruleId, same, decisive] = applyRules(signals, score);

  return { ruleId, same, score, items, decisive, venueConflict: signals.venueConflict };
}
