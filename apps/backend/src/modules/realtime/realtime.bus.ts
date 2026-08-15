// =====================================================
// W5 SSE 实时事件总线
// 推送: 库存预警 / 危废转移 / 设备异常 / 检测完成 / 气体低库存
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type RealtimeEventType =
  | 'WASTE_TRANSFERRED'      // 危废已转移
  | 'WASTE_DISPOSED'         // 危废已处置
  | 'GAS_LOW_STOCK'          // 气体低库存
  | 'CONTAINER_MAINTENANCE'  // 容器进入维护
  | 'TEST_COMPLETED'         // 检测完成
  | 'REPORT_ISSUED'          // 报告签发
  | 'BAR_CERTIFIED'          // 贵金属条码出证
  | 'SAMPLING_RECORDED';     // 取样登记

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  title: string;
  message: string;
  resource?: string;
  resourceId?: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  meta?: Record<string, any>;
}

@Injectable()
export class RealtimeBus {
  private readonly logger = new Logger(RealtimeBus.name);
  private readonly subject$ = new Subject<RealtimeEvent>();
  private counter = 0;

  /**
   * 发布事件
   */
  publish(event: Omit<RealtimeEvent, 'id' | 'timestamp'>): RealtimeEvent {
    const e: RealtimeEvent = {
      ...event,
      id: `evt-${Date.now()}-${++this.counter}`,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(`[${e.level.toUpperCase()}] ${e.type}: ${e.title}`);
    this.subject$.next(e);
    return e;
  }

  /**
   * 订阅事件流(SSE)
   */
  subscribe(): Observable<RealtimeEvent> {
    return this.subject$.asObservable();
  }

  /**
   * 当前事件总数(测试用)
   */
  size(): number {
    return this.counter;
  }
}