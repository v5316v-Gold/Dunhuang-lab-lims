const express = require('express');
const router = express.Router();

/**
 * 2026-08-11 阶段 3 - 测量不确定度 A/B 类评定（CNAS-GL005）
 * 增强阶段 2 的 GUM 算法
 */

// 不确定度 A/B 类评定
function evaluateUncertainty({ measurement_value, type_a, type_a_source, type_b_components, coverage_factor = 2, num_measurements = 1 }) {
  // 1. 计算合成不确定度
  // A 类（统计）：u_A = type_a
  const uA = parseFloat(type_a) || 0;
  // B 类（系统）：u_B = sqrt(Σ u_i²)
  let uB = 0;
  let uBSources = [];
  if (type_b_components && Array.isArray(type_b_components)) {
    type_b_components.forEach(c => {
      const ui = parseFloat(c.value) || 0;
      uB += ui * ui;
      uBSources.push({ name: c.name, value: ui, unit: c.unit || '', distribution: c.distribution || 'rectangular' });
    });
    uB = Math.sqrt(uB);
  } else if (typeof type_b === 'number') {
    uB = type_b;
  }

  // 2. 合成不确定度 u_c
  const uC = Math.sqrt(uA * uA + uB * uB);

  // 3. 扩展不确定度 U
  const k = coverage_factor;
  const U = k * uC;

  // 4. 相对不确定度
  const relative = measurement_value ? (U / measurement_value) * 100 : 0;

  // 5. 评定结果
  return {
    uA, uB, uC, U, k, relative,
    sources: {
      typeA: { value: uA, source: type_a_source || 'repeated_measurements' },
      typeB: uBSources.length > 0 ? uBSources : (typeof type_b === 'number' ? { value: type_b, source: 'manual' } : null)
    },
    method: 'CNAS-GL005 GUM (Guide to the Expression of Uncertainty in Measurement)',
    formula: 'u_c = sqrt(u_A² + u_B²), U = k × u_c'
  };
}

// 计算 A 类不确定度（贝塞尔公式）
function calculateTypeA(values) {
  if (!values || values.length < 2) return { value: 0, n: values?.length || 0 };
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const uA = stdDev / Math.sqrt(n); // A类标准不确定度
  return { value: uA, stdDev, mean, n, method: 'Bessel' };
}

// 计算 B 类不确定度（均匀分布）
function calculateTypeBUniform(halfRange, divisor) {
  // u_B = a / √3 （均匀分布）
  const uB = halfRange / (divisor || Math.sqrt(3));
  return { value: uB, distribution: 'rectangular', halfRange, divisor: divisor || Math.sqrt(3) };
}

// 计算 B 类不确定度（正态分布）
function calculateTypeBNormal(halfRange, k) {
  // u_B = a / k （正态分布）
  const uB = halfRange / (k || 2);
  return { value: uB, distribution: 'normal', halfRange, k: k || 2 };
}

// 完整的 A+B 评定 API
router.post('/uncertainty/evaluate', requireAuth, (req, res) => {
  try {
    const result = evaluateUncertainty(req.body);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 自动计算 A 类（从重复测量值）
router.post('/uncertainty/calc-type-a', requireAuth, (req, res) => {
  try {
    const { values } = req.body;
    if (!values || !Array.isArray(values)) return res.status(400).json({ error: 'values 数组必填' });
    res.json({ success: true, data: calculateTypeA(values) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 自动计算 B 类（均匀分布）
router.post('/uncertainty/calc-type-b-uniform', requireAuth, (req, res) => {
  try {
    const { halfRange, divisor } = req.body;
    if (halfRange === undefined) return res.status(400).json({ error: 'halfRange 必填' });
    res.json({ success: true, data: calculateTypeBUniform(halfRange, divisor) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 自动计算 B 类（正态分布）
router.post('/uncertainty/calc-type-b-normal', requireAuth, (req, res) => {
  try {
    const { halfRange, k } = req.body;
    if (halfRange === undefined) return res.status(400).json({ error: 'halfRange 必填' });
    res.json({ success: true, data: calculateTypeBNormal(halfRange, k) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 完整工作流：录数据 → 自动 A 类 → 加 B 类 → 评定 → 保存
router.post('/uncertainty/full-evaluation', requireAuth, (req, res) => {
  try {
    const { sample_id, parameter_name, measurement_value, repeated_values, type_b_components, coverage_factor = 2, method = 'GUM' } = req.body;
    if (!sample_id || !parameter_name || measurement_value === undefined) {
      return res.status(400).json({ error: 'sample_id / parameter_name / measurement_value 必填' });
    }
    // 1. A 类
    const typeA = repeated_values && repeated_values.length > 0
      ? calculateTypeA(repeated_values)
      : { value: 0 };
    // 2. B 类
    const typeBList = type_b_components || [];
    // 3. 合成
    const result = evaluateUncertainty({
      measurement_value,
      type_a: typeA.value,
      type_a_source: typeA.method || 'repeated_measurements',
      type_b_components: typeBList,
      coverage_factor
    });
    // 4. 保存
    const sample = queryOne('SELECT sample_code FROM workflow_samples WHERE id=?', [sample_id]);
    if (sample) {
      const exists = queryOne('SELECT id FROM samples WHERE id=?', [sample_id]);
      if (!exists) run('INSERT INTO samples (id, sample_code) VALUES (?, ?)', [sample_id, sample.sample_code]);
      const dbResult = run(
        `INSERT INTO uncertainty_calculations
         (sample_id, parameter_name, measurement_value, type_a_uncertainty, type_a_source, type_b_uncertainty, type_b_source,
          combined_uncertainty, coverage_factor, expanded_uncertainty, relative_uncertainty, num_measurements, mean_value, standard_deviation, method, calculated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sample_id, parameter_name, measurement_value, result.uA, typeA.method || 'repeated_measurements',
         result.uB, 'B类合成', result.uC, coverage_factor, result.U, result.relative,
         repeated_values?.length || 1, typeA.mean || measurement_value, typeA.stdDev || 0, method, req.session.userId]
      );
      return res.json({ success: true, id: dbResult.lastInsertRowid, evaluation: result, typeA, typeBComponents: typeBList });
    }
    res.json({ success: true, evaluation: result, typeA, typeBComponents: typeBList });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.evaluateUncertainty = evaluateUncertainty;
module.exports.calculateTypeA = calculateTypeA;
module.exports.calculateTypeBUniform = calculateTypeBUniform;
module.exports.calculateTypeBNormal = calculateTypeBNormal;
