# 内网 CA 与证书管理

## 文件清单

| 文件 | 用途 | 权限 |
|---|---|---|
| `ca.crt` | CA 根证书(推送到所有工作站/仪器的"受信任根证书") | 644 |
| `ca.key` | CA 私钥(仅 IT 主管 + 实验室主任可访问,**绝对不能落到容器**) | 600 |
| `servers/<host>/*.crt,*.key` | 服务器证书 | 644/600 |
| `clients/<device>/*.crt,*.key,*.p12` | 客户端证书(仪器对接) | 644/600 |
| `serial.txt` | 证书序列号 | 644 |
| `index.txt` | 签发记录 | 644 |

## 一次性初始化

```bash
cd /opt/dunhuang-lab-lims
./deploy/ca/init-ca.sh dunhuang-lab.local
# 输入 CA 私钥密码(强密码,保管到保险柜)
```

## 生成服务器证书

```bash
./deploy/ca/gen-server-cert.sh lims.dunhuang-lab.local 192.168.1.50 192.168.1.51
# 自动部署到 infrastructure/nginx/ssl/server.{crt,key}
```

## 生成客户端证书(检测仪器)

```bash
./deploy/ca/gen-client-cert.sh icp-oes-01
# 把 clients/icp-oes-01/client.p12 导入到 ICP-OES 仪器控制电脑
```

## 客户端信任 CA(工作站)

Windows:
```
certutil -addstore -f "Root" ca.crt
```

macOS:
```
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ca.crt
```

Linux (Debian/Ubuntu):
```
sudo cp ca.crt /usr/local/share/ca-certificates/dunhuang-ca.crt
sudo update-ca-certificates
```

## 撤销证书(若设备报废)

```bash
# 1. 编辑 index.txt,把对应行状态从 V 改为 R
# 2. 重新生成 CRL
openssl ca -config ca.cnf -gencrl -out crl.pem
# 3. nginx 加载 CRL(可选,生产建议)
```

## 备份

每季度:
```bash
tar czf ca-backup-$(date +%Y%m%d).tar.gz ca.key ca.crt index.txt serial.txt
# 加密存储到保险柜 + 异地
```

## 紧急恢复

如果 CA 私钥泄漏:
1. **立即**吊销所有已签发证书
2. 重新生成 CA(新 `ca.key`)
3. 重新签发所有服务器 + 客户端证书
4. 通知所有工作站重新信任新 CA

## 注意事项

- CA 私钥(`ca.key`)**绝对不能**提交到 git,绝不能放进 Docker 镜像,绝不能复制到任何工作站
- 推荐使用密码保护的私钥(`openssl genrsa -aes256`)
- 服务器证书有效期 825 天(27 个月),评审前 1 个月开始续签
- 客户端证书有效期同样 825 天,过期前 30 天邮件提醒
