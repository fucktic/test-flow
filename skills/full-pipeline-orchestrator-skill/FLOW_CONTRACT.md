# `flow.json` 契约（第一期）

与项目前端 React Flow 画布对齐的最小可序列化约定。主流程见 `SKILL.md`；**`flow.json` 为唯一真相**，磁盘 `*.md` 为派生产物。

## 路径约定

- `appCwd`：项目根目录，**自动动态推导，不依赖任何固定项目名称**：
  固定目录层级约定：当前skill必须位于`[项目根目录]/skills/full-pipeline-orchestrator-skill/`路径下，通过路径向上两级自动获得项目根目录
- `CURRENT`：`{appCwd}/projects/.current-project.json`
- `canvas_project_dir`：`{appCwd}/projects/{projectId}`
- 磁盘上的剧本、导演分析、服化道、分镜、图片、视频等正式产物均相对于 `canvas_project_dir`

## 顶层结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `nodes` | array | 节点列表 |
| `edges` | array | 连线列表 |
| `id` | string | 可选；前端可能保留，Agent 读到应尽量保留但 **不得依赖** |
| `name` | string | 可选；前端可能保留，Agent 读到应尽量保留但 **不得依赖** |

禁止在 JSON 中存储函数、DOM、路径对象或其它不可序列化值。

## 全局ID强制规则（P0最高优先级）
flow.json中所有`id`字段（节点ID、资产ID、图片ID、视频ID、镜头ID等）**必须为标准UUIDv4格式（36位带横线，例如"46ec1a78-2f87-44a0-99d9-321c63b43379"）**，禁止自定义命名（如"episode-1"/"scene-ep1"/"s1"/"c1"等），使用`uuidgen`命令生成，全局唯一。

### 资源引用格式规则
所有资源引用严格遵循，引用的`id`与资源自身的`id`字段完全一致：
- 人物资产：`@{对应资源自身的id字段值}characters`
- 场景资产：`@{对应资源自身的id字段值}scenes`
- 道具资产：`@{对应资源自身的id字段值}props`
- 分镜帧图片：`@{对应资源自身的id字段值}assets`
示例：
- 人物资产id为"46ec1a78-2f87-44a0-99d9-321c63b43379" → 引用格式为`@46ec1a78-2f87-44a0-99d9-321c63b43379characters李将军人物设定`
- 场景资产id为"98765432-1234-5678-90ab-cdef01234567" → 引用格式为`@98765432-1234-5678-90ab-cdef01234567scenes军营大帐场景`
- 道具资产id为"12345678-1234-5678-90ab-cdef01234567" → 引用格式为`@12345678-1234-5678-90ab-cdef01234567props青龙偃月刀道具`
- 分镜帧图片id为"a1b2c3d4-5678-90ef-ghij-klmnopqrstuv" → 引用格式为`@a1b2c3d4-5678-90ef-ghij-klmnopqrstuvassets第一镜首帧画面`

## 画布 JSON 黄金样例（与本 skill 同构）

合并写回后的 `nodes[]` / `edges[]` 以 **`reference/flow_example.json` 为唯一骨架**：节点 ID、节点类型、核心拓扑、`data` 白名单字段均必须与 reference 同构；业务内容映射到 **`validate_flow_shape.jq` 允许的位置**（含镜级 **`data.prompt`** 等已放行字段）。

- **黄金样例文件**：`full-pipeline-orchestrator-skill/reference/flow_example.json`
- **字段说明（注释文档）**：`full-pipeline-orchestrator-skill/reference/flow_example_annotated.md`
- **写后校验**：合并写回后须运行 `scripts/validate_flow_shape.sh`（见主 `SKILL.md` **[flow.json 写后校验（P0）]**）。

若项目前端升级导致 `public/flow_example.json` 变更，应 **同步更新** skill `reference/` 下两份文件并回归校验脚本。

## `episodeNode`

| 字段 | 说明 |
|------|------|
| `id` | 标准UUIDv4格式，全局唯一 |
| `type` | 固定 `episodeNode` |
| `position` | `{ "x": number, "y": number }` |
| `data` | 见下表 |

### `episodeNode.data`

| 字段 | 类型 | 说明 |
|------|------|------|
| `episodes` | array | 运行时主真相源；每集至少含 `id`、`title`、`checked`，可携带 `script` |
| `activeEpisodeId` | string | 必填；前端 UI 当前选中的剧集 |

### `data` 兼容原则

- `episodeNode.data` 的稳定核心只有：`episodes`、`activeEpisodeId`
- 新写入时 **不得**继续保留 `projectId`、`title`、`sceneBreakdowns` 等 reference 未定义字段
- 若历史项目带有胖字段，skill 写回时应归一化为 reference 白名单结构

### 常见非法反例（禁止）

- **`type`**：**不得**写成 `episode`、`Episode` 或其它别名；项目前端注册的剧集节点类型 **必须**为 **`episodeNode`**（与 React Flow `nodeTypes` 一致），否则画布无法按同一组件渲染。
- **禁止**用单次写入把 `flow.json` **整图替换**为单个「创意 Brief」节点，并 **清空** 或 **省略** `sceneNode` / `sceneImageNode` / `sceneVideoNode` / **`edges`**（除非用户显式要求重置项目）。
- **禁止**在磁盘已存在 **`ep-xx/storyboard/pXX/`** 镜级目录时，当前集仍长期缺少与之对应的 `sceneNode.data.scenes`、镜像节点、视频节点和 `edges`。

### 与项目参考拓扑一致的最小期望

- 除 **`episodeNode`** 外，典型项目还包含 **`scene-{epId}`（`type: sceneNode`）**、各镜 **`scene-image-{epId}-{scene.id}`**、**`scene-video-{epId}-{scene.id}`**、可选 **`asset-1`（`assetNode`）**，以及连接剧集→分镜→镜像→视频的 **`edges`**（参见本 skill **`reference/flow_example.json`** 与项目 **`public/flow_example.json`** 的节点类型与连线关系）。
- Agent **合并写回**须 **读全量**再改：**保留**已有 **`position`**、**`measured`**、**`edges`** 及未参与本阶段更新的节点。

## `episodes[]`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 标准UUIDv4格式，全局唯一 |
| `title` | string | 剧集标题 |
| `checked` | boolean | 是否完成 |
| `script` | object | `title`、`timestamp`、`content` |

**真相源为 `flow.json`**：`episodes[].script.content` 为剧本正文；磁盘 **`ep-xx/script.md`** 与之对应（导出覆盖，不以 md 反向覆盖 flow）。

## 镜头结构真相源

镜头结构真相源为 **`sceneNode.data.scenes[]`**（及镜级节点的 **`data.prompt`** 等）。导演 / 分镜细节以 **flow 节点字段** 为准。

## 与项目前端并存节点（必须同步）

### 节点 ID 约定

所有节点ID均为标准UUIDv4格式，全局唯一，无固定命名规则，仅需保证唯一性：
- 分镜列表节点：UUIDv4
- 静帧节点：UUIDv4
- 视频节点：UUIDv4

### `sceneNode.data.scenes`

数组项包含：

- `id`：标准UUIDv4格式，全局唯一
- `name`
- `content`
- `selected`

规则：

- Agent 更新分镜时 **必须**同步写入该数组，并与磁盘镜序一致
- **禁止**只写磁盘分镜文档而不更新对应 `sceneNode`
- `content` 必须保持 **叙事向**，例如「画面描述 + 台词 / 对白」或导演讲戏摘要
- **不要**把英文动态视频成片提示词写进 `sceneNode.data.scenes[].content`

### `sceneImageNode` / `sceneVideoNode`

- `sceneImageNode.data.id` / `sceneVideoNode.data.id` 使用展示名（通常是 `scene.name`，如 `S-1`）
- `sceneImageNode.data.sceneId` / `sceneVideoNode.data.sceneId` 使用对应 `scenes[].name` 的展示名（如S-1）
- `sceneImageNode.data` 允许字段：`sceneId`、`images`、`imageUrl`、`prompt`、`id`
- `sceneVideoNode.data` 允许字段：`sceneId`、`videos`、`prompt`、`id`
- **节点定位规则（P0）**：所有分镜图片/视频节点统一采用组合定位方式：
  1. 第一步：过滤节点类型为 `sceneImageNode` / `sceneVideoNode`
  2. 第二步：匹配`data.sceneId`等于当前分镜展示名（如`S-01`）
  3. 两步完全匹配即可唯一锁定对应节点，禁止使用自定义ID格式定位

**双轨路径（P0，与项目前端一致）**

| 用途 | 形式 | 说明 |
|------|------|------|
| **磁盘文件**、**`episode/image-url-manifest.json` 的键** | 相对 `canvas_project_dir` 的正斜杠路径 | 例如 **`episode/image/role-a.png`**、**`episode/image/ep-01-p01-first.png`**；与 imgbb、生图落盘一致。 |
| **磁盘层 `flow.json` 内图片 URL**（`sceneImageNode` / `assetNode` 等） | 分镜首帧用`"/episode/image/..."`，全局资产统一用`"/assets/{type}/{UUID}.png"` | 项目前端 `GET /api/projects/[id]/flow` 时会转换为前端展示所用的 `"/api/projects/{projectId}/..."`；skill 直接写磁盘时优先写磁盘层形态。 |
| **视频成片**（`sceneVideoNode.data.videos[].url`，磁盘层） | 标准格式 | 固定为`"/episode/video/{视频UUID}.mp4"`，使用标准UUIDv4作为文件名。项目前端读取时会转换为 `"/api/projects/{projectId}/episode/video/..."`。**禁止**本机绝对路径、相对路径、厂商临时 CDN URL。 |

规则：

- **禁止**将 **本机绝对路径**（如 `/Users/...`）、**imgbb / 厂商临时公网 URL** 写入 `sceneImageNode` / `assetNode` / `sceneVideoNode.data.videos[].url` 的正式展示字段（公网 URL 仅用于 **`episode/image-url-manifest.json`** 与 curl）。
- **兼容**：历史项目中若 `flow.json` 已存 `"/api/projects/{projectId}/..."` 也可保留；skill 新写入默认优先采用 **磁盘层** `"/episode/..."` / `"/assets/..."`，交由项目前端读取时转换。
- **镜级首帧** 磁盘文件名须能区分集与镜（如 **`episode/image/ep-01-p01-first.png`**）；`images[].id` / `name` 等若已存在可保留。
- **视频缩略 / 封面**（`sceneVideoNode.data.videos[].poster` 等，若存在）：磁盘层优先写 `"/episode/image/..."`。

## `assetNode`（全局资产库）

与项目前端 `assetNode` 对齐，用于在画布上展示 **人物 / 场景 / 道具 / 音频** 等全局资产条目。

| 字段 | 说明 |
|------|------|
| `id` | 标准UUIDv4格式，全局唯一 |
| `type` | 固定 `assetNode` |
| `position` | 前端布局；Agent 合并写回时 **须保留**，勿覆盖为占位值 |
| `data` | 见下表 |

### `assetNode.data`

| 字段 | 类型 | 说明 |
|------|------|------|
| `projectId` | string | 可选；与 `episodeNode.data.projectId` 一致时便于前端 |
| `activeTab` | string | 可选：`characters` / `scenes` / `props` / `audio` |
| `selectedId` | string | 可选；前端选中项 |
| `assets` | object | 必填结构：`characters`、`scenes`、`props`、`audio` 各为 **数组**（无则 `[]`） |

### `assets.*[]` 单项（AssetItem）

| 字段 | 说明 |
|------|------|
| `id` | 标准UUIDv4格式，全局唯一；与同一条目的`uuid`字段值完全一致；管线更新时 **优先保留** 已有条目的 `id`，仅更新 `url` / `name` / `description` |
| `uuid` | 标准UUIDv4格式，全局唯一；与同一条目的`id`字段值完全一致；和资源文件路径中的UUID对应 |
| `name` | 展示名，与服化道清单或文件名（无扩展名）一致 |
| `type` | `image` / `audio` / `video` |
| `url` | 分镜首帧写 **`/episode/image/{filename}.png`**，全局资产统一写`/assets/{type}/{UUID}.png`；项目前端读取时会转换为前端展示用的 **`/api/projects/{projectId}/...`** |
| `prompt` | 文生图提示词，必填字段 |
| `description` | 可选；可从对应 `global-assets/character-prompts.md`、`scene-prompts.md` 摘一行 |
| `poster` | 可选 |

规则：

- **`url`（P0）**：分镜首帧写 **`/episode/image/...`**，全局资产统一写`/assets/{type}/{UUID}.png`；**禁止**本机绝对路径、imgbb **公网 URL**；公网 URL 仅保留在 **`episode/image-url-manifest.json`**。若历史项目已存 **`/api/projects/{projectId}/...`** 也可兼容保留。
- Agent **仅**应更新与本阶段相关的分类（资产图片生成阶段主要写 `characters`、`scenes`）；**禁止**删除用户在前端维护的 `props`、`audio` 等未由本管线生成的条目。
- 合并写回 `flow.json` 时 **禁止**整文件覆盖全部 `nodes`；只定位 `type === "assetNode"` 的节点并合并 `data.assets`。

## 画布与磁盘映射

正式产物 **目录与文件名一律英文**（见主 `SKILL.md`）；下表路径均相对于 `canvas_project_dir`。

| 画布 | 磁盘 |
|------|------|
| `episodes[].id = ep1` | `ep-01/` |
| `episodes[].script.content` | `ep-01/script.md` |
| 导演阶段 | `ep-01/director-analysis.md` |
| 服化道阶段 | `global-assets/*.md` **only** |
| `episodes[].sceneBreakdowns[]` | `ep-01/storyboard/p01/` |
| 镜级首帧 PNG | `episode/image/ep-01-p01-first.png`（集+镜可辨） |
| `assetNode.data.assets.characters[]`（每项 `url`） | 磁盘：`assets/characters/{UUID}.png`；**`flow.json` 内磁盘层 `url`**：`/assets/characters/{UUID}.png` |
| `assetNode.data.assets.scenes[]`（每项 `url`） | 磁盘：`assets/scenes/{UUID}.png`；**`flow.json` 内磁盘层 `url`**：`/assets/scenes/{UUID}.png` |
| `assetNode.data.assets.props[]`（每项 `url`） | 磁盘：`assets/props/{UUID}.png`；**`flow.json` 内磁盘层 `url`**：`/assets/props/{UUID}.png` |

推荐命名：

- `ep1 ↔ ep-01`
- `ep2 ↔ ep-02`
- `sceneBreakdowns['ep1'][0] ↔ ep-01/storyboard/p01/`

兼容规则：

- 若现有项目的 `episodes[].id` 不为 `ep1` / `ep2`，应优先沿用现有 ID
- 新建空画布项目允许主 Skill 追加最小 `episodeNode`，但不得重建无关节点或 `edges`

## 正式产物合法路径

以下路径均相对于 `canvas_project_dir`；**目录与文件名均为英文**。

- 剧本：`ep-01/script.md`
- 导演分析：`ep-01/director-analysis.md`
- 服化道（全局唯一真相源）：`global-assets/character-prompts.md`、`global-assets/scene-prompts.md`
- 分镜提示词：`ep-01/storyboard/p01/storyboard-prompt.md`
- 单镜素材表：`ep-01/storyboard/p01/asset-map.md`
- **镜级首帧位图**：`episode/image/ep-01-p01-first.png`（文件名编码 **剧集目录名 + 镜目录名**，如 `ep-01`、`p01`），`episode/image`目录仅保留分镜首帧图
- 分镜视频：`episode/video/{视频UUID{.mp4`（使用标准UUIDv4作为文件名，唯一标识）
- **人物参考资产图**：`assets/characters/{UUID}.png`
- **场景参考资产图**：`assets/scenes/{UUID}.png`
- **道具参考资产图**：`assets/props/{UUID}.png`
- **`episode/image/` 禁止 `*.md`**：该目录下 **仅允许**契约已述的位图等（如 **`*.png`**）；**禁止**创建 **`generate-list.md`**、生成清单类或其它 **Markdown**（提示词与清单须在 **`global-assets/`** 或镜级 **`storyboard-prompt.md`** / 导演文档中）。
- **主 manifest（唯一）**：`episode/image-url-manifest.json`（**禁止**在本集子目录另建副本 manifest）

历史兼容：旧版中文路径（如 `ep-01/剧本.md`、`全局资产/`、`ep-01/分镜/p01/首帧.png`）若仍存在，应迁移到上表英文路径后再增量更新；manifest 键名与 `flow.json` 内 `url` 以新路径为准。

## 非法旧路径

以下路径即使存在，也 **不得**继续写入，也 **不得**被视为当前阶段正式真相源：

- `episode/ep-01/`
- `episode/ep-01/script.md`
- `ep-01/人物提示词.md`
- `ep-01/场景提示词.md`
- **`ep-xx/episode-assets/`** 及其下任意文件（历史项目若仍存在，应迁移到 **`global-assets/`** 与根 **`episode/image-url-manifest.json`** 约定后再增量更新）
- 任何不在“正式产物合法路径”中的并行旧路径

规则：

- **`episode/image/`** 仅为 **分镜首帧** 的正式落盘目录；全局人物/场景/道具资产正式落盘目录为`assets/`对应子目录；**`episode/image-url-manifest.json`** 为 **主 manifest** 正式路径。其它 `episode/` 子路径（如上述黑名单）仍禁止作为剧本等真相源。
- 若发现历史或误写入的旧路径文件，不得继续在其上增量更新；必须回到合法路径重新落盘，并同步 `flow.json`

## `project.json`

路径：`{canvas_project_dir}/project.json`

| 字段 | 说明 |
|------|------|
| `id` | 与目录名相同 |
| `name` | 人类可读项目名 |
| `project_root` | 可选；若存在，应为 `canvas_project_dir` 绝对路径 |
| `flowSchemaVersion` | 可选 |
| `createdAt` / `updatedAt` | 毫秒时间戳，可选 |

## `.current-project.json`

路径：`{appCwd}/projects/.current-project.json`

```json
{
  "projectId": "<uuid>",
  "updatedAt": 1774595157833
}
```

Agent 所有对 `flow.json` 的读写都必须先读此文件定位 `canvas_project_dir`。
