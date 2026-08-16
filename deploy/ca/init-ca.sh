#!/usr/bin/env bash
# ============================================================
# 敦煌金质检 LIMS - 内网 CA 初始化脚本
# 详见 docs/05-DEPLOYMENT.md §TLS 内网 CA
#
# 用法:
#   ./deploy/ca/init-ca.sh dunhuang-lab.local
# 生成:
#   ca.key         CA 私钥(严格保密,只有 IT + 主任可访问)
#   ca.crt         CA 证书(推到所有工作站和仪器的"受信任根证书")
#   serial.txt     证书序列号
# ============================================================

set -euo pipefail

DOMAIN="${1:-dunhuang-lab.local}"
CA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$(dirname "$CA_DIR")/nginx/ssl"
mkdir -p "$SSL_DIR"

CA_NAME="Dunhuang Gold Quality LIMS Internal CA"
CA_CN="Dunhuang-Lab Internal Root CA"
VALIDITY_DAYS=3650  # 10 年

echo "==> 初始化内网 CA: $CA_NAME"
echo "    CA 目录: $SSL_DIR"
echo "    域名: $DOMAIN"
echo

cd "$SSL_DIR"

# 1. CA 私钥(4096 bit)
if [[ ! -f ca.key ]]; then
    echo "[1/4] 生成 CA 私钥(4096 bit)..."
    openssl genrsa -aes256 -out ca.key 4096
    chmod 600 ca.key
else
    echo "[1/4] CA 私钥已存在,跳过"
fi

# 2. CA 证书(自签,10 年)
if [[ ! -f ca.crt ]]; then
    echo "[2/4] 生成 CA 证书(自签,$VALIDITY_DAYS 天)..."
    cat > ca.cnf <<EOF
[req]
distinguished_name = req_dn
x509_extensions    = v3_ca
prompt             = no

[req_dn]
C  = CN
ST = Gansu
L  = Dunhuang
O  = 敦煌金质检实验室
OU = IT 部门
CN = $CA_CN

[v3_ca]
basicConstraints       = critical, CA:TRUE
keyUsage               = critical, keyCertSign, cRLSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always, issuer
EOF

    openssl req -new -x509 -key ca.key -sha256 -days $VALIDITY_DAYS \
        -out ca.crt -config ca.cnf \
        -subj "/C=CN/ST=Gansu/L=Dunhuang/O=敦煌金质检实验室/OU=IT/CN=$CA_CN"
    chmod 644 ca.crt
else
    echo "[2/4] CA 证书已存在,跳过"
fi

# 3. 序列号文件
if [[ ! -f serial.txt ]]; then
    echo "01" > serial.txt
fi

# 4. 配置文件
cat > ca.cnf <<EOF
[ca]
default_ca = CA_default

[CA_default]
dir               = $SSL_DIR
certs             = \$dir
crl_dir           = \$dir/crl
database          = \$dir/index.txt
new_certs_dir     = \$dir
serial            = \$dir/serial.txt
certificate       = \$dir/ca.crt
private_key       = \$dir/ca.key
default_days      = 825
default_crl_days  = 30
default_md        = sha256
policy            = policy_match

[policy_match]
commonName              = supplied
countryName             = supplied
stateOrProvinceName     = supplied
organizationName        = supplied
organizationalUnitName  = optional

[req]
distinguished_name = req_dn
prompt             = no

[req_dn]
C  = CN
ST = Gansu
L  = Dunhuang
O  = 敦煌金质检实验室

[v3_server]
basicConstraints       = CA:FALSE
keyUsage               = critical, digitalSignature, keyEncipherment
extendedKeyUsage       = serverAuth, clientAuth
subjectAltName         = @alt_names

[v3_client]
basicConstraints       = CA:FALSE
keyUsage               = critical, digitalSignature
extendedKeyUsage       = clientAuth
EOF

# 5. index.txt
[[ -f index.txt ]] || touch index.txt

echo
echo "==> ✅ CA 初始化完成"
echo "    CA 证书: $SSL_DIR/ca.crt"
echo "    CA 私钥: $SSL_DIR/ca.key  (chmod 600)"
echo
echo "下一步:"
echo "  1) 生成服务器证书: ./deploy/ca/gen-server-cert.sh lims.$DOMAIN <服务器IP>"
echo "  2) 生成客户端证书(仪器对接): ./deploy/ca/gen-client-cert.sh <设备名>"
echo "  3) 把 ca.crt 推到所有工作站的\"受信任根证书颁发机构\""
echo
