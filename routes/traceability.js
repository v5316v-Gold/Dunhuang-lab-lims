const express = require('express');
const router = express.Router();

/**
 * 2026-08-11 阶段 4 - 全流程溯源（节点 11 资料归档 + 一站式查询）
 *
 * 完整链路：委托单 → 收样 → 检测 → 质控 → 核验 → 报告 → 复检 → 留样
 * 数据来源：projects + samples/workflow_samples + tests + qc_samples + 
 *          approval_records + uncertainty_calculations + retest_records + 
 *          retain_samples + capa_records + workflow_history
 */

// 完整溯源 API（按项目 ID 或样品 code）
router.get('/traceability/:identifier', requireAuth, (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);
    let project = null;
    let workflowSample = null;
    let client = null;

    if (isNumeric) {
      // 按项目 ID 查
      project = queryOne('SELECT * FROM projects WHERE id=?', [parseInt(identifier)]);
      if (project) {
        workflowSample = queryOne('SELECT * FROM workflow_samples WHERE sample_code=?', [project.project_no + '-S1']); // 临时映射
        client = project.client_id ? queryOne('SELECT * FROM clients WHERE id=?', [project.client_id]) : null;
      }
    } else {
      // 按 sample_code 查
      workflowSample = queryOne('SELECT * FROM workflow_samples WHERE sample_code=?', [identifier]);
      if (workflowSample) {
        // 通过 project 关联
        // （如有 sample_id 关联 project_id）
        project = queryOne('SELECT * FROM projects WHERE id=(SELECT project_id FROM samples WHERE sample_code=?)', [identifier]);
        client = workflowSample.client_name ? { client_name: workflowSample.client_name } : null;
      }
    }

    if (!workflowSample && !project) {
      return res.status(404).json({ error: '未找到对应的委托或样品' });
    }

    // 收集溯源数据
    const sampleId = workflowSample ? workflowSample.id : null;
    const result = {
      summary: {
        sample_code: workflowSample ? workflowSample.sample_code : (project ? project.project_no : null),
        project_name: project ? project.project_name : null,
        project_no: project ? project.project_no : null,
        client_name: client ? client.client_name : (workflowSample ? workflowSample.client_name : null),
        current_stage: workflowSample ? workflowSample.current_stage : null,
        status: workflowSample ? workflowSample.current_stage : (project ? project.status : null),
        method_type: project ? project.method_type : (workflowSample ? workflowSample.detection_method : null),
        price: project ? project.price : null,
        paid_amount: project ? project.paid_amount : null,
        payment_status: project ? project.payment_status : null,
        detection_items: project ? (project.detection_items ? JSON.parse(project.detection_items) : null) : null,
        detection_standard: project ? project.detection_standard : null,
        expected_date: project ? project.expected_date : null,
        submitted_at: project ? project.submitted_at : null,
        approved_at: project ? project.approved_at : null,
        created_at: project ? project.created_at : (workflowSample ? workflowSample.created_at : null)
      },
      workflow: [],
      approvals: [],
      qc: [],
      uncertainty: [],
      retests: [],
      retains: [],
      capas: [],
      samples: []
    };

    // 1. 工作流历史
    if (sampleId) {
      result.workflow = queryAll(
        `SELECT h.*, u.name as user_name FROM workflow_history h
         LEFT JOIN users u ON h.action_user_id=u.id
         WHERE h.sample_id=? ORDER BY h.action_date ASC`,
        [sampleId]
      );
    }

    // 2. 审批记录
    if (sampleId) {
      result.approvals = queryAll(
        `SELECT a.*, u.name as approver_name, u.role as approver_role
         FROM approval_records a LEFT JOIN users u ON a.approver_id=u.id
         WHERE (a.target_type='sample' AND a.target_id=?) OR (a.target_type='project' AND a.target_id=?)
         ORDER BY a.created_at ASC`,
        [sampleId, project ? project.id : 0]
      );
    }

    // 3. 质控数据
    if (sampleId) {
      result.qc = queryAll(
        `SELECT * FROM qc_samples WHERE related_sample_id=? ORDER BY test_date DESC`,
        [sampleId]
      );
    }

    // 4. 不确定度
    if (sampleId) {
      result.uncertainty = queryAll(
        `SELECT * FROM uncertainty_calculations WHERE sample_id=? ORDER BY calculated_at DESC`,
        [sampleId]
      );
    }

    // 5. 复检
    if (sampleId) {
      result.retests = queryAll(
        `SELECT * FROM retest_records WHERE original_sample_id=? OR retest_sample_id=? ORDER BY requested_at DESC`,
        [sampleId, sampleId]
      );
    }

    // 6. 留样
    if (sampleId) {
      result.retains = queryAll(
        `SELECT * FROM retain_samples WHERE sample_id=? ORDER BY retained_at DESC`,
        [sampleId]
      );
    }

    // 7. CAPA
    if (sampleId) {
      result.capas = queryAll(
        `SELECT * FROM capa_records WHERE sample_id=? ORDER BY created_at DESC`,
        [sampleId]
      );
    }

    // 8. 样品（收样信息）
    if (sampleId) {
      const sample = queryOne('SELECT * FROM samples WHERE id=?', [sampleId]);
      if (sample) result.samples = [sample];
    }

    // 计算汇总统计
    result.stats = {
      total_stages: result.workflow.length,
      total_approvals: result.approvals.length,
      total_qc: result.qc.length,
      qc_pass_rate: result.qc.length > 0 ? (result.qc.filter(q => q.judgement === 'pass').length / result.qc.length * 100).toFixed(1) : 'N/A',
      total_uncertainty: result.uncertainty.length,
      total_retests: result.retests.length,
      total_retains: result.retains.length,
      total_capas: result.capas.length
    };

    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 列出所有可溯源的委托（按项目状态分组）
router.get('/traceability/list/summary', requireAuth, (req, res) => {
  try {
    const data = queryAll(
      `SELECT p.id, p.project_no, p.project_name, p.status, p.current_stage,
              c.client_name, p.price, p.created_at,
              (SELECT COUNT(*) FROM workflow_samples ws WHERE ws.sample_code=p.project_no) as sample_count
       FROM projects p
       LEFT JOIN clients c ON p.client_id=c.id
       ORDER BY p.id DESC LIMIT 200`
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 公共溯源查询（无登录，按委托号+验证码）
router.get('/public/trace/:projectNo/:verifyCode', (req, res) => {
  try {
    const { projectNo, verifyCode } = req.params;
    // 简单的验证码（演示）
    if (verifyCode !== projectNo.slice(-4)) {
      return res.status(403).json({ error: '验证码错误' });
    }
    const project = queryOne('SELECT id, project_no, project_name, status, current_stage, created_at FROM projects WHERE project_no=?', [projectNo]);
    if (!project) return res.status(404).json({ error: '未找到委托' });
    // 返回简化数据
    res.json({
      success: true,
      data: {
        project_no: project.project_no,
        project_name: project.project_name,
        status: project.status,
        current_stage: project.current_stage,
        created_at: project.created_at,
        report_url: '/api/public/report/' + projectNo + '/' + verifyCode
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
