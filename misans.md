# 澎湃OS中文字体（MiSans）落地页前端设计规范

> 本设计规范集合了纯黑极简风格、色彩变量（基于最新版 Tailwind CSS v4 的 Oklch 体系）、排版层级结构以及入场动画配置。

## 1. 设计概述

- **视觉风格**：现代风格，极简暗黑美学（Dark Mode First）、高端产品展示风格（高对比度，大面积留白/负空间）
- **核心交互**：平滑入场动效、响应式悬浮反馈
- **目标受众**：追求极致排版的开发者、设计师及创作者

---

## 2. 颜色规范模型（OKLCH）

本项目使用 `oklch` 色彩空间定义全局颜色（Tailwind CSS v4 推荐），以实现高对比度、无缝的纯黑主题。

### 全局 CSS 变量（`:root` 配置）

```css
:root {
  /* 基础背景与前景 */
  --background: oklch(0.12 0 0);          /* 深黑色偏灰，主背景 */
  --foreground: oklch(0.985 0 0);         /* 亮白色，主文本 */
  
  /* 卡片与浮层 */
  --card: oklch(0.15 0 0);                /* 卡片背景 */
  --card-foreground: oklch(0.985 0 0);    /* 卡片文本 */
  --popover: oklch(0.15 0 0);
  --popover-foreground: oklch(0.985 0 0);
  
  /* 品牌主色（反转色） */
  --primary: oklch(0.985 0 0);            /* 品牌突出背景（纯白） */
  --primary-foreground: oklch(0.12 0 0);  /* 品牌突出文本（纯黑） */
  
  /* 辅助与次要色 */
  --secondary: oklch(0.25 0 0);           /* 次要按钮背景 */
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.20 0 0);               /* 弱化背景/斑马线 */
  --muted-foreground: oklch(0.7 0 0);     /* 弱化文本（灰色） */
  
  /* 边框与输入框 */
  --border: oklch(0.25 0 0);              /* 细微边框线 */
  --input: oklch(0.25 0 0);
  --ring: oklch(0.5 0 0);
  
  /* 组件圆角 */
  --radius: 0.625rem;                     /* 基础圆角基准 = 10px */
}
```

---

## 3. 字体与排版体系

### 字体族

首选中文字体为 MiSans，降级方案为系统默认无衬线字体：

```css
font-family: "MiSans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### 字重映射层级（10 个层级）

| 字重值 | 对应名称 |
|--------|---------|
| 100 | Thin |
| 200 | ExtraLight |
| 300 | Light |
| 400 | Normal / Regular |
| 500 | Medium |
| 600 | Demibold / Semibold |
| 700 | Bold |
| 900 | Heavy |

### 文本渐变特效（Hero 区主标题）

用于增强立体金属质感：

```css
.text-gradient {
  background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 4. 动效与交互

### 渐进式淡入上滑动效（Fade Slide Up）

所有核心模块采用顺滑入场动画，贝塞尔曲线实现"先快后慢"阻尼感：

```css
@keyframes fade-slide-up {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-slide-up {
  animation: fade-slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 级联延迟配置 */
.delay-100 { animation-delay: 100ms; }
.delay-200 { animation-delay: 200ms; }
.delay-300 { animation-delay: 300ms; }
.delay-400 { animation-delay: 400ms; }
.delay-500 { animation-delay: 500ms; }
```

### 悬浮反馈（Hover States）

- **主按钮（下载按钮）**：`hover:scale-105` 配合阴影，或 `hover:bg-neutral-200` 颜色过渡
- **列表卡片（字重展示区）**：增加半透明背景与高亮文本色，如 `hover:bg-white/[0.03]` `group-hover:text-white`

---

## 5. 组件与杂项

### 玻璃拟态导航栏

顶部导航采用 80% 透明度与模糊滤镜，确保滚动时文字可透过导航栏：

```css
/* Tailwind 样式示例 */
bg-background/80 backdrop-blur-md border-b border-white/5
```

### 自定义暗黑滚动条

防止默认白色滚动条破坏深色模式沉浸感：

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
```

---

## 6. 实现建议

本规范基于最新版 Tailwind CSS v4 的 Oklch 体系设计，适合现代暗黑风格的中文字体落地页开发。

### 核心要点
- ✅ 使用 CSS 变量确保全局一致性
- ✅ 动画延迟实现级联入场效果
- ✅ 玻璃拟态增强现代感
- ✅ 高对比度确保可读性
- ✅ 响应式设计适配各屏幕尺寸
