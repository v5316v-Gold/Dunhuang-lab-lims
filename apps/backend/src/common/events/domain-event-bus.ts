// =====================================================
// 轻量领域事件总线 — 基于 Node 内置 EventEmitter,零外部依赖
// 架构优化 A1: 跨模块副作用(检测完成 → 自动建报告)解耦为事件订阅
//   - emitAsync: 等待所有监听器完成(确定性,失败会传播给发布者)
//   - 监听器数量受限,防内存泄漏
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

import { DomainEvent, DomainEventName } from './domain-events';

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly emitter = new EventEmitter();
  private readonly maxListeners = 32;

  constructor() {
    this.emitter.setMaxListeners(this.maxListeners);
  }

  /**
   * 发布事件并等待所有同步/异步监听器完成
   * 任一监听器抛错 → 本次发布 reject(发布方可决定是否影响主流程)
   */
  async emitAsync<T>(name: DomainEventName, payload: T): Promise<void> {
    const event: DomainEvent<T> = { name, payload, occurredAt: new Date() };
    const listeners = this.emitter.listeners(name) as Array<(e: DomainEvent<T>) => unknown>;
    if (listeners.length === 0) return;
    for (const fn of listeners) {
      try {
        await fn(event);
      } catch (err) {
        this.logger.error(
          `[DomainEvent] 监听器执行失败 ${name}: ${(err as Error).message}`,
          (err as Error).stack,
        );
        throw err;
      }
    }
  }

  /** 订阅事件(handler 可为 async,emitAsync 会等待) */
  on<T>(name: DomainEventName, handler: (event: DomainEvent<T>) => unknown): void {
    this.emitter.on(name, handler as (e: unknown) => unknown);
  }

  /** 当前订阅数(调试/测试用) */
  listenerCount(name: DomainEventName): number {
    return this.emitter.listenerCount(name);
  }
}
