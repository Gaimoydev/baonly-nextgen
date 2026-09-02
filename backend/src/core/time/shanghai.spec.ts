import { describe, expect, it } from "vitest";

import {
  formatShanghai,
  parseShanghai,
  shanghaiDayKey,
  shanghaiDayRange,
  shanghaiTimeKey,
  shareAnyDay
} from "./shanghai";

describe("parseShanghai", () => {
  it("把无时区串按 Asia/Shanghai 解析（上一代在这里出过 +8h 的线上 bug）", () => {
    const d = parseShanghai("2026-08-02T10:00");
    // 上海 10:00 == UTC 02:00
    expect(d?.toISOString()).toBe("2026-08-02T02:00:00.000Z");
  });

  it("接受空格分隔的格式", () => {
    expect(parseShanghai("2026-08-02 10:00")?.toISOString()).toBe("2026-08-02T02:00:00.000Z");
  });

  it("已带时区的串不再套一次时区", () => {
    expect(parseShanghai("2026-08-02T10:00:00Z")?.toISOString()).toBe("2026-08-02T10:00:00.000Z");
    expect(parseShanghai("2026-08-02T10:00:00+08:00")?.toISOString()).toBe(
      "2026-08-02T02:00:00.000Z"
    );
  });

  it("空值和非法值返回 null 而不是 Invalid Date", () => {
    expect(parseShanghai(null)).toBeNull();
    expect(parseShanghai("")).toBeNull();
    expect(parseShanghai("   ")).toBeNull();
    expect(parseShanghai("不是日期")).toBeNull();
  });
});

describe("shanghaiDayKey", () => {
  it("含年份 —— 这是判同不可退让的要求", () => {
    expect(shanghaiDayKey(parseShanghai("2026-08-02T10:00"))).toBe("2026-08-02");
    expect(shanghaiDayKey(parseShanghai("2025-08-02T10:00"))).toBe("2025-08-02");
  });

  it("★ 回归：同月同日不同年必须产生不同的键", () => {
    // 上一代用不含年份的 MM-DD，导致「上海 2025 咖啡联动」与「2026 only」被误并
    const y2025 = shanghaiDayKey(parseShanghai("2025-08-02T10:00"));
    const y2026 = shanghaiDayKey(parseShanghai("2026-08-02T10:00"));
    expect(y2025).not.toBe(y2026);
  });

  it("按上海时区切日，不按 UTC", () => {
    // UTC 2026-08-01T20:00 == 上海 2026-08-02T04:00 → 应归为 08-02
    expect(shanghaiDayKey(new Date("2026-08-01T20:00:00Z"))).toBe("2026-08-02");
  });
});

describe("shanghaiDayRange", () => {
  it("单日活动返回一个键", () => {
    const s = parseShanghai("2026-08-02T10:00");
    expect(shanghaiDayRange(s, s)).toEqual(["2026-08-02"]);
  });

  it("多天活动返回含首尾的全部日期", () => {
    expect(
      shanghaiDayRange(parseShanghai("2026-08-02T10:00"), parseShanghai("2026-08-04T18:00"))
    ).toEqual(["2026-08-02", "2026-08-03", "2026-08-04"]);
  });

  it("endAt 缺失时退化为单日", () => {
    expect(shanghaiDayRange(parseShanghai("2026-08-02T10:00"), null)).toEqual(["2026-08-02"]);
  });

  it("脏数据（endAt 早于 startAt）不会返回空或爆量", () => {
    expect(
      shanghaiDayRange(parseShanghai("2026-08-04T10:00"), parseShanghai("2026-08-02T10:00"))
    ).toEqual(["2026-08-04"]);
  });

  it("跨度过大时有上限保护", () => {
    const keys = shanghaiDayRange(parseShanghai("2020-01-01T00:00"), parseShanghai("2030-01-01T00:00"));
    expect(keys.length).toBeLessThanOrEqual(401);
  });
});

describe("shareAnyDay", () => {
  it("有交集为 true", () => {
    expect(shareAnyDay(["2026-08-02", "2026-08-03"], ["2026-08-03"])).toBe(true);
  });

  it("★ 同月同日不同年不算交集", () => {
    expect(shareAnyDay(["2025-08-02"], ["2026-08-02"])).toBe(false);
  });

  it("空数组不算交集", () => {
    expect(shareAnyDay([], ["2026-08-02"])).toBe(false);
    expect(shareAnyDay(["2026-08-02"], [])).toBe(false);
  });
});

describe("格式化", () => {
  it("shanghaiTimeKey 输出上海本地时间", () => {
    expect(shanghaiTimeKey(parseShanghai("2026-08-02T10:30"))).toBe("10:30");
  });

  it("formatShanghai 默认格式", () => {
    expect(formatShanghai(parseShanghai("2026-08-02T10:30"))).toBe("2026-08-02 10:30");
  });

  it("非法输入返回空串而不是 'Invalid Date'", () => {
    expect(formatShanghai(null)).toBe("");
    expect(shanghaiTimeKey(null)).toBe("");
  });
});
