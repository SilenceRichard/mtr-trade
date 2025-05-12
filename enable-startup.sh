#!/bin/bash

echo "配置PM2开机自启动..."

# 1. 先运行服务启动脚本
./start-services.sh

# 2. 保存当前的PM2进程列表
pm2 save

# 3. 生成开机自启动脚本并配置
pm2 startup

echo "完成! 请根据上面的输出运行sudo命令(如有)来完成配置。" 