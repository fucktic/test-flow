#!/usr/bin/env bash
# Pipeline logging helper — append one JSONL line to the project's run log.
# Usage:
#   基础日志: log_event <project_dir> <stage> <step> <event> <detail> [duration_ms]
#   API请求日志: TRACE_ID=<uuid> API_NAME=<api名> REQUEST_METHOD=<GET/POST> REQUEST_URL=<url> REQUEST_HEADERS=<headers> REQUEST_BODY=<body> REQUEST_TIMEOUT=<超时秒> log_event.sh <project_dir> <stage> <step> api_call_request <detail>
#   API响应日志: TRACE_ID=<uuid> HTTP_STATUS=<状态码> RESPONSE_HEADERS=<headers> RESPONSE_BODY=<响应体/响应体路径> log_event.sh <project_dir> <stage> <step> api_call_response <detail> [duration_ms]
#   API失败日志: TRACE_ID=<uuid> HTTP_STATUS=<状态码> ERROR_MESSAGE=<错误详情> log_event.sh <project_dir> <stage> <step> api_call_fail <detail> [duration_ms]
#
# Fields:
#   stage       — 阶段名，如 "资产图片生成"
#   step        — 子步骤，如 "调用生图API"
#   event       — 事件类型: stage_start/stage_complete/api_call_request/api_call_response/
#                 api_call_fail/upload_start/upload_success/upload_fail/
#                 flow_write/poll_status/error
#   detail      — 人类可读详情（会被 jq 转义）
#   duration_ms — 耗时毫秒数（可选，传入 null 或省略则记 null）
#
# 环境变量（API调用专用，可选）:
#   TRACE_ID          — API调用唯一标识，用于关联请求和响应，建议用uuidgen生成
#   API_NAME          — 可读的API名称，如 "人物资产生图" "视频任务提交" "imgbb资源上传"
#   REQUEST_METHOD    — HTTP请求方法
#   REQUEST_URL       — 请求URL
#   REQUEST_HEADERS   — 脱敏后的请求头，JSON格式
#   REQUEST_BODY      — 脱敏后的请求体，JSON格式/或者大内容存路径
#   REQUEST_TIMEOUT   — 请求超时设置，秒
#   HTTP_STATUS       — HTTP响应状态码
#   RESPONSE_HEADERS  — 响应头，JSON格式
#   RESPONSE_BODY     — 响应体，或者大内容的文件存储路径
#   ERROR_MESSAGE     — 失败时的错误详情

set -euo pipefail

PROJECT_DIR="${1:?用法: log_event <project_dir> <stage> <step> <event> <detail> [duration_ms]}"
STAGE="${2:?缺少 stage}"
STEP="${3:?缺少 step}"
EVENT="${4:?缺少 event}"
DETAIL="${5:?缺少 detail}"
DURATION="${6:-null}"

LOG_FILE="${PROJECT_DIR}/pipeline-run.log.jsonl"

# Mask any sk-xxx or Bearer/x-api-key tokens in all text fields
mask_sensitive() {
  echo "$1" | sed -E 's/(sk-|Bearer |x-api-key: )[A-Za-z0-9_-]+/\1{MASKED}/gi'
}

MASKED_DETAIL=$(mask_sensitive "$DETAIL")

# 基础日志JSON
BASE_JSON=$(jq -cn \
  --arg ts "$(date -Iseconds 2>/dev/null || python3 -c 'from datetime import datetime,timezone;print(datetime.now(timezone.utc).isoformat())')" \
  --arg stage "$STAGE" \
  --arg step "$STEP" \
  --arg event "$EVENT" \
  --arg detail "$MASKED_DETAIL" \
  --argjson duration_ms "$DURATION" \
  '{ts:$ts, stage:$stage, step:$step, event:$event, detail:$detail, duration_ms:($duration_ms)}'
)

# 合并API相关的环境变量字段（如果存在）
FINAL_JSON="$BASE_JSON"
if [[ -n "${TRACE_ID:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$TRACE_ID")" '. + {trace_id: $v}'); fi
if [[ -n "${API_NAME:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$API_NAME")" '. + {api_name: $v}'); fi
if [[ -n "${REQUEST_METHOD:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$REQUEST_METHOD")" '. + {request_method: $v}'); fi
if [[ -n "${REQUEST_URL:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$REQUEST_URL")" '. + {request_url: $v}'); fi
if [[ -n "${REQUEST_HEADERS:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --argjson v "$(mask_sensitive "$REQUEST_HEADERS" | jq -c .)" '. + {request_headers: $v}') 2>/dev/null || true; fi
if [[ -n "${REQUEST_BODY:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$REQUEST_BODY")" '. + {request_body: $v}'); fi
if [[ -n "${REQUEST_TIMEOUT:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --argjson v "$REQUEST_TIMEOUT" '. + {request_timeout: $v}') 2>/dev/null || true; fi
if [[ -n "${HTTP_STATUS:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --argjson v "$HTTP_STATUS" '. + {http_status: $v}') 2>/dev/null || true; fi
if [[ -n "${RESPONSE_HEADERS:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --argjson v "$(mask_sensitive "$RESPONSE_HEADERS" | jq -c .)" '. + {response_headers: $v}') 2>/dev/null || true; fi
if [[ -n "${RESPONSE_BODY:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$RESPONSE_BODY")" '. + {response_body: $v}'); fi
if [[ -n "${ERROR_MESSAGE:-}" ]]; then FINAL_JSON=$(echo "$FINAL_JSON" | jq --arg v "$(mask_sensitive "$ERROR_MESSAGE")" '. + {error_message: $v}'); fi

# 写入日志
echo "$FINAL_JSON" >> "$LOG_FILE"
