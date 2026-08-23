// =====================================================
// W5 SSE 实时事件 Hook + UI 组件
// 浏览器原生 EventSource,零依赖
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Drawer, List, Tag, Tooltip, Empty, Space } from 'antd';
import {
  BellOutlined, ClearOutlined, ReloadOutlined,
} from '@ant-design/icons';

export interface RealtimeEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  resource?: string;
  resourceId?: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  meta?: Record<string, any>;
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
};

const LEVEL_ICON: Record<string, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠',
  error: '✗',
};

/** SSE 订阅 hook(带指数退避重连) */
export function useRealtimeEvents(token?: string) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;
    let delay = 1000; // 指数退避初始 1s,上限 30s
    const MAX_DELAY = 30_000;

    const cleanup = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const connect = () => {
      if (unmounted) return;
      const url = token
        ? `/api/v1/realtime/events?token=${encodeURIComponent(token)}`
        : `/api/v1/realtime/events`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        if (unmounted) return;
        setConnected(true);
        setReconnecting(false);
        setAttempts(0);
        delay = 1000; // 重置退避
      };
      es.onerror = () => {
        if (unmounted) return;
        setConnected(false);
        // 浏览器会默认重连,但不可靠;显式重连+指数退避
        es.close();
        esRef.current = null;
        setReconnecting(true);
        setAttempts((a) => a + 1);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (!unmounted) {
            connect();
            delay = Math.min(delay * 2, MAX_DELAY);
          }
        }, delay);
      };

      const handler = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          // 忽略 ping
          if (data?.type === 'ping' || e.type === 'ping') return;
          setEvents((prev) => [data, ...prev].slice(0, 50)); // 最多保留 50 条
        } catch {
          // ignore
        }
      };
      es.addEventListener('message', handler);
      // 也监听 type=ping
      es.addEventListener('ping', () => { /* heartbeat */ });
    };

    connect();

    return () => {
      unmounted = true;
      cleanup();
      setConnected(false);
    };
  }, [token]);

  const clear = () => setEvents([]);
  // 手动立即重连(用户在 UI 上点重连)
  const reconnectNow = () => {
    if (esRef.current) esRef.current.close();
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    setAttempts(0);
    // 触发重连:重新调 useEffect 不实际,但可以直接新建 EventSource
    // 简化:让 useEffect 的 cleanup+重启 — 改 token ref 不实用;改为手工重连函数
    const url = token
      ? `/api/v1/realtime/events?token=${encodeURIComponent(token)}`
      : `/api/v1/realtime/events`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => { setConnected(true); setReconnecting(false); setAttempts(0); };
    es.onerror = () => { setConnected(false); };
    es.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type === 'ping') return;
        setEvents((prev) => [data, ...prev].slice(0, 50));
      } catch { /* ignore */ }
    });
  };
  return { events, connected, reconnecting, attempts, clear, reconnectNow };
}

/** 实时事件中心 UI(右下角铃铛) */
export function RealtimeCenter({ token }: { token?: string }) {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const lastSeenId = useRef<string | null>(null);
  const { events, connected, reconnecting, attempts, clear, reconnectNow } = useRealtimeEvents(token);

  useEffect(() => {
    if (events.length > 0 && events[0].id !== lastSeenId.current) {
      setHasNew(true);
      lastSeenId.current = events[0].id;
    }
  }, [events]);

  return (
    <>
      <Tooltip title={connected ? '实时事件已连接' : '实时事件已断开'}>
        <Badge dot={hasNew} offset={[-4, 4]}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 18, color: connected ? '#D4AF37' : '#888' }} />}
            onClick={() => { setOpen(true); setHasNew(false); }}
          />
        </Badge>
      </Tooltip>

      <Drawer
        title={
          <span>
            <BellOutlined style={{ color: '#D4AF37', marginRight: 8 }} />
            实时事件中心
            {connected ? (
              <Tag color="green" style={{ marginLeft: 12 }}>已连接</Tag>
            ) : reconnecting ? (
              <Tag color="orange" style={{ marginLeft: 12 }}>
                重连中{attempts > 0 ? `(第 ${attempts} 次)` : ''}
              </Tag>
            ) : (
              <Tag color="red" style={{ marginLeft: 12 }}>已断开</Tag>
            )}
          </span>
        }
        placement="right"
        width={480}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button size="small" icon={<ClearOutlined />} onClick={clear}>清空</Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={reconnectNow}>重连</Button>
          </Space>
        }
      >
        {events.length === 0 ? (
          <Empty description="暂无事件" style={{ marginTop: 80 }} />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={events}
            renderItem={(e) => (
              <List.Item
                style={{ padding: '12px 0', borderBottom: '1px solid rgba(212,175,55,0.15)' }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={LEVEL_COLOR[e.level] ?? 'default'}>
                        {LEVEL_ICON[e.level] ?? '·'} {e.type}
                      </Tag>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                    </Space>
                  }
                  description={
                    <>
                      <div>{e.message}</div>
                      <div style={{ color: 'var(--text-secondary, #888)', fontSize: 12, marginTop: 4 }}>
                        {new Date(e.timestamp).toLocaleString('zh-CN')}
                      </div>
                      {e.resource && (
                        <div style={{ fontSize: 11, marginTop: 2, color: '#888' }}>
                          {e.resource}: {e.resourceId}
                        </div>
                      )}
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
}