# `flow.json` 与磁盘导出（内部约定）

须由主 Agent 在涉及画布时 Read；禁止作为独立技能匹配。

## 真相源（P0）

- **`flow.json` 为唯一业务真相**（剧本、镜表、`asset-1`、镜级 `sceneImageNode`/`sceneVideoNode` 的 `data.prompt` 等）。
- **`ep-xx/*.md`、`global-assets/*.md`、`storyboard/pNN/storyboard-prompt.md`** 均由 SDK **`export_flow_to_disk`** 从 `flow.json` **派生**，供 curl / 管线 / 审阅；**不以磁盘为准反向合并进 flow**。

## 阶段收尾（P0）

每阶段业务写入 **`flow.json`** 后，调用 **`finalize_stage_flow()`**（`sdk/flow_reference_strict.sh`，经 `flow_util.sh` 载入；别名 **`auto_sync_flow`**）：

1. **`strict_rebuild_flow`**：reference 骨架 + 保留已有节点 `data`（含 `prompt`、`url` 等）。
2. **`strict_sync_preview_node`**：刷新 `video-preview-main`。
3. **`write_flow_snapshot`**：校验并写回 `flow.json`。
4. **`export_flow_to_disk`**：覆盖导出 `script.md`、`director-analysis.md`、`global-assets/*.md`、各镜 `storyboard-prompt.md`。

写后须通过 **`scripts/validate_flow_shape.sh --strict`**（由 `write_flow_snapshot` 触发）。

## 合并写回（Agent 手工改 flow 时）

- 读全量 `flow.json`，按 id 合并节点，**禁止**整文件覆盖清空 `edges`。
- 保留顶层 `id`、`name` 等非 `nodes`/`edges` 键。

## 与 `FLOW_CONTRACT.md` 的关系

字段白名单、路径、节点 ID 约定以 **`FLOW_CONTRACT.md`** 为准；流程叙事以主 **`SKILL.md`** 为准。
