// =====================================================
// 报告详情页 — Phase 2/3 前端完善 (F2.3)
// 功能: 报告内容展示 + 三级审核操作(SUBMIT/REVIEW_PASS/APPROVE/ISSUE/驳回)
// 样式: 设计令牌(墨黑+辉金, 见 styles/design-tokens.css)
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Descriptions, Spin, Tag, Space, message,
  Modal, Input, Timeline, Empty,
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../../data/api';

interface ReportStage {
  stage: string;
  comments?: string;
  userId?: string;
  createdAt: string;
}

interface ReportDetail {
  id: string;
  reportNo: string;
  status: string;
  summary?: string;
  issuedAt?: string;
  createdAt: string;
  sample?: {
    sampleNo: string;
    customerName: string;
    sampleType: string;
  };
  stages?: ReportStage[];
  signatures?: Array<{ signerRole: string; signedAt: string; signatureData: string }>;
}

// 状态 → 颜色映射(设计令牌)
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  INTERNAL_REVIEW: 'var(--info)',
  FINAL_REVIEW: 'var(--warning)',
  APPROVED: 'var(--success)',
  ISSUED: 'var(--success)',
  REJECTED: 'var(--error)',
};

// 状态 → 可执行动作
const ACTIONS: Record<string, Array<{ key: string; label: string; type: 'primary' | 'default' | 'danger' }>> = {
  DRAFT: [{ key: 'SUBMIT', label: '提交校核', type: 'primary' }],
  INTERNAL_REVIEW: [
    { key: 'REVIEW_PASS', label: '校核通过', type: 'primary' },
    { key: 'REVIEW_REJECT', label: '驳回', type: 'danger' },
  ],
  FINAL_REVIEW: [
    { key: 'APPROVE', label: '审核批准', type: 'primary' },
    { key: 'REVIEW_REJECT', label: '驳回', type: 'danger' },
  ],
  APPROVED: [{ key: 'ISSUE', label: '签发报告', type: 'primary' }],
};

export function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; action: string }>({
    visible: false,
    action: '',
  });
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/reports/${id}`);
      setDetail(res.data);
    } catch (e) {
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (action: string, comments?: string) => {
    setActionLoading(true);
    try {
      await api.post(`/reports/${id}/transition`, { action, comments });
      message.success('操作成功');
      setRejectModal({ visible: false, action: '' });
      setComment('');
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '操作失败');
    } finally {
      setActionLoading(false);
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
        <Empty description="报告不存在" />
      </Card>
    );
  }

  const actions = ACTIONS[detail.status] ?? [];
  const canSign = detail.status === 'APPROVED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部 */}
      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')} />
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
                报告 <span style={{ color: 'var(--gold)' }}>{detail.reportNo}</span>
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                创建于 {new Date(detail.createdAt).toLocaleString()}
              </span>
            </div>
          </Space>
          <Space>
            <Tag style={{ color: STATUS_COLOR[detail.status] ?? 'var(--text-muted)' }}>
              {detail.status}
            </Tag>
            {actions.map((a) => (
              <Button
                key={a.key}
                type={a.type === 'primary' ? 'primary' : 'default'}
                danger={a.type === 'danger'}
                loading={actionLoading}
                onClick={() =>
                  a.key === 'REVIEW_REJECT'
                    ? setRejectModal({ visible: true, action: a.key })
                    : doAction(a.key)
                }
              >
                {a.label}
              </Button>
            ))}
            {canSign && (
              <Button
                style={{ background: 'var(--gold)', borderColor: 'var(--gold)', color: '#fff' }}
                onClick={() => doAction('ISSUE')}
              >
                签发
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {/* 样品信息 */}
      <Card
        title="样品信息"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <Descriptions
          column={3}
          labelStyle={{ color: 'var(--text-muted)' }}
          contentStyle={{ color: 'var(--text-primary)' }}
        >
          <Descriptions.Item label="样品编号">{detail.sample?.sampleNo}</Descriptions.Item>
          <Descriptions.Item label="客户名称">{detail.sample?.customerName}</Descriptions.Item>
          <Descriptions.Item label="样品类型">{detail.sample?.sampleType}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 报告内容 */}
      <Card
        title="检测结果"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {detail.summary ? (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.8,
            }}
          >
            {detail.summary}
          </pre>
        ) : (
          <Empty description="暂无内容" />
        )}
      </Card>

      {/* 审核轨迹 */}
      <Card
        title="审核轨迹"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {detail.stages && detail.stages.length > 0 ? (
          <Timeline
            items={detail.stages.map((s) => ({
              color: s.stage === 'DRAFT' ? 'gray' : 'var(--gold)',
              children: (
                <div>
                  <b style={{ color: 'var(--text-primary)' }}>{s.stage}</b>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(s.createdAt).toLocaleString()}
                    {s.comments ? ` — ${s.comments}` : ''}
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty description="暂无轨迹" />
        )}
      </Card>

      {/* 签名信息 */}
      {detail.signatures && detail.signatures.length > 0 && (
        <Card
          title="电子签名"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          {detail.signatures.map((sig, i) => (
            <Space key={i} style={{ marginRight: 24 }}>
              <CheckCircleOutlined style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {sig.signerRole} — {new Date(sig.signedAt).toLocaleString()}
              </span>
            </Space>
          ))}
        </Card>
      )}

      {/* 驳回弹窗 */}
      <Modal
        title="驳回报告"
        open={rejectModal.visible}
        onCancel={() => setRejectModal({ visible: false, action: '' })}
        onOk={() => doAction(rejectModal.action, comment || '驳回')}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="驳回原因(必填)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        />
      </Modal>
    </div>
  );
}
