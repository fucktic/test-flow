---
name: video-generator-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Not a standalone Cursor skill. Read only when
  full-pipeline-orchestrator-skill main agent reaches the video stage. Outputs to
  per-shot directories under ep-xx/storyboard/.
---

# 视频生成技能

## 技能描述

视频正式产物写入统一视频目录，例如：

- `{canvas_project_dir}/episode/video/{视频UUID}.mp4`

请求结构必须来自用户提供的 `video_api_profile`。脚本执行、门禁、合法路径、阶段停顿与
节点回填规则统一遵守主 `SKILL.md`（flow-first）规则。

## 每镜任务前：imgbb 与 manifest（P0）

- **在发起该镜视频 API 请求之前**，按照主skill `[imgbb manifest管理规则（P0）]`中的视频API调用前校验规则执行：
  1. 从当前批次对应`sceneVideoNode.data.prompt`中使用正则提取所有`@<UUID>(characters|scenes|props|assets)`标记的UUID及其后缀
  2. 根据后缀构造本地文件路径：`characters`→`assets/characters/{UUID}.png`，`scenes`→`assets/scenes/{UUID}.png`，`props`→`assets/props/{UUID}.png`，`assets`→`episode/image/ep-xx-pXX-first.png`
  3. 检查manifest中是否已存在该UUID对应`_uuid_map`的有效URL，缺失则调用`scripts/upload_to_imgbb.sh`上传对应本地文件，写入manifest
  4. 提示词临时替换：提取UUID后从manifest中`_uuid_map`获取公网URL替换为`@图片1`、`@图片2`...`@图片N`
  5. 必须保证视频API的`content`数组中`image_url`的顺序与提示词中`@图片N`的顺序完全一致

## 需求收集口径

- 必须要求用户提供生视频 curl 完整示例
- 必须要求用户提供 `video_api_key`
- 若视频接口是异步任务模式，还必须补充查询任务结果的 curl 示例或等价轮询契约

## `video_api_profile` 契约

`video_api_profile` 位于 **`{canvas_project_dir}/.config.json`**（主路径）或兼容的
`{appCwd}/.config.json` 顶层。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `endpoint` | string | 是 | 创建任务请求 URL |
| `method` | string | 是 | 创建任务 HTTP 方法 |
| `headers` | object | 是 | 创建任务请求头模板 |
| `body_template` | object | 否 | 创建任务 JSON 请求体模板 |
| `poll_url_template` | string | 条件必填 | 异步任务接口的轮询 URL，通常包含 `{task_id}` |
| `poll_method` | string | 条件必填 | 异步轮询 HTTP 方法 |
| `poll_headers` | object | 否 | 轮询请求头模板 |
| `response.task_id_jq` | string | 条件必填 | 从创建响应提取任务 ID 的 jq 表达式 |
| `response.video_url_jq` | string | 是 | 从响应中提取视频下载 URL 的 jq 表达式 |
| `response.status_jq` | string | 条件必填 | 从轮询响应提取任务状态的 jq 表达式 |
| `response.error_message_jq` | string | 否 | 从失败响应提取错误信息的 jq 表达式 |
| `success_status_values` | array | 条件必填 | 视为成功的状态值列表 |
| `failure_status_values` | array | 条件必填 | 视为失败的状态值列表 |

占位符：

- `{api_key}`
- `{model_id}`
- `{prompt}`
- `{duration}`
- `{ratio}`
- `{resolution}`
- `{watermark}`
- `{task_id}`

**`multi_reference`（2.0）**：用户 curl 可能使用 **`content` JSON 数组**（多段 text / image_url / video_url / audio_url），而非仅 `{first_frame_url}`。主 Agent 以用户 **`video_api_profile` / 原始 curl** 为准组装占位符。

### UUID引用替换与提示词处理（P0最高优先级）

- **提示词来源兼容**：优先读取用户直接输入的提示词，若用户未直接输入则读取flow的`sceneVideoNode.data.prompt`字段作为原始提示词
- **UUID替换规则（严格执行）**：
  1. 按UUID在原始提示词中出现的**先后顺序**，提取所有符合`@{UUID}(characters|scenes|props|assets)`格式的引用
  2. 按顺序分配编号`@图片1、@图片2、...、@图片N`，生成顺序映射表
  3. 将原始提示词中所有UUID引用统一替换为对应`@图片N`标记
  4. **禁止遗漏任何UUID引用**、**禁止调换顺序**、**禁止修改原始提示词其他内容**（仅替换UUID标记）
- **参考图数量**：单条视频任务 **`image_url` 参考图最多 9 张**（Seedance 2.0 常见上限），数量必须与提示词中`@图片N`的数量完全一致
- **顺序与标注**：多个 `image_url` 在 `content[]` 中的顺序，必须与提示词里 **`@图片1`、`@图片2`…`@图片N`** 的出现顺序**完全一一对应**：第 1 个 `image_url` 对应 `@图片1`，第 2 个对应 `@图片2`，依此类推
- **manifest**：每个 URL 来自 **`episode/image-url-manifest.json`** / 本集 manifest 的 **HTTPS**（须先完成本节 **每镜任务前：imgbb 与 manifest**）；组装前按分镜表取齐本镜所需全部键

## 单镜时长约束

统一使用multi_reference模式（Seedance 2.0），请求体中 **`duration` / `seconds` 等时长字段** 不得超过 **15**（与 2.0 常见单次成片上限一致；字段名以用户 curl 为准）。

## 参数动态适配规则（P0）
所有参数优先级从高到低：用户直接输入值 > 当前分镜配置值 > .config.json全局配置值 > 系统默认值，禁止硬编码固定值：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `duration` | 视频时长（秒） | 默认10秒，最大上限15秒 |
| `ratio` | 视频比例 | .config.json中的`video_ratio`配置 |
| `generate_audio` | 是否生成音频 | `true` |
| `watermark` | 是否加水印 | `false` |
| `video_api_key` | API密钥 | .config.json中的`video_api_key`配置 |

## 视频API请求结构强约束（P0）

**所有请求必须严格对齐Doubao Seedance 2.0标准格式，结构固定如下，禁止任何修改：**

```bash
curl -X POST "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks" \
-H "Authorization: Bearer {video_api_key}" \
-H "Content-Type: application/json" \
-d '{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "{替换后的提示词，@图片N与后续image_url顺序完全对应}"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://i.ibb.co/xxx/xxx.png"
      }
    },
    {更多image_url段，顺序与@图片N完全对应，最多9张}
  ],
  "duration": {分镜时长},
  "ratio": "{视频比例}",
  "generate_audio": {是否生成音频},
  "watermark": {是否加水印}
}'
```

### 强制约束规则：
1. **content数组固定结构**：第一项必须为`text`类型，后续所有项必须为`image_url`类型，禁止混合其他类型
2. **顺序严格对齐**：`image_url`段的顺序必须与text中`@图片N`的出现顺序完全一致
3. **禁止删减参考图**：所有在提示词中出现的UUID引用必须全部生成对应的`image_url`段，禁止遗漏、删除任何参考图
4. **禁止修改提示词**：除了将UUID标记替换为`@图片N`外，不得修改原始提示词的任何其他内容

规则：

- model固定为`doubao-seedance-2-0-260128`，无需配置
- 若创建接口只返回任务 ID，则 `poll_url_template`、`poll_method`、`response.status_jq`、`success_status_values`、`failure_status_values` 都必须存在

## 从 curl 生成 `video_api_profile`

推荐步骤：

1. 用 `scripts/parse_curl.sh` 解析用户提供的“创建任务 curl”
2. 将动态值替换成占位符：
   - 文本提示词 -> `{prompt}`
   - 首帧 URL -> `{first_frame_url}`
   - API Key -> `{api_key}`
   - 模型 ID -> `{model_id}`
   - 时长 -> `{duration}`
   - 比例 -> `{ratio}`
   - 分辨率 -> `{resolution}`
   - 水印 -> `{watermark}`
3. 若创建响应直接带视频 URL，补 `response.video_url_jq`
4. 若创建响应只返回任务 ID，再读取“查询任务结果 curl”，补齐轮询字段
5. 若解析结果无法可靠泛化，主 Agent 必须手工修正 `video_api_profile`

## API调用规则（P0最高优先级）

- 每条分镜单独提交任务
- 按固定轮询逻辑等待结果
- **禁止任何自动重试**：所有API调用不管失败原因，均不自动重试
- 任何调用失败后立即返回标准化失败通知（含失败项、错误原因、上下文信息、排查建议）
- 必须等待用户明确修改指令后才能再次发起调用，完全避免无效消耗API额度
- 下载视频到 `{canvas_project_dir}/episode/video/{视频UUID}.mp4`（UUID唯一标识每个视频）
- 不包含 ffmpeg 拼接

## 输入参数

```json
{
  "save_path": "{canvas_project_dir}/episode/video/{视频UUID}.mp4",
  "episode_id": "ep-01",
  "shots": [
    {
      "shot_id": "P01",
      "duration": 5,
      "text": "动态描述（与七段式合并正文同源）",
      "first_frame_url": "https://...",

    }
  ]
}
```



## 数据来源

- 分镜文本：`ep-01/storyboard/p01/storyboard-prompt.md`
- 主 manifest（唯一）：`episode/image-url-manifest.json`（项目根 **`{canvas_project_dir}/episode/image-url-manifest.json`**）

**注意**：视频文件统一落盘到 `{canvas_project_dir}/episode/video/{视频UUID}.mp4`，由主 Agent 下载并回填 `sceneVideoNode`。

- **【强制细粒度回写】** 每生成完单个分镜的视频，立即写入flow.json，不得攒到全部分镜视频生成完再批量回写；`flow.json` 实际只回填 reference 允许的视频展示字段。
- manifest管理规则详见主SKILL.md **[imgbb manifest管理规则（P0）]**

## API请求前置校验规则（P0最高优先级）
所有请求发起前必须通过以下全部校验，任何一项不通过直接阻断请求，不发起API调用，返回错误信息：
1. **Manifest校验**：调用`{skill_root}/scripts/validate_manifest.sh <manifest_file_path> <current_scene_prompt_file_path>`校验当前分镜所有引用的UUID在manifest中存在且对应URL合法有效，校验失败直接阻断
2. **数量校验**：提示词中`@图片N`的总数量 = content数组中`image_url`段的数量，必须完全相等，差1个都不允许
3. **顺序校验**：`image_url`段的顺序与提示词中`@图片N`的出现顺序完全一致，顺序不匹配直接阻断
4. **URL校验**：所有`image_url`必须是有效的imgbb公网URL，必须以`https://i.ibb.co/`开头
5. **结构校验**：请求body完全符合Seedance 2.0标准结构，必填字段全部存在
6. **参数校验**：所有参数值在合法范围内（duration在1-15秒之间，ratio为允许的枚举值等）

## `flow.json` 合并写回 checklist（P0）

每个分镜目录下 **`video.mp4` 已存在且非空** 后，主 Agent 必须：

1. 读取 `{canvas_project_dir}/flow.json` 全文（由主 `SKILL.md` 的 `CURRENT` → `projectId` 定位项目目录）。
2. 在 `nodes` 中定位节点：① `type === "sceneVideoNode"`；② `data.sceneId === 当前分镜展示名`（如`S-01`），组合定位到对应分镜视频节点。
3. 将 **该镜成品视频** 在 `data.videos[]` 中用于展示的 **`url`** 设为以下 **二选一**（与 `FLOW_CONTRACT.md` **双轨路径** 及项目参考 `flow.json` 一致）：**相对路径** **`/episode/video/{视频UUID}.mp4`**（与磁盘落盘一致）；**或** **`/api/projects/{projectId}/episode/video/...`**（前端上传保存形态）。**禁止**本机绝对路径、厂商临时 CDN URL 作为 **`videos[].url`**。
4. 若存在 **`poster`**（预览图），磁盘层优先写为 **`/episode/image/...`**；若项目中已存在 **`/api/projects/{projectId}/...`** 形态，也可兼容保留（与 `FLOW_CONTRACT.md` **双轨路径** 一致）。
5. `flow.json` 只回填 reference 允许的视频展示字段：`data.sceneId`、`data.prompt`、`data.videos[]`。
6. **合并写回** `flow.json`，并可更新 `project.json.updatedAt`。
7. **执行层说明**：统一使用multi_reference模式，参考 URL 来自 **本镜刷新后的** manifest，按 **`asset-map.md`** 与 **「视频 API 调用正文」** 中 **`@图片1`…** 组装 **`content[]`**（**最多 9 张** `image_url`），**`text`** 取自 **`storyboard-prompt.md`「视频 API 调用正文」**；参考图 PNG 若列入素材表则一并上传并计入张数。`flow.json` 内视频 **`url`** 为 **`/episode/video/...`**（项目前端读取时会转换为 **`/api/projects/{projectId}/episode/video/...`**）；**`poster`** 磁盘层优先 **`/episode/image/...`**（见 `FLOW_CONTRACT.md`）。
8. 若任一步未执行即宣称该镜视频交付完成 → **视为阶段未完成**（与主 `SKILL.md`「视频生成阶段」一致）。
