#!/usr/bin/env bash
# ============================================================
# 生成 Nginx 服务器证书(由内网 CA 签发)
# 用法: ./deploy/ca/gen-server-cert.sh <hostname> [ip1] [ip2] ...
# 例:   ./deploy/ca/gen-server-cert.sh lims.dunhuang-lab.local 192.168.1.50
# ============================================================

set -euo pipefail

HOSTNAME="${1:-lims.dunhuang-lab.local}"
shift
ALT_IPS=("$@")

CA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$(dirname "$CA_DIR")/nginx/ssl"
cd "$SSL_DIR"

CERT_DIR="$SSL_DIR/servers/$HOSTNAME"
mkdir -p "$CERT_DIR"

echo "==> 为 $HOSTNAME 生成服务器证书"

# 1. 私钥
echo "[1/4] 生成私钥(2048 bit)..."
openssl genrsa -out "$CERT_DIR/server.key" 2048
chmod 600 "$CERT_DIR/server.key"

# 2. CSR
echo "[2/4] 生成 CSR..."
SAN="DNS:$HOSTNAME,DNS:localhost"
for ip in "${ALT_IPS[@]:-}"; do
    SAN="$SAN,IP:$ip"
done
SAN="$SAN,DNS:127.0.0.1"

cat > "$CERT_DIR/server.cnf" <<EOF
[req]
distinguished_name = req_dn
req_extensions     = v3_server
prompt             = no

[req_dn]
C  = CN
ST = Gansu
L  = Dunhuang
O  = 敦煌金质检实验室
CN = $HOSTNAME

[v3_server]
basicConstraints       = CA:FALSE
keyUsage               = critical, digitalSignature, keyEncipherment
extendedKeyUsage       = serverAuth, clientAuth
subjectAltName         = @alt_names

[alt_names]
$(echo "$SAN" | tr ',' '\n' | awk -F: '{printf "%s = %s\n", toupper($1), $2}')
EOF

openssl req -new -key "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.csr" \
    -config "$CERT_DIR/server.cnf"

# 3. 用 CA 签发(825 天 = 评审周期约 27 个月,留余量)
echo "[3/4] CA 签发证书(825 天)..."
openssl ca -batch -config ca.cnf \
    -in "$CERT_DIR/server.csr" \
    -out "$CERT_DIR/server.crt" \
    -days 825 \
    -extensions v3_server

chmod 644 "$CERT_DIR/server.crt"

# 4. 部署到 nginx 目录(替换默认)
echo "[4/4] 部署到 nginx..."
cp "$CERT_DIR/server.crt" "$SSL_DIR/server.crt"
cp "$CERT_DIR/server.key" "$SSL_DIR/server.key"
chmod 644 "$SSL_DIR/server.crt"
chmod 600 "$SSL_DIR/server.key"

echo
echo "==> ✅ 服务器证书已生成并部署"
echo "    证书: $SSL_DIR/server.crt"
echo "    私钥: $SSL_DIR/server.key"
echo "    SAN : $SAN"
echo
echo "验证:"
echo "  openssl x509 -in $SSL_DIR/server.crt -noout -text | grep -A2 'Subject Alternative'"
echo
