// =====================================================
// Phase 1B P0-C: Westgard 多规则核心算法
// 6 规则 + 完整 Z-score 序列分析
// 行业标准: CLSI EP15-A3 / Westgard QC
// =====================================================

export interface QcPoint {
  zScore: number;        // z = (measured - target) / SD
  run: number;            // 序号(1, 2, 3, ...)
}

export interface WestgardResult {
  passed: boolean;
  violatedRule?: string;  // '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10-x' | '12-x'
  ruleDetail?: string;    // 详细描述
  evaluatedRules: string[];
}

/**
 * 应用 6 个 Westgard 多规则
 * @param points  按时间顺序的 QC 控制点(每个点 z-score)
 * @returns   passed + 违反的规则
 */
export function applyWestgardRules(points: QcPoint[]): WestgardResult {
  if (!points || points.length === 0) {
    return { passed: true, evaluatedRules: [] };
  }

  const evaluated: string[] = [];
  const n = points.length;
  const last = points[n - 1];

  // Rule 1: 1-3s — 1 个点超 ±3 SD
  evaluated.push('1-3s');
  if (Math.abs(last.zScore) > 3) {
    return {
      passed: false,
      violatedRule: '1-3s',
      ruleDetail: `第 ${last.run} 次测量 z=${last.zScore.toFixed(2)},超 ±3 SD 警告限(随机误差失控)`,
      evaluatedRules: evaluated,
    };
  }

  // Rule 2: 2-2s — 连续 2 个点同侧超 ±2 SD
  if (n >= 2) {
    evaluated.push('2-2s');
    const prev = points[n - 2];
    if (Math.abs(prev.zScore) > 2 && Math.abs(last.zScore) > 2
        && Math.sign(prev.zScore) === Math.sign(last.zScore)) {
      return {
        passed: false,
        violatedRule: '2-2s',
        ruleDetail: `连续 2 次(${prev.run} & ${last.run})同侧超 ±2 SD(系统误差)`,
        evaluatedRules: evaluated,
      };
    }
  }

  // Rule 3: R-4s — 连续 2 点极差超 4 SD
  if (n >= 2) {
    evaluated.push('R-4s');
    const prev = points[n - 2];
    if (Math.abs(last.zScore - prev.zScore) > 4) {
      return {
        passed: false,
        violatedRule: 'R-4s',
        ruleDetail: `连续 2 次极差 ${Math.abs(last.zScore - prev.zScore).toFixed(2)} SD > 4(随机误差大幅波动)`,
        evaluatedRules: evaluated,
      };
    }
  }

  // Rule 4: 4-1s — 连续 4 点同侧超 ±1 SD
  if (n >= 4) {
    evaluated.push('4-1s');
    const last4 = points.slice(-4);
    if (last4.every((p) => Math.abs(p.zScore) > 1)
        && last4.every((p) => Math.sign(p.zScore) === Math.sign(last.zScore))) {
      return {
        passed: false,
        violatedRule: '4-1s',
        ruleDetail: `连续 4 次同侧超 ±1 SD(系统误差累积)`,
        evaluatedRules: evaluated,
      };
    }
  }

  // Rule 5: 10-x — 连续 10 点同侧
  if (n >= 10) {
    evaluated.push('10-x');
    const last10 = points.slice(-10);
    if (last10.every((p) => Math.sign(p.zScore) === Math.sign(last.zScore))) {
      return {
        passed: false,
        violatedRule: '10-x',
        ruleDetail: `连续 10 次同侧(${last10[0].run}-${last.run},z=${last.zScore.toFixed(2)})(系统误差严重漂移)`,
        evaluatedRules: evaluated,
      };
    }
  }

  // Rule 6: 12-x — 连续 12 点同侧
  if (n >= 12) {
    evaluated.push('12-x');
    const last12 = points.slice(-12);
    if (last12.every((p) => Math.sign(p.zScore) === Math.sign(last.zScore))) {
      return {
        passed: false,
        violatedRule: '12-x',
        ruleDetail: `连续 12 次同侧(${last12[0].run}-${last.run})(系统误差临界)`,
        evaluatedRules: evaluated,
      };
    }
  }

  return { passed: true, evaluatedRules: evaluated };
}

/**
 * 便捷函数:计算 Z-score
 */
export function calcZScore(measured: number, target: number, sd: number): number {
  if (sd === 0) {
    throw new Error('SD 不能为 0');
  }
  return (measured - target) / sd;
}

/**
 * 便捷函数:计算回收率 (%)
 */
export function calcRecoveryPct(measured: number, expected: number): number {
  if (expected === 0) {
    throw new Error('expected 不能为 0');
  }
  return (measured / expected) * 100;
}