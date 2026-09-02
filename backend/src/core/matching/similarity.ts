/**
 * 字符串相似度原语。被 `normalize` 之后的内核和场馆内核共用。
 *
 * 中文标题没有空格分词，所以这里用两种互补的度量：
 *   - {@link similarityRatio}：最长公共子序列比值，对「插入了额外修饰词」鲁棒；
 *   - {@link tokenOverlapRatio}：字符 n-gram 的 Jaccard，对「词序颠倒」鲁棒
 *     （「游戏时光——蔚蓝档案同人only」vs「蔚蓝档案only——游戏时光」）。
 * 两者都归一到 0..1。
 */

/** 超过这个长度就不做 LCS：DP 是 O(n·m)，而展会标题正常不到 60 字。 */
const LCS_MAX_LENGTH = 200;

/**
 * 最长公共子序列长度 / 较长串长度。
 * 相等为 1，无公共字符为 0。用滚动数组把空间压到 O(min(n,m))。
 */
export function similarityRatio(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const a = [...left];
  const b = [...right];
  if (a.length > LCS_MAX_LENGTH || b.length > LCS_MAX_LENGTH) return 0;

  let previous = new Array<number>(b.length + 1).fill(0);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      current[col] =
        a[row - 1] === b[col - 1]
          ? previous[col - 1] + 1
          : Math.max(previous[col], current[col - 1]);
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }
  return previous[b.length] / Math.max(a.length, b.length);
}

/**
 * 字符 n-gram 集合（默认 2..4 字）。
 * 中文里 2 字已经是一个有意义的词，4 字覆盖成语/四字短语。
 * 串本身不足 n 时整串入集，避免短内核产生空集。
 */
export function textNgrams(value: string, min = 2, max = 4): string[] {
  const text = String(value ?? '').trim();
  if (!text) return [];
  const chars = [...text];
  const tokens: string[] = [];
  const push = (token: string) => {
    if (token && !tokens.includes(token)) tokens.push(token);
  };
  if (chars.length <= max) push(text);
  for (let size = min; size <= Math.min(max, chars.length); size += 1) {
    for (let index = 0; index + size <= chars.length; index += 1) {
      push(chars.slice(index, index + size).join(''));
    }
  }
  return tokens;
}

export interface TokenOverlap {
  /** Jaccard 比值：交集 / 并集。 */
  readonly ratio: number;
  /** 共有 token，按长度降序。审查台展示「共有关键词」。 */
  readonly shared: readonly string[];
}

/** 两串的字符 n-gram 重合度。 */
export function tokenOverlapRatio(left: string, right: string): TokenOverlap {
  const leftTokens = textNgrams(left);
  const rightTokens = textNgrams(right);
  if (!leftTokens.length || !rightTokens.length) return { ratio: 0, shared: [] };
  const shared = leftTokens.filter((token) => rightTokens.includes(token));
  const unionSize = new Set([...leftTokens, ...rightTokens]).size || 1;
  return {
    ratio: shared.length / unionSize,
    shared: [...shared].sort((a, b) => b.length - a.length),
  };
}

/** 一方是否完整包含另一方，且被包含的那方长度达到 `minLength`。 */
export function containsWithMinLength(
  left: string,
  right: string,
  minLength: number,
): boolean {
  if (!left || !right) return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= minLength && longer.includes(shorter);
}
