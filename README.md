# Node Flow

基于 Next.js 16 App Router 构建的节点可视化流编辑器和聊天工作流应用。
本项目专为 `front-main` 主应用设计，通过基于画布（ReactFlow）的节点交互结合智能体对话，提供现代化的工作流编排与执行体验。

## 🛠 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- **UI 库**: [Tailwind CSS 4](https://tailwindcss.com/), [Shadcn/UI](https://ui.shadcn.com/), Lucide React
- **状态管理**: [Zustand](https://zustand-demo.pmnd.rs/) + [Immer](https://immerjs.github.io/immer/)
- **画布交互**: [ReactFlow (@xyflow/react)](https://reactflow.dev/)
- **富文本编辑**: [Tiptap](https://tiptap.dev/) (包含 Mention @ 提及等插件)
- **国际化**: [next-intl](https://next-intl-docs.vercel.app/)
- **代码规范**: TypeScript, ESLint, [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)

## 📦 环境要求

- **Node.js**: >= 20.0.0
- **包管理器**: npm (推荐) 或 pnpm/yarn

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

启动后，在浏览器中访问 [http://localhost:3000](http://localhost:3000) 即可预览项目。

### 3. 构建生产版本

```bash
npm run build
```

### 4. 运行生产版本

```bash
npm run start
```

## 🧹 代码规范与检查

本项目强制使用 TypeScript，并配置了严格的校验工具：

- **执行代码检查 (Lint)**:

  ```bash
  npm run lint
  ```

  基于 `oxlint` 实现极速代码静态分析。

- **执行代码格式化 (Format)**:
  ```bash
  npm run format
  ```
  基于 `oxfmt` 进行代码格式化。

> **注意**：项目集成了 Husky 并在提交代码前 (pre-commit / lint-staged) 会自动进行代码规范检查和格式化。

## 📁 核心目录结构

```text
node-flow/
├── messages/             # i18n 多语言翻译文件 (zh/en)
├── src/
│   ├── app/              # Next.js App Router 页面和 API 路由
│   ├── components/       # React 组件
│   │   ├── chat/         # 智能体聊天与富文本输入组件
│   │   ├── flow/         # ReactFlow 画布及各类节点组件
│   │   ├── layout/       # 全局布局组件 (Header, 切换器等)
│   │   └── ui/           # Shadcn 基础 UI 组件
│   ├── i18n/             # 国际化配置
│   └── lib/
│       ├── store/        # Zustand 全局状态管理
│       ├── services/     # 业务与数据服务
│       └── utils/        # 工具函数
└── ...
```

## ⚠️ 开发规范提醒

1.  **代码规范**：所有文件需通过 `oxlint` 检查与 `oxfmt` 格式化，禁用 `any`，保持 TS 类型完整。
2.  **国际化支持**：新增文案必须加入 `messages/[lang]/` 对应的 JSON 文件中，并通过 `useTranslations` 引用，禁止在代码中硬编码中文或英文。
3.  **状态管理**：应用内全局状态通过 `zustand` + `immer` 管理，禁止跨应用直接共享状态。
4.  **UI 使用**：新组件优先从 Shadcn/UI 引入或使用 Tailwind 原生类，图标统一使用 `lucide-react`。
5.  **目录边界**：只读写 `node-flow/` 项目范围内的文件，严格遵守文件隔离规范。
