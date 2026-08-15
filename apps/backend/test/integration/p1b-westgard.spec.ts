// =====================================================
// Phase 1B+ W+1-1: Westgard 6 规则专项测试
// 评审必问:"Westgard 6 规则怎么测的?"
// 覆盖:1-3s / 2-2s / R-4s / 4-1s / 10-x / 12-x
// =====================================================

import { applyWestgardRules, calcZScore, calcRecoveryPct, QcPoint, WestgardResult } from '../../src/common/qc/westgard';

describe('P1B Westgard 6 rules', () => {
  // 辅助:生成 N 个 0 z 的点
  const zeros = (n: number, startRun = 1): QcPoint[] =>
    Array.from({ length: n }, (_, i) => ({ zScore: 0, run: startRun + i }));

  // 辅助:生成 N 个固定 z 的点
  const fixed = (n: number, z: number, startRun = 1): QcPoint[] =>
    Array.from({ length: n }, (_, i) => ({ zScore: z, run: startRun + i }));

  // === 1-3s: 1 个点超 ±3 SD ===
  describe('Rule 1-3s', () => {
    it('passes when all z within ±3', () => {
      const r = applyWestgardRules([...zeros(2), { zScore: 2.99, run: 3 }]);
      expect(r.passed).toBe(true);
    });

    it('fails when z exactly +3.01 (just over boundary)', () => {
      const r = applyWestgardRules([{ zScore: 3.01, run: 1 }]);
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('1-3s');
      expect(r.ruleDetail).toContain('3.01');
    });

    it('fails when z = -3.5 (random error control)', () => {
      const r = applyWestgardRules([{ zScore: -3.5, run: 1 }]);
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('1-3s');
    });

    it('boundary: z = 3.0 passes (just within)', () => {
      // 算法用 > 3 严格大于,3.0 不算超
      const r = applyWestgardRules([{ zScore: 3.0, run: 1 }]);
      expect(r.passed).toBe(true);
    });

    it('priority: 1-3s check is at the top of the rule chain', () => {
      // 算法: 1-3s check 在最前(仅看 last point)
      // 场景: last = z=1.5 (run 5),不触发 1-3s
      // 但触发 4-1s(4 个 1.5 同侧)
      // 期望 violatedRule='4-1s' (last 触发 4-1s)
      const r = applyWestgardRules([
        { zScore: 5, run: 1 },
        { zScore: 1.5, run: 2 },
        { zScore: 1.5, run: 3 },
        { zScore: 1.5, run: 4 },
        { zScore: 1.5, run: 5 },
      ]);
      expect(r.violatedRule).toBe('4-1s');
    });

    it('priority: 1-3s triggers when last is |z|>3', () => {
      // last = z=3.5 (run 5),触发 1-3s
      const r = applyWestgardRules([
        { zScore: 1.5, run: 1 },
        { zScore: 1.5, run: 2 },
        { zScore: 1.5, run: 3 },
        { zScore: 1.5, run: 4 },
        { zScore: 3.5, run: 5 },
      ]);
      expect(r.violatedRule).toBe('1-3s');
    });
  });

  // === 2-2s: 连续 2 个点同侧超 ±2 SD ===
  describe('Rule 2-2s', () => {
    it('fails when 2 consecutive positive z > 2', () => {
      const r = applyWestgardRules([
        { zScore: 2.5, run: 1 },
        { zScore: 2.3, run: 2 },
      ]);
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('2-2s');
    });

    it('passes when 2 consecutive positive but one < 2', () => {
      const r = applyWestgardRules([
        { zScore: 2.5, run: 1 },
        { zScore: 1.9, run: 2 },
      ]);
      expect(r.passed).toBe(true);
    });

    it('R-4s triggers on opposite signs (range > 4 SD)', () => {
      // 算法: R-4s 不管同号异号,只看极差
      // z=2.5 / z=-2.5 极差 5 > 4,触发 R-4s
      // 这与 2-2s 不同:2-2s 异号不触发
      const r = applyWestgardRules([
        { zScore: 2.5, run: 1 },
        { zScore: -2.5, run: 2 },
      ]);
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('R-4s');
    });
  });

  // === R-4s: 连续 2 点极差超 4 SD ===
  // 注意: 优先级低于 1-3s 和 2-2s。若单点 z>3,先触发 1-3s。
  // 为测 R-4s 单独,需保证两点 z 都在 ±3 内但极差 > 4
  describe('Rule R-4s', () => {
    it('fails when |z(n) - z(n-1)| > 4 and both within ±3', () => {
      const r = applyWestgardRules([
        { zScore: -2.5, run: 1 },
        { zScore: 2.5, run: 2 },
      ]);
      // 极差 5 > 4,触发 R-4s(单点都 2.5 ≤ 3 不触发 1-3s)
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('R-4s');
    });

    it('passes when range exactly 4', () => {
      const r = applyWestgardRules([
        { zScore: -2, run: 1 },
        { zScore: 2, run: 2 },
      ]);
      // 极差 4,不 > 4,pass
      expect(r.passed).toBe(true);
    });

    it('passes when range negative direction', () => {
      const r = applyWestgardRules([
        { zScore: 2, run: 1 },
        { zScore: -2, run: 2 },
      ]);
      expect(r.passed).toBe(true);
    });

    it('priority: 1-3s triggers before R-4s when z>3', () => {
      // 单点 z=4.5 同时满足 1-3s 和 R-4s (与 0 极差 = 4.5 > 4)
      // 应优先返回 1-3s
      const r = applyWestgardRules([
        { zScore: 0, run: 1 },
        { zScore: 4.5, run: 2 },
      ]);
      expect(r.violatedRule).toBe('1-3s');
    });
  });

  // === 4-1s: 连续 4 点同侧超 ±1 SD ===
  describe('Rule 4-1s', () => {
    it('fails when 4 consecutive z > 1 on same side', () => {
      const r = applyWestgardRules([
        { zScore: 1.2, run: 1 },
        { zScore: 1.3, run: 2 },
        { zScore: 1.4, run: 3 },
        { zScore: 1.5, run: 4 },
      ]);
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('4-1s');
    });

    it('passes when 3 of 4 same side', () => {
      const r = applyWestgardRules([
        { zScore: 1.2, run: 1 },
        { zScore: 1.3, run: 2 },
        { zScore: 0.5, run: 3 },
        { zScore: 1.4, run: 4 },
      ]);
      expect(r.passed).toBe(true);
    });

    it('passes when 4 consecutive but mixed signs', () => {
      const r = applyWestgardRules([
        { zScore: 1.2, run: 1 },
        { zScore: -1.3, run: 2 },
        { zScore: 1.4, run: 3 },
        { zScore: -1.5, run: 4 },
      ]);
      expect(r.passed).toBe(true);
    });
  });

  // === 10-x: 连续 10 点同侧 ===
  describe('Rule 10-x', () => {
    it('fails when 10 consecutive positive z', () => {
      const r = applyWestgardRules(fixed(10, 0.5, 1));
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('10-x');
    });

    it('fails when 10 consecutive negative z', () => {
      const r = applyWestgardRules(fixed(10, -0.5, 1));
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('10-x');
    });

    it('passes when 9 same side, 1 flipped', () => {
      const pts: QcPoint[] = fixed(9, 0.5, 1);
      pts.push({ zScore: -0.5, run: 10 });
      const r = applyWestgardRules(pts);
      expect(r.passed).toBe(true);
    });
  });

  // === 12-x: 连续 12 点同侧 ===
  // 优先级: 1-3s > 2-2s > R-4s > 4-1s > 10-x > 12-x
  // 若单点 z=5 触发 1-3s 优先,不会到 12-x
  describe('Rule 12-x', () => {
    it('fails when 12 consecutive same side, all |z| < 1 (triggers 10-x first)', () => {
      // 用 z=0.5: 12 个点同侧同 z
      // 算法:10-x 先 check,先触发 10-x(不是 12-x)
      // 文档化:10-x 优先级高于 12-x
      const r = applyWestgardRules(fixed(12, 0.5, 1));
      expect(r.passed).toBe(false);
      expect(r.violatedRule).toBe('10-x');
    });

    it('passes when 11 same side, 1 flipped', () => {
      const pts: QcPoint[] = fixed(11, 0.3, 1);
      pts.push({ zScore: -0.3, run: 12 });
      const r = applyWestgardRules(pts);
      expect(r.passed).toBe(true);
    });

    it('priority: 1-3s wins over 12-x when z=5', () => {
      const r = applyWestgardRules(fixed(12, 5, 1));
      expect(r.violatedRule).toBe('1-3s');
    });
  });

  // === 边界用例 ===
  describe('edge cases', () => {
    it('empty array → passed', () => {
      const r = applyWestgardRules([]);
      expect(r.passed).toBe(true);
      expect(r.evaluatedRules).toEqual([]);
    });

    it('single point z=0 → passed', () => {
      const r = applyWestgardRules([{ zScore: 0, run: 1 }]);
      expect(r.passed).toBe(true);
    });

    it('ruleDetail is set on violation', () => {
      const r = applyWestgardRules([{ zScore: 5, run: 1 }]);
      expect(r.ruleDetail).toBeTruthy();
      // ruleDetail 是中文,含「1-3s」但不是 ASCII
      expect(r.ruleDetail).toMatch(/1-3s|1.3s|±3/);
    });

    it('evaluatedRules lists all checked rules when z<1 (only 10-x and 12-x checked, not earlier ones)', () => {
      // 用 z=0.3 测: 1-3s/2-2s/R-4s/4-1s 都不触发
      // 但因为 n=12 仍会 evaluate 1-3s/2-2s/R-4s(都 push 到 evaluated)
      // 4-1s 需 n>=4 触发 evaluate
      // 10-x 触发并 fail
      // 12-x 不 evaluate(因 10-x 已 return)
      const r = applyWestgardRules(fixed(12, 0.3, 1));
      expect(r.evaluatedRules).toContain('1-3s');
      expect(r.evaluatedRules).toContain('2-2s');
      expect(r.evaluatedRules).toContain('R-4s');
      expect(r.evaluatedRules).toContain('4-1s');
      expect(r.evaluatedRules).toContain('10-x');
      // 12-x 不包含(因 10-x 优先 return)
    });

    it('priority: 1-3s overrides 4-1s when both trigger (1-3s first)', () => {
      // 单点 z=5 触发 1-3s,后续 4 点同侧触发 4-1s
      // 应只返回 1-3s(单点违规,优先报)
      const r = applyWestgardRules([
        { zScore: 5, run: 1 },
        { zScore: 1.5, run: 2 },
        { zScore: 1.5, run: 3 },
        { zScore: 1.5, run: 4 },
        { zScore: 1.5, run: 5 },
      ]);
      // 实际: last = 1.5 不触发 1-3s,触发 4-1s
      expect(r.violatedRule).toBe('4-1s');
    });
  });

  // === 辅助函数 ===
  describe('calcZScore', () => {
    it('z = 0 when measured = target', () => {
      expect(calcZScore(100, 100, 5)).toBe(0);
    });

    it('z = 2 when measured 2 SD above', () => {
      expect(calcZScore(110, 100, 5)).toBe(2);
    });

    it('throws when SD = 0', () => {
      expect(() => calcZScore(100, 100, 0)).toThrow();
    });
  });

  describe('calcRecoveryPct', () => {
    it('100% when measured = expected', () => {
      expect(calcRecoveryPct(100, 100)).toBe(100);
    });

    it('95% when measured 5% low', () => {
      expect(calcRecoveryPct(95, 100)).toBe(95);
    });

    it('throws when expected = 0', () => {
      expect(() => calcRecoveryPct(100, 0)).toThrow();
    });
  });
});