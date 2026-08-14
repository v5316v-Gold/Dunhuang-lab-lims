// =====================================================
// Westgard 多规则引擎测试 — Phase 2 Task 2.4
// 规则:
//   1₃s: 1 点超 ±3σ       2₂s: 连续 2 点超 ±2σ 同向
//   R₄s: 相邻点差 > 4σ    4₁s: 连续 4 点超 ±1σ 同向
//   10x: 连续 10 点同侧     Z-score 计算
// =====================================================

import { WestgardService } from '../../src/modules/qc/westgard.service';

describe('Westgard rules engine (Phase 2 Task 2.4)', () => {
  const westgard = new WestgardService();

  // ===== 1₃s =====
  it('1_3s: single point beyond ±3σ fails', () => {
    const r = westgard.evaluate([0.5, -0.2, 3.5]);
    expect(r.passed).toBe(false);
    expect(r.violations).toContain('1_3s');
  });

  it('1_3s: point within ±3σ passes', () => {
    const r = westgard.evaluate([0.5, -0.2, 2.9]);
    expect(r.passed).toBe(true);
  });

  // ===== 2₂s =====
  it('2_2s: two consecutive points beyond ±2σ same direction fails', () => {
    const r = westgard.evaluate([0.1, 2.3, 2.4]); // 最后两个点 2.3/2.4 同向超 2σ
    expect(r.violations).toContain('2_2s');
  });

  it('2_2s: opposite directions do not violate', () => {
    const r = westgard.evaluate([2.3, -2.4]);
    expect(r.violations).not.toContain('2_2s');
  });

  // ===== R₄s =====
  it('R_4s: adjacent points differ by >4σ fails', () => {
    const r = westgard.evaluate([2.1, -2.2]);
    expect(r.violations).toContain('R_4s');
  });

  it('R_4s: difference within 4σ passes', () => {
    const r = westgard.evaluate([1.5, -1.8]);
    expect(r.violations).not.toContain('R_4s');
  });

  // ===== 4₁s =====
  it('4_1s: four consecutive points beyond ±1σ same direction fails', () => {
    const r = westgard.evaluate([1.2, 1.4, 1.3, 1.5]);
    expect(r.violations).toContain('4_1s');
  });

  // ===== 10x =====
  it('10x: ten consecutive points on same side fails', () => {
    const r = westgard.evaluate([0.3, 0.4, 0.2, 0.5, 0.3, 0.6, 0.2, 0.4, 0.3, 0.5]);
    expect(r.violations).toContain('10x');
  });

  it('10x: mixed sides pass', () => {
    const r = westgard.evaluate([0.3, -0.4, 0.2, -0.5, 0.3, -0.6, 0.2, -0.4, 0.3, -0.5]);
    expect(r.violations).not.toContain('10x');
  });

  // ===== Z-score =====
  it('calculateZScore: (measured - expected) / sd', () => {
    expect(westgard.calculateZScore(100.1, 100.0, 0.05)).toBeCloseTo(2, 5);
    expect(westgard.calculateZScore(100.0, 100.0, 0.05)).toBe(0);
    expect(westgard.calculateZScore(100.0, 100.0, 0)).toBe(0); // sd=0 防除零
  });

  // ===== 空输入 =====
  it('empty input passes', () => {
    const r = westgard.evaluate([]);
    expect(r.passed).toBe(true);
  });
});
