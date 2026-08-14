@echo off
REM ============================================================
REM  敦煌金检测中心 LIMS 停止脚本
REM  用途: 关闭 3001 端口上的 node 进程
REM ============================================================

setlocal

echo 正在查找 3001 端口占用进程...

set "FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo   找到 PID=%%P,正在停止...
  taskkill /F /PID %%P >nul 2>&1
  if errorlevel 1 (
    echo   [WARN] 停止 PID=%%P 失败
  ) else (
    echo   [OK] 已停止 PID=%%P
  )
)

if "%FOUND%"=="0" (
  echo [INFO] 端口 3001 当前无服务运行
)

echo.
pause
