#!/bin/bash
set -euo pipefail

# 用法：validate_manifest.sh <manifest_file_path> <prompt_file_path>
# 或者：validate_manifest.sh <manifest_file_path> <uuid_list (逗号分隔)>

if [ $# -lt 2 ]; then
  echo "Usage: $0 <manifest_file_path> <prompt_file_path|uuid_list>"
  exit 1
fi

MANIFEST_FILE="$1"
INPUT="$2"

# 校验manifest文件存在
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "【Manifest校验失败】Manifest文件不存在: $MANIFEST_FILE"
  exit 1
fi

# 校验manifest是合法JSON
if ! jq empty "$MANIFEST_FILE" > /dev/null 2>&1; then
  echo "【Manifest校验失败】Manifest文件不是合法JSON: $MANIFEST_FILE"
  exit 1
fi

# 校验必填字段存在
REQUIRED_FIELDS=("_uuid_map" "urls")
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e "has(\"$field\")" "$MANIFEST_FILE" > /dev/null 2>&1; then
    echo "【Manifest校验失败】Manifest缺少必填字段: $field"
    exit 1
  fi
done

# 检查是否有上传时间字段，用于过期检测
HAS_UPLOAD_TIMES=$(jq -e "has(\"upload_times\")" "$MANIFEST_FILE" > /dev/null 2>&1 && echo "true" || echo "false")
CURRENT_TIMESTAMP=$(date +%s)
EXPIRE_SECONDS=$((30*24*3600)) # 30天过期
WARNINGS=()

# 提取需要校验的UUID列表
UUIDS=()
if [[ "$INPUT" == *","* ]]; then
  # 输入是逗号分隔的UUID列表
  IFS=',' read -ra UUIDS <<< "$INPUT"
else
  # 输入是提示词文件路径，从中提取所有UUID
  if [ ! -f "$INPUT" ]; then
    echo "【Manifest校验失败】提示词文件不存在: $INPUT"
    exit 1
  fi
  # 提取所有@<UUID>xxx格式中的UUID
  UUIDS=($(grep -oE '@[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(characters|scenes|props|assets)' "$INPUT" | sed 's/@\([^a-z]*\).*/\1/'))
fi

# 去重UUID
UUIDS=($(echo "${UUIDS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

# 校验每个UUID在_uuid_map中存在，且对应的URL合法，同时检测过期URL
ERRORS=()
for uuid in "${UUIDS[@]}"; do
  if [ -z "$uuid" ]; then
    continue
  fi
  # 检查UUID在_uuid_map中存在
  if ! jq -e "._uuid_map.has(\"$uuid\")" "$MANIFEST_FILE" > /dev/null 2>&1; then
    ERRORS+=("UUID $uuid 不存在于manifest的_uuid_map中")
    continue
  fi
  # 获取URL
  url=$(jq -r "._uuid_map[\"$uuid\"]" "$MANIFEST_FILE")
  # 校验URL是合法的imgbb URL
  if [[ ! "$url" =~ ^https://i\.ibb\.co/ ]]; then
    ERRORS+=("UUID $uuid 对应的URL不是有效的imgbb URL: $url")
    continue
  fi
  
  # 检测URL是否过期（仅当有upload_times字段时）
  if [[ "$HAS_UPLOAD_TIMES" == "true" ]]; then
    # 根据URL找到对应的文件路径
    path=$(jq -r ".urls | to_entries[] | select(.value == \"$url\") | .key" "$MANIFEST_FILE" 2>/dev/null || echo "")
    if [[ -n "$path" ]]; then
      # 获取上传时间戳
      upload_time=$(jq -r ".upload_times[\"$path\"]" "$MANIFEST_FILE" 2>/dev/null || echo "")
      if [[ "$upload_time" =~ ^[0-9]+$ ]]; then
        # 计算是否超过30天
        diff=$((CURRENT_TIMESTAMP - upload_time))
        if [[ $diff -gt $EXPIRE_SECONDS ]]; then
          days=$((diff / 86400))
          WARNINGS+=("资源 $path 对应的URL已过期 $days 天，建议重新上传: $url")
        fi
      fi
    fi
  fi
done

# 检查是否有错误
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "【Manifest校验失败】发现以下问题："
  for err in "${ERRORS[@]}"; do
    echo "- $err"
  done
  exit 1
fi

# 输出警告信息（不影响校验结果）
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "【Manifest校验警告】发现以下潜在问题："
  for warn in "${WARNINGS[@]}"; do
    echo "- $warn"
  done
fi

echo "【Manifest校验通过】所有引用的资源URL均合法有效"
exit 0
