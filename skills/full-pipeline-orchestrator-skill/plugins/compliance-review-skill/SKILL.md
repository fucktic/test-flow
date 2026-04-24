---
name: compliance-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent runs compliance review; not a standalone user-facing skill.
---

# 内容合规审核技能

检查当前阶段产出是否触碰 Seedance、文生图平台与通用内容安全红线。

本插件在 `standard` / `strict` 模式下默认启用；`lean` 模式下可按需触发。

## 审核对象

根据当前阶段不同，读取：

- `ep-01/剧本.md`
- `ep-01/导演分析.md`
- `全局资产/人物提示词.md`
- `全局资产/场景提示词.md`
- `ep-01/分镜/p01/分镜提示词.md`
- 必要时读取对应图片

## 审核流程

1. 读取待审核内容
2. 按红线清单逐项检查
3. 输出 PASS / FAIL

## 验收重点

- 真人 / 名人、版权 IP、政治、宗教、色情、血腥、未成年人、仇恨歧视、人身权利、虚假信息
- 人物与服装提示词是否容易触发文生图误杀
- 分镜与图片是否涉及危险尺度内容

## 输出规范

- 全部通过 -> PASS
- 任一未通过 -> FAIL，并给出位置、触碰规则、修改方向
- 阶段标记与等待确认规则统一遵守主 `SKILL.md`
