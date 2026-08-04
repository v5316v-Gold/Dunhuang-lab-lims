# ADR-0004:电子签名 = 第三方 CA 服务

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 菩提老祖 + 质量负责人
> **影响范围**: PDF 报告、检测数据法律效力、CNAS 审核

## 背景

敦煌金质检的检测报告具有**法律效力** —— 是上海黄金交易所等客户的**结算凭证**。报告的电子签名必须满足:

1. **签名者不可否认**:签名 + 时间戳 + 证书,可独立验证
2. **签名时间不可否认**:用可信时间戳服务(RFC 3161)
3. **签名不可伪造**:CA 证书 + 私钥硬件保护
4. **满足 21 CFR Part 11**:FDA 对电子记录的合规要求
5. **满足 CNAS / ISO 17025**:CNAS 对电子签名的认可要求

常见的错误做法是"自签证书"或"图章图片",这两种都不满足合规要求:

| 错误做法 | 问题 | 合规性 |
|---|---|---|
| 图章图片 | 任何人都可复制;无时间戳 | ❌ 不合规 |
| 自签证书(OpenSSL 生成) | 无第三方背书;CNAS 不认 | ❌ 不合规 |
| 软证书(U 盘存储) | 易被盗;无硬件保护 | ⚠️ 部分场景不合规 |
| 硬证书(USB Key / 智能卡) | 私钥硬件保护 | ✅ 合规(推荐) |
| 云签名服务(DigiCert / GlobalSign) | 第三方可信 CA | ✅ 合规 |
| 国内 CA 服务(君子签 / 法大大 / 上海 CA) | 第三方可信 CA + 国内法律认可 | ✅ 合规 |

## 决策

**采用第三方 CA 服务(国内 CA 优先)**,支持硬件 USB Key + 云签名双模式。

### 选型推荐

| CA 服务商 | 类型 | 优势 | 适用 |
|---|---|---|---|
| **君子签**(www.junzisign.com) | 国内云签 | 国内电子签名法律效力强;API 完善 | 推荐 |
| **法大大**(www.fadada.com) | 国内云签 | 大客户多;API 稳定 | 备选 |
| **上海 CA**(www.sheca.com) | 国内传统 CA | 政府背景;证书权威 | 政府客户优先 |
| **GlobalSign / DigiCert** | 国际 CA | 国际认可 | 国际客户 |

**Phase 2 起步选君子签**(国内电子签名法律效力强 + API 完善)。

### 集成架构

```
LIMS 检测报告(PDF)
   ↓
服务端调用 CA SDK
   ↓
私钥硬件签名(USB Key / 云密钥)
   ↓
返回:Base64 签名 + 证书链 + 时间戳 token
   ↓
嵌入 PDF + 入审计链
   ↓
下次打开 PDF:任何人可验证签名
```

### 关键设计

```typescript
// apps/backend/src/common/signature/signature.service.ts

interface SignatureResult {
  signatureData: string;        // Base64 签名
  certificateSerial: string;    // CA 证书序列号
  certificateChain: string;     // CA 证书链(PEM)
  timestampToken: string;       // RFC 3161 时间戳
  timestampAuthority: string;   // TSA 服务地址
  signedAt: Date;               // 签名时间
  algorithm: string;            // 'SHA256withRSA' / 'SHA256withECDSA'
}

async function signPdf(pdfBytes: Buffer, signerCert: string): Promise<SignatureResult> {
  // 1. 计算 PDF SHA256
  const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest();

  // 2. 硬件签名(USB Key / 云密钥)
  const signature = await caSdk.sign(pdfHash, signerCert);

  // 3. 获取时间戳(RFC 3161)
  const timestamp = await tsaClient.getTimestamp(pdfHash);

  // 4. 返回签名结果
  return {
    signatureData: signature.toString('base64'),
    certificateSerial: signerCert.serial,
    certificateChain: await caSdk.getChain(signerCert.serial),
    timestampToken: timestamp.token,
    timestampAuthority: tsaClient.url,
    signedAt: new Date(),
    algorithm: 'SHA256withRSA',
  };
}
```

## 理由

### 为什么必须第三方 CA

| 维度 | 第三方 CA | 自签证书 |
|---|---|---|
| **CNAS 认可** | ✅ | ❌ 不认 |
| **21 CFR Part 11** | ✅ | ❌ |
| **法律效力** | ✅ 第三方背书 | ❌ 无第三方背书 |
| **不可伪造** | ✅ CA 私钥保护 | ⚠️ 自签可复制 |
| **国际互认** | ✅ GlobalSign 等 | ❌ |

### 为什么优先国内 CA

| 维度 | 国内 CA(君子签) | 国际 CA(GlobalSign) |
|---|---|---|
| **国内法律效力** | ✅ 《电子签名法》认可 | ⚠️ 需公证 |
| **国内法院采信** | ✅ 高 | ⚠️ 低 |
| **API 中文文档** | ✅ | ❌ 英文 |
| **国内 CA 资质** | ✅ 工信部 / 国密局 | ✅ |
| **客户认可** | ✅ 国内黄金交易所认可 | ✅ 国际认可 |

**敦煌金质检主要服务国内黄金交易所 / 国内客户**,国内 CA 更合适。

### 为什么必须时间戳

签名 + 时间戳 = 不可否认的"何时签名":
- 仅签名 → 可反驳"签名时间伪造"
- 签名 + 时间戳 → 由可信第三方(TSA)证明"在 X 时间确实签了 Y 内容"

**RFC 3161 标准**:TSA(Time Stamp Authority)用可信时钟签发时间戳,与签名内容绑定。

### 为什么 PDF 必须 SHA256 入审计链

```
PDF 内容 SHA256
   ↓
CA 签名(SHA256withRSA / ECDSA)
   ↓
时间戳(TSA 用同一 SHA256 签名)
   ↓
签名结果入 DB audit_logs(SHA256 链)
   ↓
下次审计员验证:重新计算 PDF SHA256 → 比对签名 → 比对时间戳
```

任何 PDF 修改 → SHA256 变化 → 签名失效 → 审计链断链自检立即报警。

## 替代方案

### 备选 1:OpenSSL 自签证书
- **优势**: 免费;可控
- **拒绝理由**: CNAS 不认;无第三方背书

### 备选 2:用 PDF 内置图章(图片)
- **优势**: 简单
- **拒绝理由**: 任何人都可复制;无加密;无时间戳;无法律效力

### 备选 3:用区块链签名
- **优势**: 去中心化;不可篡改
- **拒绝理由**: CNAS 审核员不熟;成本高;过度设计

### 备选 4:用区块链 + CA 混合
- **优势**: 法律 + 不可篡改双保险
- **拒绝理由**: 复杂度;过度设计;Phase 5 再考虑

## 影响

### 正面影响
- ✅ **法律效力**:报告 = 黄金交易结算凭证
- ✅ **CNAS 审核通过**:第三方 CA 是 CNAS 认可的标准做法
- ✅ **不可否认**:签名 + 时间戳 = 双因素不可否认
- ✅ **客户信任**:客户验证报告真伪零成本(打开 PDF 即可)

### 负面影响 + 缓解
- ⚠️ **CA 服务年费**:~5-10 万/年;**缓解**:在项目预算中
- ⚠️ **CA 服务不可用**:签名失败;**缓解**:备选 CA + 降级方案(标记 + 人工补签)
- ⚠️ **私钥保管**:USB Key 物理丢失;**缓解**:备份 USB Key + 多签机制(双 USB Key)
- ⚠️ **时间戳服务依赖**:TSA 不可用;**缓解**:本地缓存 + 标记补签
- ⚠️ **性能开销**:每次签名 ~500ms-2s;**缓解**:BullMQ 异步队列 + 报告签发 P95 < 5s

### 关键约束

1. **每个签名必须有 CA 证书链**:用于第三方验证
2. **每个签名必须有 RFC 3161 时间戳**:用于不可否认时间
3. **签名结果必须入审计链**:SHA256(PDF) + 签名数据 + 证书序列号 + 时间戳 token
4. **签名失败必须有降级方案**:人工补签 + 标记 + 后续重新签名
5. **CA 证书必须定期更新**:通常 1-2 年

## 验证标准

- [ ] 集成第三方 CA 服务(Phase 1 POC + Phase 4 落地)
- [ ] 签名 API 可用:`POST /reports/:id/sign`
- [ ] PDF 报告含 CA 签名 + 时间戳 + 证书链
- [ ] 第三方验证:用 Adobe Acrobat / PDF 阅读器可验证签名
- [ ] 签名结果入审计链(`audit_logs` SHA256 链完整)
- [ ] 签名失败降级:标记报告 + 通知质量负责人 + 重试机制
- [ ] 性能:报告签发 P95 < 5s
- [ ] CNAS 现场验证:审核员可现场打开 PDF 验证签名

## 相关决策

- ADR-0003: 审计链 SHA256
- ADR-0006: PDF 报告生成
- ADR-0011: 贵金属检测业务约束

## 参考

- [21 CFR Part 11 §11.50 电子签名](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/subchapter-A/part-11)
- [RFC 3161 时间戳协议](https://www.rfc-editor.org/rfc/rfc3161)
- [君子签官网](https://www.junzisign.com)
- [法大大官网](https://www.fadada.com)
- [中华人民共和国电子签名法](http://www.npc.gov.cn/npc/c12435/201905/3a4f9b1f8f2c4f3e9b5f7d3a2e1f4c5b.html)