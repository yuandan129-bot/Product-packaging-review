# 包装背标合规性智能审核系统

AI 驱动的包装审核助手，帮助设计师快速检查包装背标的合规性。

## 功能特性

- 📸 上传包装背标图片进行 AI 解析
- ✅ 自动检查 9 大强制标注要素
- 🔍 营养成分表数值验证
- ⚠️ 广告法禁用词检测
- 📋 生成详细的合规体检报告

## 技术栈

- **框架**: Next.js 14+
- **部署**: Vercel
- **语言**: JavaScript/React
- **样式**: CSS Modules

## 快速开始

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

访问 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
packaging-review-app/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── page.jsx           # 主页面
│   ├── layout.jsx         # 布局
│   ├── globals.css        # 全局样式
│   └── page.module.css    # 页面样式
├── lib/                   # 工具函数和索引库
│   ├── standards-index.json      # 国家标准索引
│   ├── advertising-law-index.json # 广告法索引
│   ├── checklist.json            # 审核清单
│   └── utils.js                  # 工具函数
├── public/                # 静态资源
├── package.json
└── next.config.js
```

## 知识库

### 国家标准库

- GB 7718 - 预包装食品标签通则
- GB 28050 - 预包装食品营养标签通则
- GB 2760 - 食品添加剂使用标准

### 广告法库

- 禁用词清单（8大类）
- 允许表述参考
- 合规检查规则

### 审核清单

- 产品识别
- 强制标注内容（9大要素）
- 致敏原检查
- 营养标签检查
- 食品添加剂检查
- 广告文案检查
- 排版规范检查
- 品牌一致性检查

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 中连接 GitHub 仓库
3. 自动部署完成

## 环境变量

如需集成 Claude Vision API，添加以下环境变量：

```
ANTHROPIC_API_KEY=your_api_key
```

## 许可证

MIT
