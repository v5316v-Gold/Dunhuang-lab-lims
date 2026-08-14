// =====================================================
// 样品详情页 — Phase 3 页面交互完善(②)
// 功能: 详情展示 + 状态机推进(9 态)+ 历史轨迹
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Descriptions, Space, Tag, Timeline, message, Spin, Empty,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '../../data/api';

interface SampleDetail {
  id: string;
  sampleNo: string;
  customerName: string;
  customerRef?: string;
  sampleType: string;
  weightG: string;
  status: string;
  receivedAt: string;
  receivedBy?: { name: string };
  batch?: { batchNo: string };
  tests?: Array<{ id: string; method: string; status: string; purityPct?: string }>;
}

const STATUS_COLOR: Record<string, string> = {
  RECEIVED: 'var(--info)',
  BATCHED: 'var(--gold)',
  IN_TEST: 'var(--warning)',
  TESTED: 'var(--success)',
  REPORT_DRAFT: 'var(--text-secondary)',
  REPORT_REVIEW: 'var(--info)',
  REPORT_APPROVED: 'var(--success)',
  ARCHIVED: 'var(--text-muted)',
  REJECTED: 'var(--error)',
};

/** 9 态可用动作(纯前端映射,与后端 state-machine 一致) */
const NEXT_ACTIONS: Record<string, Array<{ event: string; label: string; to: string; danger?: boolean }>> = {
  RECEIVED: [{ event: 'TO_BATCH', label: '加入批次', to: 'BATCHED' }],
  BATCHED: [{ event: 'START_TEST', label: '开始检测', to: 'IN_TEST' }],
  IN_TEST: [{ event: 'COMPLETE_TEST', label: '完成检测', to: 'TESTED' }],
  TESTED: [{ event: 'TO_REPORT_DRAFT', label: '生成报告草稿', to: 'REPORT_DRAFT' }],
  REPORT_DRAFT: [{ event: 'SUBMIT_REVIEW', label: '提交审核', to: 'REPORT_REVIEW' }],
  REPORT_REVIEW: [{ event: 'APPROVE', label: '审核通过', to: 'REPORT_APPROVED' }, { event: 'REVIEW_REJECT', label: '驳回', to: 'REPORT_DRAFT', danger: true }],
  REPORT_APPROVED: [{ event: 'ARCHIVE', label: '归档', to: 'ARCHIVED' }],
  ARCHIVED: [],
  REJECTED: [],
};

export function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/samples/${id}`);
      setDetail(res.data);
    } catch {
      message.error('加载样品详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const doTransition = async (event: string) => {
    setActing(true);
    try {
      await api.post(`/samples/${id}/transition`, { event });
      message.success(`状态转换: ${event}`);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '状态转换失败');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!detail) {
    return (
      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Empty description="样品不存在" />
      </Card>
    );
  }

  const actions = NEXT_ACTIONS[detail.status] ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部 */}
      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/samples')} />
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
                样品 <span style={{ color: 'var(--gold)' }}>{detail.sampleNo}</span>
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                接收于 {new Date(detail.receivedAt).toLocaleString()}
              </span>
            </div>
          </Space>
          <Space wrap>
            <Tag style={{ color: STATUS_COLOR[detail.status] ?? 'var(--text-muted)', fontSize: 14, padding: '4px 12px' }}>
              {detail.status}
            </Tag>
            {actions.map((a) => (
              <Button
                key={a.event}
                type={a.danger ? 'default' : 'primary'}
                danger={a.danger}
                loading={acting}
                onClick={() => doTransition(a.event)}
                style={!a.danger ? { background: 'var(--gold)', borderColor: 'var(--gold)' } : undefined}
              >
                {a.label} → {a.to}
              </Button>
            ))}
          </Space>
        </Space>
      </Card>

      {/* 基本信息 */}
      <Card title="样品信息" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Descriptions
          column={3}
          labelStyle={{ color: 'var(--text-muted)' }}
          contentStyle={{ color: 'var(--text-primary)' }}
        >
          <Descriptions.Item label="样品编号">
            <span style={{ color: 'var(--gold)' }}>{detail.sampleNo}</span>
          </Descriptions.Item>
          <Descriptions.Item label="客户名称">{detail.customerName}</Descriptions.Item>
          <Descriptions.Item label="客户委托号">{detail.customerRef ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="样品类型">{detail.sampleType}</Descriptions.Item>
          <Descriptions.Item label="接收重量(g)">
            <span style={{ color: 'var(--gold)' }}>{detail.weightG}</span>
          </Descriptions.Item>
          <Descriptions.Item label="所属批次">
            {detail.batch ? <Tag style={{ color: 'var(--gold)' }}>{detail.batch.batchNo}</Tag> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="接收人">{detail.receivedBy?.name ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 检测任务 */}
      {detail.tests && detail.tests.length > 0 && (
        <Card title="检测任务" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          {detail.tests.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '8px 12px',
                marginBottom: 8,
                background: 'var(--bg-tertiary)',
                borderRadius: 6,
                borderLeft: `3px solid ${STATUS_COLOR[t.status] ?? 'var(--text-muted)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-primary)' }}>{t.method}</span>
                <span style={{ color: STATUS_COLOR[t.status] ?? 'var(--text-muted)' }}>{t.status}</span>
              </div>
              {t.purityPct && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
                  纯度: <span style={{ color: 'var(--gold)' }}>{t.purityPct}%</span>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* 状态机时间线 */}
      <Card title="状态流转示意" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Timeline
          items={[
            { color: 'green', children: 'RECEIVED 已接收' },
            { color: 'gold', children: 'BATCHED 已分批' },
            { color: 'orange', children: 'IN_TEST 检测中' },
            { color: 'blue', children: 'TESTED 已检测' },
            { color: 'purple', children: 'REPORT_DRAFT 报告草稿' },
            { color: 'cyan', children: 'REPORT_REVIEW 报告审核' },
            { color: 'green', children: 'REPORT_APPROVED 报告已批' },
            { color: 'gray', children: 'ARCHIVED 已归档' },
          ]}
        />
      </Card>
    </div>
  );
}
