# 画布：分镜图/视频提示词（内部插件）

须由主 Agent 在补全每条分镜的文生图与视频叙事提示词时 Read。

## 真相源

- 更新当前集对应镜头的磁盘 `storyboard-prompt.md` / `asset-map.md`
- **同步到画布节点（P0）**：`flow.json` 只保留 reference 允许的展示字段；同一镜的图片 / 视频结果分别回填到 **`sceneImageNode`**、**`sceneVideoNode`**。**不要**把视频成片提示词写进 **`sceneNode.data.scenes[].content`**；列表项 `content` 保持叙事向（见 `FLOW_CONTRACT.md`）。
- 镜级磁盘目录 `ep-xx/storyboard/pxx/` 为导出层，与审核通过版本保持一致

## 步骤摘要

1. 从 `{appCwd}/projects/.current-project.json` 读取 `projectId`，定位 `episodeNode` 与对应 `scene-{epId}` 的 `sceneNode`，以及各镜的 `scene-image-*`、`scene-video-*` 节点
2. 遍历目标剧集 `sceneNode.data.scenes`
3. `imagePrompt`：写成静态构图、人物外观、光影、画幅感完整英文段落
4. 七段式正文与镜级 `storyboard-prompt.md` 中 **「Seedance 2.0 动态提示词（七段式）」** 同源；**视频 API** 的 **`text`** **不**取该合并串，而取同文件 **「视频 API 调用正文」**（仅 `@图片N`），见主 `SKILL.md` **[分镜与视频 API 引用记号]**。
5. 保存 `flow.json`（须已含 `sceneNode.data.scenes` 与镜级 `data.prompt` 等，见 `flow/canvas-sync.md`）；补全 reference 节点与 edges 后 **`finalize_stage_flow`**
6. 若本阶段同步导出镜级目录，则把审核通过版本写入：
   - `ep-01/storyboard/p01/storyboard-prompt.md`
   - `ep-01/storyboard/p01/asset-map.md`

## 约束

- 禁止占位符式假文
- 每条分镜对应单一连续场景
- 修改后保持 JSON 合法与 React Flow 节点结构
