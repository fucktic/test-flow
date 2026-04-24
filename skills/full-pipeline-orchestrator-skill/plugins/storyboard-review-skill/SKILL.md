---
name: storyboard-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent runs storyboard review; not a standalone user-facing skill.
---

# Seedance 2.0 提示词审核技能

本插件仅在 `standard` / `strict` 审核模式下启用；`lean` 模式默认不调用。

## 审核对象

- `ep-xx/剧本.md`（核对台词来源）
- `ep-01/分镜/p01/分镜提示词.md`
- `ep-01/分镜/p01/素材对应表.md`
- `ep-01/导演分析.md`
- `ep-01/剧集资产/人物提示词.md`
- `ep-01/剧集资产/场景提示词.md`

## 审核流程

1. 建立整体理解
2. 逐镜比对导演讲戏与分镜提示词
3. 检查素材表与 `@图N` 引用
4. 脑内预演 Seedance 生成效果
5. 输出 PASS / FAIL

## 验收重点

- 已确认 **`video_pipeline_mode`**（主 `SKILL.md`）：**`first_last_frames`** 时审核每镜 **首帧 / 尾帧** 生图段与落盘一致性；**`multi_reference`** 时不强制镜级首尾帧，但 **七段式 + 素材对应表** 须可支撑多参考视频任务
- 每镜都有建议时长、**Seedance 动态提示词（七段式）**：`【画风】【镜头】【台词】【音效】【BGM】【字幕】【备注】` 齐全，且段内为完整句叙事而非空占位
- **【台词】**与 `剧本.md` 中本镜对白 **一致**（或明确标注无对白 / 仅旁白）；禁止与剧本冲突的臆造对白
- **【镜头】**覆盖导演分析该镜「镜头建议」要点；若未覆盖须在【备注】说明理由
- `@图N` 引用与素材表一一对应；**`multi_reference`** 时 **【画风】【镜头】** 等宜含 **`@图片1`…** 与表内本镜人物 / 场景引用 **条数一致**（便于视频 API 挂载至多 9 张 `image_url` 且顺序对齐）
- **`first_last_frames`**：首帧 / 尾帧是静态画面，不是动态运镜复述；且与七段中【画风】【镜头】起止状态一致
- 相邻镜头衔接自然，节奏合理
- 提示词叙事清晰、运镜可执行；**音效 / BGM / 字幕** 段有实质内容或明确写「无」/「后期添加」

## 输出规范

- 平均分 >= 8 且无单项低于 6 -> PASS
- 否则 FAIL，并按镜列问题与修改方向（缺失哪一段、台词与剧本哪处不一致、与导演哪条建议偏离）
- 阶段标记与等待确认规则统一遵守主 `SKILL.md`
