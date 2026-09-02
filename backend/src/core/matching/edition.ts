/**
 * 届数（期号）解析与跨源归一 —— 业务规则 3。
 *
 * 同一场展会的届数在三个平台上写法完全不同：
 *   bilibili 「北京·蔚蓝档案only同人展2.0」          → 2
 *   cpp      「长春蔚蓝档案ONLY02.轨聚春城」          → 2
 *   通用     「第二届」「ONLY-2」「ONLY·2」「ONLY 2」 → 2
 *   深圳系列 「蔚蓝档案同人Only·第68号邀请」          → 68
 *
 * 归一目标是同一个字符串，这样「届数相同」才能成为一维可用的证据。
 * 注意年份（2025）绝不能被当成届数，所以年份在解析前先剔除。
 */

/** 简体中文数字字面量。只覆盖 0-9，十位靠 {@link parseChineseNumber} 组合。 */
const CHINESE_DIGITS: Readonly<Record<string, number>> = {
  零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 两: 2, 贰: 2, 三: 3, 叁: 3,
  四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陆: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9,
};

/**
 * 解析「二」「十」「二十」「二十三」「12」这类小数字。
 * 届数不会超过两位，所以只实现到「X十Y」，不做万/亿。
 * 解析失败返回 null（调用方保留原文，不做臆测）。
 */
export function parseChineseNumber(text: string): number | null {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);

  const tenIndex = value.indexOf('十');
  if (tenIndex >= 0) {
    const head = value.slice(0, tenIndex);
    const tail = value.slice(tenIndex + 1);
    const tens = head ? CHINESE_DIGITS[head] : 1;
    const ones = tail ? CHINESE_DIGITS[tail] : 0;
    if (tens === undefined || ones === undefined) return null;
    return tens * 10 + ones;
  }

  const digits = [...value].map((char) => CHINESE_DIGITS[char]);
  if (digits.some((digit) => digit === undefined)) return null;
  return Number(digits.join(''));
}

/**
 * 届数模式。顺序即优先级：先匹配语义最明确的「第 N 号邀请 / 第 N 届」，
 * 再匹配挂在 only 后面的数字。
 *
 * `[-_·.、]?` 容忍分隔符 —— 这是规则 3 明确要求的（`ONLY-02` / `ONLY·2`）。
 */
const EDITION_PATTERNS: readonly RegExp[] = [
  /第\s*([0-9零〇一二两三四五六七八九十]+)\s*号邀请/i,
  /第\s*([0-9零〇一二两三四五六七八九十]+)\s*(?:届|回|次|弹|期)/i,
  /only\s*[-_·.、\s]?\s*([0-9]{1,2}(?:\.[0-9]+)?)/i,
  /only\s*[-_·.、\s]?\s*([一二两三四五六七八九十]+)/i,
  /vol\.?\s*([0-9]{1,2}(?:\.[0-9]+)?)/i,
];

/** 四位年份不是届数，解析前先挖空（保留位宽，避免把「2025」粘成「25」）。 */
function stripYears(value: string): string {
  return value.replace(/(?:19|20)\d{2}/g, '    ');
}

/**
 * 抽取并归一标题里的届数。
 * 返回十进制整数字符串（`"2"`、`"68"`），无届数时返回空串。
 *
 * `2.0` / `02` / `二` / `第二届` / `ONLY-02` 一律归到 `"2"`：
 * 小数点后缀是「2.0 世代」这种营销写法，不承载序号信息。
 */
export function extractEdition(title: string | null | undefined): string {
  const text = stripYears(String(title ?? '').toLowerCase());
  for (const pattern of EDITION_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const raw = match[1];
    const parsed = parseChineseNumber(raw.includes('.') ? raw.split('.')[0] : raw);
    if (parsed === null || Number.isNaN(parsed)) continue;
    return String(parsed);
  }
  return '';
}

/** 两个标题的届数关系。双方都写了届数才可能构成证据或反证。 */
export type EditionRelation = 'match' | 'conflict' | 'unknown';

export function compareEditions(left: string, right: string): EditionRelation {
  const leftEdition = extractEdition(left);
  const rightEdition = extractEdition(right);
  if (!leftEdition || !rightEdition) return 'unknown';
  return leftEdition === rightEdition ? 'match' : 'conflict';
}
