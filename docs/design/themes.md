# 主题与设计 token

> 参考物在 `docs/design/themes/*.reference.jsx`（用户提供，来自 ant.design 首页
> 「定制主题，随心所欲」展示区的 **Dashboard** 预览 + 主题选择器）。
> **它们是设计意图，不是可直接粘贴的代码。**

## 三套主题

| 主题 | 文件 | 特征 |
|---|---|---|
| 暗色 | `dark.reference.jsx` | `theme.darkAlgorithm`。近黑 `#050505` 底 / `#111111` 抬升面，蓝 accent `#1677FF`。只覆盖 Layout / Menu / Progress |
| 亮色 shadcn | `light-shadcn.reference.jsx` | Tailwind **zinc/neutral 色阶**（`#18181b` 前景、`#e4e4e7` 边框、`#fafafa` 布局底）。中性主色（不是蓝），圆角 10，阴影极轻 |
| 亮色 liquid | `light-liquid.reference.jsx` | 毛玻璃。`backdrop-filter: blur(12px)` + `color-mix(in srgb, …)` + inset 高光双层，全局圆角 12，动效更快（0.05/0.1/0.2s） |

## 关键约束：literal 只能出现在 token 层

CLAUDE.md 硬约束是「**禁止**字面量颜色 / 间距 / 圆角 / 字号，只能取设计 token」。
而这三份参考文件里全是 `#18181b`、`rgba(255,255,255,0.2)` 这样的字面量 —— 不矛盾：

**token 定义层是唯一允许写字面量的地方**，因为它就是真相源本身。
禁令针对的是**页面和业务组件**。所以这三份文件的正确落地方式是：

```
frontend/shared/tokens/
  palette.ts      原始色阶（zinc / blue / 语义色），无语义含义 ← 字面量只在这里
  semantic.ts     语义层：bg / bgElevated / fg / fgMuted / border / accent / danger …
  themes/
    shadcn.ts     语义 → 具体值（light + dark 两套）
    liquid.ts     语义 → 具体值 + 玻璃层参数（模糊半径、透明度、inset 高光）
  to-antd.ts      语义 → AntD ConfigProvider 的 { token, components } 对象
  to-tailwind.css 语义 → @theme CSS 变量（供 HeroUI 前台消费）
```

**同一份语义层同时喂两个 app** —— 这是 token 单一真相源的全部意义。
前台（HeroUI + Tailwind）和后台（AntD）视觉语言一致，改一处两边都变。

## 三点必须注意的实现细节

1. **`antd-style` 和 `clsx` 还没装。** 两份亮色主题都用了 `createStyles`，
   以及 AntD 6 的 `ConfigProvider` 组件级 `classNames`（`({ props }) => ({ root: … })` 形态）。
   这是 AntD 6 才有的 API，用它比写全局 CSS 覆盖健康得多 —— 不会打架、不需要 `!important`。

2. **liquid 需要一个背景才看得见。** `backdrop-filter` 作用在它背后的内容上，
   底下是纯色的话玻璃效果等于零。启用 liquid 时布局必须有渐变或图片背景。
   这决定了它**不能只是一个 token 切换**，还牵涉布局层。

3. **暗色那份比两份亮色薄得多**（只有 Layout / Menu / Progress，token 层几乎没动）。
   直接用会得到「AntD 默认暗色 + 一点点定制」，和精心调过的 shadcn 亮色不成对。
   需要补一套 shadcn 的暗色对应（zinc 色阶反转即可，`#18181b` ↔ `#fafafa` 那条轴）。

## 待定

- **三选一还是可切换？** 后台已有 `providers/theme-mode.tsx`。
  倾向：shadcn 亮/暗 作为主线可切，liquid 作为可选皮肤（因为它对背景有额外要求）。
- **前台用哪套？** 前台是 HeroUI，视觉调性可以更活泼。但配色应共享 zinc 语义轴，
  否则两个 app 看起来像两个产品。
- `color-mix()` 和 `backdrop-filter` 的浏览器下限 —— 需要确认目标用户群
  （移动端占比高的话 `backdrop-filter` 在低端安卓上有性能代价）。
