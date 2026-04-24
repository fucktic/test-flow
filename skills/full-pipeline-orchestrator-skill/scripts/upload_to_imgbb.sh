#!/bin/bash
# imgbb上传工具：上传本地图片到imgbb，返回永久有效公网 URL。
# 主流程约定：视频阶段在「每镜视频任务前」对本镜所需本地图调用本脚本并刷新 manifest，不依赖图片阶段是否曾上传。
# 特性：自动校验图片可访问性，校验通过才返回URL，无自动重试
# 用法：./upload_to_imgbb.sh <本地图片路径> <imgbb_api_key> [项目目录（可选，用于记录日志）]

upload_imgbb_single() {
    local image_path="$1"
    local api_key="$2"
    local project_dir="${3:-}"
    local start_time=$(date +%s%3N)
    local trace_id=$(uuidgen)
    
    if [[ ! -f "$image_path" ]]; then
        echo "错误：文件不存在 $image_path" >&2
        [[ -n "$project_dir" ]] && TRACE_ID="$trace_id" ERROR_MESSAGE="文件不存在：$image_path" "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "文件不存在：$image_path" 0
        return 1
    fi

    # 记录请求日志（如果指定了项目目录）
    if [[ -n "$project_dir" ]]; then
        local request_headers='{"Content-Type": "multipart/form-data"}'
        local request_body="{\"image_path\": \"$image_path\", \"expiration\": 3600}"
        TRACE_ID="$trace_id" API_NAME="imgbb图片上传" REQUEST_METHOD="POST" REQUEST_URL="https://api.imgbb.com/1/upload" REQUEST_HEADERS="$request_headers" REQUEST_BODY="$request_body" REQUEST_TIMEOUT="30" \
        "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_request" "上传本地文件：$image_path"
    fi

    # 执行上传请求
    local response=$(curl -s -X POST "https://api.imgbb.com/1/upload" \
        --connect-timeout 10 --max-time 30 \
        -F "key=$api_key" \
        -F "image=@$image_path")
    local end_time=$(date +%s%3N)
    local duration_ms=$(( (end_time - start_time) / 1000 ))
    
    # 基础校验：响应合法性与状态码
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "error")
    local success=$(echo "$response" | jq -r '.success' 2>/dev/null || echo "false")
    
    # 严格检查：imgbb 有时会返回 status 200 但 success 为 false
    if [[ "$status" != "200" || "$success" != "true" ]]; then
        local error=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null || echo "响应解析失败")
        echo "上传失败：status=$status, success=$success, 错误=$error" >&2
        # 记录失败日志
        if [[ -n "$project_dir" ]]; then
            TRACE_ID="$trace_id" HTTP_STATUS="$status" ERROR_MESSAGE="$error" RESPONSE_BODY="$response" \
            "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "上传失败：$error" "$duration_ms"
        fi
        return 1
    fi

    local url=$(echo "$response" | jq -r '.data.url' 2>/dev/null || echo "")
    if [[ -z "$url" || "$url" == "null" || ! "$url" =~ ^https://i\.ibb\.co/.*$ ]]; then
        local error="返回URL非法：$url"
        echo "上传失败：$error" >&2
        if [[ -n "$project_dir" ]]; then
            TRACE_ID="$trace_id" HTTP_STATUS="$status" ERROR_MESSAGE="$error" RESPONSE_BODY="$response" \
            "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "上传失败：$error" "$duration_ms"
        fi
        return 1
    fi

    # 强校验：图片实际可访问性
    local head_response=$(curl -s -I --max-time 5 "$url" 2>/dev/null)
    local http_code=$(echo "$head_response" | grep -E '^HTTP/' | awk '{print $2}')
    local content_type=$(echo "$head_response" | grep -i '^Content-Type:' | awk '{print $2}' | tr '[:upper:]' '[:lower:]')
    local content_length=$(echo "$head_response" | grep -i '^Content-Length:' | awk '{print $2}')
    
    # 1. HTTP 状态码检查
    if [[ ! "$http_code" =~ ^(200|302|304)$ ]]; then
        local error="图片无法访问，HTTP状态码: $http_code"
        echo "校验失败：$error，URL: $url" >&2
        if [[ -n "$project_dir" ]]; then
            TRACE_ID="$trace_id" HTTP_STATUS="$http_code" ERROR_MESSAGE="$error" \
            "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "校验失败：$error" "$duration_ms"
        fi
        return 1
    fi

    # 2. Content-Type 检查 (必须是 image)
    if [[ ! "$content_type" =~ ^image/ ]]; then
        local error="返回的不是图片，Content-Type: $content_type"
        echo "校验失败：$error，URL: $url" >&2
        if [[ -n "$project_dir" ]]; then
            TRACE_ID="$trace_id" HTTP_STATUS="$http_code" ERROR_MESSAGE="$error" \
            "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "校验失败：$error" "$duration_ms"
        fi
        return 1
    fi

    # 3. Content-Length 检查 (防止占位图/空文件)
    if [[ -n "$content_length" && "$content_length" -lt 1000 ]]; then
        local error="图片过小（可能是占位图/损坏），Content-Length: $content_length"
        echo "校验失败：$error，URL: $url" >&2
        if [[ -n "$project_dir" ]]; then
            TRACE_ID="$trace_id" HTTP_STATUS="$http_code" ERROR_MESSAGE="$error" \
            "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_fail" "校验失败：$error" "$duration_ms"
        fi
        return 1
    fi

    # 记录成功响应日志
    if [[ -n "$project_dir" ]]; then
        local response_body=$(echo "$response" | jq -c .)
        TRACE_ID="$trace_id" HTTP_STATUS="$status" RESPONSE_BODY="$response_body" \
        "${BASH_SOURCE[0]%/*}/log_event.sh" "$project_dir" "资源上传" "imgbb上传" "api_call_response" "上传成功，URL：$url" "$duration_ms"
    fi

    echo "$url"
    return 0
}

upload_imgbb() {
    local image_path="$1"
    local api_key="$2"
    local project_dir="${3:-}"
    
    upload_imgbb_single "$image_path" "$api_key" "$project_dir"
    if [[ $? -ne 0 ]]; then
        echo "上传失败，请检查配置" >&2
        return 1
    fi
    return 0
}

# 测试示例
if [[ "$0" == "${BASH_SOURCE[0]}" ]]; then
    if [[ $# -lt 2 || $# -gt 3 ]]; then
        echo "用法：./upload_to_imgbb.sh <本地图片路径> <imgbb_api_key> [项目目录]" >&2
        exit 2
    fi
    upload_imgbb "$1" "$2" "${3:-}"
    exit $?
fi