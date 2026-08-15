// =====================================================
// W5 SSE 实时事件 Controller
// GET /api/v1/realtime/events → SSE 流
// POST /api/v1/realtime/publish → 测试事件
// =====================================================

import { Controller, Post, Body, Sse, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import { RealtimeBus, RealtimeEvent } from './realtime.bus';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly bus: RealtimeBus) {}

  /**
   * SSE 事件流(SSE 不能自定义 header,token 走 query)
   * 每 15s 心跳保活
   */
  @Sse('events')
  events(@Query('token') _token?: string): Observable<MessageEvent | { data: RealtimeEvent }> {
    return merge(
      this.bus.subscribe(),
      interval(15000).pipe(map(() => ({ type: 'ping', data: { ts: Date.now() } }))),
    );
  }

  /** 测试发布事件(开发/演示用) */
  @Post('publish')
  @ApiOperation({ summary: '发布测试事件(开发/演示用)' })
  publish(@Body() body: Omit<RealtimeEvent, 'id' | 'timestamp'>) {
    return this.bus.publish(body);
  }
}
