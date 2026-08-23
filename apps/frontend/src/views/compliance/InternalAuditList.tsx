// =====================================================
// 内部审核 InternalAuditList — CNAS-CL01:2018 §8.8(必审)
// 列表 + 创建 + 关闭(发现/不符合项,MFA 强制)+ 内审检查表(15 条款)
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Input, Select, Table, Tag, Space, Modal, App, Alert, InputNumber, Collapse, Typography, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, CheckSquareOutlined, FileProtectOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';

const { Text, Paragraph } = Typography;

interface InternalAudit {
  id: string;
  auditNo: string;
  title: string;
  scope: string;
  auditDate: string;
  auditorIds: string[];
  findings?: string | null;
  ncCount: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED';
  createdBy?: { name?: string } | null;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  PLANNED: { color: 'gold', label: '计划中' },
  IN_PROGRESS: { color: 'processing', label: '进行中' },
  CLOSED: { color: 'green', label: '已关闭' },
};

export default function InternalAuditList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<InternalAudit | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [createForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['internal-audits', statusFilter],
    queryFn: async () => {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      return (await api.get<{ items: InternalAudit[]; total: number }>(`/compliance/internal-audit${q}`)).data;
    },
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: any[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userMap = new Map((users?.data ?? []).map((u: any) => [u.id, u.name ?? u.username]));

  const { data: checklist } = useQuery({
    queryKey: ['audit-checklist'],
    queryFn: async () => (await api.get<any[]>('/compliance/audit-checklist')).data,
    enabled: checklistOpen,
  });

  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/compliance/internal-audit', v)).data,
    onSuccess: () => {
      message.success('内审计划已创建(编号自动生成)');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['internal-audits'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const closeMut = useMutation({
    mutationFn: async ({ mfaToken }: { mfaToken: string }) => {
      const values = await closeForm.validateFields().catch(() => null);
      if (!values) return null;
      return (await api.post(`/compliance/internal-audit/${closeTarget!.id}/close`, values, {
        headers: { 'x-mfa-token': mfaToken },
      })).data;
    },
    onSuccess: (data) => {
      if (!data) return;
      message.success(`内审 ${data.auditNo} 已关闭`);
      setCloseTarget(null);
      setMfaOpen(false);
      closeForm.resetFields();
      qc.invalidateQueries({ queryKey: ['internal-audits'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '关闭失败'),
  });

  const columns = [
    {
      title: '编号', dataIndex: 'auditNo', width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span>,
    },
    { title: '审核主题', dataIndex: 'title', width: 180, ellipsis: true },
    { title: '审核范围', dataIndex: 'scope', ellipsis: true },
    {
      title: '审核日期', dataIndex: 'auditDate', width: 110,
      render: (v: string) => v?.substring(0, 10),
    },
    {
      title: '内审员', dataIndex: 'auditorIds', width: 150,
      render: (ids: string[]) => (ids ?? []).map((id) => <Tag key={id}>{userMap.get(id) ?? id.slice(0, 8)}</Tag>),
    },
    {
      title: '不符合项', dataIndex: 'ncCount', width: 90, align: 'right' as const,
      render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <Tag>0</Tag>),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => {
        const m = STATUS_META[v] ?? { color: 'default', label: v };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '操作', width: 100, fixed: 'right' as const,
      render: (_: any, r: InternalAudit) =>
        r.status !== 'CLOSED' ? (
          <Popconfirm
            title="关闭内审(需 MFA 二次验证)"
            description="关闭后将记录审核发现与不符合项数量,不可再改。"
            onConfirm={() => { setCloseTarget(r); closeForm.resetFields(); setMfaOpen(true); }}
          >
            <Button size="small" type="primary" icon={<CheckSquareOutlined />}>关闭</Button>
          </Popconfirm>
        ) : (
          <Button size="small" type="link" onClick={() => {
            Modal.info({ title: `内审发现(${r.auditNo})`, width: 620, content: <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.findings ?? '(无记录)'}</Paragraph> });
          }}>查看发现</Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="内部审核"
        subtitle="CNAS-CL01:2018 §8.8 · 年度内审计划 → 发现/不符合项 → 关闭(MFA)"
        icon={<SafetyCertificateOutlined />}
        extra={
          <Space>
            <Select
              allowClear placeholder="状态" style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter}
              options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
            />
            <Button icon={<FileProtectOutlined />} onClick={() => setChecklistOpen(true)}>内审检查表(15 条款)</Button>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['internal-audits'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>新建内审</Button>
          </Space>
        }
      />

      <DataTable<InternalAudit>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1050 }}
      />

      {/* 创建内审 */}
      <Modal
        title="新建内审计划"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="审核主题" name="title" rules={[{ required: true, message: '请输入审核主题' }]}>
            <Input placeholder="如:2026 年度管理体系内部审核" />
          </Form.Item>
          <Form.Item label="审核范围" name="scope" rules={[{ required: true, message: '请输入审核范围' }]}>
            <Input.TextArea rows={3} placeholder="如:火试金/ICP 检测活动、设备、人员、报告签发全过程(CNAS §4-§8 全要素)" />
          </Form.Item>
          <Form.Item label="审核日期" name="auditDate" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="内审员(多选)" name="auditorIds" rules={[{ required: true, message: '请选择至少一名内审员' }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="选择内审员"
              options={(users?.data ?? []).map((u: any) => ({ value: u.id, label: `${u.name ?? u.username}(${u.role ?? ''})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关闭内审(先校验字段,MFA 弹窗确认后提交) */}
      <Modal
        title={`关闭内审(${closeTarget?.auditNo ?? ''})`}
        open={!!closeTarget && !mfaOpen}
        onCancel={() => setCloseTarget(null)}
        onOk={() => { setMfaOpen(true); }}
        okText="下一步(MFA 验证)"
        cancelText="取消"
        width={560}
      >
        <Alert
          type="warning" showIcon
          message="关闭内审为敏感操作,需 MFA 二次验证;关闭后不可再修改。"
          style={{ marginBottom: 16 }}
        />
        <Form form={closeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="审核发现(findings)" name="findings" rules={[{ required: true, message: '请填写审核发现' }]}>
            <Input.TextArea rows={4} placeholder="如:仪器设备维护记录不全;新员工上岗考核记录缺失…" />
          </Form.Item>
          <Form.Item label="不符合项数量(ncCount)" name="ncCount" rules={[{ required: true, message: '请填写不符合项数量' }]} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={mfaOpen}
        title="MFA 二次验证 · 关闭内审"
        description="关闭内审需二次验证(CNAS §8.8 敏感操作)。"
        onCancel={() => setMfaOpen(false)}
        onConfirm={(mfaToken) => closeMut.mutateAsync({ mfaToken })}
      />

      {/* 内审检查表(15 条款) */}
      <Modal
        title="内审检查表(CNAS §4-§7 + §8.8,15 条款)"
        open={checklistOpen}
        onCancel={() => setChecklistOpen(false)}
        footer={<Button onClick={() => setChecklistOpen(false)}>关闭</Button>}
        width={820}
      >
        {!checklist ? (
          <Alert type="info" showIcon message="加载检查表…(需质量管理/实验室主任/管理员角色)" />
        ) : (
          <Collapse
            defaultActiveKey={['0']}
            items={(checklist as any[]).map((c, i) => ({
              key: String(i),
              label: <Text strong>{c.section} — {c.clause}: {c.title}</Text>,
              children: (
                <div>
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    {(c.questions ?? []).map((q: string, qi: number) => <li key={qi}>{q}</li>)}
                  </ul>
                  {c.evidence && <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>取证要求:{c.evidence}</Paragraph>}
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
