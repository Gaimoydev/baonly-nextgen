/**
 * 标题 / 城市的归一化与「退化标题」检测。
 *
 * 判同的第一性问题是：同一场展会在三个平台上的标题写法完全不同。
 *   bilibili  「上海·蔚蓝档案同人ONLY·吾悦相约」
 *   cpp       「上海·蔚蓝档案Only·吾悦相约」
 *   dlcomic   「上海蔚蓝档案ONLY·吾悦相约」
 * 三者的**判别性内核**都是「吾悦相约」——把 IP 名、届数、品类词、城市名、
 * 标点全部剥掉之后剩下的东西。判同比的就是这个内核。
 *
 * 剥离必须做到「宁可多剥」，因为漏剥会让内核带上平台特有的噪声导致漏合并；
 * 而多剥的代价（内核变空）由 {@link isKernelDegenerate} 兜住 —— 见业务规则 2。
 */

/**
 * 已知城市名。仅用于两个用途：
 *   1. 记录没有结构化 city 字段时，从标题/场馆文本里兜底猜城市；
 *   2. 从标题/场馆里剥掉城市名，得到判别性内核。
 * 这不是「支持的城市白名单」——记录自带的 city/province 永远优先。
 */
export const KNOWN_CITY_NAMES: readonly string[] = [
  '北京', '上海', '天津', '重庆', '广州', '深圳', '武汉', '成都', '杭州', '南京',
  '苏州', '无锡', '长春', '嘉兴', '长沙', '西安', '郑州', '青岛', '济南', '厦门',
  '福州', '沈阳', '大连', '哈尔滨', '合肥', '南昌', '昆明', '贵阳', '南宁',
];

/** IP 名与其别称。剥掉之后不同平台的写法才能对齐。 */
const IP_ALIAS_PATTERNS: readonly RegExp[] = [
  /蔚蓝档案|碧蓝档案|蔚藍檔案/g,
  /blue\s*archive/g,
  /\bbaonly\b|\bbao\b/g,
];

/**
 * 届数 / 期号 / 年份标记。这些**不进内核**，而是由 `edition.ts` 单独抽成一维证据。
 * 理由：跨源写法差异最大的就是这里（「ONLY同人展02」vs「ONLY02」vs「第二届」），
 * 留在内核里只会制造假差异。
 */
const EDITION_MARKER_PATTERNS: readonly RegExp[] = [
  /第\s*[0-9零〇一二两三四五六七八九十]+\s*号邀请/g,
  /第\s*[0-9零〇一二两三四五六七八九十]+\s*(?:届|回|次|弹|期)/g,
  /vol\.?\s*\d+(?:\.\d+)?/g,
  /only\s*[-_·.、]?\s*\d+(?:\.\d+)?/g,
  /(?:19|20)\d{2}/g,
  /\bp\s*\d+\b/g,
  /\d+\.\d+/g,
];

/** 品类词。「同人only展」这种组合里没有任何判别信息。 */
const GENRE_WORD_PATTERN =
  /同人only|only展|同人展|同人祭|onlyevent|only|同人|漫展|展会|展览|活动|免费|专场/g;

/** 行政区划后缀，用于把「上海市」「广州 海珠」压成「上海」「广州」。 */
const REGION_SUFFIX_PATTERN = /(?:省|市|自治区|特别行政区|地区|新区|开发区|高新区)$/;

/** 内核里要剥掉的行政区划片段（区/县/镇 等）。 */
const REGION_FRAGMENT_PATTERN = /[一-龥]{1,6}(?:省|自治区|特别行政区|地区|市|区|县|镇|乡|街道|商圈)/g;

const PUNCTUATION_PATTERN =
  /[·・\s_\-—~～:：,，.。!！?？'"'"“”()（）【】\[\]{}<>《》&＆/\\|+*#@]+/g;

/** 全角字母数字 → 半角。cpp 的标题里常出现全角 ＯＮＬＹ。 */
function toHalfWidth(value: string): string {
  return value.replace(/[！-～]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 城市名归一：去掉行政后缀并小写。「上海市」→「上海」。 */
export function normalizeCity(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(REGION_SUFFIX_PATTERN, '')
    .trim();
}

/**
 * 解析一条记录所在的城市。
 * 优先用结构化字段；缺失时从「标题 + 场馆 + 地址」里找已知城市名兜底。
 * 返回空串表示无法确定城市 —— 该记录不会与任何记录合并（见门槛 G1）。
 */
export function resolveCity(record: {
  city?: string | null;
  province?: string | null;
  title?: string | null;
  venueName?: string | null;
  address?: string | null;
}): string {
  const direct = normalizeCity(record.city);
  if (direct) return direct;
  const text = `${record.title ?? ''} ${record.venueName ?? ''} ${record.address ?? ''}`;
  const hit = KNOWN_CITY_NAMES.find((city) => text.includes(city));
  if (hit) return hit;
  return normalizeCity(record.province);
}

/**
 * 标题归一：小写、半角、剥掉 IP 名 / 届数 / 品类词 / 标点。
 * **保留**城市名 —— 城市名的剥离在 {@link titleKernel} 里做，
 * 因为「是否带城市名」本身也是一维（弱）证据。
 */
export function normalizeTitle(value: string | null | undefined): string {
  let text = toHalfWidth(String(value ?? '')).toLowerCase();
  for (const pattern of IP_ALIAS_PATTERNS) text = text.replace(pattern, ' ');
  for (const pattern of EDITION_MARKER_PATTERNS) text = text.replace(pattern, ' ');
  return text.replace(GENRE_WORD_PATTERN, ' ').replace(PUNCTUATION_PATTERN, '').trim();
}

/**
 * 标题的判别性内核 = 归一化标题再剥掉城市名与行政区划片段。
 *
 * `cityHints` 传该记录自己的 city/province，这样非内置列表里的城市
 * （石家庄、乌鲁木齐……）也能被正确剥掉，而不必维护一张全国城市表。
 */
export function titleKernel(
  value: string | null | undefined,
  cityHints: readonly string[] = [],
): string {
  let kernel = normalizeTitle(value);
  const hints = [...cityHints, ...KNOWN_CITY_NAMES]
    .map((hint) => normalizeCity(hint))
    .filter((hint) => hint.length >= 2)
    .sort((left, right) => right.length - left.length);
  for (const hint of hints) kernel = kernel.split(hint).join('');
  return kernel.replace(REGION_FRAGMENT_PATTERN, '').trim();
}

/**
 * 业务规则 2 —— 退化标题守卫。
 *
 * 「上海·蔚蓝档案同人only·」剥完之后内核是空串，它会成为同城任何标题的子串，
 * 用它做相等/包含判定会把一个城市的所有场次糊成一团。内核短于 2 个字符时，
 * 相等与包含这两条**决定性**路径一律禁用，判同必须回退到场馆与时间证据。
 */
export const KERNEL_MIN_MEANINGFUL_LENGTH = 2;

export function isKernelDegenerate(kernel: string): boolean {
  return kernel.length < KERNEL_MIN_MEANINGFUL_LENGTH;
}

/** 标题里是否出现 only（不区分大小写、容忍全角）。 */
export function titleHasOnly(value: string | null | undefined): boolean {
  return /only/i.test(toHalfWidth(String(value ?? '')));
}

/** 标题里是否出现蔚蓝档案 IP 名。 */
export function titleHasBlueArchive(value: string | null | undefined): boolean {
  return /蔚蓝档案|碧蓝档案|蔚藍檔案|blue\s*archive|\bbao?\b/i.test(
    toHalfWidth(String(value ?? '')),
  );
}

/**
 * 「双方都是蔚蓝档案 only 展」——本项目最有力的一维语境证据。
 * 注意必须**双方都成立**：一边是 only 展一边是咖啡联动时，
 * 同城同日纯属撞车，绝不能合并（见负例：上海 2025 咖啡联动 vs 二周年 only）。
 */
export function sharesBaOnlyContext(left: string, right: string): boolean {
  return (
    titleHasOnly(left) &&
    titleHasOnly(right) &&
    titleHasBlueArchive(left) &&
    titleHasBlueArchive(right)
  );
}

/** 归一化标题里出现的已知城市名（用于「标题城市一致」这一维弱证据）。 */
export function cityMentionedInTitle(value: string | null | undefined): string {
  const text = toHalfWidth(String(value ?? ''));
  return KNOWN_CITY_NAMES.find((city) => text.includes(city)) ?? '';
}
