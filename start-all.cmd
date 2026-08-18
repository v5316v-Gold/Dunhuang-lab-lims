@echo off
rem =====================================================
rem 敦煌金质检 LIMS - 一键启动脚本(前后端)
rem 用法: 双击 或 cmd 运行 start-all.cmd
rem 说明: 先启动后端(3030),再启动前端(5173)
rem =====================================================
setlocal

set ROOT=%~dp0
cd /d "%ROOT%"

echo ============================================
echo  敦煌金质检 LIMS 启动器
echo ============================================

rem ---- 0. 清理旧的 node 进程(可选,谨慎) ----
echo [0/3] 检查端口占用...
netstat -ano | findstr ":3030 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo   ⚠ 3030 已占用,可能后端已在运行
) else (
  echo   ✓ 3030 空闲
)
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo   ⚠ 5173 已占用,可能前端已在运行
) else (
  echo   ✓ 5173 空闲
)

rem ---- 1. 启动后端 ----
echo.
echo [1/3] 启动后端 (NestJS :3030)...
if not exist "apps\backend\node_modules" (
  echo   ❌ 后端依赖未安装,先执行 pnpm install
  pause
  exit /b 1
)
start "LIMS-Backend" cmd /c "cd /d %ROOT%apps\backend && set NODE_ENV=development && node node_modules\@nestjs\cli\bin\nest.js start"

rem 等待后端就绪(最多 40 秒)
echo   等待后端启动...
for /l %%i in (1,1,20) do (
  ping -n 2 127.0.0.1 >nul
  netstat -ano | findstr ":3030 " | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 goto backend_ready
)
echo   ⚠ 后端 40 秒未就绪,检查 apps\backend\nest.err.log
:backend_ready
echo   ✓ 后端已就绪

rem ---- 2. 启动前端 ----
echo.
echo [2/3] 启动前端 (Vite :5173, 局域网可访问)...
if not exist "apps\frontend\node_modules" (
  echo   ❌ 前端依赖未安装
  pause
  exit /b 1
)
start "LIMS-Frontend" cmd /c "cd /d %ROOT%apps\frontend && set NODE_ENV=development && node node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173"

rem 等待前端就绪
echo   等待前端启动...
for /l %%i in (1,1,15) do (
  ping -n 2 127.0.0.1 >nul
  netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 goto fe_ready
)
echo   ⚠ 前端 30 秒未就绪,检查 apps\frontend\vite.err.log
:fe_ready
echo   ✓ 前端已就绪

rem ---- 3. 完成 ----
echo.
echo ============================================
echo   ✅ 启动完成
echo   本机:   http://localhost:5173/
echo   局域网: http://192.168.2.110:5173/
echo   后端:   http://localhost:3030/api/docs
echo ============================================
echo.
echo 停止: 关闭 "LIMS-Backend" 和 "LIMS-Frontend" 窗口
echo 或: taskkill /f /im node.exe
pause
