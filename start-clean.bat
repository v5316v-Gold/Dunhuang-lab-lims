@echo off
REM ============================================================
REM  敦煌金检测中心 LIMS 智能启动脚本
REM  功能：清理残留进程 → 释放端口 → 启动服务
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo  敦煌金检测中心 LIMS 智能启动
echo  端口：3001
echo  目录：%CD%
echo ============================================================
echo.

REM 1) 清理所有 node.exe 残留进程
echo [INFO] 清理残留 node.exe 进程...
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
  echo [OK] 已清理残留进程
) else (
  echo [OK] 无残留进程
)
timeout /t 2 /nobreak >nul

REM 2) 检查 3001 端口
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [WARN] 3001 端口仍被占用，尝试强制释放...
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p 2>nul
  )
  timeout /t 2 /nobreak >nul
)

REM 3) 启动服务
echo.
echo [INFO] 正在启动服务，请勿关闭此窗口...
echo       访问地址: http://localhost:3001
echo       默认账号: admin / admin123
echo.
echo --------------------------------------------------------
echo.

node server.js

echo.
echo --------------------------------------------------------
echo [INFO] 进程已退出 (code=%errorlevel%)
pause
