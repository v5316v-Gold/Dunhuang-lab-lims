@echo off
REM ============================================================
REM  敦煌金检测中心 LIMS 启动脚本 - 端口 3001
REM  用途: 显式设置 PORT=3001 后启动 node server.js
REM  注意: 必须用 .bat 启动,不要用 MSYS bash 的 PORT= 前缀
REM        (后者会被 Hermes 终端环境捕获,导致端口错乱)
REM ============================================================

setlocal

cd /d "%~dp0"

echo.
echo ============================================================
echo  敦煌金检测中心 LIMS 启动器
echo  端口: 3001
echo  目录: %CD%
echo ============================================================
echo.

set PORT=3001
set NODE_ENV=development

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未检测到 node.exe,请先安装 Node.js 并加入 PATH
  echo         下载地址: https://nodejs.org/
  pause
  exit /b 1
)

echo [INFO] Node 版本:
node --version
echo.

if not exist "node_modules\express" (
  echo [WARN] 未检测到 node_modules,正在执行 npm install ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install 失败
    pause
    exit /b 1
  )
  echo.
)

if not exist "public\index.html" (
  echo [ERROR] 找不到 public\index.html
  echo         当前目录: %CD%
  pause
  exit /b 1
)

echo [INFO] 正在启动服务,请勿关闭此窗口...
echo       访问地址: http://localhost:3001/
echo       默认账号: admin / admin123
echo.
echo --------------------------------------------------------
echo.

node server.js

echo.
echo --------------------------------------------------------
echo [INFO] 进程已退出 (code=%errorlevel%)
pause
