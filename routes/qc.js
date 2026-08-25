const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 阶段 2 P1 - QC 质控引擎（节点 8）
// 参考：金现代 LIMS 文档 + Westgard Rules 国际标准
// ============================================================

// Westgard 多规则引擎
class WestgardRules {
  constructor() {
    // 规则定义
    this.rules = {
      '1_3s': { name: '1_3s', desc: '1个质控值超过 ±3SD（失控警告）', severity: 're' },
      '1_2s': { name: '1_2s', desc: '1个质控值超过 ±2SD（警告规则）', severity: 'warning' },
      '2_2s': { name: '2_2s', desc: '连续2个质控值同方向超过 ±2SD（系统误差）', severity: 're' },
      'R_4s': { name: 'R_4s', desc: '同批内2个质控值极差 > 4SD（随机误差）', severity: 're' },
      '4_1s': { name: '4_1s', desc: '连续4个质控值同方向超过 ±1SD（系统误差）', severity: 're' },
      '10_x': { name: '10_x', desc: '连续10个质控值在均值同侧（系统漂移）', severity: 're' }
    };
  }

  // 单点判定（用最近 N 个质控值判定）
  judge(measurements, options = {}) {
    // measurements: [{value, mean, sd},,,] 时间正序
    const sd = options.sd || 2;
    const violations = [];
    const len = measurements.length;
    if (len === 0) return { violations: [], judgement: 'unknown', score: 0 };

    const last = measurements[len - 1];
    const z = (last.value - last.mean) / last.sd;

    // 1_3s: 1个值超过 ±3SD
    if (Math.abs(z) >= 3) {
      violations.push({ rule: '1_3s', z, severity: 're', desc: this.rules['1_3s'].desc });
    }
    // 1_2s: 1个值超过 ±2SD（警告，不失控）
    else if (Math.abs(z) >= 2) {
      violations.push({ rule: '1_2s', z, severity: 'warning', desc: this.rules['1_2s'].desc });
    }

    // 2_2s: 连续2个值同方向超过 +2SD 或 -2SD
    if (len >= 2) {
      const prev = measurements[len - 2];
      const prevZ = (prev.value - prev.mean) / prev.sd;
      if (Math.abs(z) >= 2 && Math.abs(prevZ) >= 2 && (z > 0) === (prevZ > 0)) {
        violations.push({ rule: '2_2s', z, severity: 're', desc: this.rules['2_2s'].desc });
      }
    }

    // R_4s: 同批内2个值极差 > 4SD（一个 > +2SD，另一个 < -2SD）
    if (len >= 2) {
      const prev = measurements[len - 2];
      const prevZ = (prev.value - prev.mean) / prev.sd;
      if (Math.abs(z - prevZ) >= 4) {
        violations.push({ rule: 'R_4s', z, severity: 're', desc: this.rules['R_4s'].desc });
      }
    }

    // 4_1s: 连续4个值同方向超过 +1SD 或 -1SD
    if (len >= 4) {
      const last4 = measurements.slice(-4);
      const allPositive = last4.every(m => (m.value - m.mean) / m.sd >= 1);
      const allNegative = last4.every(m => (m.value - m.mean) / m.sd <= -1);
      if (allPositive || allNegative) {
        violations.push({ rule: '4_1s', z, severity: 're', desc: this.rules['4_1s'].desc });
      }
    }

    // 10_x: 连续10个值在均值同侧
    if (len >= 10) {
      const last10 = measurements.slice(-10);
      const allAbove = last10.every(m => m.value >= m.mean);
      const allBelow = last10.every(m => m.value <= m.mean);
      if (allAbove || allBelow) {
        violations.push({ rule: '10_x', z, severity: 're', desc: this.rules['10_x'].desc });
      }
    }

    // 综合判定
    const hasRe = violations.some(v => v.severity === 're');
    const hasWarning = violations.some(v => v.severity === 'warning');
    let judgement = 'pass';
    if (hasRe) judgement = 're';
    else if (hasWarning) judgement = 'warning';

    return { violations, judgement, z, score: this.calculateScore(violations) };
  }

  // 质控评分（0-100）
  calculateScore(violations) {
    let s = 100;
    violations.forEach(v => {
      if (v.severity === 're') s -= 30;
      else if (v.severity === 'warning') s -= 10;
    });
    return Math.max(0, s);
  }
}

const westgard = new WestgardRules();

// 列出质控样
router.get('/qc-samples', requireAuth, (req, res) => {
  try {
    const { qc_type, judgement, parameter_name, date_start, date_end, limit } = req.query;
    let sql = `SELECT q.*, u.name as operator_name FROM qc_samples q LEFT JOIN users u ON q.operator_id=u.id WHERE 1=1`;
    const params = [];
    if (qc_type) { sql += ' AND q.qc_type = ?'; params.push(qc_type); }
    if (judgement) { sql += ' AND q.judgement = ?'; params.push(judgement); }
    if (parameter_name) { sql += ' AND q.qc_name LIKE ?'; params.push('%' + parameter_name + '%'); }
    if (date_start) { sql += ' AND q.test_date >= ?'; params.push(date_start); }
    if (date_end) { sql += ' AND q.test_date <= ?'; params.push(date_end); }
    sql += ' ORDER BY q.test_date DESC, q.id DESC LIMIT ?';
    params.push(parseInt(limit) || 200);
    res.json({ success: true, data: queryAll(sql, params) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 新增质控样 + 自动 Westgard 判定
router.post('/qc-samples', requireAuth, (req, res) => {
  try {
    const { qc_type, qc_name, expected_value, tolerance, unit, measured_value, related_sample_id, test_date, remark } = req.body;
    if (!qc_type || !qc_name || !measured_value) return res.status(400).json({ error: '必填字段缺失' });

    // 自动生成质控编号
    const max = queryOne('SELECT MAX(id) as max_id FROM qc_samples');
    const nextId = (max && max.max_id) ? max.max_id + 1 : 1;
    const qc_no = 'QC-' + String(nextId).padStart(6, '0');

    // 计算偏差
    const deviation = measured_value - (expected_value || 0);
    const deviation_percent = expected_value ? (deviation / expected_value) * 100 : 0;

    // 查过去同类型质控样历史（最近 10 个）做 Westgard 判定
    const history = queryAll(
      'SELECT measured_value as value, expected_value as mean, tolerance as sd FROM qc_samples WHERE qc_type=? AND qc_name=? ORDER BY test_date DESC, id DESC LIMIT 10',
      [qc_type, qc_name]
    );
    // 转换为 Westgard 期望格式（value/mean/sd）
    const measurements = history.map(h => ({
      value: parseFloat(h.value),
      mean: parseFloat(h.mean),
      sd: parseFloat(h.sd) || 1
    }));
    measurements.push({ value: parseFloat(measured_value), mean: parseFloat(expected_value || 0), sd: parseFloat(tolerance || 1) });

    const judgeResult = westgard.judge(measurements);

    // 保存
    const result = run(
      `INSERT INTO qc_samples
       (qc_no, qc_type, qc_name, expected_value, tolerance, unit, measured_value, deviation, deviation_percent,
        westgard_1_3s, westgard_2_2s, westgard_R_4s, westgard_4_1s, westgard_10_x, rule_violated,
        judgement, related_sample_id, operator_id, test_date, remark)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [qc_no, qc_type, qc_name, expected_value || 0, tolerance || 1, unit || '',
       measured_value, deviation, deviation_percent,
       judgeResult.violations.some(v => v.rule === '1_3s') ? 1 : 0,
       judgeResult.violations.some(v => v.rule === '2_2s') ? 1 : 0,
       judgeResult.violations.some(v => v.rule === 'R_4s') ? 1 : 0,
       judgeResult.violations.some(v => v.rule === '4_1s') ? 1 : 0,
       judgeResult.violations.some(v => v.rule === '10_x') ? 1 : 0,
       judgeResult.violations.map(v => v.rule).join(','),
       judgeResult.judgement,
       related_sample_id || null,
       req.session.userId,
       test_date || new Date().toISOString().split('T')[0],
       remark || '']
    );

    res.json({
      success: true,
      id: result,
      qc_no,
      judgement: judgeResult.judgement,
      score: judgeResult.score,
      violations: judgeResult.violations,
      z_score: judgeResult.z
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除质控样
router.delete('/qc-samples/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM qc_samples WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Levey-Jennings 质控图数据（按 qc_name + qc_type 聚合最近 N 个点）
router.get('/qc-samples/lj-chart', requireAuth, (req, res) => {
  try {
    const { qc_type, qc_name, limit } = req.query;
    if (!qc_type || !qc_name) return res.status(400).json({ error: 'qc_type/qc_name 必填' });
    const data = queryAll(
      `SELECT qc_no, test_date, measured_value, expected_value as mean, tolerance as sd,
              deviation, deviation_percent, judgement, rule_violated
       FROM qc_samples WHERE qc_type=? AND qc_name=?
       ORDER BY test_date ASC, id ASC LIMIT ?`,
      [qc_type, qc_name, parseInt(limit) || 50]
    );
    // 计算每点的 z-score
    const chart = data.map(d => ({
      ...d,
      z_score: d.sd ? (d.measured_value - d.mean) / d.sd : 0
    }));
    res.json({ success: true, data: chart });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// QC 统计（按月/按类型统计合格率）
router.get('/qc-samples/stats', requireAuth, (req, res) => {
  try {
    const data = queryAll(
      `SELECT qc_type, qc_name,
              COUNT(*) as total_count,
              SUM(CASE WHEN judgement='pass' THEN 1 ELSE 0 END) as pass_count,
              SUM(CASE WHEN judgement='warning' THEN 1 ELSE 0 END) as warning_count,
              SUM(CASE WHEN judgement='re' THEN 1 ELSE 0 END) as re_count
       FROM qc_samples WHERE test_date >= date('now', '-30 day')
       GROUP BY qc_type, qc_name`
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
