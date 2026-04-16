#!/usr/bin/env bash
# =============================================================
# Node Flow — One-click startup script (Linux / macOS)
# Usage:
#   ./start.sh          → development mode (hot reload)
#   ./start.sh prod     → production mode (build + start)
# =============================================================

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

MODE="${1:-dev}"

echo -e "${BLUE}"
echo "  ███╗   ██╗ ██████╗ ██████╗ ███████╗    ███████╗██╗      ██████╗ ██╗    ██╗"
echo "  ████╗  ██║██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██║     ██╔═══██╗██║    ██║"
echo "  ██╔██╗ ██║██║   ██║██║  ██║█████╗      █████╗  ██║     ██║   ██║██║ █╗ ██║"
echo "  ██║╚██╗██║██║   ██║██║  ██║██╔══╝      ██╔══╝  ██║     ██║   ██║██║███╗██║"
echo "  ██║ ╚████║╚██████╔╝██████╔╝███████╗    ██║     ███████╗╚██████╔╝╚███╔███╔╝"
echo "  ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ "
echo -e "${NC}"

# ── Check Node.js ─────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Please install Node.js >= 20: https://nodejs.org${NC}"
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]) < 20 ? 1 : 0)" && echo "ok" || echo "old")
if [[ "$NODE_VER" == "old" ]]; then
  echo -e "${YELLOW}⚠ Node.js $(node -v) detected. Node.js >= 20 is recommended.${NC}"
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── Install dependencies ───────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
  npm install
  echo -e "${GREEN}✓ Dependencies installed.${NC}"
else
  echo -e "${GREEN}✓ node_modules found, skipping install.${NC}"
fi

# ── Create data directories ────────────────────────────────────
mkdir -p projects skills
echo -e "${GREEN}✓ Data directories ready (projects/, skills/).${NC}"

# ── Start ─────────────────────────────────────────────────────
if [[ "$MODE" == "prod" ]]; then
  echo -e "\n${YELLOW}🔨 Building production bundle...${NC}"
  npm run build
  echo -e "\n${GREEN}✓ Build complete. Starting production server...${NC}"
  echo -e "${BLUE}➜ Open http://localhost:3000${NC}\n"
  npm run start
else
  echo -e "\n${GREEN}🚀 Starting development server...${NC}"
  echo -e "${BLUE}➜ Open http://localhost:3000${NC}\n"
  npm run dev
fi
