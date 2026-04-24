---
name: image-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent runs image review; not a standalone user-facing skill.
---

# 图片质量审核技能

本插件仅在 `standard` / `strict` 审核模式下启用；`lean` 模式默认不调用。

## 审核对象

- **`episode/image/`**（本集人物 / 场景参考 **PNG**，含宫格）
- 历史兼容：若磁盘仍存在 `全局资产/人物/*.png`、`全局资产/场景/*.png`，可一并纳入比对（新项目以 `episode/image/` 为准）
- `ep-01/分镜/p01/{首帧,尾帧}.png`（**`first_last_frames`** 管线；**`multi_reference`** 下仅审核已存在的镜级帧）
- `全局资产/人物提示词.md`
- `全局资产/场景提示词.md`
- `ep-01/导演分析.md`

## 审核流程

1. 读取导演分析与提示词
2. 逐张查看图片
3. 比对还原度、布局、角色一致性、风格一致性
4. 输出 PASS / FAIL

## 验收重点

- 人物图是否满足“左脸特写 + 三视图 + 白底”
- **场景参考图是否为 3×3 宫格构图**（与服化道提示词一致）；格间与全图 **风格、渲染、色板** 是否统一
- **`episode/image/` 人物图与场景宫格是否画风一致**（与 `全局资产/人物提示词.md`、`场景提示词.md` 中统一视觉规范一致）
- 首尾帧是否与对应镜的提示词一致
- 图片是否清晰、无畸形、无明显水印

## 输出规范

- 平均分 >= 7 且无单项低于 5 -> PASS
- 否则 FAIL，并列出需重生成图片与建议处理
- 阶段标记与等待确认规则统一遵守主 `SKILL.md`
