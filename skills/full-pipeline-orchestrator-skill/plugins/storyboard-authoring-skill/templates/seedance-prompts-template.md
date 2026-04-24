---
name: seedance-prompts-template
description: Seedance 2.0 镜级产出模板（统一含首帧生图段 + 七段式 + 素材表）。
---

# Seedance 2.0 镜级模板

每个剧情点对应一个镜级目录，例如：`ep-01/storyboard/p01/`（目录名 **英文**）。

**任何模式**镜级 `storyboard-prompt.md` 均须含 **首帧生图提示词** 与 **七段式**；分镜帧图生成阶段将对应 PNG 落盘至 **`episode/image/ep-01-p01-first.png`**。单镜秒数上限为15秒。

## 「图片1」、`@图片1` 与 `@图1`

- **`asset-map.md`** 用 **`@图1`、`@图2`**；须同时给出 **`AssetItem.id`**（与 `assetNode` / 前端一致，常为 UUID）与 **磁盘路径键** **`episode/image/{文件名}.png`**，便于 **`@图N` ↔ 文件名 ↔ id** 对齐。
- **七段式**：叙事与磁盘 `storyboard-prompt.md` 中保留的七段式正文同源；`flow.json` 不再保存 `sceneVideoNode.data.prompt` / `sceneBreakdowns[].videoPrompt` 这类胖字段。
- **视频 API 调用正文**（见下独立小节）：**仅**供 Ark **`content[0].text`** 使用，**只**写 **`@图片1`…`@图片N`** 与短叙事句，**禁止**写入磁盘路径、`/api/projects/...`、`episode/image/...` 字面。
- **`@图1` 与 `@图片1` 指同一参考位**；**`content[]` 里 `image_url` 顺序** 与 **`@图片1`…** 一致。
- **`视频1` / `音频1`** 与 **`@视频1` / `@音频1`** 同理。

---

## `storyboard-prompt.md`

```markdown
# p01 storyboard prompt

**建议成片时长（秒）**：10（**单镜不超过15秒上限**；超出须回到导演阶段拆镜）

## 首帧生图提示词
参考图顺序：
图1 = [人物/场景名称]（特征：[外观关键词]）

[静态构图描述；须与下方「七段式」中【画风】【镜头】的首帧状态一致]



## Seedance 2.0 动态提示词（七段式）

以下七段为同一条成片提示词的**结构化草稿**；**`multi_reference`** 时在【画风】【镜头】等段中嵌入 **`@图片1`…** 与素材表一致，供 **`content` 数组** 多图对齐。

【画风】
[全剧/导演阐述 + 本镜色调、线条、比例等；与服化道、首帧一致]

【镜头】
[景别、运镜、节奏、镜头变化；对齐导演分析本镜「镜头建议」]

【台词】
[本镜涉及的剧本对白：角色名 + 原文；无角色对白则明确说明]

【音效】
[环境声、拟音、动作音效]

【BGM】
[情绪、乐器或风格；可与导演「音乐氛围」对齐]

【字幕】
[字幕需求或「无」/「后期添加」]

【备注】
[与上下镜衔接、禁忌或表演提示]

## 视频 API 调用正文（Ark `content[0].text`）

以下段落 **单独**用于视频创建接口的 **`text`** 字段；与上列七段式 **语义一致**，但 **字面**仅使用 **`@图片1`…**，不写路径。

[@图片1 人物外观与 @图片2 场景光色下，镜头从全景推至角色特写；保留【台词】中的对白节奏；环境音与 BGM 与七段式一致。]

```

---

## `asset-map.md`

```markdown
# p01 asset map

| 引用编号 | AssetItem.id（与 assetNode 一致） | 素材类型 | 磁盘路径键（manifest 键同） |
|---------|----------------------------------|---------|------------------------------|
| @图1 | `<uuid-人物>` | 人物参考 | episode/image/role-a.png |
| @图2 | `<uuid-场景>` | 场景参考 | episode/image/scene-grid.png |
| @图3 | `<uuid-可选>` | 首帧（成片参考） | episode/image/ep-01-p01-first.png |
| @音频1 | — | 音频参考 | [可选] |
| @视频1 | — | 视频参考 | [可选] |
```

**`flow.json` 画布** 中对应资源 **`url`** 磁盘层优先写为 **`/episode/image/{文件名}.png`**（项目前端读取时会转换为 **`/api/projects/{projectId}/...`**，见 `FLOW_CONTRACT.md` **双轨路径**）；**磁盘 / manifest** 仍用 **`episode/image/...`** 键。

将本镜实际用于 **`content[]`** 的静态图列入上表，**总数 ≤ 9**，顺序与正文 **`@图片1`…** 一致。

---

## 输出规范

- 中文提示词正文；**目录与文件名英文**（`storyboard-prompt.md`、`asset-map.md`、`video.mp4`）。
- 每镜独立落盘。
- 首帧位图文件名：**`episode/image/ep-{剧集目录名}-p{镜目录名}-first.png`**（示例：`ep-01`、`p01`）。
- 七段式合并正文保留在磁盘 `storyboard-prompt.md` 中；视频阶段 Ark **`content` 首段 `text`** 取自 **`storyboard-prompt.md` 中「视频 API 调用正文」**（不得默认精简致【台词】丢失）。
