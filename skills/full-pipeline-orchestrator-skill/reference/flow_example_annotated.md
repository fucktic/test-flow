# `flow_example.json` 逐字段说明（注释文档）

> **说明**：标准 **JSON 不支持 `//` 或 `/* */` 注释**。本文件与同级 [`flow_example.json`](flow_example.json) 配套，等价于「在 JSON 每一层参数上打的详细注释」。  
> 本副本位于 **`full-pipeline-orchestrator-skill/reference/`**，与项目仓库 `public/flow_example.json` 应保持内容同步；`projectId` 占位为 `00000000-0000-0000-0000-000000000001`。

---

## 根级

| 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|------|------|------|------|------------|
| `nodes` | `array` | 是 | 画布上全部节点 | 数组顺序**不**表示业务顺序；逻辑关系以 `id`、`type`、`edges` 为准。持久化保存后，前端可能重排。 |
| `edges` | `array` | 是 | 有向连线 | 仅描述**已接线**的链路；某节点在 `nodes` 里存在但无入边/出边是允许的（如独立资产库、预览窗）。 |

---

## 通用：任意 `nodes[]` 元素

以下字段在多种 `type` 上出现；**未在某一节点出现的字段表示该节点不需要或未序列化该状态**。

| 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|------|------|------|------|------------|
| `id` | `string` | 是 | 节点全局唯一 ID | **必须为标准UUIDv4格式（36位带横线，例如"46ec1a78-2f87-44a0-99d9-321c63b43379"）**，使用`uuidgen`命令生成；必须与所有 `edges[].source` / `edges[].target` 引用一致；重名会导致图解析失败。 |
| `type` | `string` | 是 | React Flow 节点类型名 | 必须与前端 `nodeTypes` 注册键一致；非法值会导致该节点无法渲染。 |
| `position` | `object` | 是 | 画布坐标系中的位置 | 原点与缩放依产品；一般为**像素**或逻辑坐标，**可为浮点**。 |
| `position.x` | `number` | 是 | 横向位置 | 负值表示在可视区域左侧（如预览节点常在 `x < 0`）。 |
| `position.y` | `number` | 是 | 纵向位置 | 多列镜链通常 `y` 随镜递增或网格对齐。 |
| `data` | `object` | 是 | 业务载荷 | **唯一**应持久化的业务真相（除布局元数据外）；读图时按 `type` 分支解析。 |
| `measured` | `object` | 否 | 节点实测宽高 | 由前端在渲染后写入，用于自动布局、 minimap、碰撞盒；**缺省时可不读**。 |
| `measured.width` | `number` | 否 | 宽度（px） | 与节点 UI 实际占位一致。 |
| `measured.height` | `number` | 否 | 高度（px） | 同上。 |
| `selected` | `boolean` | 否 | 是否选中 | **会话/UI 状态**；保存到文件时可能为 `false`，不承载业务语义。 |
| `dragging` | `boolean` | 否 | 是否拖拽中 | 通常为瞬时状态；持久化多为 `false`。 |
| `hidden` | `boolean` | 否 | 是否隐藏节点 | `true` 时仍可能在 `nodes` 中，用于「占位但未接入主线」的镜；**不一定**有对应 `edges`。 |
| `selectable` | `boolean` | 否 | 是否允许点选 | `videoPreviewNode` 常为 `false`，防止拖动画布时误选大块预览区。 |

---

## `episodeNode`（示例：`id: "46ec1a78-2f87-44a0-99d9-321c63b43379"`）

**职责**：多集入口、当前激活集、每集剧本在画布上的缓存。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `episodes` | `array` | 是 | 剧集列表 | 一项一集；顺序多为创建顺序，**不一定**与 `ep1/ep2` 数字严格对应，以 `id` 为准。 |
| `episodes[].id` | `string` | 是 | 集逻辑 ID | 标准UUIDv4格式，全局唯一。 |
| `episodes[].title` | `string` | 是 | 展示标题 | 纯 UI 文案；可与磁盘目录名（如 `ep-01`）人工对应，**无自动校验**。 |
| `episodes[].checked` | `boolean` | 是 | 完成/勾选态 | 产品可定义为「本集已审」「已导出」等，**不参与**路由计算 unless 产品明确使用。 |
| `episodes[].script` | `object` | 否 | 该集剧本 | **仅当**该集已有剧本时出现；第二集未写剧本则无 `script` 键。 |
| `episodes[].script.title` | `string` | 在 `script` 存在时 | 剧本标题 | 可与 `episodes[].title` 不同；一长一短分工。 |
| `episodes[].script.content` | `string` | 在 `script` 存在时 | 剧本正文 | 可极长；管线中常与 `ep-xx/script.md` **全文一致**。画布若只展示摘要，仍可能存全文。 |
| `activeEpisodeId` | `string` | 是 | 当前选中集 | **必须**等于某 `episodes[].id`；切换集时只改此字段即可驱动 UI 切换 `scene-ep*` 可见性等（依前端实现）。 |

---

## `sceneNode`（示例：`id: "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv"`）

**职责**：单集下的分镜条列表（一条一幕）。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `title` | `string` | 是 | 列表标题 | 如「分镜列表 EP_001」；与 `episodeNode` 中集标题**独立**，可不同步。 |
| `scenes` | `array` | 是 | 镜数组 | **空数组**表示该集尚未拆镜（见 `scene-ep2`）。顺序 = 镜序 = 叙事顺序（除非 UI 提供重排）。 |
| `scenes[].id` | `string` | 是 | 镜内部 ID | 短 ID（`s1`）或带时间戳（`s1775134164472`）；后者与节点 `scene-image-ep1-s1775134164472` **后缀一致**。 |
| `scenes[].name` | `string` | 是 | 镜展示名 | 如 `S-1`；**必须与**同镜的 `sceneImageNode.data.sceneId`、`sceneVideoNode.data.sceneId` **字符串一致**，否则无法对齐 UI。 |
| `scenes[].content` | `string` | 是 | 镜文案 | 可为 **纯文本** 或 **HTML**；HTML 内可含 `assetMention` 的 `<span>`，引用 `assetNode` 中资源。 |
| `scenes[].selected` | `boolean` | 是 | 行选中态 | 列表 UI 用；多行可同时为 `true` 依产品设计。 |

---

## `sceneImageNode`（示例：`scene-image-ep1-s1` 等）

**职责**：单镜静态图：首帧/参考图多版本。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `id` | `string` | 是 | 分镜展示名 | 等于 `sceneNode.data.scenes[].name`（如 `S-1`），用于 UI 展示，**不是** `scenes[].id`。 |
| `sceneId` | `string` | 是 | 对应镜展示名 | 等于 `sceneNode.data.scenes[].name`（展示名，如S-1），用于关联分镜列表中的展示记录。 |
| `images` | `array` | 否 | 多图列表 | 空数组表示尚未上传任何帧，或仅走占位逻辑。 |
| `images[].id` | `string` | 在条目存在时 | 单图条目 ID | 标准 UUIDv4 格式，用于列表内删除、替换。 |
| `images[].url` | `string` | 在条目存在时 | 图片 URL | 磁盘层优先写 **`/episode/image/xxx.png`** 格式（如 `/episode/image/ep-01-p01-first.png`），项目前端读取时会自动转换为API路径。 |
| `images[].type` | `string` | 在条目存在时 | 图片类型 | 可选值：`first_frame`（首帧）/`reference`（参考图）。 |
| `images[].uuid` | `string` | 在条目存在时 | 图片唯一UUID | 标准 UUIDv4 格式，永久绑定该图片，用于 Seedance 2.0 接口引用，格式为`@{UUID}assets`。 |
| `imageUrl` | `string` | 否 | 当前主图 | 通常与「当前选中帧」一致；若只有一张图，常与 `images[0].url` 或最后一张相同。 |

**节点 ID 与 `scenes[].id` 的对应**：`scene-image-ep1-s1` 中 **`s1`** 对应 `scenes[].id`，而 **`sceneId`** 仍为展示名 `S-1`，两者层级不同，勿混淆。

---

## `sceneVideoNode`（示例：`scene-video-ep1-s1` 等）

**职责**：单镜成片视频与封面。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `id` | `string` | 是 | 分镜展示名 | 等于 `sceneNode.data.scenes[].name`（如 `S-1`），用于 UI 展示。 |
| `sceneId` | `string` | 是 | 对应镜展示名 | 等于 `sceneNode.data.scenes[].name`（展示名，如S-1），用于关联分镜列表中的展示记录。 |
| `prompt` | `string` | 是 | 视频生成提示词 | 使用 UUID 格式引用资源：`@{UUID}characters/scenes/props/assets`，调用 API 前由主 Agent 替换为 `@图片N`。 |
| `videos` | `array` | 否 | 成片列表 | 可多次生成多版本；无则仅有 `sceneId`（未出片）。 |
| `videos[].id` | `string` | 在条目存在时 | 视频条目 ID | 可与 `videoPreviewNode` 里 `items[].id` 对齐以便跳转。 |
| `videos[].url` | `string` | 在条目存在时 | 视频 URL | 磁盘层优先写 **`/episode/video/{视频UUID}.mp4`** 格式，项目前端读取时会自动转换为 API 路径。 |
| `videos[].poster` | `string` | 否 | 封面帧 | 多为同项目下 **`/episode/image/...`** 路径。 |
| `videos[].selected` | `boolean` | 否 | 是否当前选中成片 | UI 列表高亮用。 |

---

## `videoPreviewNode`（示例：`video-preview-main`）

**职责**：聚合预览区，按集展示已生成片段及元数据。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `episodes` | `array` | 是 | 按集的预览桶 | 与 `episodeNode.episodes` **不同结构**：此处侧重**成片列表**与统计。 |
| `episodes[].episodeId` | `string` | 是 | 集展示 ID | 如 `EP_001`，**可以**与 `ep1` 不同命名体系，仅要求产品内一致。 |
| `episodes[].episodeName` | `string` | 是 | 集名称 | 展示用。 |
| `episodes[].totalScenes` | `number` | 是 | 总镜数 | 统计用；可与 `sceneNode.scenes.length` 同步，**不一定**实时强一致。 |
| `episodes[].selectedVideos` | `number` | 是 | 已选/已生成数 | 业务统计。 |
| `episodes[].vid` | `string` | 是 | 播放器或分组 ID | 如 `VID_ep1`。 |
| `episodes[].items` | `array` | 是 | 成片条目 | 扁平列表，可跨镜排序（依产品）。 |
| `episodes[].items[].id` | `string` | 是 | 条目 ID | 建议与 `sceneVideoNode.data.videos[].id` 可关联。 |
| `episodes[].items[].url` | `string` | 是 | 视频 URL | API 路径。 |
| `episodes[].items[].poster` | `string` | 是 | 封面 URL | API 路径。 |
| `episodes[].items[].duration` | `string` | 是 | 展示时长 | 人类可读字符串如 `10s`，**不是**毫秒数字。 |
| `episodes[].items[].status` | `string` | 是 | 状态机 | 如 `generated`、`failed`（依产品枚举）。 |

---

## `assetNode`（示例：`asset-1`）

**职责**：全局资产库（人物/场景/道具/音频），供富文本 `@` 或 `data-id` 引用。

| `data` 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|-------------|------|------|------|------------|
| `activeTab` | `string` | 是 | 当前 Tab | `characters` / `scenes` / `props` / `audio`；**注意** `assets.scenes` 是「美术场景图」，不是分镜 `sceneNode`。 |
| `assets` | `object` | 是 | 四类桶 | 每类为数组，**可空数组**。 |
| `assets.characters` | `array` | 是 | 角色 | 人像立绘、三视图等。 |
| `assets.scenes` | `array` | 是 | 场景图 | 如九宫格场景。 |
| `assets.props` | `array` | 是 | 道具 | 小物体、关键道具图。 |
| `assets.audio` | `array` | 是 | 音频 | BGM、音效等。 |

### 单条资产（四类共用）

| 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|------|------|------|------|------------|
| `id` | `string` | 是 | 资产主键 | 出现在分镜 HTML `data-id` 中；**全局建议唯一**（跨四类也要注意避免冲突，依产品）。 |
| `uuid` | `string` | 是 | 资产图片唯一UUID | 标准UUIDv4格式（36位带横线），永久绑定该资产，用于Seedance2.0接口引用，格式为`@{UUID}assets`。 |
| `name` | `string` | 是 | 显示名 | `@name` 展示用。 |
| `type` | `string` | 是 | 媒体类型 | `image`、`audio` 等；决定预览组件。 |
| `url` | `string` | 是 | 资源地址 | 磁盘层优先写 **`/episode/image/xxx.png`** 格式（如 `/episode/image/char_linmo.png`），项目前端读取时会自动转换为API路径；**空字符串**表示占位未上传。 |
| `description` | `string` | 是 | 短描述 | 可空串。 |
| `prompt` | `string` | 是 | 文生图/备注提示词 | 可空串；管线可能从服化道同步而来。 |

---

## `edges[]` 每条连线

| 字段 | 类型 | 必填 | 含义 | 细节与注意 |
|------|------|------|------|------------|
| `id` | `string` | 是 | 边唯一 ID | 建议可读命名：`e-{source}-{target}`，避免与节点 `id` 冲突。 |
| `source` | `string` | 是 | 起点节点 `id` | 必须存在于 `nodes[]`。 |
| `target` | `string` | 是 | 终点节点 `id` | 必须存在于 `nodes[]`。 |
| `sourceHandle` | `string` | 是 | 起点桩 ID | React Flow 多出口时使用；示例为 `main`。 |
| `targetHandle` | `string` | 是 | 终点桩 ID | 示例为 `in`。 |
| `animated` | `boolean` | 是 | 是否流动动画 | 视觉强调数据流方向。 |
| `style` | `object` | 是 | 线样式 | |
| `style.stroke` | `string` | 是 | 颜色 | CSS 色，如 `#6366f1`。 |
| `style.strokeWidth` | `number` | 是 | 线宽 | 像素。 |

**本示例拓扑语义（颜色可自定）**：紫线连接剧集→分镜列表；蓝线分镜列表→静帧；绿线静帧→视频。**未出现在 `edges` 中的镜**（如示例中 S-3）可能为隐藏或未接入主链，属数据或产品策略结果，**不是** JSON 语法错误。

---

## 与管线契约（`sceneBreakdowns` 等）的关系

本 **示例** 为演示用，**未必**包含 `episodeNode.data.sceneBreakdowns`、`projectId` 等制片管线字段。真实项目由 Agent 合并时，应在保持 **上述节点类型与 `edges` 拓扑** 的前提下，**追加**契约字段，且 **不**删除前端依赖的 `data` 键（除非迁移脚本明确处理）。

---

## Seedance2.0 参考图标记规则（ID使用规范）
所有图片/资产的ID必须为标准UUIDv4格式（36位带横线，全局唯一），引用时严格遵循以下格式，引用的ID与资源自身的`id`字段完全一致：
1. **人物资产**：引用格式为`@{资产自身的id字段值}characters`，示例：`@46ec1a78-2f87-44a0-99d9-321c63b43379characters林墨人物设定`
2. **场景资产**：引用格式为`@{资产自身的id字段值}scenes`，示例：`@98765432-1234-5678-90ab-cdef01234567scenes会议室场景`
3. **道具资产**：引用格式为`@{资产自身的id字段值}props`，示例：`@12345678-1234-5678-90ab-cdef01234567props合同文件道具`
4. **分镜首帧图片**：引用格式为`@{图片自身的id字段值}assets`，示例：`@a1b2c3d4-5678-90ef-ghij-klmnopqrstuvassets第1镜首帧画面`
> 注：ID统一使用标准UUIDv4格式（36位带横线），使用`uuidgen`命令生成，生成后永久绑定对应资源，不允许重复使用。

---

*对应文件：[`flow_example.json`](flow_example.json) · 生成方式：自真实业务样例脱敏而来。*
