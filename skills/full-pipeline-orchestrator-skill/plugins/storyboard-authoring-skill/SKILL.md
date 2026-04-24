---
name: storyboard-authoring-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Read only when full-pipeline-orchestrator-skill
  main agent reaches the storyboard stage; not a standalone user-facing skill.
---

# Seedance 2.0 分镜编写技能

## 技能说明

将导演讲戏与**原剧本对白**转化为镜级分镜提示词。每个剧情点对应一个镜级目录 `p01`、`p02`...，
每镜至少需要：

- `storyboard-prompt.md`
- `asset-map.md`

**首帧**：主 `SKILL.md` **[首帧与英文目录]** — 任何模式均须在 `storyboard-prompt.md` 中含 **首帧组图提示词**，提示词需包含首帧的场景、动作、风格要求，分镜帧图生成阶段生成 **`episode/image/ep-xx-pXX-first.png`** 一张图。统一使用multi_reference模式（Seedance 2.0），单镜秒数上限为15秒。

节点与 **`data.prompt`** 规则见 `FLOW_CONTRACT.md` 与主SKILL（flow-first）。

## 读取要求

执行前须读取：


- **`ep-xx/script.md`（必读本集）**：按镜定位场次与**对白原文**，禁止凭空撰台词
- `ep-xx/director-analysis.md`
- **`global-assets/character-prompts.md`**、**`global-assets/scene-prompts.md`**（服化道主真相源）
- 本集涉及的参考图 **相对路径键**（如 `episode/image/xxx.png`）；**HTTPS 在视频阶段按镜写入** `episode/image-url-manifest.json`
- `seedance-prompt-methodology.md`
- `examples/seedance-prompt-examples.md`
- `templates/seedance-prompts-template.md`（统一镜级骨架）

## 执行流程

1. 统一使用multi_reference模式（Seedance 2.0），单镜时长上限为15秒。
2. 从导演分析中读取剧情点 `P01`、`P02`…
3. **对照剧本**：为每个 `Pxx` 在 `ep-xx/script.md` 中定位对应场次 / 段落，摘录本镜涉及的**对白与动作**（可做简表，但台词须可回溯到原文）
4. 读取同编号 `Pxx` 的导演阐述：**画面描述、台词/对白、音乐氛围、镜头建议** 等
5. 为本集涉及的素材建立 **`@图1`、`@图2`** 编号（与 `asset-map.md` 一致）。正文可写 **「图片1」「视频1」「音频1」**，**语义上与 `@图1` / `@视频1` / `@音频1` 一一对应**
6. 每个剧情点生成一套镜级文件：**首帧组图提示词** + **七段式** + **「视频 API 调用正文」** + **`asset-map.md`**（须含 **`AssetItem.id`**、人物 / 场景/道具及 **`episode/image/ep-xx-pXX-first.png`** 的路径键；**`multi_reference`** 时 **「视频 API 调用正文」** 内 **`@图片1`…** 与 **`asset-map.md`** 顺序一致，**静态参考图总数 ≤ 9**）
    - **【强制细粒度回写】** 每生成完单个分镜的基础提示词/首帧提示词/asset-map，立即写入flow.json，不得攒到全部分镜生成完再批量回写
7. 每镜提示词必须包含 **Seedance 动态提示词（七段式）**：`【画风】【镜头】【台词】【音效】【BGM】【字幕】【备注】`，格式见 `templates/seedance-prompts-template.md`
8. 导演阶段产出的初版镜头列表由 `sceneNode.data.scenes` 承载；本阶段继续细化镜级磁盘文档，必须将首帧生成提示词写入 `sceneImageNode.data.prompt`，将视频生成提示词写入 `sceneVideoNode.data.prompt`
9. **七段式正文与视频 API `text`（分流）**：将七段式正文 **按顺序合并为一段完整字符串**，保留在磁盘 `storyboard-prompt.md` 中，与其中 **「Seedance 2.0 动态提示词（七段式）」** **同源**。调用视频 API（如 Ark `content`）时，**`text` 取自** 同一文件中的 **「视频 API 调用正文」** 全文（**仅 `@图片N`**，无路径），**不得**与七段式合并串混用，也 **不得** 默认精简致 **【台词】** 丢失。**`multi_reference`（2.0）**：**`image_url` 顺序** 与 **「视频 API 调用正文」** 中 **`@图片1`…** 一致
10. 主 Agent 在分镜阶段完成时，负责同步 `scene-{epId}.data.scenes`、`sceneImageNode`、`sceneVideoNode` 与 reference 要求的 `edges`。**批次过滤说明**：本 skill 接收的分镜数据由主 Agent 预先过滤，仅传入当前批次的 2 个分镜，主 Agent 负责增量回写。

## 关键规则（P0 强制）

- **引用写法强制规范**：`asset-map.md` 用 `@图1`、`@图2` 临时编号；flow.json 中存储时须替换为标准 UUID 引用格式：人物资产为`@{对应资产自身的id字段值}characters`、场景资产为`@{对应资产自身的id字段值}scenes`、道具资产为`@{对应资产自身的id字段值}props`、分镜帧图片为`@{对应图片自身的id字段值}assets`。**调用视频 API 前，主 Agent 需将 UUID 引用按出现顺序替换为 `@图片1、@图片2...`，且 `content` 数组中 `image_url` 的顺序必须与替换后的编号完全一一对应。** ID 为标准 UUIDv4 格式；引用顺序与 `asset-map.md`、`content[]` 里的 image 段顺序 100% 对应
- **格式校验**：视频API正文中禁止出现本地路径、API地址、除`@图片N`之外的其他引用格式，不符合直接报错阻断，不得进入下一阶段
- 非首镜需要自然带上上一镜的核心摘要，保持衔接
- **组图提示词段**：提示词头部须有参考图顺序列表；**首帧画面与光影**须与七段式【画风】【镜头】起止状态一致，保证生成图符合镜头叙事逻辑
- **`multi_reference`**：七段内写清 **多参考用途**（人物 / 场景 / 道具），与 `plugins/video-generator-skill/SKILL.md` 中 Ark `content` 约定一致
- **生视频（2.0 `multi_reference`）** 单条任务 **`image_url` 最多 9 张**；本镜实际张数 = **`asset-map.md`** 中本镜列出的静态参考，见 `video-generator-skill`
- **`@图片N`** 须对应 **对应assets子目录或`episode/image/...`本地路径键**
- 若某镜缺少所需人物或场景/道具参考图，必须明确报缺并暂停到资产图片生成阶段补齐

## 质量红线（P0）

- **【台词】**：须引用或忠实还原 `script.md` 中本镜对白；无角色对白时明确写「本镜无角色对白」等
- **【镜头】**：须包含景别与运镜信息，并与导演分析该镜「镜头建议」**一致**；单镜成片 **不超过15秒上限**
- **【画风】**：须与全剧设定及导演整体阐述一致；与首帧生图段不矛盾

## 输出要求

主 Agent 必须按镜写入：

- `{canvas_project_dir}/ep-01/storyboard/p01/storyboard-prompt.md`
- `{canvas_project_dir}/ep-01/storyboard/p01/asset-map.md`

分镜帧图生成阶段将 **`episode/image/ep-01-p01-first.png`** 落盘（与主 `SKILL.md` 一致）。
