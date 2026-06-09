# 项目上下文 — 行途 (交互式旅游策划)

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI) + 自定义组件
- **Styling**: Tailwind CSS 4
- **LLM**: coze-coding-dev-sdk (doubao-seed-2-0-lite-260215)
- **AI 能力**: 意图理解、方案生成、流式对话

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── understand/ # 意图理解接口 (POST)
│   │   │   ├── plan/       # 方案生成接口 (POST)
│   │   │   └── chat/       # 对话细化接口 (POST, SSE流式)
│   │   ├── layout.tsx      # 根布局
│   │   ├── page.tsx        # 首页 (TravelPlanner 组件)
│   │   └── globals.css     # 全局样式 + CSS动画
│   ├── components/
│   │   ├── TravelPlanner.tsx  # 核心交互组件 (问答引导+方案展示+对话)
│   │   └── ui/                # shadcn/ui 组件库
│   ├── data/
│   │   └── tourism.ts      # 旅游知识库 (目的地/景点/选项数据)
│   ├── lib/
│   │   ├── types.ts        # 核心类型定义
│   │   ├── constraint-engine.ts  # 约束求解引擎
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── hooks/              # 自定义 Hooks
├── DESIGN.md               # 设计规范
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 核心业务逻辑

### 交互流程
1. **Hero页** → 点击"开始策划"
2. **问答引导** (6步: 场景→同伴→天数→预算→季节→出行方式)
   - 场景步骤支持图片选择 + 文字输入双通道
   - 文字输入通过 `/api/understand` 解析意图
3. **方案生成** → 调用 `/api/plan` 获取2-3个差异化方案
4. **方案展示** → 可展开查看逐日行程、亮点、注意事项
5. **条件调整** → 修改预算/天数/季节等，即时重新生成
6. **对话细化** → 通过 `/api/chat` (SSE流式) 自然语言追问调整

### 约束求解引擎 (`constraint-engine.ts`)
- 预算硬过滤: 排除超预算目的地
- 物理约束: 高反风险与老人/幼儿/孕妇冲突矩阵
- 季节加权: 非最佳季节降分，不推荐季节强降分
- 出行方式: 交通便利度影响分数
- 评分公式: 场景匹配(40%) + 季节(20%) + 预算(15%) + 交通(15%) + 体力(10%)

### 旅游知识库 (`tourism.ts`)
- 覆盖20+中国主要目的地，横跨西南/西北/华南/华东/华北/东北
- 每个目的地含: 海拔、高反风险、预算范围、最佳/不推荐季节、交通便利度、体力要求、亮点、注意事项

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/understand` | POST | 意图理解：解析文字输入为结构化偏好 |
| `/api/plan` | POST | 方案生成：约束求解 + LLM 生成差异化方案 |
| `/api/chat` | POST (SSE) | 对话细化：流式输出调整建议 |

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
