# 现成设计系统对接

项目里已经用了组件库或设计系统时，**铁律 6（一致性）要求你服从它，而不是另起一套。** 本节说明怎么服从。

## 优先级

```
项目现有设计系统  >  本 skill 的 L1 定律数值  >  通用默认
        ↓
   L0 铁律仍然不可豁免
```

换句话说：**风格与间距圆角可以跟随项目现有体系，对比度、热区、状态完备、破坏性保护、键盘可达这几条不能跟随。** 很多设计系统的默认按钮在小字号下并不达标。

## 常见体系速查

| 体系 | 出品方 | 基调 | 适配场景 | 圆角 | 密度 | 备注 |
|---|---|---|---|---|---|---|
| Material 3 | Google | 动态取色、圆润容器 | 安卓、消费级、教育 | 大（16–28px） | 中 | 与本 skill 族 2.2 一致 |
| Fluent 2 | Microsoft | 中性、克制、办公 | 企业后台、Office 生态 | 小（2–6px） | 中高 | 与族 1.4 接近 |
| Shopify Polaris | Shopify | 商业、转化导向 | 电商后台、结账流 | 中（8–12px） | 中 | 结账类流程的表单规范很值得抄 |
| Adobe Spectrum | Adobe | 中性、高信息密度 | 专业创作工具 | 小（4px） | 高 | 与族 1.4 接近 |
| Apple HIG | Apple | 克制、留白、语义分层 | iOS / iPadOS | 中（10–16px） | 低 | 热区标准 44×44pt |
| Ant Design | 蚂蚁集团 | 中性、企业级 | 国内中后台、表格密集 | 中（6px） | 高 | 表格与表单规范成熟 |
| Element Plus / Naive | Vue 生态 | 中性 | 中后台 | 小（4px） | 中高 | |
| shadcn/ui + Tailwind | shadcn | 极简、可组合 | 现代 SaaS、创业产品 | 小（6px） | 中 | token 直接落在 CSS 变量，易改造 |
| Arco Design | 字节 | 中性 | 国内中后台 | 中（6px） | 中高 | |
| Semi Design | 抖音 | 中性、留白更多 | 内容与中后台 | 中（6px） | 中 | |

## 对接步骤

1. **先探测项目已有体系**——看 `package.json` 依赖、组件库配置、CSS 变量命名（`--color-primary` / `--primary` / theme 文件）
2. **读它的 token 层**，把数值映射到本 skill 的 token 名：

   ```
   --color-primary-500  → --brand-500
   --color-primary-foreground → --brand-solid 的反色
   --radius-md          → --radius-md
   --space-4            → --space-4
   --text-base          → --text-base
   ```

3. **跑一次基线审计**：用 `scripts/contrast.js` 检查它的默认按钮、次要文字、禁用态、输入框边框是否达标
4. **不达标的项用局部补丁修正**，不要整体替换体系：

   ```css
   /* 例：某体系的主按钮白字只有 3.2:1，加深填充色即可，不要换掉整个组件库 */
   .btn-primary { background: var(--brand-700); }
   ```

5. **风格宪法层仍然适用**：在该体系的约束下追加 L2 风格要求（如「本项目走族 1.1 极简」），风格决定排版与留白节奏，不动组件实现

## 什么时候不要用现成体系

以下情况从零定义 token 更合适：

- 视觉风格强到会与组件库视觉冲突（族 4 光学透明、族 6 粗野原始）
- 目标平台非 Web（小程序原生、原生 App、桌面端）且没有对应体系
- 需要极强的品牌识别度（族 8）
- 体量很小且无后续维护（一次性页面，过度设计 token 是浪费）

## 自建 token 时的最小集

无论用哪个体系，下列六类 token 必须存在且成对声明（详见 `tokens-color.md` 的 on-* 结构）：

```
颜色   primary/on_primary, background/foreground, card/card_fg, muted/muted_fg,
       destructive/on_destructive, border, border_strong, ring
间距   4 8 12 16 20 24 32 40 48 64 80 96
字号   12 13 15 16 18 20 24 30 36 48 64 96
圆角   0 4 8 12 16 24 full
阴影   0 / 1 / 2 / 3 / 4 五级，色值带品牌色相偏移
动效   instant 80 / fast 120 / base 200 / slow 300 / page 400
       + 三条缓动曲线
```

缺任何一类就是 token 不完整，走查表 D 项扣分。
