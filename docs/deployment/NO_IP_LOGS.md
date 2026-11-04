# 中继、Caddy、coturn 不记录 IP(R4)

目标：我们自己运行的服务不把用户的 IP 地址写进日志或长期留在内存里。
这只是**我们这一方**少留数据，不等于「没人知道你的 IP」——见文末「做不到的」。

## 1. 中继(server/relay)——代码已改，未在生产核实

- 中继代码本身不写访问日志，也不打印来源地址(已检查 `server/relay/app/`)。
- 唯一用到 IP 的地方是认证前的连接限流。2026-11-04 之前，限流表直接以原始 IP 为键，而且这些键从不删除：进程运行多久，来访过的 IP 就在内存里留多久。
- 现在改为：
  - 限流键 = 用每次启动随机生成的 32 字节盐对 IP 做 HMAC-SHA256(`rate_limit.source_fingerprint`)。内存里没有原始 IP；盐不落盘，重启后旧键无法再和 IP 对上。
  - 窗口过期、没有事件的键会被清掉(`SlidingWindowLimiter._sweep`)。
- 测试:`server/relay/tests/test_rate_limit.py` 末尾三条，做过「故意改坏 → 测试失败」检查。
- **注意**:中继进程的 stdout/stderr 通常被 systemd journal 收走。代码里没有打印 IP 的语句，但第三方库(websockets)出错时的日志内容**未逐条核实**。

## 2. Caddy——需要 Paul 在服务器上确认

Caddy 只有在站点块里写了 `log` 指令时才记录访问日志(官方文档:"When configured, by default all requests to the site will be logged." [log 指令](https://caddyserver.com/docs/caddyfile/directives/log))。

在服务器上检查:
```bash
grep -n "log" /etc/caddy/Caddyfile
```
- 没有 `log` → 不记访问日志，不用改。
- 有 `log` 且确实需要排错用的日志 → 删掉 IP 字段(`delete` 过滤器,同一页文档):
```
log {
	format filter {
		request>remote_ip delete
		request>client_ip delete
		request>headers>X-Forwarded-For delete
		request>headers>Cf-Connecting-Ip delete
	}
}
```
改完 `sudo systemctl reload caddy`。

## 3. coturn(TURN)——需要 Paul 在服务器上改

coturn 默认把日志同时写到 stdout 和日志文件([turnserver(1)](https://man.archlinux.org/man/turnserver.1)),连接记录里有对端地址。`TURN_SETUP_WALKTHROUGH.md` 里调试阶段开的是 `log-file=/var/log/turnserver.log` + `verbose`。

测通之后，在 `/etc/turnserver.conf` 里把这两行换成(coturn 作者在邮件列表给出的组合，[讨论](https://groups.google.com/g/turn-server-project-rfc5766-turn-server/c/k1VzO8blRiQ)):
```
log-file=/dev/null
simple-log
no-stdout-log
```
并删掉 `verbose`。然后:
```bash
sudo systemctl restart coturn
sudo rm -f /var/log/turnserver*.log
sudo journalctl --vacuum-time=1s -u coturn   # 清掉 journal 里已有的旧记录
```
作者提醒：用配置文件方式时，coturn 在读到配置之前仍会输出少量启动信息;要完全没有输出得用命令行参数。

## 做不到的(对外说明时要照实写)

- **网络路径上的人能看到 IP**:VPS 服务商、机房网络、Cloudflare(中继走 Cloudflare Tunnel 时，Cloudflare 看得到访问者 IP，并按它自己的政策处理)。
- TURN 转发音视频时必须知道双方地址才能转发，运行期间内存里一定有。
- 我们没有独立审计;上面「未核实」的部分就是未核实。
