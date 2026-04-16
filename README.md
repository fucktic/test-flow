<div align="center">
  <img src="public/mantur-logo.svg" alt="Node Flow" width="72" />
  <h1>Node Flow</h1>
  <p>Visual AI-agent workflow editor — script → storyboard → image → video</p>

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

## Overview

**Node Flow** is an open-source, browser-based visual workflow editor that pairs a **ReactFlow canvas** with a **multi-agent streaming chat panel**. It is built for AI-driven content production pipelines and lets you orchestrate every step — from script writing to final video — through a drag-and-drop canvas while delegating real work to AI agent CLIs (Claude, OpenCode, Codex, etc.) via a pluggable **Skill** system.

### Key Features

| Feature          | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| Visual Canvas    | Node-based editor; episode → scene → image → video pipeline                  |
| Multi-Agent Chat | Floating widget that streams CLI output in real time                         |
| Skill System     | Drop a `SKILL.md` folder into `skills/`; agents auto-discover and execute it |
| Multi-Project    | Create and switch between isolated projects                                  |
| Auto-Save        | Canvas persists to `flow.json` and restores on reload                        |
| i18n             | EN / 简体中文 / 繁體中文 / 日本語 / Русский / Tiếng Việt                     |

---

## Requirements

| Runtime                 | Version                                                         |
| ----------------------- | --------------------------------------------------------------- |
| Node.js                 | ≥ 20.0.0                                                        |
| Docker + Docker Compose | any recent version (optional)                                   |
| AI agent CLI            | `claude`, `opencode`, `codex`, or `openclaw` installed globally |

---

## Installation & Running

Choose **one** of the three methods below.

---

### Method 1 — One-click Script (Node.js)

The fastest way to get started on any platform.

**macOS / Linux**

```bash
git clone https://github.com/your-org/node-flow.git
cd node-flow
./start.sh          # development mode  (hot reload, http://localhost:3000)
./start.sh prod     # production mode   (build → start, http://localhost:3000)
```

**Windows**

```bat
git clone https://github.com/your-org/node-flow.git
cd node-flow
start.bat           :: development mode
start.bat prod      :: production mode
```

The script automatically:

1. Checks for Node.js ≥ 20
2. Runs `npm install` if `node_modules` is missing
3. Creates `projects/` and `skills/` directories
4. Starts the server

---

### Method 2 — Docker (recommended for production)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose.

#### Quick start (one command)

```bash
git clone https://github.com/your-org/node-flow.git
cd node-flow
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

#### Common Docker commands

```bash
# Build image and start in the background
docker compose up -d --build

# View live logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build --force-recreate
```

#### What gets mounted as volumes

| Host path             | Container path           | Purpose                      |
| --------------------- | ------------------------ | ---------------------------- |
| `./projects/`         | `/app/projects`          | All project data (persisted) |
| `./skills/`           | `/app/skills`            | Skill packages (persisted)   |
| `./public/agent.json` | `/app/public/agent.json` | Agent configuration          |

> **Note:** The AI agent CLI (e.g. `claude`) must be available **inside** the container if you want agents to execute. You can either install it in the Dockerfile or run Node Flow on the host and call the host-installed CLI via a mounted socket. For most users, running Node Flow natively (Method 1) is simpler when using local CLIs.

---

### Method 3 — Manual Node.js

```bash
# 1. Clone
git clone https://github.com/your-org/node-flow.git
cd node-flow

# 2. Install
npm install

# 3a. Development server (hot reload)
npm run dev

# 3b. OR: Production build + start
npm run build
npm run start
```

---

## Post-Installation Setup

### 1. Configure an Agent

Open the app → click the floating chat button → **Manage Agents** → add an entry:

```json
{
  "name": "Claude",
  "endpoint": "claude",
  "description": "Claude AI coding assistant"
}
```

The `endpoint` is the CLI command invoked on the server. Built-in adapters:

| `endpoint` value  | Command executed                             |
| ----------------- | -------------------------------------------- |
| `claude`          | `claude -p <prompt> --verbose --effort high` |
| `opencode`        | `opencode run <prompt>`                      |
| `codex`           | `codex exec <prompt>`                        |
| `openclaw`        | `openclaw agent --message <prompt>`          |
| _(anything else)_ | `<endpoint> "<prompt>"`                      |

The config is saved to `public/agent.json`.

### 2. Import a Skill

Skill packages live in `skills/<skill-name>/SKILL.md`. You can:

- **Import via UI**: click **"Import Skill"** in the header and upload a skill folder
- **Copy manually**: place a folder containing `SKILL.md` into `skills/`

```
skills/
└── my-pipeline/
    ├── SKILL.md        ← required: what this skill does and how to invoke it
    └── prompt.txt      ← any supporting files
```

The agent reads every `SKILL.md` before responding and picks the best match automatically.

### 3. Create Your First Project

Click **"New Project"** → enter a name → the canvas opens. The agent will populate nodes as it executes skills. You can also add/edit nodes manually.

---

## Node Types

| Node                   | Role                                                       |
| ---------------------- | ---------------------------------------------------------- |
| **Episode Node**       | Manages episode list; check ≤ 3 to activate their pipeline |
| **Scene Node**         | Lists scenes per episode; select ≤ 3 for generation        |
| **Scene Image Node**   | Generate or upload storyboard images                       |
| **Scene Video Node**   | Generate or upload video clips                             |
| **Asset Node**         | Library of characters, scenes, props, audio                |
| **Video Preview Node** | Aggregates selected clips for review and export            |

---

## Project Data Layout

All data is stored locally. Nothing is sent to external servers.

```
projects/
└── <uuid>/
    ├── project.json        ← name, timestamps
    ├── flow.json           ← canvas state (auto-saved)
    ├── assets/
    │   ├── characters/
    │   ├── scenes/
    │   ├── props/
    │   └── audio/
    ├── episode/
    │   ├── image/
    │   └── video/
    └── temp/               ← chat upload attachments
```

> `projects/` and `skills/` are in `.gitignore`. Back them up separately.

---

## Development

```bash
npm run lint          # static analysis (Oxlint)
npm run format        # auto-format (Oxfmt)
npx tsc --noEmit      # type check
npm run build         # production build
```

Pre-commit hooks (Husky + lint-staged) run lint and format automatically on every commit.

---

## Directory Structure

```
node-flow/
├── Dockerfile
├── docker-compose.yml
├── start.sh / start.bat        ← one-click scripts
├── messages/                   ← i18n (en / zh / zh-TW / ja / ru / vi)
├── projects/                   ← runtime data (git-ignored)
├── public/agent.json           ← agent config
├── skills/                     ← skill packages (git-ignored)
└── src/
    ├── app/
    │   ├── [locale]/           ← pages
    │   └── api/
    │       ├── agents/execute  ← POST streaming agent execution
    │       ├── agents/manage   ← GET/POST agent list
    │       └── projects/[id]/  ← flow, upload, temp, assets, episode
    ├── components/
    │   ├── chat/               ← chat widget & input
    │   ├── flow/nodes/         ← all node components
    │   ├── layout/             ← header, switchers
    │   └── ui/                 ← Shadcn base components
    └── lib/
        ├── actions/            ← Server Actions
        ├── agents/             ← command executor
        ├── hooks/              ← custom hooks
        ├── services/           ← project / agent / upload
        ├── store/              ← Zustand (flow, chat, projects)
        ├── types/              ← TypeScript definitions
        └── utils/              ← helpers
```

---

## API Reference

| Method | Path                                   | Description               |
| ------ | -------------------------------------- | ------------------------- |
| `GET`  | `/api/projects/current`                | Get active project ID     |
| `POST` | `/api/projects/current`                | Set active project ID     |
| `GET`  | `/api/projects/[id]/flow`              | Load canvas data          |
| `POST` | `/api/projects/[id]/flow`              | Save canvas data          |
| `POST` | `/api/projects/[id]/upload`            | Upload media file         |
| `POST` | `/api/projects/[id]/temp`              | Upload chat attachments   |
| `GET`  | `/api/projects/[id]/assets/[...path]`  | Serve asset files         |
| `GET`  | `/api/projects/[id]/episode/[...path]` | Serve episode media       |
| `GET`  | `/api/agents/manage`                   | List agents               |
| `POST` | `/api/agents/manage`                   | Save agents               |
| `POST` | `/api/agents/execute`                  | Execute agent (streaming) |

---

## Contributing

1. Fork the repo and create a feature branch (`git checkout -b feat/my-feature`)
2. Follow conventions: TypeScript strict, no `any`, i18n for all visible text
3. Run `npm run lint && npm run format` before committing
4. Open a Pull Request with a clear description of the change

---

## License

[MIT](LICENSE) © Node Flow Contributors
