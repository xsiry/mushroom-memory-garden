#!/bin/sh
# 仅创建本项目的版本目录、入口链接和独立 Nginx 配置。
set -eu

release_id=${1:?请提供发布版本号}
case "$release_id" in
    *[!0-9-]*|'') echo "发布版本号仅允许数字和横线" >&2; exit 1 ;;
esac
app_root=/home/apps/mushroom-memory-garden
config=/etc/nginx/conf.d/mushroom-memory-garden.conf
stage=/tmp/mushroom-memory-garden-$release_id
release=$app_root/releases/$release_id
owns_config=0
created_root=0

cleanup() {
    status=$?
    trap - 0
    if test "$status" -ne 0; then
        restored=1
        if test "$owns_config" -eq 1; then
            rm -f "$config"
            if nginx -t; then
                systemctl reload nginx || restored=0
            else
                restored=0
            fi
        fi
        if test "$created_root" -eq 1 && test "$restored" -eq 1; then
            failed=/home/apps/.mushroom-memory-garden.failed-$release_id-$$
            mv "$app_root" "$failed"
            printf '失败产物保留在 %s，应用路径已释放，可重新发布\n' "$failed" >&2
        fi
        if test "$restored" -eq 0; then
            echo "原 Nginx 配置未能重载，已保留应用文件，请检查服务状态" >&2
        fi
    fi
    exit "$status"
}
trap cleanup 0
trap 'exit 1' HUP INT TERM

test -d "$stage"
test ! -e "$app_root"
test ! -e "$config"
if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18088$'; then
    echo "18088 端口已被占用，中止部署" >&2
    exit 1
fi
nginx -t
cd "$stage"
sha256sum -c archive.sha256
unpacked=$stage/unpacked-$$
mkdir "$unpacked"
tar -xzf site.tar.gz -C "$unpacked"
cd "$unpacked"
sha256sum -c SHA256SUMS
mkdir "$app_root"
created_root=1
mkdir -p "$release" "$app_root/backups"
cp -a /etc/nginx/nginx.conf "$app_root/backups/nginx.conf.before"
cp -a /etc/nginx/conf.d "$app_root/backups/conf.d.before"
cp -a "$unpacked/." "$release/"
cd "$release"
sha256sum -c SHA256SUMS
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
ln -s "$release/site" "$app_root/current"
cp "$stage/mushroom-memory-garden.conf" "$app_root/nginx.conf"
cp "$stage/rollback.sh" "$app_root/rollback.sh"
chmod 700 "$app_root/rollback.sh"
owns_config=1
cp "$stage/mushroom-memory-garden.conf" "$config"
chmod 644 "$config"

nginx -t
systemctl reload nginx
curl --noproxy '*' --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 http://127.0.0.1:18088/healthz
curl --noproxy '*' --fail --silent --show-error http://127.0.0.1:18088/ -o "$stage/home-response"
while read -r hash file; do
    case "$file" in
        site/*)
            path=${file#site/}
            curl --noproxy '*' --fail --silent --show-error "http://127.0.0.1:18088/$path" -o "$stage/verify-response"
            printf '%s  %s\n' "$hash" "$stage/verify-response" | sha256sum -c -
            ;;
    esac
done < "$release/SHA256SUMS"
printf 'DEPLOYED %s\n' "$release"
