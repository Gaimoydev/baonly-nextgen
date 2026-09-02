/**
 * 场馆相似度与冲突判定 —— 业务规则 4。
 *
 * 三个源写场馆的方式完全不同，这是判同里最脏的一维：
 *   bilibili  venueName=「北京大红门国际会展中心」 address=「永外高庄138号」
 *   cpp       venueName=「北京 丰台」（只有市+区！）  address=「丰台区永外高庄138号 大红门国际会展中心 兰亭阁一层报告厅」
 *   dlcomic   venueName=address=「长春市丽枫酒店宽城区长白路50号」
 *
 * 所以：**venueName 和 address 必须合起来看**，不能只信 venueName。
 * 处理方式是把两者切成片段，逐片剥掉城市 / 行政区 / 路名门牌 / 楼层 /
 * 通用设施后缀，剩下的就是「地标 token」。比较地标集合，而不是比较整串。
 */

import { KNOWN_CITY_NAMES, normalizeCity } from './normalize';
import { similarityRatio } from './similarity';

/**
 * 地标 token 的最小长度 —— 规则 4 里「内核≥3字」的落点。
 *
 * 依据：中国的市辖区名几乎全是 2 个字（丰台/朝阳/宽城/普陀/杨浦/宝山/南山/海珠），
 * 而真实场馆地标都 ≥3 字（大红门国际 / 凯宾斯基 / 智慧湾 / 西店记忆funstown）。
 * 取 3 恰好把「上海 普陀」这类只写到区级的文本挡在「具体场馆」之外，
 * 使它们既不能构成场馆证据、也不能构成场馆冲突。
 */
export const VENUE_LANDMARK_MIN_LENGTH = 3;

/** 判定两个地标 token 相同所需的最小长度与相似度（避免短 token 靠一两个字撞上）。 */
const VENUE_CONTAINMENT_MIN_LENGTH = 4;
const VENUE_FUZZY_MIN_LENGTH = 5;
const VENUE_FUZZY_MIN_RATIO = 0.72;

/** 片段切分符。中英文标点 + 空白。 */
const SEGMENT_SPLIT_PATTERN = /[·・\s_\-—~～:：,，.。!！?？'"'"“”()（）【】\[\]{}<>《》&＆/\\|+*#@]+/;

/** 行政区划片段：带后缀的才剥，避免误伤「宽城」这种可能是地标一部分的裸词。 */
const REGION_FRAGMENT_PATTERN =
  /[一-龥]{1,6}(?:省|自治区|特别行政区|地区|市|区|县|镇|乡|街道|社区|商圈|新区|开发区|高新区)/g;

/** 路名 + 门牌。「长白路50号」「逸景路462号」整体无判别力。 */
const STREET_PATTERN = /[一-龥a-z0-9]+(?:路|街|大道|巷|弄|里)[0-9]*(?:号)?/g;

/** 楼层 / 馆号 / 门牌残留。注意长模式在前，否则「号楼」会被「号」先吃掉。 */
const BUILDING_PATTERN = /[0-9]+\s*(?:号楼|号馆|号厅|号|栋|幢|座|楼|层|f)\b?/g;

/**
 * 通用设施后缀。剥掉之后剩下的才是专名。
 * 顺序即优先级：长词必须排在其后缀词之前（国际会展中心 → 会展中心 → 中心）。
 */
const FACILITY_SUFFIX_PATTERN =
  /国际会展中心|国际会议中心|会展中心|展览中心|会议中心|大宴会厅|宴会厅|多功能厅|报告厅|文创小镇|创意园区|文创园|创意园|科创园|产业园|购物中心|体育中心|活动中心|展示中心|艺术中心|美术馆|博物馆|图书馆|体育馆|文化馆|展厅|酒店|宾馆|会馆|商场|商城|大厦|广场|园区|公园|中心/g;

/** 整段就是这些词时直接丢弃（它们不是地名）。 */
const GENERIC_SEGMENTS: readonly string[] = [
  '场馆', '地址', '会场', '现场', '活动', '空间', '街区', '展区', '漫展区',
  '东区', '西区', '南区', '北区', '中区', '主会场', '分会场',
];

/** 把一条记录的场馆文本拼起来。**venueName 和 address 都要。** */
export function venueText(record: {
  venueName?: string | null;
  address?: string | null;
}): string {
  return [record.venueName, record.address].filter(Boolean).join(' ').trim();
}

/** 单个片段 → 地标内核。返回空串表示这个片段没有判别力。 */
function segmentToLandmark(segment: string, cityHints: readonly string[]): string {
  let core = segment.toLowerCase().trim();
  if (!core) return '';

  const hints = [...cityHints.map((hint) => normalizeCity(hint)), ...KNOWN_CITY_NAMES]
    .filter((hint) => hint.length >= 2)
    .sort((left, right) => right.length - left.length);
  for (const hint of hints) core = core.split(hint).join('');

  core = core
    .replace(REGION_FRAGMENT_PATTERN, '')
    .replace(STREET_PATTERN, '')
    .replace(FACILITY_SUFFIX_PATTERN, '')
    .replace(BUILDING_PATTERN, '')
    .replace(/[0-9]+/g, '')
    .replace(/^[东西南北中]+/, '')
    .trim();

  if (core.length < VENUE_LANDMARK_MIN_LENGTH) return '';
  if (GENERIC_SEGMENTS.includes(core)) return '';
  return core;
}

/**
 * 一条记录的地标 token 集合。空数组 = 该记录没有写明具体场馆
 * （只有城市/区级文本，或者干脆没填），此时它既不能证实也不能证伪。
 */
export function venueLandmarks(
  record: { venueName?: string | null; address?: string | null },
  cityHints: readonly string[] = [],
): string[] {
  const text = venueText(record);
  if (!text) return [];
  const landmarks: string[] = [];
  for (const segment of text.split(SEGMENT_SPLIT_PATTERN)) {
    const landmark = segmentToLandmark(segment, cityHints);
    if (landmark && !landmarks.includes(landmark)) landmarks.push(landmark);
  }
  return landmarks;
}

/** 两个地标 token 是否指同一个地方。 */
function landmarksEqual(left: string, right: string): boolean {
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length >= VENUE_CONTAINMENT_MIN_LENGTH && longer.includes(shorter)) return true;
  return (
    shorter.length >= VENUE_FUZZY_MIN_LENGTH &&
    similarityRatio(left, right) >= VENUE_FUZZY_MIN_RATIO
  );
}

/**
 * 场馆关系三态。
 *   `same`     双方都写明具体场馆且能对上 —— 强证据。
 *   `conflict` 双方都写明具体场馆但完全对不上 —— 规则 4 的封锁条件。
 *   `unknown`  至少一方没写到「具体场馆」这个粒度 —— 不构成证据也不构成反证。
 */
export type VenueRelation = 'same' | 'conflict' | 'unknown';

export interface VenueComparison {
  readonly relation: VenueRelation;
  readonly shared: readonly string[];
  readonly leftLandmarks: readonly string[];
  readonly rightLandmarks: readonly string[];
}

export function compareVenues(
  left: { venueName?: string | null; address?: string | null },
  right: { venueName?: string | null; address?: string | null },
  cityHints: readonly string[] = [],
): VenueComparison {
  const leftLandmarks = venueLandmarks(left, cityHints);
  const rightLandmarks = venueLandmarks(right, cityHints);
  if (!leftLandmarks.length || !rightLandmarks.length) {
    return { relation: 'unknown', shared: [], leftLandmarks, rightLandmarks };
  }
  const shared: string[] = [];
  for (const leftLandmark of leftLandmarks) {
    for (const rightLandmark of rightLandmarks) {
      if (landmarksEqual(leftLandmark, rightLandmark) && !shared.includes(leftLandmark)) {
        shared.push(leftLandmark);
      }
    }
  }
  return {
    relation: shared.length ? 'same' : 'conflict',
    shared,
    leftLandmarks,
    rightLandmarks,
  };
}
