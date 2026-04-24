#!/usr/bin/env bash
# 配置驱动视频生成：从 .config.json 读取 video_api_profile 与 video_api_key，
# 按用户提供的 curl 契约创建任务 / 轮询 / 下载；目标路径由 jobs JSON（如各分镜 video.mp4）指定
set -euo pipefail

CREATE_MAX_TRY=3
POLL_INTERVAL_DEFAULT=10
POLL_MAX_WAIT_DEFAULT=300

usage() {
  echo "用法: $0 --project-root <项目根目录> --jobs <video_jobs.json>" >&2
  echo "   或: $0 --config <.config.json 路径> --jobs <video_jobs.json>" >&2
  exit 1
}

abs_path() {
  local p="$1"
  if [[ ! "$p" = /* ]]; then
    p="$(pwd)/$p"
  fi
  local d b
  d="$(cd "$(dirname "$p")" && pwd)"
  b="$(basename "$p")"
  echo "$d/$b"
}

trim() {
  echo "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

is_bad_value() {
  local lc
  lc="$(trim "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lc" in
  "" | 请填写 | 待填写 | 待填 | todo | changeme | your_api_key | api_key_here | xxx | null | undefined) return 0 ;;
  *) return 1 ;;
  esac
}

fail_json() {
  local message="$1"
  local model="${2:-}"
  jq -n \
    --arg status "failed" \
    --arg message "$message" \
    --arg model "$model" \
    '{status:$status,message:$message,model:$model,shots:[]}' | jq .
  exit 1
}

extract_with_selector() {
  local json="$1"
  local selector="$2"
  if [[ -z "${selector:-}" ]]; then
    echo ""
    return 0
  fi
  echo "$json" | jq -r "$selector // empty" 2>/dev/null || true
}

json_array_contains() {
  local array_json="$1"
  local value="$2"
  echo "$array_json" | jq -e --arg v "$value" 'index($v) != null' >/dev/null 2>&1
}

render_string() {
  local template="$1"
  local task_id="$2"
  local prompt="$3"
  local first_frame_url="$4"
  local last_frame_url="$5"
  local duration="$6"
  local ratio="$7"
  local watermark="$8"

  jq -nr \
    --arg template "$template" \
    --arg api_key "$API_KEY" \
    --arg model_id "$MODEL_ID" \
    --arg prompt "$prompt" \
    --arg first_frame_url "$first_frame_url" \
    --arg last_frame_url "$last_frame_url" \
    --arg duration "$duration" \
    --arg ratio "$ratio" \
    --arg watermark "$watermark" \
    --arg task_id "$task_id" \
    '$template
    | gsub("\\{api_key\\}"; $api_key)
    | gsub("\\{model_id\\}"; $model_id)
    | gsub("\\{prompt\\}"; $prompt)
    | gsub("\\{first_frame_url\\}"; $first_frame_url)
    | gsub("\\{last_frame_url\\}"; $last_frame_url)
    | gsub("\\{duration\\}"; $duration)
    | gsub("\\{ratio\\}"; $ratio)
    | gsub("\\{watermark\\}"; $watermark)
    | gsub("\\{task_id\\}"; $task_id)'
}

render_json_template() {
  local template_json="$1"
  local task_id="$2"
  local prompt="$3"
  local first_frame_url="$4"
  local last_frame_url="$5"
  local duration="$6"
  local ratio="$7"
  local watermark="$8"

  echo "$template_json" | jq -c \
    --arg api_key "$API_KEY" \
    --arg model_id "$MODEL_ID" \
    --arg prompt "$prompt" \
    --arg first_frame_url "$first_frame_url" \
    --arg last_frame_url "$last_frame_url" \
    --arg ratio "$ratio" \
    --arg task_id "$task_id" \
    --argjson duration "$duration" \
    --argjson watermark "$watermark" '
    walk(
      if type == "string" then
        if . == "{duration}" then $duration
        elif . == "{watermark}" then $watermark
        elif . == "{api_key}" then $api_key
        elif . == "{model_id}" then $model_id
        elif . == "{prompt}" then $prompt
        elif . == "{first_frame_url}" then $first_frame_url
        elif . == "{last_frame_url}" then $last_frame_url
        elif . == "{ratio}" then $ratio
        elif . == "{task_id}" then $task_id
        else
          gsub("\\{api_key\\}"; $api_key)
          | gsub("\\{model_id\\}"; $model_id)
          | gsub("\\{prompt\\}"; $prompt)
          | gsub("\\{first_frame_url\\}"; $first_frame_url)
          | gsub("\\{last_frame_url\\}"; $last_frame_url)
          | gsub("\\{ratio\\}"; $ratio)
          | gsub("\\{task_id\\}"; $task_id)
        end
      else .
      end
    )'
}

build_header_args() {
  local headers_json="$1"
  HEADER_ARGS=()
  while IFS=$'\t' read -r key value; do
    [[ -n "${key:-}" ]] || continue
    HEADER_ARGS+=(-H "$key: $value")
  done < <(echo "$headers_json" | jq -r 'to_entries[]? | [.key, (.value | tostring)] | @tsv')
}

CONFIG_PATH=""
PROJECT_ROOT=""
JOBS_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --config)
    CONFIG_PATH="$2"
    shift 2
    ;;
  --project-root)
    PROJECT_ROOT="$2"
    shift 2
    ;;
  --jobs)
    JOBS_PATH="$2"
    shift 2
    ;;
  -h | --help)
    usage
    ;;
  *)
    echo "未知参数: $1" >&2
    usage
    ;;
  esac
done

[[ -n "${JOBS_PATH:-}" ]] || usage

if [[ -z "${CONFIG_PATH:-}" ]]; then
  [[ -n "${PROJECT_ROOT:-}" ]] || usage
  CONFIG_PATH="$(abs_path "$PROJECT_ROOT")/.config.json"
else
  CONFIG_PATH="$(abs_path "$CONFIG_PATH")"
fi
JOBS_PATH="$(abs_path "$JOBS_PATH")"

if ! command -v jq >/dev/null 2>&1; then
  fail_json "须安装 jq（如 brew install jq）"
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  fail_json "未找到配置: $CONFIG_PATH"
fi


API_KEY="$(jq -r '.video_api_key // ""' "$CONFIG_PATH")"
if is_bad_value "$API_KEY"; then
  fail_json "video_api_key 无效或为占位符，请检查 .config.json"
fi

PROFILE_JSON="$(jq -c '.video_api_profile // null' "$CONFIG_PATH")"
if [[ -z "$PROFILE_JSON" || "$PROFILE_JSON" == "null" ]]; then
  fail_json "缺少 video_api_profile，请先根据用户提供的视频 curl 示例写入 .config.json"
fi
if ! echo "$PROFILE_JSON" | jq -e 'type == "object"' >/dev/null 2>&1; then
  fail_json "video_api_profile 必须是 object"
fi

MODEL_ID="$(jq -r '.video_model_id // ""' "$CONFIG_PATH")"
CREATE_ENDPOINT_TEMPLATE="$(echo "$PROFILE_JSON" | jq -r '.endpoint // ""')"
CREATE_METHOD="$(echo "$PROFILE_JSON" | jq -r '.method // ""' | tr '[:lower:]' '[:upper:]')"
CREATE_HEADERS_TEMPLATE_JSON="$(echo "$PROFILE_JSON" | jq -c '.headers // {}')"
BODY_TEMPLATE_JSON="$(echo "$PROFILE_JSON" | jq -c '.body_template // null')"
POLL_URL_TEMPLATE="$(echo "$PROFILE_JSON" | jq -r '.poll_url_template // ""')"
POLL_METHOD="$(echo "$PROFILE_JSON" | jq -r '.poll_method // ""' | tr '[:lower:]' '[:upper:]')"
POLL_HEADERS_TEMPLATE_JSON="$(echo "$PROFILE_JSON" | jq -c '.poll_headers // {}')"
TASK_ID_JQ="$(echo "$PROFILE_JSON" | jq -r '.response.task_id_jq // ""')"
VIDEO_URL_JQ="$(echo "$PROFILE_JSON" | jq -r '.response.video_url_jq // ""')"
STATUS_JQ="$(echo "$PROFILE_JSON" | jq -r '.response.status_jq // ""')"
ERROR_MESSAGE_JQ="$(echo "$PROFILE_JSON" | jq -r '.response.error_message_jq // ""')"
SUCCESS_VALUES_JSON="$(echo "$PROFILE_JSON" | jq -c '.success_status_values // []')"
FAILURE_VALUES_JSON="$(echo "$PROFILE_JSON" | jq -c '.failure_status_values // []')"
POLL_INTERVAL="$(echo "$PROFILE_JSON" | jq -r '.poll_interval_seconds // empty')"
POLL_MAX_WAIT="$(echo "$PROFILE_JSON" | jq -r '.poll_max_wait_seconds // empty')"

[[ -n "$CREATE_ENDPOINT_TEMPLATE" ]] || fail_json "video_api_profile.endpoint 不能为空" "$MODEL_ID"
[[ -n "$CREATE_METHOD" ]] || fail_json "video_api_profile.method 不能为空" "$MODEL_ID"
[[ -n "$VIDEO_URL_JQ" || -n "$TASK_ID_JQ" ]] || fail_json "video_api_profile.response 至少要提供 video_url_jq 或 task_id_jq" "$MODEL_ID"

if [[ -z "$POLL_INTERVAL" || "$POLL_INTERVAL" == "null" ]]; then
  POLL_INTERVAL="$POLL_INTERVAL_DEFAULT"
fi
if [[ -z "$POLL_MAX_WAIT" || "$POLL_MAX_WAIT" == "null" ]]; then
  POLL_MAX_WAIT="$POLL_MAX_WAIT_DEFAULT"
fi

PROFILE_TEXT="$(printf '%s\n%s\n%s\n%s\n%s' \
  "$CREATE_ENDPOINT_TEMPLATE" \
  "$CREATE_HEADERS_TEMPLATE_JSON" \
  "$BODY_TEMPLATE_JSON" \
  "$POLL_URL_TEMPLATE" \
  "$POLL_HEADERS_TEMPLATE_JSON")"
if echo "$PROFILE_TEXT" | grep -q '{model_id}'; then
  if is_bad_value "$MODEL_ID"; then
    fail_json "video_api_profile 使用了 {model_id} 占位符，但 .config.json.video_model_id 缺失或非法"
  fi
fi

if [[ -n "$TASK_ID_JQ" ]]; then
  [[ -n "$POLL_URL_TEMPLATE" ]] || fail_json "异步视频接口缺少 poll_url_template" "$MODEL_ID"
  [[ -n "$POLL_METHOD" ]] || fail_json "异步视频接口缺少 poll_method" "$MODEL_ID"
  [[ -n "$STATUS_JQ" ]] || fail_json "异步视频接口缺少 response.status_jq" "$MODEL_ID"
  if [[ "$(echo "$SUCCESS_VALUES_JSON" | jq 'length')" -eq 0 ]]; then
    fail_json "异步视频接口缺少 success_status_values" "$MODEL_ID"
  fi
  if [[ "$(echo "$FAILURE_VALUES_JSON" | jq 'length')" -eq 0 ]]; then
    fail_json "异步视频接口缺少 failure_status_values" "$MODEL_ID"
  fi
fi

if [[ ! -f "$JOBS_PATH" ]]; then
  fail_json "未找到 jobs: $JOBS_PATH" "$MODEL_ID"
fi

SAVE_DIR="$(jq -r '.save_dir' "$JOBS_PATH")"
EPISODE_ID="$(jq -r '.episode_id' "$JOBS_PATH")"
SHOT_COUNT="$(jq '.shots | length' "$JOBS_PATH")"

if [[ -z "$SAVE_DIR" || "$SAVE_DIR" == "null" ]] || [[ -z "$EPISODE_ID" || "$EPISODE_ID" == "null" ]] || [[ "$SHOT_COUNT" -lt 1 ]]; then
  fail_json "jobs 须含非空 save_dir、episode_id 与 shots 数组" "$MODEL_ID"
fi

SAVE_DIR="$(abs_path "$SAVE_DIR")"
FRAG_DIR="$SAVE_DIR/片段"
mkdir -p "$FRAG_DIR"

RESULTS_JSON="[]"
fail_any=0
ok_any=0

for ((i = 0; i < SHOT_COUNT; i++)); do
  shot="$(jq -c ".shots[$i]" "$JOBS_PATH")"
  shot_id="$(echo "$shot" | jq -r --arg def "P$((i + 1))" '.shot_id // $def')"
  text="$(echo "$shot" | jq -r '.text // ""')"
  fu="$(echo "$shot" | jq -r '.first_frame_url // ""')"
  lu="$(echo "$shot" | jq -r '.last_frame_url // ""')"
  duration="$(echo "$shot" | jq -r 'if (.duration | type) == "number" then .duration else (.duration | tonumber? // 5) end')"
  ratio="$(echo "$shot" | jq -r '.ratio // ""')"
  watermark="$(echo "$shot" | jq -c '.watermark // false')"

  one="$(jq -n --arg sid "$shot_id" '{shot_id:$sid,status:"failed",task_id:"",video_url:null,save_path:"",error:""}')"

  if [[ -z "${text// }" ]]; then
    one="$(echo "$one" | jq --arg e '缺少 text' '.error=$e')"
    RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
    fail_any=1
    continue
  fi

  if [[ -z "$fu" || "$fu" != https://* ]]; then
    one="$(echo "$one" | jq --arg e '缺少有效的 first_frame_url（须为 https）' '.error=$e')"
    RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
    fail_any=1
    continue
  fi

  if [[ -z "$lu" || "$lu" != https://* ]]; then
    one="$(echo "$one" | jq --arg e '缺少有效的 last_frame_url（须为 https）' '.error=$e')"
    RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
    fail_any=1
    continue
  fi

  create_endpoint="$(render_string "$CREATE_ENDPOINT_TEMPLATE" "" "$text" "$fu" "$lu" "$duration" "$ratio" "$watermark")"
  create_headers="$(render_json_template "$CREATE_HEADERS_TEMPLATE_JSON" "" "$text" "$fu" "$lu" "$duration" "$ratio" "$watermark")"
  create_body=""
  if [[ "$BODY_TEMPLATE_JSON" != "null" ]]; then
    create_body="$(render_json_template "$BODY_TEMPLATE_JSON" "" "$text" "$fu" "$lu" "$duration" "$ratio" "$watermark")"
  fi

  resp=""
  task_id=""
  create_video_url=""
  try=1
  while [[ $try -le $CREATE_MAX_TRY ]]; do
    if [[ $try -gt 1 ]]; then
      sleep $((try * 5))
    fi
    curl_args=(-sS -X "$CREATE_METHOD" "$create_endpoint")
    build_header_args "$create_headers"
    curl_args+=("${HEADER_ARGS[@]}")
    if [[ -n "$create_body" ]]; then
      curl_args+=(-d "$create_body")
    fi
    if ! resp="$(curl "${curl_args[@]}")"; then
      try=$((try + 1))
      continue
    fi
    task_id="$(extract_with_selector "$resp" "$TASK_ID_JQ")"
    create_video_url="$(extract_with_selector "$resp" "$VIDEO_URL_JQ")"
    if [[ -n "$create_video_url" && "$create_video_url" != "null" ]]; then
      break
    fi
    if [[ -n "$task_id" && "$task_id" != "null" ]]; then
      break
    fi
    try=$((try + 1))
  done

  if [[ -z "$task_id" || "$task_id" == "null" ]]; then
    task_id=""
  fi
  if [[ -z "$create_video_url" || "$create_video_url" == "null" ]]; then
    create_video_url=""
  fi

  save_path="$FRAG_DIR/${EPISODE_ID}-${shot_id}.mp4"
  one="$(echo "$one" | jq --arg t "$task_id" --arg p "$save_path" '.task_id=$t | .save_path=$p')"

  if [[ -n "$create_video_url" ]]; then
    one="$(echo "$one" | jq --arg u "$create_video_url" '.video_url=$u')"
    if curl -sS -L -o "$save_path" "$create_video_url"; then
      one="$(echo "$one" | jq '.status="success" | .error=""')"
      ok_any=1
    else
      one="$(echo "$one" | jq --arg e "下载视频失败" '.error=$e')"
      fail_any=1
    fi
    RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
    continue
  fi

  if [[ -z "$task_id" ]]; then
    err_msg="$(extract_with_selector "$resp" "$ERROR_MESSAGE_JQ")"
    if [[ -z "$err_msg" ]]; then
      err_msg="$(echo "$resp" | jq -c '.' 2>/dev/null || echo "$resp")"
    fi
    one="$(echo "$one" | jq --arg e "创建任务失败: $err_msg" '.error=$e')"
    RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
    fail_any=1
    continue
  fi

  poll_url="$(render_string "$POLL_URL_TEMPLATE" "$task_id" "$text" "$fu" "$lu" "$duration" "$ratio" "$watermark")"
  poll_headers="$(render_json_template "$POLL_HEADERS_TEMPLATE_JSON" "$task_id" "$text" "$fu" "$lu" "$duration" "$ratio" "$watermark")"

  start_ts=$(date +%s)
  pr=""
  st=""
  vurl=""
  poll_ok=0
  while true; do
    now=$(date +%s)
    if [[ $((now - start_ts)) -ge $POLL_MAX_WAIT ]]; then
      one="$(echo "$one" | jq --arg e "轮询超时（${POLL_MAX_WAIT}s）" '.error=$e')"
      break
    fi

    poll_args=(-sS -X "$POLL_METHOD" "$poll_url")
    build_header_args "$poll_headers"
    poll_args+=("${HEADER_ARGS[@]}")
    if ! pr="$(curl "${poll_args[@]}")"; then
      sleep "$POLL_INTERVAL"
      continue
    fi

    st="$(trim "$(extract_with_selector "$pr" "$STATUS_JQ")")"
    # 打印轮询进度
    echo "[$((now - start_ts))s] 任务${task_id}状态：${st:-处理中}" >&2
    if [[ -n "$st" ]] && json_array_contains "$SUCCESS_VALUES_JSON" "$st"; then
      vurl="$(extract_with_selector "$pr" "$VIDEO_URL_JQ")"
      if [[ -n "$vurl" && "$vurl" != "null" ]]; then
        poll_ok=1
      else
        one="$(echo "$one" | jq --arg e "任务成功但未解析到视频 URL" '.error=$e')"
      fi
      break
    fi

    if [[ -n "$st" ]] && json_array_contains "$FAILURE_VALUES_JSON" "$st"; then
      err_msg="$(extract_with_selector "$pr" "$ERROR_MESSAGE_JQ")"
      one="$(echo "$one" | jq --arg e "任务 $st: ${err_msg:-unknown}" '.error=$e')"
      break
    fi

    sleep "$POLL_INTERVAL"
  done

  if [[ "$poll_ok" -eq 1 ]]; then
    one="$(echo "$one" | jq --arg u "$vurl" '.video_url=$u')"
    if curl -sS -L -o "$save_path" "$vurl"; then
      one="$(echo "$one" | jq '.status="success" | .error=""')"
      ok_any=1
    else
      one="$(echo "$one" | jq --arg e "下载视频失败" '.error=$e')"
      fail_any=1
    fi
  else
    fail_any=1
  fi

  RESULTS_JSON="$(echo "$RESULTS_JSON" | jq --argjson o "$one" '. + [$o]')"
done

RESULTS_JSON="$(echo "$RESULTS_JSON" | jq 'sort_by(.shot_id)')"

if [[ "$ok_any" -eq 1 && "$fail_any" -eq 0 ]]; then
  status="success"
  msg="全部分镜片段已生成"
elif [[ "$ok_any" -eq 1 ]]; then
  status="partial"
  msg="部分分镜成功，详见各 shot 的 status/error"
else
  status="failed"
  msg="全部分镜失败"
fi

jq -n \
  --arg status "$status" \
  --arg msg "$msg" \
  --arg model "$MODEL_ID" \
  --argjson shots "$RESULTS_JSON" \
  '{status:$status,message:$msg,model:$model,shots:$shots}' | jq .

if [[ "$status" == "success" ]]; then
  exit 0
fi
if [[ "$status" == "partial" ]]; then
  exit 2
fi
exit 1
