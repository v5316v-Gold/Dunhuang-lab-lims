#!/usr/bin/env bash
# ============================================================
# 生成"报告电子签名"专用客户端证书
# 用法: ./deploy/ca/gen-report-signer-cert.sh
#
# 输出:
#   infrastructure/nginx/ssl/report-signer.crt  (证书)
#   infrastructure/nginx/ssl/report-signer.key  (私钥 — git-ignored)
# ============================================================

set -euo pipefail

CA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$(dirname "$CA_DIR")/nginx/ssl"
CERT_DIR="$SSL_DIR/clients/report-signer"
mkdir -p "$CERT_DIR"

cd "$SSL_DIR"

# 1. 私钥
openssl genrsa -aes256 -out "$CERT_DIR/report-signer.key" 2048
chmod 600 "$CERT_DIR/report-signer.key"

# 2. CSR
cat > "$CERT_DIR/csr.cnf" <<EOF
[req]
distinguished_name = req_dn
req_extensions     = v3_client
prompt             = no

[req_dn]
C  = CN
ST = Gansu
L  = Dunhuang
O  = 敦煌金质检实验室
OU = 报告签发
CN = report-signer

[v3_client]
basicConstraints = CA:FALSE
keyUsage         = critical, digitalSignature, nonRepudiation
extendedKeyUsage = clientAuth, emailProtection
EOF

openssl req -new -key "$CERT_DIR/report-signer.key" \
    -out "$CERT_DIR/report-signer.csr" \
    -config "$CERT_DIR/csr.cnf"

# 3. CA 签发(825 天)
openssl ca -batch -config ca.cnf \
    -in "$CERT_DIR/report-signer.csr" \
    -out "$CERT_DIR/report-signer.crt" \
    -days 825 \
    -extensions v3_client

chmod 644 "$CERT_DIR/report-signer.crt"

# 4. 部署到 backend 能找到的位置
# 方案:配置 SIGNATURE_CONFIG 指向 /etc/lims/ssl 或本仓库路径
cp "$CERT_DIR/report-signer.crt" "$SSL_DIR/report-signer.crt"
cp "$CERT_DIR/report-signer.key" "$SSL_DIR/report-signer.key"
chmod 644 "$SSL_DIR/report-signer.crt"
chmod 600 "$SSL_DIR/report-signer.key"

# 清理
rm -f "$CERT_DIR/csr.cnf" "$CERT_DIR/report-signer.csr"

echo
echo "============================================================"
echo "  ✅ 报告签名证书已生成"
echo "  证书: $SSL_DIR/report-signer.crt"
echo "  私钥: $SSL_DIR/report-signer.key"
echo
echo "  配置环境变量(如使用):"
echo "    REPORT_SIGN_CERT_PATH=$SSL_DIR/report-signer.crt"
echo "    REPORT_SIGN_KEY_PATH=$SSL_DIR/report-signer.key"
echo "    REPORT_SIGN_KEY_PASSPHRASE=<你刚才输入的密码>"
echo "============================================================"
