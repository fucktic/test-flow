#!/usr/bin/env bash
# Validate runtime flow.json shape for project canvas compatibility.
# Usage: validate_flow_shape.sh [--strict] /path/to/flow.json [reference.json]
# Exit: 0 OK, 1 validation errors, 2 usage / bad files / jq errors

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JQ_RULES="$SCRIPT_DIR/validate_flow_shape.jq"
STRICT_MODE=0

usage() {
  echo "Usage: validate_flow_shape.sh [--strict] <path/to/flow.json> [reference.json]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT_MODE=1
      shift
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

TARGET="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

if ! command -v jq >/dev/null 2>&1; then
  echo "validate_flow_shape.sh: jq is required" >&2
  exit 2
fi

if [[ ! -f "$TARGET" ]]; then
  echo "Not a file: $TARGET" >&2
  exit 2
fi

if [[ ! -f "$JQ_RULES" ]]; then
  echo "Validation rules not found: $JQ_RULES" >&2
  exit 2
fi

if ! jq empty "$TARGET" 2>/dev/null; then
  echo "Invalid JSON: $TARGET" >&2
  exit 2
fi

OUT="$(jq -nr --slurpfile T "$TARGET" --argjson strict "$STRICT_MODE" -f "$JQ_RULES" 2>&1)" || {
  echo "$OUT" >&2
  exit 2
}

if [[ -n "$OUT" ]]; then
  echo "$OUT" >&2
  exit 1
fi

exit 0
