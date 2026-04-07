# Node-Flow 项目技术架构图

本文档提供了 `node-flow` 项目的技术架构概览，适用于项目汇报与开发参考。

## 1. 系统总体架构

系统基于 Next.js 14 (App Router) 构建，采用前后端分离同构模式。前端通过 ReactFlow 提供可视化节点编辑能力，后端依赖 Next.js API Routes 提供数据持久化与 Agent 代理执行服务。数据最终持久化在本地文件系统中。

```mermaid
graph TD
    %% 样式定义
    classDef frontend fill:#E3F2FD,stroke:#1565C0,stroke-width:2px;
    classDef backend fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px;
    classDef storage fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px;
    classDef external fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px;

    %% 客户端层
    subgraph Client [客户端 - Client Side]
        UI[UI 组件库 ShadCN/Tailwind]
        Canvas[ReactFlow 画布面板]
        Chat[Chat 智能助手面板]
        ProjectMgr[项目管理]
        StoreFlow[use-flow Store]
        StoreChat[use-chat Store]
        StoreProject[use-projects Store]
    end

    Canvas --- StoreFlow
    Chat --- StoreChat
    ProjectMgr --- StoreProject

    %% 服务端层
    subgraph Server [服务端 - Server Side]
        API_Project[Project API]
        API_Agent[Agent API]
        Srv_Flow[Flow Service]
        Srv_Project[Project Service]
        Srv_Agent[Agent Executor]
        Srv_Upload[Upload Service]
    end

    API_Project --> Srv_Flow
    API_Project --> Srv_Project
    API_Project --> Srv_Upload
    API_Agent --> Srv_Agent

    %% 数据持久化层
    subgraph Storage [本地文件存储 - File System]
        Dir_Projects[projects/ 目录]
        File_FlowJson[flow.json]
        File_Assets[assets/]
    end

    Dir_Projects --> File_FlowJson
    Dir_Projects --> File_Assets

    %% 外部依赖/模型
    subgraph External [外部模型 - External Services]
        LLM[LLM / Agent Models]
    end

    %% 数据流转关系
    StoreFlow -.->|同步状态| API_Project
    StoreChat -.->|对话交互| API_Agent
    StoreProject -.->|获取列表| API_Project

    Srv_Flow -.->|读写JSON| File_FlowJson
    Srv_Project -.->|读写目录| Dir_Projects
    Srv_Agent -.->|调度调用| LLM
    Srv_Upload -.->|保存文件| File_Assets

    %% 应用样式
    class UI,Canvas,Chat,ProjectMgr,StoreFlow,StoreChat,StoreProject frontend;
    class API_Project,API_Agent,Srv_Flow,Srv_Project,Srv_Agent,Srv_Upload backend;
    class Dir_Projects,File_FlowJson,File_Assets storage;
    class LLM external;
```

## 2. 核心技术栈

| 分类          | 技术栈                                                                         | 说明                                                   |
| :------------ | :----------------------------------------------------------------------------- | :----------------------------------------------------- |
| **框架**      | [Next.js 14](https://nextjs.org/)                                              | 使用 App Router，服务端渲染与 API 路由聚合             |
| **画布**      | [ReactFlow](https://reactflow.dev/)                                            | 实现复杂节点拖拽、连线及交互面板，状态集中管理         |
| **状态管理**  | [Zustand](https://zustand-demo.pmnd.rs/)                                       | 轻量级状态管理，拆分为 flow, chat, projects 多个 store |
| **UI 组件库** | [ShadCN UI](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) | 灵活的原子化 CSS 与可定制化无头组件库                  |
| **国际化**    | [next-intl](https://next-intl-docs.vercel.app/)                                | 多语言支持，文本数据与组件代码分离                     |
| **本地存储**  | Node.js `fs`                                                                   | 直接读写本地 `projects/[id]` 目录文件进行持久化        |

## 3. 业务模块划分

- **画布模块 (`components/flow`)**: 提供核心可视化编辑能力，包含多种自定义节点类型（`asset-node`, `scene-node`, `episode-node` 等），数据实时双向绑定。
- **Agent/对话模块 (`components/chat`)**: 侧边栏助手，包含 Chat 界面与 Agent 选择执行机制，提供与用户进行对话指令交互的功能。
- **项目管理模块 (`components/project`)**: 实现项目的新建、切换与项目状态的加载与存储。
- **核心服务模块 (`lib/core` & `lib/services`)**: 封装对本地文件系统操作的安全控制（仅限读取项目本身 `projects/` 路径），防止跨目录访问，保障数据隔离。
