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
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, DownloadOutlined, EyeOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { useAuthStore } from '../../stores/auth.store';

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
  remarks?: string;
  issuedAt?: string;
  createdAt: string;
  // W2: 6 角色签名人(CNAS-CL01:2018 §7.8.4)
  submitterId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  authorizerId?: string | null;
  issuerId?: string | null;
  submitter?: { id: string; name: string; username: string } | null;
  reviewer?: { id: string; name: string; username: string } | null;
  approver?: { id: string; name: string; username: string } | null;
  authorizer?: { id: string; name: string; username: string } | null;
  issuer?: { id: string; name: string; username: string } | null;
  sample?: {
    sampleNo: string;
    customerName: string;
    sampleType: string;
  };
  stages?: ReportStage[];
  signatures?: Array<{ signerRole: string; signedAt: string; signatureData: string }>;
}

// 6 角色 → 中文名(用于展示)
const ROLE_LABELS: Record<string, string> = {
  submitter: '提交',
  reviewer: '校核',
  approver: '审核',
  authorizer: '批准',
  issuer: '签发',
};

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
  APPROVED: [
    { key: 'AUTHORIZE', label: '批准(W2)', type: 'primary' },
    { key: 'ISSUE', label: '签发报告', type: 'primary' },
  ],
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
  const [editOpen, setEditOpen] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- MFA 二次验证(审核/签发必须)----
  const [mfaModal, setMfaModal] = useState<{ action: string; comments?: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

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

  // 报告状态推进(CNAS §7.8 / 21 CFR Part 11: 强制 MFA 二次验证)
  // 点击动作 → 弹 MFA 验证码 → challenge 拿 mfaToken → 带 x-mfa-token 推进状态
  const doAction = async (action: string, comments?: string) => {
    if (!useAuthStore.getState().user?.mfaEnabled) {
      message.warning('该操作需要 MFA 二次验证,请先在右上角"账号安全 · 启用 MFA"完成绑定');
      return;
    }
    setMfaModal({ action, comments });
    setMfaCode('');
  };

  const submitWithMfa = async () => {
    if (!mfaModal) return;
    setMfaBusy(true);
    try {
      const ch = await api.post('/auth/mfa/challenge', { code: mfaCode });
      const mfaToken = ch.data?.mfaToken;
      if (!mfaToken) throw new Error('未获取到 MFA token');
      await api.post(
        `/reports/${id}/transition`,
        { action: mfaModal.action, comments: mfaModal.comments },
        { headers: { 'x-mfa-token': mfaToken } },
      );
      message.success('操作成功');
      setMfaModal(null);
      setMfaCode('');
      setRejectModal({ visible: false, action: '' });
      setComment('');
      await load();
    } catch (e: any) {
      // 错误提示由 api 拦截器统一处理(避免双 toast);
      // MFA_NOT_ENABLED 时后端 message 已含操作指引
    } finally {
      setMfaBusy(false);
    }
  };

  // 打开编辑弹窗
  const openEdit = () => {
    setEditSummary(detail?.summary ?? '');
    setEditRemarks(detail?.remarks ?? '');
    setEditOpen(true);
  };

  // 保存编辑内容
  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/reports/${id}`, { summary: editSummary, remarks: editRemarks });
      message.success('报告内容已保存');
      setEditOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 下载 PDF(仅 ISSUED 状态有)
  const downloadPdf = async () => {
    try {
      const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail?.reportNo || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('报告 PDF 已下载');
    } catch (e: any) {
      message.error(e?.response?.data?.message || '下载失败(报告可能尚未签发 PDF)');
    }
  };

  // 预览 PDF
  const previewPdf = async () => {
    try {
      const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '预览失败(报告可能尚未签发 PDF)');
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
            {/* 编辑内容(未签发可编辑) */}
            {detail.status !== 'ISSUED' && detail.status !== 'SUPERSEDED' && (
              <Button icon={<EditOutlined />} onClick={openEdit}>编辑内容</Button>
            )}
            {/* 下载/预览 PDF */}
            <Button icon={<DownloadOutlined />} onClick={downloadPdf}>下载</Button>
            <Button icon={<EyeOutlined />} onClick={previewPdf}>预览</Button>
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
        extra={
          detail.status !== 'ISSUED' && detail.status !== 'SUPERSEDED' ? (
            <Button size="small" icon={<EditOutlined />} onClick={openEdit}>编辑</Button>
          ) : null
        }
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
          <Empty description={'暂无内容,点击右上角"编辑"填写'} />
        )}
        {detail.remarks && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>备注: </span>
            <span style={{ color: 'var(--text-secondary)' }}>{detail.remarks}</span>
          </div>
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

      {/* 签字链 — W2: 6 角色签名人(CNAS-CL01:2018 §7.8.4) */}
      <Card
        title="签字链(CNAS-CL01 强制 6 角色互斥)"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {(['submitter', 'reviewer', 'approver', 'authorizer', 'issuer'] as const).map((role) => {
            const userId = detail[`${role}Id` as keyof ReportDetail] as string | null | undefined;
            const user = detail[role as keyof ReportDetail] as { name?: string; username?: string } | null | undefined;
            const signed = !!userId;
            return (
              <div key={role} style={{ minWidth: 160 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                  {ROLE_LABELS[role]}人
                </div>
                <Space>
                  {signed ? (
                    <>
                      <CheckCircleOutlined style={{ color: 'var(--success)' }} />
                      <span style={{ color: 'var(--text-primary)' }}>{user?.name ?? user?.username ?? userId}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>○ 未签字</span>
                    </>
                  )}
                </Space>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 签名信息 */}
      {detail.signatures && detail.signatures.length > 0 && (
        <Card
          title="电子签名(21 CFR Part 11)"
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

      {/* 编辑内容弹窗 */}
      <Modal
        title="编辑报告内容"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={saveEdit}
        okText="保存"
        confirmLoading={saving}
        width={640}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>检测结果内容</div>
            <Input.TextArea
              rows={10}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder={'样品编号 / 客户 / 检测方法 / 纯度 / 不确定度 / 元素结果...\n建议从"检测结果"自动生成,可手动调整'}
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>备注</div>
            <Input.TextArea
              rows={3}
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              placeholder="报告备注(选填)"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </Modal>

      {/* MFA 二次验证弹窗(审核/签发强制) */}
      <Modal
        title="MFA 二次验证"
        open={!!mfaModal}
        onCancel={() => setMfaModal(null)}
        onOk={submitWithMfa}
        okText="验证并执行"
        confirmLoading={mfaBusy}
        okButtonProps={{ disabled: mfaCode.length !== 6 }}
        width={380}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            操作: <b style={{ color: 'var(--text-primary)' }}>{mfaModal?.action}</b> — 请输入手机验证器(或备份码)的
            6 位验证码
          </div>
          <Input
            value={mfaCode}
            maxLength={6}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            placeholder="TOTP 6 位验证码"
            size="large"
            autoFocus
            style={{ letterSpacing: 6, textAlign: 'center', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </Modal>
    </div>
  );
}
