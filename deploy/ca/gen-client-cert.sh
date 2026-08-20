#!/usr/bin/env bash
# ============================================================
# 生成客户端证书(用于检测仪器对接,mTLS)
# 用法: ./deploy/ca/gen-client-cert.sh <设备名>
# 例:   ./deploy/ca/gen-client-cert.sh icp-oes-01
#       ./deploy/ca/gen-client-cert.sh fire-assay-balance-01
# ============================================================

set -euo pipefail

DEVICE_NAME="${1:-icp-oes-01}"

CA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$(dirname "$CA_DIR")/nginx/ssl"
cd "$SSL_DIR"

CERT_DIR="$SSL_DIR/clients/$DEVICE_NAME"
mkdir -p "$CERT_DIR"

echo "==> 为设备 $DEVICE_NAME 生成客户端证书"

# 1. 私钥
echo "[1/4] 生成私钥..."
openssl genrsa -out "$CERT_DIR/client.key" 2048
chmod 600 "$CERT_DIR/client.key"

# 2. CSR
cat > "$CERT_DIR/client.cnf" <<EOF
[req]
distinguished_name = req_dn
req_extensions     = v3_client
prompt             = no

[req_dn]
C  = CN
ST = Gansu
L  = Dunhuang
O  = 敦煌金质检实验室
OU = 检测仪器
CN = $DEVICE_NAME

[v3_client]
basicConstraints = CA:FALSE
keyUsage         = critical, digitalSignature
extendedKeyUsage = clientAuth
EOF

openssl req -new -key "$CERT_DIR/client.key" \
    -out "$CERT_DIR/client.csr" \
    -config "$CERT_DIR/client.cnf"

# 3. CA 签发
echo "[3/4] CA 签发客户端证书(825 天)..."
openssl ca -batch -config ca.cnf \
    -in "$CERT_DIR/client.csr" \
    -out "$CERT_DIR/client.crt" \
    -days 825 \
    -extensions v3_client

# 4. 打包 p12(便于导入仪器/工作站)
echo "[4/4] 打包 p12(导入仪器)..."
openssl pkcs12 -export \
    -inkey "$CERT_DIR/client.key" \
    -in "$CERT_DIR/client.crt" \
    -certfile ca.crt \
    -out "$CERT_DIR/client.p12" \
    -name "$DEVICE_NAME"

chmod 644 "$CERT_DIR/client.crt"
chmod 644 "$CERT_DIR/client.p12"

echo
echo "==> ✅ 客户端证书已生成"
echo "    crt : $CERT_DIR/client.crt"
echo "    key : $CERT_DIR/client.key"
echo "    p12 : $CERT_DIR/client.p12  (导入仪器/工作站)"
echo
