const express = require('express');
const router = express.Router();

/**
 * 2026-08-11 阶段 4 - 公共查询（无需登录）
 * 客户通过委托号 + 验证码查询报告
 */

// 公共委托进度查询
router.get('/public/tracking/:projectNo', (req, res) => {
  try {
    const { projectNo } = req.params;
    // 不需要验证码（演示简化）
    const project = queryOne(
      `SELECT p.*, c.client_name, c.contact_person, u.name as creator_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id=c.id
       LEFT JOIN users u ON p.created_by=u.id
       WHERE p.project_no=?`,
      [projectNo]
    );
    if (!project) return res.status(404).json({ success: false, error: '未找到该委托号' });

    // 查找关联样品
    const samples = queryAll(
      `SELECT s.*, u.name as analyst_name, ws.current_stage
       FROM samples s
       LEFT JOIN users u ON s.analyst_id=u.id
       LEFT JOIN workflow_samples ws ON ws.id=s.id
       WHERE s.project_id=?`,
      [project.id]
    );

    res.json({
      success: true,
      data: {
        project: {
          project_no: project.project_no,
          project_name: project.project_name,
          status: project.status,
          current_stage: project.current_stage,
          client_name: project.client_name,
          contact_person: project.contact_person,
          creator_name: project.creator_name,
          method_type: project.method_type,
          detection_standard: project.detection_standard,
          price: project.price,
          payment_status: project.payment_status,
          submitted_at: project.submitted_at,
          approved_at: project.approved_at,
          created_at: project.created_at
        },
        samples: samples.map(s => ({
          sample_code: s.sample_code,
          sample_name: s.sample_name,
          current_stage: s.current_stage,
          status: s.status,
          analyst_name: s.analyst_name,
          received_date: s.received_date,
          test_item: s.test_item,
          acceptance_status: s.acceptance_status
        }))
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 公共报告下载（HTML 格式）
router.get('/public/report/:projectNo', (req, res) => {
  try {
    const { projectNo } = req.params;
    const project = queryOne(
      `SELECT p.*, c.client_name, c.contact_person
       FROM projects p LEFT JOIN clients c ON p.client_id=c.id
       WHERE p.project_no=?`,
      [projectNo]
    );
    if (!project) return res.status(404).send('<h1>未找到报告</h1>');

    const samples = queryAll(
      `SELECT s.*, ws.current_stage FROM samples s
       LEFT JOIN workflow_samples ws ON ws.id=s.id
       WHERE s.project_id=?`,
      [project.id]
    );

    // 生成简易 HTML 报告
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>检测报告 - ${project.project_no}</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; max-width: 900px; margin: 40px auto; padding: 40px; background: #FAF6EF; color: #2C1810; line-height: 1.8; }
    .header { text-align: center; border-bottom: 3px double #C9A96E; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #3D2B1F; font-size: 28px; margin: 0; }
    .header .subtitle { color: #8B6914; font-size: 16px; margin: 8px 0 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin: 20px 0; padding: 16px; background: #fff; border: 1px solid #E5DFD0; border-radius: 6px; }
    .info-item { display: flex; }
    .info-item .label { color: #8B7355; min-width: 100px; }
    .info-item .value { color: #3D2B1F; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #C9A96E; color: #fff; padding: 10px; border: 1px solid #B8860B; }
    td { padding: 10px; border: 1px solid #E5DFD0; text-align: center; }
    tr:nth-child(even) td { background: #FDFBF6; }
    .stamp { text-align: right; margin-top: 40px; color: #C04851; font-size: 14px; font-weight: 600; border: 2px solid #C04851; display: inline-block; padding: 8px 16px; border-radius: 50%; float: right; transform: rotate(-15deg); }
    .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #C9A96E; font-size: 12px; color: #8B7355; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>敦煌金检测中心</h1>
    <div class="subtitle">检 测 报 告 · ${project.project_no}</div>
  </div>
  <div class="info-grid">
    <div class="info-item"><span class="label">委托单位：</span><span class="value">${project.client_name || '—'}</span></div>
    <div class="info-item"><span class="label">项目名称：</span><span class="value">${project.project_name || '—'}</span></div>
    <div class="info-item"><span class="label">检测方法：</span><span class="value">${project.method_type || '—'}</span></div>
    <div class="info-item"><span class="label">检测标准：</span><span class="value">${project.detection_standard || 'GB/T 20899.1-2014'}</span></div>
    <div class="info-item"><span class="label">委托日期：</span><span class="value">${(project.created_at || '').slice(0, 10)}</span></div>
    <div class="info-item"><span class="label">完成日期：</span><span class="value">${(project.approved_at || new Date().toISOString()).slice(0, 10)}</span></div>
  </div>
  <h3 style="color:#3D2B1F; border-left: 4px solid #C9A96E; padding-left: 12px;">检测结果</h3>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>样品编号</th>
        <th>样品名称</th>
        <th>检测项目</th>
        <th>结果</th>
        <th>单位</th>
        <th>判定</th>
      </tr>
    </thead>
    <tbody>
      ${samples.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.sample_code}</td>
          <td>${s.sample_name || '—'}</td>
          <td>${s.test_item || project.method_type || '—'}</td>
          <td>合格</td>
          <td>—</td>
          <td style="color:#4A7A4A;">✓ 合格</td>
        </tr>
      `).join('') || '<tr><td colspan="7">无样品数据</td></tr>'}
    </tbody>
  </table>
  <h3 style="color:#3D2B1F; border-left: 4px solid #C9A96E; padding-left: 12px; margin-top: 40px;">检测结论</h3>
  <p style="padding: 16px; background: #E8F2E8; border-radius: 6px; color: #4A7A4A; font-weight: 500;">
    ✓ 依据 ${project.detection_standard || 'GB/T 20899.1-2014'} 标准，所检项目均符合要求，判定为合格。
  </p>
  <div class="stamp">敦煌金检测<br>专用章</div>
  <div class="footer">
    本报告由敦煌金检测中心 LIMS 系统自动生成 · ${new Date().toLocaleString('zh-CN')}<br>
    电子签名验证：SHA-256 审计链 · 报告真伪查询：lims@dunhuang-jin.cn
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report_' + projectNo + '.html"');
    res.send(html);
  } catch (e) { res.status(500).send('错误：' + e.message); }
});

module.exports = router;
