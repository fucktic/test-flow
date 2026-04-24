---
name: art-direction-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent reaches the art-direction stage; not a standalone user-facing skill.
---

# 服化道设计技能

## 技能说明

将导演提供的人物清单和场景清单转化为可直接用于文生图的提示词，同时维护：

- **`global-assets/`**：跨集主真相源（**`.md` 提示词**；不替代资产图片生成阶段在 **`episode/image/`** 的 **PNG** 落盘）。本集相关条目在全局文件中以 **章节标题、标注或 `ep-xx` 前缀** 区分，**不**再写入任何 **`ep-xx/episode-assets/`** 目录。

公共门禁、合法路径、阶段停顿与 `flow.json` 保存规则见主 `SKILL.md`。人物 / 场景 / 道具参考 **位图** 由 **资产图片生成阶段** 按 `image-generator-skill` 写入对应 `assets/` 子目录（`assets/characters/`、`assets/scenes/`、`assets/props/`）（**公网 URL 写入主 manifest 在视频阶段按镜完成**，见主 `SKILL.md`）。

## 读取要求

执行前须读取：

- `ep-01/director-analysis.md`
- `templates/art-design-template.md`
- `examples/character-prompt-examples.md`
- `examples/scene-prompt-examples.md`
- 若存在：`global-assets/character-prompts.md`、`global-assets/scene-prompts.md`

## 执行流程

1. 读取导演分析中的人物清单和场景清单
2. 仅为 `新增` 和 `变体` 项设计提示词；`复用` 项不重复设计
3. 人物提示词必须明确（强制规则）：
   - 每个人物仅生成1张图，左半边为面部特写，右半边为全身正面/侧面/背面三视图，三视图拼接在同一张图内
   - 白色背景，无多余装饰元素
   - **全项目画风锁定**：人物段须与场景段 **共用同一套「视觉规范」**（线条、渲染方式、色板、材质、整体风格关键词），确保后续生成的人物图与场景宫格 **画风一致**，并与导演整体视觉阐述对齐
   - 全局复用这张唯一的人物图作为所有分镜的参考，禁止为同一人物生成多份不同的参考图
    - **【强制细粒度回写】** 每生成完单个人物提示词，立即写入flow.json，不得攒到全部人物生成完再批量回写
4. 场景提示词 **固定采用 3×3 九宫格**（**禁止** 3×4、4×4 或其它格数）：
   - 每张场景宫格图恰好 **9 格**；本集每个独立场景占一格，**所有格子视觉风格必须统一**
   - 若本集场景数 **少于 9**：余格标注为留空 / 空白占位 / 纯氛围延续格（与 `examples/scene-prompt-examples.md` 一致），**不得**为凑格数改用更大宫格
   - 若本集场景数 **多于 9**：**拆多张** 3×3 宫格（第二张起可写作「ep-xx 场景宫格 二」等），Panel 连续编号；或与导演协商合并次要场景后再落格——**禁止**单张非 3×3 宫格
    - **【强制细粒度回写】** 每生成完单个场景提示词，立即写入flow.json，不得攒到全部场景生成完再批量回写
5. 输出 **仅** 全局主文件（见 **[输出要求]**）：在 `global-assets/character-prompts.md`、`global-assets/scene-prompts.md` 中维护本集与跨集条目，**不**另写剧集快照目录。

## 写法原则

- 叙事描述式，不堆关键词
- 具体化到可视化程度
- 明确构图、景别、光源、材质、色调
- 尽量用正向描述，少用否定句
- 人物与场景 **共用「视觉规范」锚点**，避免人物偏插画而场景偏写实等割裂

## 输出要求

主 Agent 必须写入：

- `{canvas_project_dir}/global-assets/character-prompts.md`
- `{canvas_project_dir}/global-assets/scene-prompts.md`

规则：

- 全局文件为跨集累积主真相源；本集条目在文件中通过 **章节 / 标注** 与跨集区分
- 正式文件落盘后，由主 Agent 完成一次合法的 `flow.json` 保存
