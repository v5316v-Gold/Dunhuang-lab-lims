// =====================================================
// 样品详情页 — 交互完善(编辑 + 留样登记/销毁 + 真正生成报告 + 跨页跳转)
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Descriptions, Space, Tag, Timeline, message, Spin, Empty, Modal, Form, Input, InputNumber, Select, Alert, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, InboxOutlined, DeleteOutlined, FileAddOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

interface SampleDetail {
  id: string;
  sampleNo: string;
  customerName: string;
  customerRef?: string;
  sampleType: string;
  weightG: string;
  declaredPurityPct?: string;
  storageLocation?: string;
  remarks?: string;
  status: string;
  receivedAt: string;
  retentionUntil?: string;
  receivedBy?: { name: string };
  batch?: { id: string; batchNo: string };
  tests?: Array<{ id: string; method: string; status: string; purityPct?: string }>;
  reports?: Array<{ id: string; reportNo: string; status: string }>;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  RECEIVED: { color: 'blue', label: '已接收' },
  BATCHED: { color: 'cyan', label: '已分批' },
  IN_TEST: { color: 'gold', label: '检测中' },
  TESTED: { color: 'green', label: '已检测' },
  REPORT_DRAFT: { color: 'default', label: '报告草稿' },
  REPORT_REVIEW: { color: 'orange', label: '报告审核' },
  REPORT_APPROVED: { color: 'purple', label: '报告已批' },
  ARCHIVED: { color: 'geekblue', label: '已留样' },
  REJECTED: { color: 'red', label: '已拒收' },
  DISPOSED: { color: 'red', label: '已处置' },
};

const DISPOSE_METHODS = [
  { value: 'INCINERATION', label: '焚烧' },
  { value: 'ACID_DISSOLUTION', label: '酸溶回收' },
  { value: 'RETURN_CUSTOMER', label: '退还客户' },
];

export function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [disposeForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [archiveForm] = Form.useForm();
  const [users, setUsers] = useState<any[]>([]);

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

  // 留样销毁需要选择双人审批的批准人
  const loadUsers = async () => {
    try {
      const res = await api.get('/users', { params: { pageSize: 100 } });
      setUsers(res.data?.data ?? []);
    } catch { /* ignore */ }
  };

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

  // TESTED → 真正创建报告草稿(POST /reports)并跳转报告详情
  const createReport = async () => {
    setActing(true);
    try {
      const res = await api.post('/reports', { sampleId: id });
      message.success('报告草稿已生成');
      await load();
      navigate(`/reports/${res.data.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '生成报告失败');
    } finally {
      setActing(false);
    }
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields().catch(() => null);
    if (!values) return;
    try {
      await api.patch(`/samples/${id}`, values);
      message.success('样品信息已更新');
      setEditOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '保存失败');
    }
  };

  const submitArchive = async () => {
    const values = await archiveForm.validateFields().catch(() => null);
    if (!values) return;
    try {
      await api.post(`/samples/${id}/archive`, values);
      message.success('留样登记完成,样品已归档');
      setArchiveOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '留样登记失败');
    }
  };

  const submitDispose = async (mfaToken: string) => {
    const values = await disposeForm.validateFields().catch(() => null);
    if (!values) return;
    try {
      await api.post(`/samples/${id}/dispose-retention`, values, { headers: { 'x-mfa-token': mfaToken } });
      message.success('留样销毁已登记');
      setDisposeOpen(false);
      setMfaOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '销毁失败');
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

  const meta = STATUS_META[detail.status] ?? { color: 'default', label: detail.status };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部 */}
      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
            <Tag color={meta.color} style={{ fontSize: 14, padding: '4px 12px' }}>{meta.label}</Tag>
            <Button icon={<EditOutlined />} onClick={() => { editForm.setFieldsValue({ storageLocation: detail.storageLocation, remarks: detail.remarks }); setEditOpen(true); }}>
              编辑
            </Button>
            {/* 状态机动作 */}
            {detail.status === 'RECEIVED' && (
              <Button type="primary" style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }} onClick={() => navigate('/batches')}>
                去批次管理加入批次
              </Button>
            )}
            {detail.status === 'BATCHED' && (
              <Button type="primary" style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }} loading={acting} onClick={() => doTransition('START_TEST')}>
                开始检测
              </Button>
            )}
            {detail.status === 'IN_TEST' && (
              <Button type="primary" style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }} loading={acting} onClick={() => doTransition('COMPLETE_TEST')}>
                完成检测
              </Button>
            )}
            {detail.status === 'TESTED' && (
              <Button type="primary" icon={<FileAddOutlined />} loading={acting} onClick={createReport}>
                生成报告草稿
              </Button>
            )}
            {(detail.status === 'TESTED' || detail.status === 'REPORT_DRAFT' || detail.status === 'REPORT_REVIEW' || detail.status === 'REPORT_APPROVED') && (
              <Button icon={<InboxOutlined />} onClick={() => { archiveForm.resetFields(); setArchiveOpen(true); }}>
                留样登记
              </Button>
            )}
            {detail.status === 'ARCHIVED' && (
              <Button danger icon={<DeleteOutlined />} onClick={() => { loadUsers(); disposeForm.resetFields(); setDisposeOpen(true); }}>
                留样销毁
              </Button>
            )}
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
          <Descriptions.Item label="声明纯度">{detail.declaredPurityPct ? `${detail.declaredPurityPct}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="所属批次">
            {detail.batch ? (
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/batches/${detail.batch!.id}`)}>
                {detail.batch.batchNo}
              </Button>
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="留样位置">{detail.storageLocation ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="留样到期">{detail.retentionUntil ? new Date(detail.retentionUntil).toLocaleDateString('zh-CN') : '—'}</Descriptions.Item>
          <Descriptions.Item label="接收人">{detail.receivedBy?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{detail.remarks ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 检测任务 */}
      {detail.tests && detail.tests.length > 0 && (
        <Card
          title="检测任务"
          extra={<Button size="small" type="link" onClick={() => navigate('/tests')}>检测任务列表</Button>}
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          {detail.tests.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '8px 12px',
                marginBottom: 8,
                background: 'var(--bg-tertiary)',
                borderRadius: 6,
                borderLeft: `3px solid ${STATUS_META[t.status]?.color ?? 'var(--text-muted)'}`,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>
                <Tag color={t.method === 'FIRE_ASSAY' ? 'gold' : 'cyan'}>{t.method === 'FIRE_ASSAY' ? '火试金' : t.method}</Tag>
                {t.purityPct && <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{parseFloat(String(t.purityPct)).toFixed(4)}%</span>}
              </span>
              <span style={{ color: STATUS_META[t.status]?.color ?? 'var(--text-muted)' }}>{STATUS_META[t.status]?.label ?? t.status}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 报告 */}
      {detail.reports && detail.reports.length > 0 && (
        <Card title="检测报告" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          {detail.reports.map((r) => (
            <Button key={r.id} type="link" icon={<FileTextOutlined />} onClick={() => navigate(`/reports/${r.id}`)}>
              {r.reportNo} · {r.status}
            </Button>
          ))}
        </Card>
      )}

      {/* 状态机时间线(按当前状态高亮) */}
      <Card title="状态流转" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Timeline
          items={[
            { color: 'green', children: 'RECEIVED 已接收' },
            { color: detail.status === 'BATCHED' ? '#ff4d4f' : 'blue', children: 'BATCHED 已分批' },
            { color: detail.status === 'IN_TEST' ? '#ff4d4f' : 'blue', children: 'IN_TEST 检测中' },
            { color: detail.status === 'TESTED' ? '#ff4d4f' : 'blue', children: 'TESTED 已检测' },
            { color: detail.status.startsWith('REPORT') ? '#ff4d4f' : 'blue', children: 'REPORT 报告流转' },
            { color: detail.status === 'ARCHIVED' ? '#ff4d4f' : 'gray', children: 'ARCHIVED 已留样' },
          ]}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal title={`编辑样品(${detail.sampleNo})`} open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="保存" cancelText="取消">
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="留样位置" name="storageLocation">
            <Input placeholder="如:留样柜 A-3-12" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 留样登记弹窗 */}
      <Modal title="留样登记" open={archiveOpen} onCancel={() => setArchiveOpen(false)} onOk={submitArchive} okText="登记归档" cancelText="取消">
        <Alert type="info" showIcon message="登记后样品状态 → ARCHIVED,并计算留样到期日。" style={{ marginBottom: 16 }} />
        <Form form={archiveForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="留样位置" name="location" rules={[{ required: true, message: '留样位置必填' }]}>
            <Input placeholder="如:留样柜 A-3-12" />
          </Form.Item>
          <Form.Item label="留样期(月)" name="months" initialValue={6}>
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 留样销毁弹窗 */}
      <Modal
        title="留样销毁(双人审批)"
        open={disposeOpen && !mfaOpen}
        onCancel={() => setDisposeOpen(false)}
        onOk={() => setMfaOpen(true)}
        okText="下一步(MFA 验证)"
        cancelText="取消"
      >
        <Alert type="warning" showIcon message="留样销毁需批准人 + MFA 二次验证(CNAS §7.4)。" style={{ marginBottom: 16 }} />
        <Form form={disposeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="批准人" name="approveById" rules={[{ required: true, message: '请选择批准人' }]}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="选择批准人"
              options={users.map((u: any) => ({ value: u.id, label: `${u.name ?? u.username}(${u.role ?? ''})` }))}
            />
          </Form.Item>
          <Form.Item label="销毁方式" name="method" rules={[{ required: true }]} initialValue="INCINERATION">
            <Select options={DISPOSE_METHODS} />
          </Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={mfaOpen}
        title="MFA 二次验证 · 留样销毁"
        description="留样销毁为敏感操作,需二次验证。"
        onCancel={() => setMfaOpen(false)}
        onConfirm={submitDispose}
      />
    </div>
  );
}
