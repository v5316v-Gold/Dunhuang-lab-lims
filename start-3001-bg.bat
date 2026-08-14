@echo off
REM ============================================================
REM  敦煌金检测中心 LIMS 启动脚本 (后台版) - 端口 3001
REM  用途: 启动后窗口立即关闭,服务在后台运行
REM  日志:  logs\server-YYYYMMDD-HHMMSS.log
REM  停止:  stop-3001.bat
REM ============================================================

setlocal

cd /d "%~dp0"

if not exist "logs" mkdir "logs"

for /f "tokens=2 delims==" %%a in ('wmic os get localtime /value 2^>nul ^| find "="') do set "TIMESTAMP=%%a"
set "TS=%TIMESTAMP:~0,8%-%TIMESTAMP:~8,6%"
set "LOGFILE=logs\server-%TS%.log"

set PORT=3001
set NODE_ENV=development

echo ============================================================
echo  敦煌金检测中心 LIMS - 后台启动
echo  端口: 3001
echo  日志: %LOGFILE%
echo ============================================================

REM 用 start /B 在后台启动,日志重定向
start /B "" cmd /c "node server.js > %LOGFILE% 2>&1"

echo 启动命令已提交,等待 3 秒检查端口...
timeout /t 3 /nobreak >nul

REM 校验端口是否真的起来
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [WARN] 端口 3001 暂未监听,请查看日志: %LOGFILE%
) else (
  echo [OK] 服务已就绪: http://localhost:3001/
)

echo.
echo 提示: 关闭窗口不影响服务运行
echo       停止服务: 运行 stop-3001.bat
echo       查看日志: type %LOGFILE%
echo.
timeout /t 3 /nobreak >nul
