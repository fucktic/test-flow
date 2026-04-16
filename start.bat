@echo off
rem =============================================================
rem  Node Flow — One-click startup script (Windows)
rem  Usage:
rem    start.bat          -> development mode (hot reload)
rem    start.bat prod     -> production mode (build + start)
rem =============================================================

setlocal enabledelayedexpansion
set MODE=%1
if "%MODE%"=="" set MODE=dev

echo.
echo   NODE FLOW
echo   =========
echo.

rem ── Check Node.js ─────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js ^>= 20:
  echo         https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js found: %NODE_VER%

rem ── Install dependencies ──────────────────────────────────────
if not exist "node_modules\" (
  echo.
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
  echo [OK] Dependencies installed.
) else (
  echo [OK] node_modules found, skipping install.
)

rem ── Create data directories ───────────────────────────────────
if not exist "projects\" mkdir projects
if not exist "skills\"   mkdir skills
echo [OK] Data directories ready.

rem ── Start ─────────────────────────────────────────────────────
if /i "%MODE%"=="prod" (
  echo.
  echo [INFO] Building production bundle...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Build complete. Starting production server...
  echo [INFO] Open http://localhost:3000
  echo.
  call npm run start
) else (
  echo.
  echo [INFO] Starting development server...
  echo [INFO] Open http://localhost:3000
  echo.
  call npm run dev
)

pause
