<div align="center">
  <img src="public/mantur-logo.svg" alt="Node Flow" width="72" />
  <h1>Node Flow</h1>
  <p>可视化 AI 智能体工作流编辑器 — 剧本 → 分镜 → 图片 → 视频</p>

  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh.md">中文</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" />
    <img src="https://img.shields.io/badge/license-MIT-22c55e" />
  </p>
</div>

---

## 简介

**Node Flow** 是一款开源的、运行在浏览器中的可视化工作流编辑器，将 **ReactFlow 画布**与**多智能体流式聊天面板**融为一体。专为 AI 内容生产流水线设计，让您可以在画布上可视化编排从剧本到视频的完整流程，同时通过可插拔的 **Skill（技能）** 系统将实际执行任务委托给 AI 智能体 CLI（Claude、OpenCode、Codex 等）。

### 核心功能

| 功能         | 说明                                                          |
| ------------ | ------------------------------------------------------------- |
| 可视化画布   | 节点式编辑器；剧集 → 场景 → 图片 → 视频完整流水线             |
| 多智能体聊天 | 悬浮聊天窗口，实时流式展示 CLI 输出                           |
| Skill 系统   | 将含 `SKILL.md` 的文件夹放入 `skills/`，智能体自动发现并执行  |
| 多项目管理   | 创建和切换多个独立项目                                        |
| 自动保存     | 画布状态持久化到 `flow.json`，刷新后自动恢复                  |
| 国际化       | 支持 EN / 简体中文 / 繁體中文 / 日本語 / Русский / Tiếng Việt |

---

## 环境要求

| 运行环境                | 版本要求                                             |
| ----------------------- | ---------------------------------------------------- |
| Node.js                 | ≥ 20.0.0                                             |
| Docker + Docker Compose | 任意较新版本（可选）                                 |
| AI 智能体 CLI           | 全局安装 `claude`、`opencode`、`codex` 或 `openclaw` |

---

## 安装与启动

选择以下**三种方式之一**。

---

### 方式一 — 一键启动脚本（Node.js）

最快捷的本地启动方式，适用于所有平台。

**macOS / Linux**

```bash
git clone https://github.com/your-org/node-flow.git
cd node-flow
./start.sh          # 开发模式（热重载，http://localhost:3000）
./start.sh prod     # 生产模式（构建 → 启动，http://localhost:3000）
```

**Windows**

```bat
git clone https://github.com/your-org/node-flow.git
cd node-flow
start.bat           :: 开发模式
start.bat prod      :: 生产模式
```

脚本会自动执行以下步骤：

1. 检查 Node.js 版本是否 ≥ 20
2. 如果 `node_modules` 不存在则自动运行 `npm install`
3. 创建 `projects/` 和 `skills/` 目录
4. 启动服务器

---

### 方式二 — Docker（推荐用于生产）

需要安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 或 Docker Engine + Compose。

#### 一键启动

```bash
git clone https://github.com/your-org/node-flow.git
cd node-flow
docker compose up -d
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

#### 常用 Docker 命令

```bash
# 构建镜像并在后台启动
docker compose up -d --build

# 查看实时日志
docker compose logs -f

# 停止服务
docker compose down

# 代码修改后重新构建
docker compose up -d --build --force-recreate
```

#### 挂载的数据目录（Volume）

| 宿主机路径            | 容器路径                 | 用途               |
| --------------------- | ------------------------ | ------------------ |
| `./projects/`         | `/app/projects`          | 项目数据（持久化） |
| `./skills/`           | `/app/skills`            | 技能包（持久化）   |
| `./public/agent.json` | `/app/public/agent.json` | 智能体配置         |

> **注意：** 若要在 Docker 容器内执行 AI 智能体命令（如 `claude`），需要在 Dockerfile 中安装对应 CLI。大多数情况下，直接在宿主机以方式一运行更简单，可直接调用本地安装的 CLI。

---

### 方式三 — 手动 Node.js

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/node-flow.git
cd node-flow

# 2. 安装依赖
npm install

# 3a. 开发服务器（热重载）
npm run dev

# 3b. 或：生产构建后启动
npm run build
npm run start
```

---

## 安装后配置

### 第一步：配置智能体

打开应用 → 点击悬浮聊天按钮 → **管理智能体** → 添加条目：

```json
{
  "name": "Claude",
  "endpoint": "claude",
  "description": "Claude AI 编程助手"
}
```

`endpoint` 字段是服务端实际调用的 CLI 命令，内置适配器：

| `endpoint` 值 | 实际执行命令                                 |
| ------------- | -------------------------------------------- |
| `claude`      | `claude -p <prompt> --verbose --effort high` |
| `opencode`    | `opencode run <prompt>`                      |
| `codex`       | `codex exec <prompt>`                        |
| `openclaw`    | `openclaw agent --message <prompt>`          |
| _其他任意值_  | `<endpoint> "<prompt>"`                      |

配置保存在 `public/agent.json`。

### 第二步：导入技能（Skill）

技能包存放在 `skills/<技能名>/SKILL.md`，有两种方式导入：

- **通过界面导入**：点击页头的 **"导入技能"** 按钮，上传技能文件夹
- **手动复制**：将包含 `SKILL.md` 的文件夹直接放入 `skills/` 目录

```
skills/
└── my-pipeline/
    ├── SKILL.md        ← 必须：描述该技能的用途与执行规范
    └── prompt.txt      ← 任意支持文件
```

智能体回复前会自动读取所有 `SKILL.md`，自动选择最匹配的技能执行。

### 第三步：创建第一个项目

点击 **"新建项目"** → 输入名称 → 画布自动打开。智能体执行技能后会向画布添加节点，您也可以手动拖拽编辑。

---

## 节点类型说明

| 节点                                   | 作用                                  |
| -------------------------------------- | ------------------------------------- |
| **剧集节点（Episode Node）**           | 管理剧集列表，最多勾选 3 集激活流水线 |
| **场景节点（Scene Node）**             | 列出每集场景，最多选 3 个参与生成     |
| **场景图片节点（Scene Image Node）**   | 为场景生成或上传分镜图片              |
| **场景视频节点（Scene Video Node）**   | 为场景生成或上传视频片段              |
| **资产节点（Asset Node）**             | 角色、场景、道具、音频的资产库        |
| **视频预览节点（Video Preview Node）** | 汇总已选视频片段，支持预览与导出      |

---

## 项目数据结构

所有数据本地存储，不上传到任何外部服务器。

```
projects/
└── <uuid>/
    ├── project.json        ← 项目名称、时间戳
    ├── flow.json           ← 画布节点与连线（自动保存）
    ├── assets/
    │   ├── characters/     ← 角色
    │   ├── scenes/         ← 场景
    │   ├── props/          ← 道具
    │   └── audio/          ← 音频
    ├── episode/
    │   ├── image/          ← 剧集图片
    │   └── video/          ← 剧集视频
    └── temp/               ← 聊天上传的临时文件
```

> `projects/` 和 `skills/` 已加入 `.gitignore`，如需备份请单独处理。

---

## 开发命令

```bash
npm run lint          # 静态检查（Oxlint）
npm run format        # 代码格式化（Oxfmt）
npx tsc --noEmit      # TypeScript 类型检查
npm run build         # 生产构建
```

Husky + lint-staged 已配置 pre-commit hook，提交前自动执行检查与格式化。

---

## 目录结构

```
node-flow/
├── Dockerfile
├── docker-compose.yml
├── start.sh / start.bat        ← 一键启动脚本
├── messages/                   ← i18n 翻译（en/zh/zh-TW/ja/ru/vi）
├── projects/                   ← 运行时项目数据（已加入 .gitignore）
├── public/agent.json           ← 智能体配置
├── skills/                     ← 技能包（已加入 .gitignore）
└── src/
    ├── app/
    │   ├── [locale]/           ← 页面路由
    │   └── api/
    │       ├── agents/execute  ← POST 流式执行智能体命令
    │       ├── agents/manage   ← GET/POST 智能体列表
    │       └── projects/[id]/  ← flow / upload / temp / assets / episode
    ├── components/
    │   ├── chat/               ← 聊天窗口与输入组件
    │   ├── flow/nodes/         ← 所有节点组件
    │   ├── layout/             ← 页头、切换器
    │   └── ui/                 ← Shadcn 基础组件
    └── lib/
        ├── actions/            ← Server Actions
        ├── agents/             ← 命令执行器
        ├── hooks/              ← 自定义 Hooks
        ├── services/           ← 项目 / 智能体 / 上传服务
        ├── store/              ← Zustand 状态（flow / chat / projects）
        ├── types/              ← TypeScript 类型定义
        └── utils/              ← 工具函数
```

---

## API 接口

| 方法   | 路径                                   | 说明                 |
| ------ | -------------------------------------- | -------------------- |
| `GET`  | `/api/projects/current`                | 获取当前活动项目 ID  |
| `POST` | `/api/projects/current`                | 设置当前活动项目 ID  |
| `GET`  | `/api/projects/[id]/flow`              | 加载画布数据         |
| `POST` | `/api/projects/[id]/flow`              | 保存画布数据         |
| `POST` | `/api/projects/[id]/upload`            | 上传媒体文件         |
| `POST` | `/api/projects/[id]/temp`              | 上传聊天附件         |
| `GET`  | `/api/projects/[id]/assets/[...path]`  | 提供资产文件访问     |
| `GET`  | `/api/projects/[id]/episode/[...path]` | 提供剧集媒体文件访问 |
| `GET`  | `/api/agents/manage`                   | 获取智能体配置列表   |
| `POST` | `/api/agents/manage`                   | 保存智能体配置列表   |
| `POST` | `/api/agents/execute`                  | 流式执行智能体命令   |

---

## 参与贡献

1. Fork 仓库并创建功能分支（`git checkout -b feat/my-feature`）
2. 遵守编码规范：TypeScript 严格模式、禁止裸 `any`、文案全走 i18n
3. 提交前运行 `npm run lint && npm run format`
4. 提交 Pull Request，附上清晰的改动说明

---

## 开源协议

[MIT](LICENSE) © Node Flow Contributors
