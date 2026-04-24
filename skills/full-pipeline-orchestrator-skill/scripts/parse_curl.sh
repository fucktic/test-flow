#!/bin/bash
# curl解析工具：将完整curl命令解析为标准化API配置JSON
# 用法：./parse_curl.sh "<完整curl命令>"

parse_curl() {
    local curl_cmd="$1"
    local config_json="{}"

    # 清理curl命令：移除反斜杠、换行、多余空格，统一为单行命令
    local clean_cmd=$(echo "$curl_cmd" | tr -d '\\' | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')

    # 提取method
    local method=$(echo "$clean_cmd" | grep -oE '-X\s+[A-Z]+' | awk '{print $2}' | tr '[:lower:]' '[:upper:]')
    if [[ -z "$method" ]]; then
        method="GET"
    fi
    config_json=$(echo "$config_json" | jq --arg m "$method" '.method = $m')

    # 提取endpoint
    local url=$(echo "$clean_cmd" | grep -oE "https?://[^'\" ]+" | head -1)
    config_json=$(echo "$config_json" | jq --arg u "$url" '.endpoint = $u')

    # 提取headers
    local headers="{}"
    while read -r header; do
        if [[ -n "$header" ]]; then
            local key=$(echo "$header" | cut -d':' -f1 | xargs)
            local value=$(echo "$header" | cut -d':' -f2- | xargs)
            headers=$(echo "$headers" | jq --arg k "$key" --arg v "$value" '.[$k] = $v')
        fi
    done < <(echo "$clean_cmd" | grep -oE '-H\s*"[^"]+"' | sed 's/-H\s*"//;s/"$//')
    config_json=$(echo "$config_json" | jq --argjson h "$headers" '.headers = $h')

    # 提取body模板（POST时）
    if [[ "$method" == "POST" ]]; then
        local body=$(echo "$clean_cmd" | grep -oE '-d\s*'\''[^'\'']+'\'' | sed 's/-d\s*'\''//;s'\''$//' | head -1)
        if [[ -z "$body" ]]; then
            body=$(echo "$clean_cmd" | grep -oE '-d\s*"[^"]+"' | sed 's/-d\s*"//;s"$//' | head -1)
        fi
        # 支持--body参数
        if [[ -z "$body" ]]; then
            body=$(echo "$clean_cmd" | grep -oE '--body\s*'\''[^'\'']+'\'' | sed 's/--body\s*'\''//;s'\''$//' | head -1)
        fi
        if [[ -z "$body" ]]; then
            body=$(echo "$clean_cmd" | grep -oE '--body\s*"[^"]+"' | sed 's/--body\s*"//;s"$//' | head -1)
        fi
        if [[ -n "$body" ]]; then
            # 替换实际值为占位符
            body=$(echo "$body" | jq 'walk(if type == "string" then
                if test("^sk-") then "{api_key}"
                elif test("nano-banana|doubao-seedance") then "{model_id}"
                elif test("(提示词|prompt|首帧|尾帧|人物|场景)") then "{prompt}"
                else . end
            else . end)' 2>/dev/null || echo "$body")
            config_json=$(echo "$config_json" | jq --argjson b "$(echo "$body" | jq -c .)" '.body_template = $b')
        fi
    fi

    # 生成脱敏后的 raw_curl_template
    # 1. 对 -F key= 进行脱敏
    local raw_curl=$(echo "$clean_cmd" | sed -E 's/(-F key=)[^ ]+/\1{API_KEY}/g')
    # 2. 对 Authorization Header 脱敏
    raw_curl=$(echo "$raw_curl" | sed -E 's/(Authorization:[[:space:]]*Bearer[[:space:]]*)[A-Za-z0-9_-]+/\1{API_KEY}/i')
    # 3. 对 x-api-key Header 脱敏
    raw_curl=$(echo "$raw_curl" | sed -E 's/(x-api-key:[[:space:]]*)[A-Za-z0-9_-]+/\1{API_KEY}/i')
    # 4. 对 Body 中的 sk- 开头 Key 脱敏 (已在上面处理过，这里再次确保)
    raw_curl=$(echo "$raw_curl" | sed -E 's/"sk-[A-Za-z0-9_-]+"/"{api_key}"/g')
    
    config_json=$(echo "$config_json" | jq --arg t "$raw_curl" '.raw_curl_template = $t')

    # 自动生成响应解析规则（默认适配常用API格式）
    local response='{
        "image_url_jq": ".data[0].url // .data.url // .url",
        "task_id_jq": ".id // .task_id",
        "video_url_jq": ".content.video_url // .video_url // .data.video_url",
        "status_jq": ".status // .data.status"
    }'
    config_json=$(echo "$config_json" | jq --argjson r "$(echo "$response" | jq -c .)" '.response = $r')

    echo "$config_json"
}

# 测试示例
if [[ "$0" == "${BASH_SOURCE[0]}" ]]; then
    parse_curl "$1"
fi