// =====================================================
// 火试金计算器算例测试 — Phase 2 Task 2.3
// 依据: ADR-0011 §4(公式) + GB/T 9288(仲裁方法)
// 验证:
//   1. 差减法基本算例(已知值)
//   2. QC 修正算例
//   3. QC 回收率边界(99.5-100.5% 判定)
//   4. 平行样 RSD 算例
//   5. 纯度等级判断(5N/4N/3N)
//   6. 非法输入抛错
// =====================================================

import {
  calculateFireAssayPurity,
  calculateParallelRSD,
  getPurityGrade,
} from '../../src/modules/test/fire-assay.calculator';

describe('Fire assay calculator (Phase 2 Task 2.3)', () => {
  // ===== 1. 差减法基本算例 =====
  it('subtraction method: known value', () => {
    // 称样 1.0000g,金粒 0.9988g → 纯度 99.880000%
    const r = calculateFireAssayPurity({ sampleWeightG: '1.0000', prillWeightG: '0.9988' });
    expect(r.purityPct).toBe('99.880000');
    expect(r.qcPassed).toBe(true);
  });

  it('subtraction method: 5N gold (99.999%)', () => {
    const r = calculateFireAssayPurity({ sampleWeightG: '1.00000', prillWeightG: '0.99999' });
    expect(r.purityPct).toBe('99.999000'); // 0.99999/1.00000 × 100 = 99.999
  });

  // ===== 2. QC 修正算例 =====
  it('QC correction: recovery 99.88% restores purity', () => {
    // 差减 99.88%,QC 回收率 99.88% → 修正后 100.00%
    const r = calculateFireAssayPurity({
      sampleWeightG: '1.0000',
      prillWeightG: '0.9988',
      qcRecoveryPct: '99.88',
    });
    expect(r.qcPassed).toBe(true);
    const expected = (99.88 * 100) / 99.88; // = 100
    expect(parseFloat(r.purityPct)).toBeCloseTo(expected, 4);
  });

  // ===== 3. QC 回收率边界 =====
  it('QC recovery boundary: 99.5-100.5% passes, outside fails', () => {
    const passLow = calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '0.9', qcRecoveryPct: '99.5' });
    expect(passLow.qcPassed).toBe(true);

    const passHigh = calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '0.9', qcRecoveryPct: '100.5' });
    expect(passHigh.qcPassed).toBe(true);

    const failLow = calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '0.9', qcRecoveryPct: '99.4' });
    expect(failLow.qcPassed).toBe(false);

    const failHigh = calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '0.9', qcRecoveryPct: '100.6' });
    expect(failHigh.qcPassed).toBe(false);
  });

  // ===== 4. 平行样 RSD =====
  it('parallel RSD: known values', () => {
    // [99.9, 100.1]: mean=100, sd=0.14142, RSD=0.1414%
    const rsd = calculateParallelRSD(['99.9', '100.1']);
    expect(parseFloat(rsd)).toBeCloseTo(0.1414, 3);
  });

  it('parallel RSD: requires at least 2 values', () => {
    expect(() => calculateParallelRSD(['99.9'])).toThrow();
  });

  // ===== 5. 纯度等级 =====
  it('purity grade: 5N/4N/3N/990/950/other', () => {
    expect(getPurityGrade('99.9990')).toBe('Au99999 (5N)');
    expect(getPurityGrade('99.9900')).toBe('Au9999 (4N)');
    expect(getPurityGrade('99.9000')).toBe('Au999 (3N)');
    expect(getPurityGrade('99.0000')).toBe('Au990');
    expect(getPurityGrade('95.0000')).toBe('Au950');
    expect(getPurityGrade('90.0000')).toBe('其他');
  });

  // ===== 6. 非法输入 =====
  it('invalid inputs throw', () => {
    expect(() => calculateFireAssayPurity({ sampleWeightG: '0', prillWeightG: '1' })).toThrow('称样量');
    expect(() => calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '-1' })).toThrow('金粒重');
    expect(() => calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '2' })).toThrow('大于称样量');
    expect(() => calculateFireAssayPurity({ sampleWeightG: '1', prillWeightG: '0.5', qcRecoveryPct: '0' })).toThrow('QC 回收率');
  });
});
