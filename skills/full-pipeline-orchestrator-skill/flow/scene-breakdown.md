# 画布：分镜拆解（内部插件）

须由主 Agent 在“将剧本拆为分镜表”时 Read；reference-first 模式下，分镜真相源为 `sceneNode.data.scenes`。

## 何时触发

- 用户要求拆解分镜
- **`ep-xx/director-analysis.md` 落盘后** 的主 SKILL「导演拆镜回写」（初版 `sceneNode.data.scenes`，可尚无 `ep-xx/storyboard/pXX/`）
- 分镜编写阶段（补全提示词与镜级 md）
- 需要从画布重新导出镜级目录时

## 步骤摘要

1. 读取 `{appCwd}/projects/.current-project.json` 得到 `projectId`，再读 `{appCwd}/projects/{projectId}/flow.json`
2. 遍历目标集的 `script.content` 或 `ep-xx/script.md`
3. 将每条分镜写入当前集的 `sceneNode.data.scenes[]`，每条至少包含：
   - `sceneNumber`
   - `type`
   - `location`
   - `画面描述`
   - `台词/对白`
   - `音乐氛围`
   - `镜头建议`
4. 镜级提示词正文保留在后续 `storyboard-prompt.md` / `asset-map.md` 中；本阶段先保证 `sceneNode.data.scenes` 的镜序、摘要和数量正确
5. **同步** `nodes` 中 `scene-{epId}` 的 `sceneNode.data.scenes`（以 flow 为准），见 `flow/canvas-sync.md` 与主 SKILL。
6. 保存 `flow.json`

## 与磁盘的关系

- `sceneNode.data.scenes[0]` 对应目标剧集的 `ep-xx/storyboard/p01/`
- 导出时按镜创建：
  - `storyboard-prompt.md`
  - `asset-map.md`
- 图片阶段在 **`episode/image/`** 生成 **`ep-xx-pXX-first.png`**、**`-last.png`**（任意 `video_pipeline_mode`）

镜级目录是导出层，不是独立真相源。

额外限制：

- **禁止**只写磁盘导演拆镜文档而不更新 `sceneNode.data.scenes`
- **禁止**向 `episode/ep-01/` 或其它主 SKILL 黑名单旧路径导出分镜文件
- 导演分析中单镜建议时长不得超过 **当前 `video_pipeline_mode` 对应上限**（**15 秒** 或 **12 秒**，见主 `SKILL.md`）；拆镜条数须与之一致，便于一镜一次调用生视频 API
