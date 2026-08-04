// =====================================================
// Westgard 规则引擎
// 详见 ADR-0011 §5
// =====================================================

import { Injectable } from '@nestjs/common';

export type WestgardRule = '1_3s' | '2_2s' | 'R_4s' | '4_1s' | '10x';

export interface WestgardResult {
  passed: boolean;
  violations: WestgardRule[];
}

/**
 * Westgard 多规则引擎
 *
 * 1₃s: 1 个点超过 ±3σ(失控)
 * 2₂s: 连续 2 个点超过 ±2σ 同方向
 * R₄s: 2 个相邻点间差超过 4σ
 * 4₁s: 连续 4 个点超过 ±1σ 同方向
 * 10x: 连续 10 个点在均值同侧
 */
@Injectable()
export class WestgardService {
  evaluate(zScores: number[]): WestgardResult {
    const violations: WestgardRule[] = [];

    if (zScores.length === 0) {
      return { passed: true, violations: [] };
    }

    const last = zScores[zScores.length - 1];
    const prev = zScores.length >= 2 ? zScores[zScores.length - 2] : null;

    // 1₃s
    if (Math.abs(last) > 3) {
      violations.push('1_3s');
    }

    // 2₂s
    if (prev !== null && Math.abs(last) > 2 && Math.abs(prev) > 2 && Math.sign(last) === Math.sign(prev)) {
      violations.push('2_2s');
    }

    // R₄s
    if (prev !== null && Math.abs(last - prev) > 4) {
      violations.push('R_4s');
    }

    // 4₁s
    if (zScores.length >= 4) {
      const last4 = zScores.slice(-4);
      const allPositive = last4.every((z) => z > 1);
      const allNegative = last4.every((z) => z < -1);
      if (allPositive || allNegative) {
        violations.push('4_1s');
      }
    }

    // 10x
    if (zScores.length >= 10) {
      const last10 = zScores.slice(-10);
      const allPositive = last10.every((z) => z > 0);
      const allNegative = last10.every((z) => z < 0);
      if (allPositive || allNegative) {
        violations.push('10x');
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * 计算 Z-score
   * Z = (measured - expected) / SD
   */
  calculateZScore(measured: number, expected: number, sd: number): number {
    if (sd === 0) return 0;
    return (measured - expected) / sd;
  }
}