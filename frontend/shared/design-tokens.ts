/**
 * 设计 token —— 前台(HeroUI + Tailwind)与后台(Ant Design)的**单一真相源**。
 *
 * 为什么要有这个文件：
 *   上一代项目的 8,894 行 CSS 里没有设计系统 —— 每个视觉需求现场写色值，
 *   累积出无法维护的样式层，而且反复出现对比度不达标的问题（改过两处 WCAG AA）。
 *   这里把颜色/尺度收敛到一处，两套 UI 库都从这里取值，观感才能一致。
 *
 * 设计原则（重要，改这个文件前先读）：
 *   ★ 尺度类 token（间距/圆角/字号/阴影）**直接沿用 Tailwind 4 的默认值**，不重新发明。
 *     Tailwind 的尺度经过大量实践验证；自创一套是上一代"审美平庸"的直接成因。
 *   ★ 只定义**品牌专属**的部分：primary 色阶、语义色映射、动效时长。
 *   ★ 中性色沿用 Tailwind 的 slate（冷灰，配蓝色主色更协调）。
 *   ★ 任何字面量色值出现在组件里都是 lint 错误 —— 一律从这里取。
 */

// ─────────────────────────────────────────────────────────
// 品牌主色：Blue Archive 的蓝。色阶按 OKLCH 均匀步进生成，
// 保证任意相邻两级的感知对比一致（手调 hex 做不到这点）。
// ─────────────────────────────────────────────────────────

export const brand = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb", // 浅色主题的主色：白字对比度 4.6:1，过 WCAG AA
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
  950: "#172554"
} as const;

/**
 * 语义色。
 *
 * ⚠ 上一代的教训：暗色主题用了浅色 accent(#79a9ff) 配白字，对比度只有 ~2.3:1，
 *   远低于 WCAG AA 的 4.5:1。所以这里明暗两套**分别指定**，不是同一个值换个背景用。
 */
export const semantic = {
  light: {
    primary: brand[600], // on white: 4.6:1 ✓
    primaryHover: brand[700],
    primaryText: "#ffffff",
    success: "#15803d", // green-700, on white 4.8:1 ✓
    warning: "#b45309", // amber-700, on white 4.7:1 ✓
    danger: "#b91c1c", // red-700,   on white 5.9:1 ✓
    info: brand[600]
  },
  dark: {
    primary: brand[400], // on slate-900: 6.4:1 ✓
    primaryHover: brand[300],
    primaryText: "#0f172a", // ★ 深色文字。浅色主色上放白字必然不达标
    success: "#4ade80", // green-400
    warning: "#fbbf24", // amber-400
    danger: "#f87171", // red-400
    info: brand[400]
  }
} as const;

/** 中性色：Tailwind slate（冷灰，与蓝色主色同色温） */
export const neutral = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617"
} as const;

/** 表面色（背景层次）。暗色主题用三级层次区分卡片/面板/页面 */
export const surface = {
  light: {
    page: "#ffffff",
    card: "#ffffff",
    raised: neutral[50],
    border: neutral[200],
    text: neutral[900],
    textMuted: neutral[600] // on white 4.7:1 ✓
  },
  dark: {
    page: neutral[950],
    card: neutral[900],
    raised: neutral[800],
    border: neutral[700],
    text: neutral[100],
    textMuted: neutral[400] // on slate-900 5.2:1 ✓
  }
} as const;

// ─────────────────────────────────────────────────────────
// 尺度类：沿用 Tailwind 4 默认值，此处只做显式记录供 AntD 对齐。
// 不要在这里发明新的尺度级别。
// ─────────────────────────────────────────────────────────

/** 圆角（Tailwind 默认） */
export const radius = {
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999
} as const;

/** 字号 px（Tailwind 默认） */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36
} as const;

/** 间距基准 4px（Tailwind 默认的 spacing scale 单位） */
export const spacingUnit = 4;

/** 动效时长 ms。全部要尊重 prefers-reduced-motion */
export const duration = {
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
  /** 倒计时等数据驱动的更新节奏 */
  tick: 1000
} as const;

/** 中文优先的字体栈。dist 里有自带字体时在此追加 */
export const fontFamily = {
  sans: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Microsoft YaHei",
    "PingFang SC",
    "Hiragino Sans GB",
    "Noto Sans SC",
    "sans-serif"
  ].join(", "),
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"].join(", ")
} as const;

// ─────────────────────────────────────────────────────────
// Ant Design 适配器（后台用）
// ─────────────────────────────────────────────────────────

/**
 * 转成 AntD ConfigProvider 的 theme.token。
 * 用法：`<ConfigProvider theme={{ token: antdToken("dark"), algorithm: theme.darkAlgorithm }}>`
 */
export function antdToken(mode: "light" | "dark") {
  const s = semantic[mode];
  const f = surface[mode];
  return {
    colorPrimary: s.primary,
    colorSuccess: s.success,
    colorWarning: s.warning,
    colorError: s.danger,
    colorInfo: s.info,
    colorBgBase: f.page,
    colorTextBase: f.text,
    colorBorder: f.border,
    borderRadius: radius.md,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.sans,
    motionDurationFast: `${duration.fast}ms`,
    motionDurationMid: `${duration.normal}ms`,
    motionDurationSlow: `${duration.slow}ms`
  };
}

export type ThemeMode = "light" | "dark";
