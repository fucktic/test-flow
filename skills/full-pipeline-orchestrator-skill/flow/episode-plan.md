# 画布：剧集规划（内部插件）

须由主 Agent 在规划或导入多集剧本时 Read；路径与 flow-first 规则见 `flow/canvas-sync.md`、`FLOW_CONTRACT.md`。

## 何时触发

- 用户一句话创意需展开为多集结构
- 前端已建项后首次写入 `ep-xx/script.md`
- 批量导入已有多集剧本

## 步骤摘要

1. 读取 `{appCwd}/projects/.current-project.json` 得到 `projectId`，再读 `{appCwd}/projects/{projectId}/flow.json`。
   合并写回时须遵守 reference-first contract 与剧本双写（见 `FLOW_CONTRACT.md`、主 SKILL）。稳定核心是 **`episodes` / `activeEpisodeId`**；镜头结构化信息统一写入 `sceneNode.data.scenes`，并补全 reference 规定的镜像节点、视频节点与 edges。服化道正式路径仅为 **`global-assets/*.md`**（无 per-episode 快照目录，见 `FLOW_CONTRACT.md`）。
2. 规划每集：
   - 画布内 `id` 使用 `ep1`、`ep2`
   - 磁盘目录使用 `ep-01`、`ep-02`
3. 为每集准备 `title`、`checked`、`script`
4. 合并写入 `episodeNode.data.episodes`
5. 同步写入对应磁盘剧本文件：`ep-01/script.md`、`ep-02/script.md`
6. 保存 `flow.json`

## 输出

- `importedEpisodeIds`
- `episodeCount`
- 下一步按主 SKILL 路由进入导演分析或分镜拆解
