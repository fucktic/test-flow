---
name: script-analysis-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent runs script or director review; not a standalone user-facing skill.
---

# 剧本 / 导演分析审核技能

用于审核两类文本产物：

- 剧本阶段：`ep-01/剧本.md`
- 导演阶段：`ep-01/导演分析.md`

本插件仅在 `standard` / `strict` 审核模式下启用；`lean` 模式默认不调用。

## 审核对象

- `ep-01/剧本.md` 或 `ep-01/导演分析.md`
- 若审核导演分析，则同时读取 `ep-01/剧本.md`

## 审核流程

1. 建立整体理解
2. 逐段比对原文与目标产物
3. 脑内预演画面与节奏
4. 按清单评分
5. 输出 PASS / FAIL

## 验收重点

- 剧情完整性
- 节奏与时长合理性
- 讲戏是否足够具体
- 人物 / 场景清单是否完整且可供下游使用

## 输出规范

- 平均分 >= 8 且无单项低于 6 -> PASS
- 否则 FAIL，并列出问题、位置、修改方向
- 阶段标记与等待确认规则统一遵守主 `SKILL.md`
