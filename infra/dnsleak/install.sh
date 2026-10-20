#!/usr/bin/env bash
# Installs the SecureInChat DNS leak test server on a Debian or Ubuntu VPS. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/Paul30028/secureinchat/main/infra/dnsleak/install.sh | sudo bash
# Re-running it is safe: it updates the server and keeps the rest.
set -euo pipefail

ZONE="${ZONE:-lk.secureinchat.com}"
NS_NAME="${NS_NAME:-ns-lk.secureinchat.com}"
API_HOST="${API_HOST:-dnsapi.secureinchat.com}"
ORIGIN="${ORIGIN:-https://secureinchat.com}"
SRC_URL="${SRC_URL:-https://raw.githubusercontent.com/Paul30028/secureinchat/main/infra/dnsleak/server.py}"

[ "$(id -u)" = 0 ] || { echo "Run as root (use sudo)."; exit 1; }
command -v python3 >/dev/null || { apt-get update -y && apt-get install -y python3; }
command -v curl >/dev/null || apt-get install -y curl

# Address to bind: the server's primary interface address (works with or without NAT).
BIND_IP="${BIND_IP:-$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)}"
[ -n "$BIND_IP" ] || { echo "Could not detect the server address. Re-run with BIND_IP=x.x.x.x"; exit 1; }

# Port 53 must be free on that address (systemd-resolved only holds 127.0.0.53, which is fine).
if ss -H -lunp "sport = :53" | grep -q "$BIND_IP\|0.0.0.0:53\|\*:53"; then
  if ! ss -H -lunp "sport = :53" | grep -q dnsleak; then
    echo "Port 53 on $BIND_IP is already in use:"; ss -lunp "sport = :53"; echo "Stop that service first, then re-run."; exit 1
  fi
fi

id dnsleak >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin dnsleak
mkdir -p /opt/dnsleak
curl -fsSL "$SRC_URL" -o /opt/dnsleak/server.py
chmod 0644 /opt/dnsleak/server.py

cat >/etc/systemd/system/dnsleak.service <<EOF
[Unit]
Description=SecureInChat DNS leak test server
After=network-online.target
Wants=network-online.target

[Service]
User=dnsleak
ExecStart=/usr/bin/python3 /opt/dnsleak/server.py --zone $ZONE --ns-name $NS_NAME --dns-bind $BIND_IP:53 --http-bind 127.0.0.1:8081 --origin $ORIGIN
Restart=always
RestartSec=2
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
StandardOutput=null
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable dnsleak >/dev/null
systemctl restart dnsleak

# HTTPS for the result API through Caddy (automatic certificate).
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
touch /etc/caddy/Caddyfile
if ! grep -q "$API_HOST" /etc/caddy/Caddyfile; then
  cat >>/etc/caddy/Caddyfile <<EOF

$API_HOST {
	reverse_proxy 127.0.0.1:8081
}
EOF
fi
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 53/udp >/dev/null; ufw allow 53/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  echo "ufw: opened 53, 80 and 443."
fi

echo; echo "Self-test:"
sleep 1
python3 - "$BIND_IP" "$ZONE" <<'PY'
import socket, struct, sys
ip, zone = sys.argv[1], sys.argv[2]
name = "000000000000-1." + zone
wire = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\0"
msg = struct.pack("!HHHHHH", 1, 0x0100, 1, 0, 0, 0) + wire + struct.pack("!HH", 1, 1)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(3); s.sendto(msg, (ip, 53))
r = s.recv(512); print("  DNS answer from", ip, "-", "OK" if r[3] & 15 == 0 and r[7] == 1 else "unexpected reply")
PY
curl -fsS http://127.0.0.1:8081/h >/dev/null && echo "  HTTP API on 127.0.0.1:8081 - OK"
echo
echo "Installed. Server address: $BIND_IP   Zone: $ZONE   API: https://$API_HOST"
echo "Now make sure these DNS records exist in Cloudflare (DNS only, grey cloud):"
echo "  A   $NS_NAME  ->  <this server's public IP>"
echo "  NS  $ZONE     ->  $NS_NAME"
echo "  A   $API_HOST ->  <this server's public IP>"
