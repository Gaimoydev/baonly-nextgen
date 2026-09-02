import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * 业务时区。全站的"日期"概念都以此为准 —— 展会是线下活动，
 * "8 月 2 日的场次"指的是上海时间的 8 月 2 日，与服务器时区无关。
 */
export const BUSINESS_TZ = "Asia/Shanghai";

/**
 * 把**无时区**的时间串按 Asia/Shanghai 解析成 Date（内部即 UTC 瞬间）。
 *
 * ★ 上一代在这里出过真实 bug：后台表单用 `<input type="datetime-local">`，
 *   提交上来的是 `2026-08-02T10:00` 这种无时区串。旧代码直接 `new Date(str)`，
 *   在 UTC 部署的机器上会被当成 UTC 解析 → 整批时间偏移 +8 小时。
 *
 * 凡是来自后台表单、爬虫文本、CSV 导入的无时区串，**必须**走这个函数。
 */
export function parseShanghai(input: string | null | undefined): Date | null {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;

  // 已带时区信息（Z 或 ±HH:MM）的串是明确的瞬间，直接解析，不要再套时区
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = dayjs.tz(text.replace(" ", "T"), BUSINESS_TZ);
  return parsed.isValid() ? parsed.toDate() : null;
}

/**
 * 取 Asia/Shanghai 视角的日期键 `YYYY-MM-DD`。
 *
 * ★ **必须含年份**。上一代判同用的是不含年份的 `MM-DD`，
 *   导致"上海 2025 咖啡联动"和"2026 only"因同为 08-02 被误判成同一活动。
 *   这是已确认的线上 bug，新实现不得重演。
 */
export function shanghaiDayKey(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseShanghai(date) : date;
  if (!d || Number.isNaN(d.getTime())) return "";
  return dayjs(d).tz(BUSINESS_TZ).format("YYYY-MM-DD");
}

/** 取 Asia/Shanghai 视角的 `HH:mm` */
export function shanghaiTimeKey(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return dayjs(date).tz(BUSINESS_TZ).format("HH:mm");
}

/** 按格式串输出 Asia/Shanghai 本地时间 */
export function formatShanghai(date: Date | null | undefined, pattern = "YYYY-MM-DD HH:mm"): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return dayjs(date).tz(BUSINESS_TZ).format(pattern);
}

/**
 * 活动跨越的所有日期键（含首尾）。多天活动的判同和"当天有哪些场次"都用它。
 * 上限 400 天，防止脏数据（endAt 早于 startAt 或差出几十年）撑爆内存。
 */
export function shanghaiDayRange(startAt: Date | null, endAt: Date | null): string[] {
  if (!startAt) return [];
  const start = dayjs(startAt).tz(BUSINESS_TZ).startOf("day");
  const end = endAt ? dayjs(endAt).tz(BUSINESS_TZ).startOf("day") : start;
  if (!end.isValid() || end.isBefore(start)) return [start.format("YYYY-MM-DD")];

  const keys: string[] = [];
  let cursor = start;
  for (let i = 0; i <= 400 && !cursor.isAfter(end); i += 1) {
    keys.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return keys;
}

/** 判断两个活动是否有共同的日期（年份参与比较） */
export function shareAnyDay(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const set = new Set(a);
  return b.some((day) => set.has(day));
}
