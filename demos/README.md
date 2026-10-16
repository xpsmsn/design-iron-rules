# Demo 生成规范

25 式风格的设计 demo。每个 demo 是**单文件自包含 HTML**，截图后进 `assets/previews/`。

这些 demo 同时是 **skill 的实战验证**：每个页面都必须用该风格自己 `references/style-XX-*.md` 里定义的 token 落地，而不是套一个通用模板换个颜色。截图好看 = 该风格的规则可落地。

---

## 一、技术硬约束（违反会直接翻车）

| 项 | 要求 |
|---|---|
| 文件 | `demos/NN-slug.html`，**单个 HTML**，CSS 内联或 `<style>` 内嵌 |
| 外部资源 | **零**。禁止 CDN 字体、外部图片、外部 CSS/JS。headless 渲染时网络不稳，外部资源会加载失败留下空白 |
| 图片 | 只能用 CSS 渐变 / 纯色块 / 内联 SVG / `data:` URI。**不要用 emoji 当主视觉** |
| 字体 | 只能用系统字体栈，见下表 |
| 视口 | 1440 × 900，截图同尺寸 |
| 编码 | `<meta charset="utf-8">` 必须写在 `<head>` 第一行 |
| 自适应 | 页面高度**不要超过 900px**，超出会被截断。宁可信息少而精 |

### 可用字体栈（Windows / macOS 通用）

```css
--font-sans:  "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif;
--font-serif: "Songti SC", "SimSun", "Source Han Serif SC", "Noto Serif SC", Georgia, serif;
--font-kai:   "Kaiti SC", "KaiTi", "STKaiti", var(--font-serif);
--font-mono:  "Cascadia Code", Consolas, "SF Mono", "Courier New", monospace;
```

字体族越少越稳。要中文衬线效果用 `--font-serif`，要手写感用 `--font-kai`。

---

## 二、内容要求：必须像真实项目

这是 demo 好不好看的分水岭。**AI 味的 demo 等于没做。**

**必须做到：**

- 起一个**像真公司/真产品**的名字，不要用「示例」「演示」「Demo」「XX 公司」这种占位名
- 中文文案要**具体到像真的**：用真实的日期、金额、百分比、人名、地名、单位
- 数字要**自洽**：列表里的价格、百分比、总量之间不能互相矛盾
- 页面要有**真实的信息结构**：导航、面包屑、分区标题、元信息、状态标签

**绝对禁止：**

- `Lorem ipsum` / `示例文本` / `标题一` / `这里是描述` / `XXX` / `0000-00-00`
- 假到出戏的数据：`123456`、`9999+`、`100% 好评`、`50万人`
- 「了解更多」「立即购买」这种万能占位 CTA（要写具体的动词短语，如「预约试听」「查看排课表」）
- 通篇一个字号一个颜色（层级必须拉开）

---

## 三、风格保真要求

开工前**必须先读**对应的参考文档，token 从那里取：

| 文件 | 覆盖风格 |
|---|---|
| `references/style-01-order.md` | 1.1 瑞士极简 / 1.2 编辑杂志 / 1.3 暗黑优先 / 1.4 专业高密度 |
| `references/style-02-flat-geometric.md` | 2.1 经典扁平 / 2.2 Material You / 2.3 孟菲斯撞色 |
| `references/style-03-tactile-material.md` | 3.1 新拟态 / 3.2 黏土风 / 3.3 写实拟物 / 3.4 有机自然 |
| `references/style-04-optics-glass.md` | 4.1 玻璃拟态 / 4.2 液态玻璃 / 4.3 极光渐变 |
| `references/style-05-retrofuture.md` | 5.1 赛博朋克 / 5.2 终端 TUI / 5.3 Y2K 千禧 |
| `references/style-06-raw-brutal.md` | 6.1 粗野主义 / 6.2 反设计/故障 |
| `references/style-07-cultural.md` | 7.1 新中式 / 7.2 复古印刷 / 7.3 纸感手作 |
| `references/style-08-brand-led.md` | 8.1 大字排版 / 8.2 3D 插画吉祥物 / 8.3 品牌动效 |

同时读 `references/style-taxonomy.md` 里该风格所属**族**的定位，确认没跑偏。

### 判定标准

截图放在一起，**一眼能认出是哪个风格**。如果两个 demo 看起来像，就是没做到位，回去读文档。

---

## 四、L0 铁律不可违反

Demo 是这个 skill 的门面，不能自己打自己的脸。以下必须达标：

1. **正文对比度 ≥ 4.5:1**，大字号 ≥ 3:1，组件轮廓 ≥ 3:1
   - 改色后用 `node scripts/contrast.js "#前景" "#背景" 字号 字重` 实测，别凭肉眼
2. **主动作唯一且文案是动词短语**：「提交申请」不是「申请提交」
3. **破坏性操作不做成主色按钮**
4. **数值来自 token**，页面里不出现 token 表外的散值

> 装饰性分割线、背景纹理可以低对比，不要为了达标把整个设计改成灰扑扑的。

---

## 五、截图规范

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --hide-scrollbars `
        --user-data-dir="$env:TEMP\design-iron-rules-shoot" `
        --force-device-scale-factor=2 `
        --window-size=1440,900 `
        --screenshot="C:\绝对路径\assets\previews\NN-slug.png" `
        "file:///C:/绝对路径/demos/NN-slug.html"
```

- 视口 1440×900，**2 倍 DPI**（清晰度够，体积可控）
- **`--screenshot` 必须用绝对路径**，Edge 不解析相对路径
- **`--user-data-dir` 必须指定独立目录**：多个 Edge 实例并发时会争抢默认 profile，
  被占用时渲染会**静默失败**（无报错但不出图），很容易误判成页面有问题
- Edge 的 `ERROR: external_registry_loader` 报错是环境噪音，不影响出图
- 输出必须是真实 PNG，不能是 0 字节或空白图

以上坑都已处理，直接跑全量重出图：

```bash
node scripts/shoot.js
```

---

## 六、25 式主题对照表

主题不是随便定的——每个都对应 `data/style-attributes.csv` 里该风格的 `best_for` 适用场景。

### 族 1 · 秩序理性

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 01 | `swiss-minimal` | 瑞士极简 | 青野建筑事务所 官网首页 |
| 02 | `editorial-magazine` | 编辑杂志 | 《食光志》秋季专题：大山里的发酵 |
| 03 | `dark-first` | 暗黑优先 | 夜航 Studio 音乐人主页 |
| 04 | `pro-density` | 专业高密度 | 磐石 量化交易终端 |

### 族 2 · 扁平几何

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 05 | `classic-flat` | 经典扁平 | 简记 团队任务看板 |
| 06 | `material-you` | Material You | 知芽 中学生错题本 App |
| 07 | `memphis` | 孟菲斯撞色 | 跳跳岛 少儿体能馆报名页 |

### 族 3 · 触感拟物

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 08 | `neumorphism` | 新拟态 | Lumo 智能家居 控制面板 |
| 09 | `clay` | 黏土风 | 小象巴士 少儿英语启蒙 |
| 10 | `skeuomorphic` | 写实拟物 | Aurora 专业音频工作站 |
| 11 | `organic-natural` | 有机自然 | 青禾 有机农产品商城 |

### 族 4 · 光学透明

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 12 | `glassmorphism` | 玻璃拟态 | 潮汐 音乐 App 播放页 |
| 13 | `liquid-glass` | 液态玻璃 | 棱镜 X 智能眼镜 发布页 |
| 14 | `aurora-gradient` | 极光渐变 | Nova AI 模型发布页 |

### 族 5 · 未来复古

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 15 | `cyberpunk` | 赛博朋克 | 霓虹纪元 游戏赛季活动页 |
| 16 | `terminal-tui` | 终端 TUI | nimbus 分布式存储 CLI |
| 17 | `y2k` | Y2K 千禧 | Y2K LAB 潮牌商城 |

### 族 6 · 粗野原始

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 18 | `brutalism` | 粗野主义 | 混凝土 设计工作室作品集 |
| 19 | `anti-design` | 反设计/故障 | 噪音 独立音乐节海报墙 |

### 族 7 · 文化地域

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 20 | `new-chinese` | 新中式/东方极简 | 云隐茶事 品牌主页 |
| 21 | `retro-print` | 复古印刷 | 纸上市集 独立刊物 |
| 22 | `paper-craft` | 纸感手作 | 手作日记 手账社区 |

### 族 8 · 品牌驱动

| # | slug | 风格 | demo 主题 |
|---|---|---|---|
| 23 | `bold-type` | 大字排版 | 疾风 跑鞋品牌首页 |
| 24 | `mascot-3d` | 3D 插画吉祥物 | 豆豆助手 品牌介绍页 |
| 25 | `brand-motion` | 品牌动效 | Flux Web3 协议官网 |

---

## 七、文件清单

```
demos/
  README.md            # 本文件
  01-swiss-minimal.html
  ...
  25-brand-motion.html
assets/previews/
  01-swiss-minimal.png
  ...
  25-brand-motion.png
```
