// =====================================================
// Phase 1B P0-D: 状态机守卫(强制度)
// CNAS §7.4 数据控制 + §7.5/§7.8 流程合规
// =====================================================

import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * 状态机定义
 * key: 实体名
 * value: { from: 允许的源状态集合, to: 目标状态 }
 */
const TRANSITIONS: Record<string, {
  states: string[];
  allowed: Record<string, string[]>;
}> = {
  // 样品主状态机
  Sample: {
    // ⚠️ fix: 用真实 SampleStatus enum(无 REPORTED,是 REPORT_DRAFT/REVIEW/APPROVED)
    states: ['RECEIVED', 'BATCHED', 'IN_TEST', 'TESTED', 'REPORT_DRAFT', 'REPORT_REVIEW', 'REPORT_APPROVED', 'ARCHIVED', 'DISPOSED', 'REJECTED', 'VOIDED'],
    allowed: {
      RECEIVED: ['BATCHED', 'REJECTED', 'VOIDED'],
      BATCHED: ['IN_TEST', 'TESTED', 'VOIDED'],
      IN_TEST: ['TESTED', 'BATCHED', 'VOIDED'],
      TESTED: ['REPORT_DRAFT', 'REPORT_REVIEW', 'REPORT_APPROVED', 'ARCHIVED', 'VOIDED'],
      REPORT_DRAFT: ['REPORT_REVIEW', 'VOIDED'],
      REPORT_REVIEW: ['REPORT_APPROVED', 'REPORT_DRAFT', 'VOIDED'],
      REPORT_APPROVED: ['ARCHIVED', 'VOIDED'],
      ARCHIVED: ['DISPOSED', 'VOIDED'],
      DISPOSED: ['VOIDED'],
      REJECTED: ['VOIDED'],
      VOIDED: [],
    },
  },

  // 检测
  Test: {
    states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
    allowed: {
      PENDING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'REJECTED'],
      COMPLETED: ['REJECTED'],
      REJECTED: ['PENDING'],  // 复检
      CANCELLED: [],
    },
  },

  // 报告
  Report: {
    states: ['DRAFT', 'INTERNAL_REVIEW', 'FINAL_REVIEW', 'APPROVED', 'ISSUED', 'SUPERSEDED', 'RECALLED'],
    allowed: {
      DRAFT: ['INTERNAL_REVIEW', 'VOIDED'],
      INTERNAL_REVIEW: ['FINAL_REVIEW', 'DRAFT'],
      FINAL_REVIEW: ['APPROVED', 'INTERNAL_REVIEW'],
      APPROVED: ['ISSUED', 'RECALLED'],
      ISSUED: ['SUPERSEDED', 'RECALLED'],
      SUPERSEDED: [],
      RECALLED: ['SUPERSEDED'],
    },
  },

  // 危废
  WasteRecord: {
    states: ['STORED', 'TRANSFERRED', 'INCINERATED', 'RECYCLED_GOLD', 'NEUTRALIZED', 'DISPOSED', 'REJECTED'],
    allowed: {
      STORED: ['TRANSFERRED', 'REJECTED'],
      TRANSFERRED: ['INCINERATED', 'RECYCLED_GOLD', 'NEUTRALIZED', 'DISPOSED'],
      INCINERATED: [],
      RECYCLED_GOLD: [],
      NEUTRALIZED: [],
      DISPOSED: [],
      REJECTED: ['STORED'],
    },
  },

  // 容器(W3)
  Container: {
    states: ['IN_STOCK', 'IN_USE', 'CLEANING', 'MAINTENANCE', 'RETIRED', 'LOST'],
    allowed: {
      IN_STOCK: ['IN_USE', 'CLEANING', 'MAINTENANCE', 'RETIRED', 'LOST'],
      IN_USE: ['IN_STOCK', 'MAINTENANCE'],
      CLEANING: ['IN_STOCK', 'MAINTENANCE'],
      MAINTENANCE: ['IN_STOCK', 'RETIRED'],
      RETIRED: [],
      LOST: ['IN_STOCK'],  // 找回后可恢复
    },
  },
};

@Injectable()
export class StateMachineService {
  private readonly logger = new Logger(StateMachineService.name);

  /**
   * 校验状态转换合法性
   * @throws BadRequestException 若不合法
   */
  assertTransition(entity: keyof typeof TRANSITIONS, from: string, to: string): void {
    const sm = TRANSITIONS[entity];
    if (!sm) {
      throw new BadRequestException(`未知实体 ${entity} 的状态机`);
    }
    if (!sm.states.includes(from)) {
      throw new BadRequestException(`${entity} 当前状态 ${from} 不在合法状态集合`);
    }
    if (!sm.states.includes(to)) {
      throw new BadRequestException(`${entity} 目标状态 ${to} 不在合法状态集合`);
    }
    const allowedNext = sm.allowed[from] ?? [];
    if (!allowedNext.includes(to)) {
      throw new BadRequestException(
        `${entity} 状态 ${from} → ${to} 不允许。` +
        `允许的目标: [${allowedNext.join(', ') || '(无,终态)'}]`,
      );
    }
  }

  /**
   * 查询合法目标
   */
  getAllowedTargets(entity: keyof typeof TRANSITIONS, from: string): string[] {
    return TRANSITIONS[entity]?.allowed[from] ?? [];
  }

  /**
   * 查询合法源
   */
  getAllowedSources(entity: keyof typeof TRANSITIONS, to: string): string[] {
    const sm = TRANSITIONS[entity];
    if (!sm) return [];
    return Object.entries(sm.allowed)
      .filter(([_, targets]) => targets.includes(to))
      .map(([from]) => from);
  }

  /**
   * 是否终态
   */
  isTerminal(entity: keyof typeof TRANSITIONS, state: string): boolean {
    const allowed = this.getAllowedTargets(entity, state);
    return allowed.length === 0;
  }

  /**
   * 列出所有状态
   */
  getStates(entity: keyof typeof TRANSITIONS): string[] {
    return TRANSITIONS[entity]?.states ?? [];
  }
}