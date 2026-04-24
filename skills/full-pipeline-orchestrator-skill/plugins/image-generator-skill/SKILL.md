---
name: image-generator-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. Config-driven image generation: Agent uses curl+jq
  per image_api_profile in project .config.json. No bundled shell script, no vendor-specific API examples.
---

# 配置驱动生图技能

## 技能说明

执行方读取 **`{canvas_project_dir}/.config.json`**（主路径）；若不存在则回退
`{appCwd}/.config.json`。从中读取 `image_api_profile`，按通用契约用 `curl + jq`
调用用户配置的生图 HTTP API。

公共门禁、第三方 API 限制、合法路径与阶段停顿规则见主 `SKILL.md`（flow-first）。

## 入参规则（P0强制）
- 必须传入`image_type`枚举值：`asset`（人物/场景/道具等全局资产类生图）/`shot_frames`（分镜首帧生图）
- `image_type=asset`：强制`sequential_image_generation="disabled"`，忽略`sequential_image_generation_options`参数，单张生成
- `image_type=shot_frames`：强制`sequential_image_generation="auto"` + `sequential_image_generation_options=2`，接收合并后的统一组图提示词，一次调用返回1张首帧图片

## ID生成规则（P0强制）
- 每生成一张图片（含资产图、分镜首帧），必须使用`uuidgen`命令生成**标准UUIDv4格式（36位带横线）**作为该图片的唯一ID
- 回填flow.json时，将生成的UUID写入对应图片条目的`id`字段和`uuid`字段，保持两个字段值一致
- 资产类图片的ID同时作为对应资产条目的`id`字段值

## 产物路径

产物分三类：

- 人物参考图（含 3×3 宫格等）：**`assets/characters/{UUID}.png`**
- 场景参考图（含 3×3 宫格等）：**`assets/scenes/{UUID}.png`**
- 道具参考图：**`assets/props/{UUID}.png`**
- 分镜首帧：**`episode/image/ep-01-p01-first.png`**（文件名编码剧集目录名与镜目录名）

**`episode/image/`** 下 **仅允许** 位图等契约已述文件（如 **`*.png`**）；**禁止**创建 **`generate-list.md`** 或其它 **Markdown** 清单（见 `FLOW_CONTRACT.md`）。

## 生成顺序与分帧参考（P0 强制规则）

- **人物资产生成规则（P0强制）**：人物参考图必须严格符合art-direction-skill的三视图要求：左半边为面部特写，右半边为全身正面/侧面/背面三视图，三视图拼接在同一张图内，白色背景，无多余装饰元素，全项目画风锁定。
- **须先**完成本集 **人物图、场景（宫格）图、道具图** 在 **对应assets子目录** 落盘，并 **`assetNode`** 与 `flow` 对齐后，再生成各镜 **`-first.png`**。
- **前置强制校验**：分帧图生成前必须检查对应人物/场景/道具参考图是否已存在于对应assets子目录，无参考图直接阻断请求，不得发起API调用
- **分帧图**每条请求 **必须** 使用 `{reference_image_url}`（或 profile 等价字段），且 **至少一条** 参考应对应已落盘的 **人物/场景/道具** 资产（经临时 imgbb 上传该本地文件得到 URL）；**禁止任何无参考** 的分帧任务（即使配置声明无参考也必须强制带参考），100%保证人物场景一致性
- 镜级 **首帧英文提示词** 与 **`asset-map.md`** 中的 **参考图顺序**、**`episode/image/...` 文件名** 一致
- **【强制细粒度回写】** 
  - 每生成完单张人物参考图，立即写入flow.json
  - 每生成完单张场景参考图，立即写入flow.json
  - 每生成完单张道具参考图，立即写入flow.json
  - 每生成完单个分镜的首帧图，立即写入flow.json，回填首帧图片信息
  - 不得攒到全部图片生成完再批量回写，每成功生成一张就回写一次

## `image_api_profile` 契约

`image_api_profile` 位于 `.config.json` 顶层。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `endpoint` | string | 是 | 完整请求 URL，须以 `https://` 开头 |
| `method` | string | 是 | `POST` 或 `GET` |
| `headers` | object | 是 | 请求头 |
| `body_template` | object | POST 时必填 | JSON 请求体模板 |
| `size_by_type` | object | 否 | 键为 `人物` / `场景` / `分帧图` |
| `response` | object | 是 | 至少包含 `image_url_jq` 或 `image_base64_jq` |

占位符：

- `{api_key}`
- `{model_id}`
- `{prompt}`
- `{negative_prompt}`
- `{size}`
- `{reference_image_url}`

规则：

- 人物图、场景图可不带参考图字段
- 分帧图任务必须使用 `{reference_image_url}` 或等价参考图字段
- 若分帧图 **必须** 使用公网参考图 URL，而主 manifest 在资产图片生成阶段/分镜帧图生成阶段尚无该键：在 **本条 curl 调用前** 对 **对应assets子目录或`episode/image/`下已落盘的对应参考图** 执行一次 `scripts/upload_to_imgbb.sh`，将返回 URL 填入 `{reference_image_url}`；**上传成功后必须原子更新主manifest的`urls`/`_uuid_map`/`file_hashes`三个字段**，统一管理所有上传资源
- 若 `body_template` 中没有分帧图参考字段占位，视为 profile 不满足契约

## 单条任务流程

对每一项任务：

1. 按`image_type`确定请求参数：
   - `asset`类型：添加`sequential_image_generation="disabled"`到请求体
   - `shot_frames`类型：添加`sequential_image_generation="auto"` + `sequential_image_generation_options=2`到请求体
2. 计算保存路径：
   - `asset`类型：`assets/{type}/{UUID}.png`（`type`为`characters`/`scenes`/`props`）
   - `shot_frames`类型：保存路径为`episode/image/ep-xx-pXX-first.png`
3. 若任务类型是分帧图且需要 `{reference_image_url}`：按上节规则取得 URL（从manifest中获取，必要时临时上传本地参考图）
4. 用 `jq` 替换 `body_template` / `headers` 中的占位符
5. 分帧图请求必须显式传入参考图字段
6. `curl` 调用 API
7. 【强制规则】必须使用curl下载图片，禁止使用任何其他下载方式（包括http模块、fetch、第三方下载工具等）：
   - 优先用 `image_url_jq` 提取API返回的图片公网URL
   - 执行固定curl命令下载到对应保存路径：
     ```bash
     curl -s -o "{save_path}" "{image_url}" --connect-timeout 10 --max-time 30 --retry 1
     ```
    - 下载后强制校验：检查文件是否存在且文件大小>0，校验失败直接返回错误
    - 仅当API明确返回base64格式时，先将base64内容写入临时文件再解码移动到目标路径，禁止其他处理方式
    - `asset`类型：下载单张写入对应保存路径
    - `shot_frames`类型：下载返回的1张图片写入首帧路径
8. 上传并写入manifest：
   - 判断项目配置中存在有效的imgbb_api_key，不存在则直接跳过
    - 计算本地文件的MD5哈希值
    - 检查`episode/image-url-manifest.json`中是否已有该文件路径对应的记录：
      - 若存在且哈希值匹配：跳过上传，复用已有URL
      - 若存在但哈希值不匹配：说明资源已修改，需要重新上传
      - 若不存在：执行新上传
    - 调用`{skill_root}/scripts/upload_to_imgbb.sh`上传本地文件
    - 上传成功则原子更新manifest四个字段：
      1. `urls`：更新文件路径对应公网URL
      2. `_uuid_map`：更新资源UUID对应公网URL
      3. `file_hashes`：更新文件路径对应新的MD5哈希值
      4. `upload_times`：新增/更新文件路径对应上传时间戳（秒级）
    - 上传失败处理：
      - 所有阶段上传失败均立即终止当前流程，输出标准化错误提示
      - 错误提示格式固定：
        ```
        【流程失败通知】
        当前阶段：<当前执行阶段>
        失败步骤：imgbb资源上传
        失败原因：<原始错误信息>
        上下文信息：本地文件路径=<本地资源路径>
        排查建议：检查imgbb密钥有效性/网络连通性/本地图片是否存在/是否触发imgbb限流
        ```
9. 写入本地文件完成，进入下一步回写flow.json流程

## API调用规则（P0最高优先级）

- 同一批内最多 3 条并发
- **禁止任何自动重试**：所有API调用不管失败原因（网络错误/超时/5xx/429/401/审核失败等），均不自动重试
- 任何调用失败后立即返回标准化失败通知（含失败项、错误原因、上下文信息、排查建议）
- 必须等待用户明确修改指令后才能再次发起调用，完全避免无效消耗API额度
- 【强制规则】所有返回的图片必须使用curl下载，禁止使用其他任何下载工具或方式

## 与主流程衔接

- 分帧图依赖的参考图先看 **对应assets子目录** 人物/场景/道具图、**`episode/image/`** 分镜首帧图（本地）
- 本地 png 已落盘后，由主 Agent 回填 `sceneImageNode`；**人物/场景/道具图** 完成后还须回填 **`assetNode.data.assets`**（见 checklist）
- manifest管理规则详见主SKILL.md **[imgbb manifest管理规则（P0）]**

## `flow.json` 合并写回 checklist（P0）

每完成一镜（或一批）**本地 png 已落盘**后，主 Agent 必须：

1. 读取 `{canvas_project_dir}/flow.json` 全文（由主 `SKILL.md` 的 `CURRENT` → `projectId` 定位）。
2. 在 `nodes` 中定位节点：① `type === "sceneImageNode"`；② `data.sceneId === 当前分镜展示名`（如`S-01`），组合定位到对应分镜图片节点。
3. 将 **该镜展示用图** 的地址写入 **`data.imageUrl`** 或 **`data.images[].url`**；磁盘层优先写 **`/episode/image/{filename}.png`**（项目前端读取时会转换为 `/api/projects/{projectId}/...`）。若项目里已存在 **`/api/projects/{projectId}/...`** 形态，也可兼容保留。**禁止**本机绝对路径、imgbb 公网 URL 写入上述字段。
4. `flow.json` 只回填 reference 允许的图片展示字段：`data.sceneId`、`data.imageUrl`、`data.images[]`；`data.prompt` 由分镜阶段写入。
5. **禁止**将 imgbb 或其它 **公网 URL** 写入上述 `sceneImageNode` 字段；公网 URL **仅**在 **`episode/image-url-manifest.json`** 中供 **视频 curl** 使用，且 **由视频阶段按镜上传刷新**。
6. **合并写回** `flow.json`（不得整体覆盖无关 `nodes`/`edges`），并可更新 `project.json.updatedAt`。
7. 若任一步未执行即宣称该镜图片交付完成 → **视为阶段未完成**（与主 `SKILL.md`「分镜帧图生成阶段」规则一致）。

8. **`assetNode`（人物/场景/道具参考图，P0）**：在 **对应assets子目录** 下 **人物图、场景图（含宫格）、道具图** 已落盘后，主 Agent 必须：
   - 在 `nodes` 中定位 **`type === "assetNode"`**；若无则按主SKILL规则 **追加**最小 `assetNode`。
   - 将 **`data.assets.characters`** / **`data.assets.scenes`** / **`data.assets.props`** 与当前磁盘上的 **对应assets子目录** 文件对齐：
      - 新生成资产：必须同时填写`id`和`uuid`字段，两者值完全一致（使用同一个标准UUIDv4）
      - 已有资产：**优先保留** 已有 `AssetItem.id`，仅更新 `url`/`name`/`prompt` 等业务字段
      - 所有资产必填字段：`id`、`uuid`、`name`、`type: "image"`、`url`、`prompt`；`description`为可选字段
      - 磁盘层 **`url`** 统一写 **`/assets/{type}/{UUID}.png`**（与 `FLOW_CONTRACT.md` **`assetNode`** 一致）
   - **禁止**删除 `data.assets.props`、`data.assets.audio` 中已有条目；**禁止**将 imgbb 公网 URL 写入 `assetNode` 的 `url`。
9. 若 **`episode/image/`** 资产已生成但未完成 `assetNode` 合并写回即宣称资产图片生成阶段交付完成 → **视为阶段未完成**。
