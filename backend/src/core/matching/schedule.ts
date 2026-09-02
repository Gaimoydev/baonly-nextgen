/**
 * 日期提取与重合判定 —— 业务规则 1 与规则 5。
 *
 * 规则 1（含年份）：上一代用不含年份的 `MM-DD` 做日期键，导致
 * 「上海 2025 咖啡联动」与「上海 2026 only」因为同月同日被误并。
 * 本模块的日期键**一律是 `YYYY-MM-DD`**，年份是判同的必要组成部分。
 *
 * 规则 5（多天活动）：一个活动可能横跨多天，任一天重合即构成时间证据。
 *
 * 时区固定 Asia/Shanghai：数据源给的是 UTC 瞬时，但「哪一天办展」是本地日历概念。
 * 跨 UTC 日界的场次（cpp 常给 `T16:00:00Z` = 次日 0 点）只有按上海时区
 * 折算才能和 bilibili 的 `T02:00:00Z` 落到同一天。
 */

const TIME_ZONE = 'Asia/Shanghai';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
/** Asia/Shanghai 相对 UTC 的固定偏移。中国大陆自 1991 年起不再有夏令时。 */
const SHANGHAI_UTC_OFFSET_MS = 8 * MS_PER_HOUR;

/**
 * 一条记录最多枚举几天。
 *
 * 依据：同人展会实际只办 1-2 天，跨 3 天已属罕见。而咖啡联动 / 快闪店
 * 这类长周期企划会写成 60 天区间（实测：`2023-11-30 ~ 2024-01-31`）。
 * 若把长区间整段展开，它会和同城两个月内的**每一场**展会都产生日期重合，
 * 使日期门槛彻底失效。截断到 7 天既覆盖了所有真实的多日展，
 * 又把长周期企划限制成「只在开头几天参与撞期」。
 */
export const MAX_MATCH_DAYS = 7;

/** 起止时间落在 {@link MAX_MATCH_DAYS} 之外时，认定为长周期企划而非多日展。 */
export function isLongSpan(record: {
  startAt: string | Date | null;
  endAt?: string | Date | null;
}): boolean {
  const start = dayKey(record.startAt);
  const end = dayKey(record.endAt ?? record.startAt);
  if (!start || !end) return false;
  return (dayKeyToUtcMs(end) - dayKeyToUtcMs(start)) / MS_PER_DAY >= MAX_MATCH_DAYS;
}

/** 把瞬时时间折算成上海时区的 `YYYY-MM-DD`。无效输入返回空串。 */
export function dayKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // sv-SE 的 formatToParts 天然就是 ISO 顺序，避免手工拼装。
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** `YYYY-MM-DD`（上海）→ 该日 0 点的 UTC 毫秒。用于按天步进。 */
function dayKeyToUtcMs(key: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return Number.NaN;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  return Date.UTC(year, month - 1, day) - SHANGHAI_UTC_OFFSET_MS;
}

/**
 * 一条记录覆盖的日期键集合（升序、去重、上限 {@link MAX_MATCH_DAYS}）。
 * 没有 startAt 的记录返回空数组，它将无法通过日期门槛。
 */
export function recordDayKeys(record: {
  startAt: string | Date | null;
  endAt?: string | Date | null;
}): string[] {
  const start = dayKey(record.startAt);
  if (!start) return [];
  const end = dayKey(record.endAt ?? record.startAt) || start;

  let cursor = dayKeyToUtcMs(start);
  const endMs = dayKeyToUtcMs(end);
  if (!Number.isFinite(cursor) || !Number.isFinite(endMs) || endMs < cursor) return [start];

  const keys: string[] = [];
  for (let index = 0; index < MAX_MATCH_DAYS && cursor <= endMs; index += 1) {
    const key = dayKey(new Date(cursor));
    if (key && !keys.includes(key)) keys.push(key);
    cursor += MS_PER_DAY;
  }
  return keys;
}

/** 规则 5：任一日期重合即算。返回全部重合日期，空数组表示不重合。 */
export function sharedDayKeys(
  left: { startAt: string | Date | null; endAt?: string | Date | null },
  right: { startAt: string | Date | null; endAt?: string | Date | null },
): string[] {
  const leftKeys = recordDayKeys(left);
  if (!leftKeys.length) return [];
  const rightKeys = recordDayKeys(right);
  return rightKeys.filter((key) => leftKeys.includes(key));
}

/**
 * 只给了日期没给具体时刻的记录（上海时区 0 点整且没有独立结束时刻）。
 * cpp 大量记录如此，此时开场时刻不构成有效证据，不能因为「差 10 小时」扣分。
 */
export function isDateOnly(record: {
  startAt: string | Date | null;
  endAt?: string | Date | null;
}): boolean {
  if (!record.startAt) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(record.startAt));
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return hour === '00' && minute === '00';
}

/** 两条记录开场时刻的间隔小时数。任一方缺时间或为纯日期时返回 null。 */
export function startTimeGapHours(
  left: { startAt: string | Date | null; endAt?: string | Date | null },
  right: { startAt: string | Date | null; endAt?: string | Date | null },
): number | null {
  if (!left.startAt || !right.startAt) return null;
  if (isDateOnly(left) || isDateOnly(right)) return null;
  const leftMs = new Date(left.startAt).getTime();
  const rightMs = new Date(right.startAt).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return null;
  return Math.abs(leftMs - rightMs) / MS_PER_HOUR;
}
