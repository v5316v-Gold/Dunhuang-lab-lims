#!/bin/bash
# 敦煌金检测中心 LIMS 智能启动脚本 (Linux/Mac)

PORT=3001
echo "============================================================"
echo " 敦煌金检测中心 LIMS 智能启动"
echo " 端口：$PORT"
echo " 目录：$(pwd)"
echo "============================================================"

# 1) 清理残留进程
echo "[INFO] 清理残留 node 进程..."
pkill -9 -f "node server.js" 2>/dev/null
sleep 2

# 2) 启动服务
echo "[INFO] 正在启动服务..."
echo "     访问地址: http://localhost:$PORT"
echo "     默认账号: admin / admin123"
echo "------------------------------------------------------------"

node server.js
