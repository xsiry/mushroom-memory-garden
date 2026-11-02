#!/bin/sh
# 首次部署的回退只撤下本项目站点，保留版本、配置副本和日志。
set -eu
config=/etc/nginx/conf.d/mushroom-memory-garden.conf
app_root=/home/apps/mushroom-memory-garden
test -f "$config"
test -d "$app_root"
backup="$app_root/backups/mushroom-memory-garden.$(date +%Y%m%d-%H%M%S).conf"
mv "$config" "$backup"
if ! nginx -t; then
    mv "$backup" "$config"
    echo "移除站点后配置校验失败，已恢复本项目配置；未重载服务" >&2
    exit 1
fi
if ! systemctl reload nginx; then
    mv "$backup" "$config"
    echo "回退重载失败，已还原配置文件；请检查服务状态" >&2
    exit 1
fi
printf '本项目站点已停用，版本文件保留在 %s\n' "$app_root"
