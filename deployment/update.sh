#!/bin/sh
# 静态资源更新只原子切换入口，失败恢复原版本，不重载其他站点。
set -eu
release_id=${1:?请提供新版本号}
previous_id=${2:?请提供预期当前版本号}
case "$release_id:$previous_id" in *[!0-9:-]*|'') echo "版本号格式错误" >&2; exit 1 ;; esac
app_root=/home/apps/mushroom-memory-garden
stage=/tmp/mushroom-memory-garden-$release_id
release=$app_root/releases/$release_id
previous=$app_root/releases/$previous_id/site
switched=0

cleanup() {
    status=$?
    trap - 0
    if test "$status" -ne 0 && test "$switched" -eq 1; then
        if test "$(readlink -f "$app_root/current")" = "$release/site"; then
            ln -s "$previous" "$app_root/.rollback-$release_id-$$"
            mv -Tf "$app_root/.rollback-$release_id-$$" "$app_root/current"
            printf '已恢复版本 %s，新版本文件保留用于排查\n' "$previous_id" >&2
        else
            echo "入口已被其他操作更改，未覆盖当前入口" >&2
        fi
    fi
    exit "$status"
}
trap cleanup 0
trap 'exit 1' HUP INT TERM

test -d "$app_root"
exec 9> "$app_root/.deploy.lock"
if ! flock -n 9; then
    echo "本项目已有发布任务执行中，中止更新" >&2
    exit 1
fi
test -d "$previous"
test "$(readlink -f "$app_root/current")" = "$previous"
test ! -e "$release"
nginx -t
cd "$stage"
sha256sum -c archive.sha256
mkdir "$release"
tar -xzf site.tar.gz -C "$release"
cd "$release"
sha256sum -c SHA256SUMS
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
printf '%s\n' "$previous" > "$app_root/backups/previous-$release_id.txt"
ln -s "$release/site" "$app_root/.current-$release_id-$$"
test "$(readlink -f "$app_root/current")" = "$previous"
switched=1
mv -Tf "$app_root/.current-$release_id-$$" "$app_root/current"
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
printf 'UPDATED %s\n' "$release"
