# 蘑菇家族公网部署

## 当前入口

- 项目英文名：`mushroom-memory-garden`
- 游戏：<http://47.102.205.35:18088/>
- PNG 二维码：<http://47.102.205.35:18088/entry-qr.png>
- 服务器目录：`/home/apps/mushroom-memory-garden`
- 当前版本：`20261102-093222`
- 前一版本：`20261101-134859`

游戏由服务器现有 Nginx 直接提供静态资源，不依赖本机运行，不需要在服务器安装 Node.js 或数据库。网页内保存二维码下载的是 900×900 PNG，二维码保留白色静区，可用于手机分享和打印。图鉴底部的素材来源说明已移除。

## 文件和服务

```text
/home/apps/mushroom-memory-garden/
  current -> releases/20261102-093222/site
  releases/
    20261101-134859/
    20261102-093222/
  backups/
    nginx.conf.before
    conf.d.before/
    previous-20261102-093222.txt
  nginx.conf
  rollback.sh
```

Nginx 站点配置为 `/etc/nginx/conf.d/mushroom-memory-garden.conf`，仅新增 18088 监听。现有主配置及其他站点配置未修改。访问和错误日志分别为 `/var/log/nginx/mushroom-memory-garden.access.log` 与 `.error.log`，由已有 Nginx 日志轮转管理。

常规检查：

```sh
nginx -t
systemctl is-active nginx
readlink -f /home/apps/mushroom-memory-garden/current
curl --fail http://127.0.0.1:18088/healthz
```

健康检查还应实际访问首页和资源；单独的 `/healthz` 仅证明 HTTP 监听可用。发布脚本逐个请求 20 个站点文件并比较 SHA256，校验清单保存在每个版本的 `SHA256SUMS`。

## 发布与回退

本地 `deployment/install.sh` 负责首次安装，`deployment/update.sh` 负责后续版本更新。新版本先独立解包、校验，再原子切换 `current` 链接。后续更新持有本项目独占锁，资源验收失败自动恢复原链接；更新静态资源无需重载其他站点。

回退本次页面更新时，先核对当前版本并取得同一把锁：

```sh
app_root=/home/apps/mushroom-memory-garden
exec 9> "$app_root/.deploy.lock"
flock -x 9
test "$(readlink -f "$app_root/current")" = "$app_root/releases/20261102-093222/site"
ln -s "$app_root/releases/20261101-134859/site" "$app_root/.rollback-manual-$$"
mv -Tf "$app_root/.rollback-manual-$$" "$app_root/current"
curl --fail http://127.0.0.1:18088/
```

如需停用整个新站点，执行 `sh /home/apps/mushroom-memory-garden/rollback.sh`。这只撤下本项目 Nginx 配置并重载，保留版本文件、备份和日志。完整旧配置备份用于对照，不应整体覆盖其他应用后来发生的配置变化。

## 验证与边界

本地 15 项规则测试通过。公网 Chrome 已验证首页、记忆排序、成功领取凭证、工作人员核销及刷新恢复、失败复盘重试、二维码显示和下载。PNG 下载检查真实文件签名和尺寸，并通过 macOS Vision 独立解码。

本次页面更新包含蘑菇点击动效、点选反馈与领奖页双列按钮布局；319px 及以下视口使用单列领奖按钮，避免核验文字超出。规则和存档结构未改变。

本次发布证据保存在本地 `outputs/deployment/20261102-093222/`，包括归档校验、更新记录、资源内容校验与浏览器截图。以前各版本的证据目录继续保留。

当前使用 HTTP/IP 入口，未配置游戏域名及独立 HTTPS。没有采集游客账号或个人信息。游玩凭证依然保存在游客当前浏览器，本次部署未引入跨设备联网核销；现场礼品仍由工作人员人工核验。公网 Chrome 证据不等于真机微信与活动现场验收。
