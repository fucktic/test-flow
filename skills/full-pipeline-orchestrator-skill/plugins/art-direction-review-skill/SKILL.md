---
name: art-direction-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent runs art review; not a standalone user-facing skill.
---

# 服化道设计审核技能

本插件仅在 `standard` / `strict` 审核模式下启用；`lean` 模式默认不调用。

## 审核对象

- `全局资产/人物提示词.md`
- `全局资产/场景提示词.md`
- `ep-01/剧集资产/人物提示词.md`
- `ep-01/剧集资产/场景提示词.md`
- `ep-01/导演分析.md`

## 审核流程

1. 读取导演分析中的人物清单与场景清单
2. 逐项比对服化道提示词是否遗漏、偏离或冲突
3. 脑内预演文生图结果
4. 输出 PASS / FAIL

## 验收重点

- 人物外观信息是否完整、可生成、可区分
- **场景提示词是否规定为 3×3 九宫格**（禁止 3×4、4×4）；余格与 **多于 9 场景时的拆表策略** 是否符合 `art-direction-skill`
- 场景宫格是否覆盖完整、**格间与全格画风统一**；**人物提示词与场景宫格是否共用同一套视觉规范**，与导演整体风格不矛盾
- `全局资产/` 与 `剧集资产/` 是否主从一致

## 输出规范

- 平均分 >= 8 且无单项低于 6 -> PASS
- 否则 FAIL，并给出问题位置、脑内预演风险、修改方向
- 阶段标记与等待确认规则统一遵守主 `SKILL.md`
