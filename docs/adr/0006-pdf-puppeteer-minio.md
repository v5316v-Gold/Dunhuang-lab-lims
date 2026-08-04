# ADR-0006:报告 PDF = Puppeteer + MinIO + 时间戳

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 后端工程师
> **影响范围**: PDF 生成、报告存储、CNAS 审核、客户交付

## 背景

敦煌金质检的报告 PDF 是**法律文件** = 黄金交易结算凭证。必须满足:

1. **格式严格**:中英文双语;固定布局;不可任意修改
2. **内容完整**:样品信息 + 检测方法 + 检测结果 + 不确定度 + QC 状态 + 多级签名
3. **不可篡改**:PDF 内容 SHA256 入审计链 + CA 签名 + 时间戳
4. **可验证**:客户打开 PDF 可看到签名 + 时间戳 + 二维码
5. **可归档**:5 年留存 + 异地备份

PDF 生成方案对比:

| 方案 | 优势 | 劣势 |
|---|---|---|
| **pdfkit / jsPDF**(程序化) | 性能好;可控 | 模板开发成本高;样式繁琐 |
| **wkhtmltopdf**(HTML → PDF) | 模板友好 | 维护少;CJK 字体问题 |
| **Puppeteer**(Chromium 渲染) | ⭐ 模板即 HTML;CSS/JS 全支持;渲染精准 | 资源占用大;性能 |
| **WeasyPrint**(Python) | 模板友好 | 需 Python;Node.js 不直接支持 |
| **报告引擎(JasperReports 等)** | 企业级 | 重;Java 体系;学习曲线 |

## 决策

**采用 Puppeteer + MinIO + 时间戳**。

### 1. 模板即 HTML

```
apps/backend/src/modules/report/pdf/
├── template.html       # EJS 模板(中英文双语)
├── styles.css          # 报告样式
├── assets/             # 静态资源(logo / 印章 / 字体)
│   ├── logo.png
│   ├── seal.png
│   └── NotoSansSC.ttf  # 中文字体子集
└── pdf.service.ts      # Puppeteer 渲染
```

### 2. 渲染流程

```typescript
// apps/backend/src/modules/report/pdf/pdf.service.ts

async function generateReportPdf(reportId: string): Promise<GeneratedPdf> {
  // 1. 加载报告数据
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { sample: true, signatures: true, /* ... */ },
  });

  // 2. EJS 模板渲染 HTML
  const html = await ejs.renderFile('template.html', {
    report,
    sample: report.sample,
    elements: report.elements,
    qc: report.qcSummary,
    generatedAt: new Date(),
  });

  // 3. Puppeteer 渲染 PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBytes = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });

  await browser.close();

  // 4. 计算 PDF SHA256
  const pdfSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  // 5. 上传 MinIO
  const fileId = await minioService.uploadPdf(`reports/${reportId}.pdf`, pdfBytes);

  // 6. CA 签名 + 时间戳(详见 ADR-0004)
  const signature = await signatureService.signPdf(pdfBytes, report.signerCert);

  // 7. 嵌入签名到 PDF(PDF 内嵌签名 + 可见签名图章)
  const signedPdfBytes = await pdfService.embedSignature(pdfBytes, signature);

  // 8. 更新报告状态
  await prisma.report.update({
    where: { id: reportId },
    data: {
      pdfFileId: fileId,
      pdfSha256,
      qrCode: generateQrCode(`https://lims.dhg.example/verify/${report.reportNo}`),
      status: 'ISSUED',
    },
  });

  // 9. 入审计链(自动通过 PG 触发器)

  return { signedPdfBytes, pdfSha256, signature };
}
```

### 3. MinIO 存储

```typescript
// apps/backend/src/infrastructure/minio/minio.service.ts

class MinioService {
  // Bucket 结构
  // dunhuang-reports/2026/09/LIMS-2026-000001.pdf
  // dunhuang-certificates/
  // dunhuang-qc-data/
  // dunhuang-photos/

  async uploadPdf(path: string, bytes: Buffer): Promise<string> {
    await this.client.putObject('dunhuang-reports', path, bytes, bytes.length, {
      'Content-Type': 'application/pdf',
      'X-Amz-Server-Side-Encryption': 'AES256',
    });
    return path;
  }

  async getPdf(path: string): Promise<Buffer> {
    const stream = await this.client.getObject('dunhuang-reports', path);
    return streamToBuffer(stream);
  }
}
```

### 4. 验证 API

```
GET /verify/:reportNo - 公开访问
  返回:
    reportNo, sampleNo, customerName,
    purityPct, uncertainty, method, status,
    pdfSha256, issuedAt, signatures[].{signerRole, signedAt, certificateSerial},
    isValid: true  // 后端实时计算比对
```

## 理由

### 为什么 Puppeteer(而非 jsPDF / pdfkit)

| 维度 | Puppeteer | jsPDF / pdfkit |
|---|---|---|
| **模板开发** | ⭐⭐⭐ HTML/CSS 即所见即所得 | ⭐ 程序化拼坐标 |
| **样式表达力** | ⭐⭐⭐ Flex/Grid/字体/图片 | ⭐ 基础 |
| **中文支持** | ⭐⭐⭐ 字体子集化简单 | ⭐ 字体注册繁琐 |
| **维护成本** | ⭐⭐⭐ 前端工程师可维护 | ⭐ 后端专属 |
| **性能** | ⭐ 启动 ~200ms;渲染 ~500ms | ⭐⭐⭐ < 100ms |
| **资源占用** | ⚠️ Chromium 内存 ~100MB | ⭐⭐⭐ 几 MB |

**核心理由**:报告样式复杂(双语 / 表格 / 签名图章 / 二维码),HTML/CSS 表达力远胜程序化拼 PDF。性能损耗可通过 BullMQ 异步 + 浏览器池弥补。

### 为什么 MinIO(而非本地 FS / NFS)

| 维度 | MinIO (S3) | 本地 FS | NFS |
|---|---|---|---|
| **横向扩展** | ✅ | ❌ | ⚠️ |
| **异地备份** | ✅ 内置复制 | ⚠️ 需 rsync | ⚠️ |
| **版本控制** | ✅ | ❌ | ❌ |
| **CDN 友好** | ✅ | ⚠️ | ⚠️ |
| **成本** | ⭐ 自建免费 / 云付费 | ⭐⭐⭐ | ⭐⭐ |

### 为什么时间戳嵌入 PDF

PDF 内嵌时间戳(RFC 3161)→ 任何人打开 PDF 可看到"签名时间" + "TSA 服务" + 验证证书。

### 为什么 SHA256 入审计链

```
PDF bytes → SHA256 → 入 audit_logs.curr_hash
   ↓
下次审计员验证:重新计算 PDF SHA256 → 比对 DB 中 SHA256 → 一致 = 报告未被修改
```

## 替代方案

### 备选 1:jsPDF / pdfkit(程序化)
- **优势**: 性能好;无浏览器依赖
- **拒绝理由**: 模板开发成本极高;中文支持差;维护难

### 备选 2:wkhtmltopdf
- **优势**: 简单
- **拒绝理由**: 维护少;CJK 字体问题;QT 依赖

### 备选 3:本地 FS 存储 PDF
- **优势**: 简单
- **拒绝理由**: 无版本控制;难横向扩展;难异地备份

### 备选 4:PDFBox(Java)
- **优势**: 强大
- **拒绝理由**: 与 NestJS 不匹配;需 JVM

## 影响

### 正面影响
- ✅ **模板即代码**:HTML/CSS,前端工程师可改
- ✅ **样式丰富**:双语 / 表格 / 图章 / 二维码 / 字体子集化
- ✅ **签名 + 时间戳嵌入 PDF**:客户零成本验证
- ✅ **版本控制**:MinIO 支持 object versioning
- ✅ **异地备份**:MinIO 内置跨区域复制

### 负面影响 + 缓解
- ⚠️ **Puppeteer 内存占用 ~100MB/实例**:缓解:浏览器池(2-4 个实例复用)
- ⚠️ **首次渲染慢 ~500ms**:缓解:Redis 缓存模板编译结果
- ⚠️ **字体子集化**:中文全套字体 ~10MB,嵌入 PDF 会膨胀;缓解:`fontmin` 子集化,只嵌入实际使用的字符
- ⚠️ **Puppeteer 与 NestJS 部署耦合**:缓解:Docker 镜像内含 Chromium,CI 测试 OK
- ⚠️ **PDF 生成失败回退**:缓解:BullMQ 重试 + 标记重试 + 人工兜底

### 关键约束

1. **PDF 模板版本管理**:每次模板变更必须升级版本号 + 入审计
2. **PDF 内容 SHA256 必须入 audit_logs**:PG 触发器自动
3. **PDF 必须含 CA 签名 + 时间戳 + 二维码**:详见 ADR-0004
4. **PDF 必须含不确定度 + QC 状态**:合规要求
5. **PDF 必须支持 OCR 验证**:CNAS 审核员可能扫二维码验真伪

## 验证标准

- [ ] Puppeteer + Chromium 在 Docker 镜像内可启动
- [ ] EJS 模板渲染 HTML < 100ms
- [ ] HTML → PDF 渲染 < 2s
- [ ] PDF 含双语 / 表格 / 签名图章 / 二维码
- [ ] CA 签名 + 时间戳 + 证书链 嵌入 PDF
- [ ] MinIO 上传 + 下载成功
- [ ] 公开验证 API `GET /verify/:reportNo` 工作
- [ ] 审计链中 SHA256 与 PDF 内容一致
- [ ] 性能:报告签发 P95 < 5s
- [ ] CNAS 现场验证:审核员可现场生成 + 验证 PDF

## 相关决策

- ADR-0003: 审计链 SHA256
- ADR-0004: 第三方 CA
- ADR-0011: 贵金属检测业务约束

## 参考

- [Puppeteer 官方文档](https://pptr.dev/)
- [MinIO 官方文档](https://min.io/docs/minio/linux/index.html)
- [RFC 3161 时间戳协议](https://www.rfc-editor.org/rfc/rfc3161)
- [PDF 数字签名规范(Adobe)](https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf)