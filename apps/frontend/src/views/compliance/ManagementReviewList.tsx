// =====================================================
// 管理评审 ManagementReviewList — CNAS-CL01:2018 §8.9(必审)
// 列表 + 创建 + 关闭(输出/决议,MFA 强制)+ 12 项评审输入自动汇总
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Input, Select, Table, Tag, Space, Modal, App, Alert, Descriptions, Typography, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, CheckSquareOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

const { Text, Paragraph } = Typography;

interface ManagementReview {
  id: string;
  reviewNo: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  reviewDate: string;
  attendees: string[];
  inputs?: string | object | null;
  outputs?: string | null;
  decisions?: string | null;
  status: 'PLANNED' | 'CLOSED';
}

interface MrInputs {
  period: { from: string; to: string };
  inputs: Array<{ key: string; title: string; value?: any; summary?: string }>;
  generatedAt: string;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  PLANNED: { color: 'gold', label: '计划中' },
  CLOSED: { color: 'green', label: '已关闭' },
};

export default function ManagementReviewList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<ManagementReview | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [inputsOpen, setInputsOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['management-reviews'],
    queryFn: async () => (await api.get<{ items: ManagementReview[]; total: number }>('/compliance/management-review')).data,
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: any[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userMap = new Map((users?.data ?? []).map((u: any) => [u.id, u.name ?? u.username]));

  const { data: mrInputs, isLoading: inputsLoading } = useQuery({
    queryKey: ['management-review-inputs'],
    queryFn: async () => {
      const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      const to = new Date().toISOString().substring(0, 10);
      return (await api.get<MrInputs>(`/compliance/management-review/inputs?from=${from}&to=${to}`)).data;
    },
    enabled: inputsOpen,
  });

  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/compliance/management-review', v)).data,
    onSuccess: () => {
      message.success('管理评审已创建(编号自动生成)');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['management-reviews'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const closeMut = useMutation({
    mutationFn: async ({ mfaToken }: { mfaToken: string }) => {
      const values = await closeForm.validateFields().catch(() => null);
      if (!values) return null;
      return (await api.post(`/compliance/management-review/${closeTarget!.id}/close`, values, {
        headers: { 'x-mfa-token': mfaToken },
      })).data;
    },
    onSuccess: (data) => {
      if (!data) return;
      message.success(`管理评审 ${data.reviewNo} 已关闭`);
      setCloseTarget(null);
      setMfaOpen(false);
      closeForm.resetFields();
      qc.invalidateQueries({ queryKey: ['management-reviews'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '关闭失败'),
  });

  const columns = [
    {
      title: '编号', dataIndex: 'reviewNo', width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span>,
    },
    { title: '评审主题', dataIndex: 'title', width: 200, ellipsis: true },
    {
      title: '评审期', width: 190,
      render: (_: any, r: ManagementReview) => `${r.periodFrom?.substring(0, 10)} ~ ${r.periodTo?.substring(0, 10)}`,
    },
    {
      title: '评审日期', dataIndex: 'reviewDate', width: 110,
      render: (v: string) => v?.substring(0, 10),
    },
    {
      title: '参会人员', dataIndex: 'attendees', width: 160,
      render: (ids: string[]) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(ids ?? []).slice(0, 3).map((id) => userMap.get(id) ?? id.slice(0, 8)).join('、')}
          {(ids ?? []).length > 3 ? ` 等 ${ids.length} 人` : ''}
        </Text>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => {
        const m = STATUS_META[v] ?? { color: 'default', label: v };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '操作', width: 150, fixed: 'right' as const,
      render: (_: any, r: ManagementReview) => (
        <Space size={4}>
          {r.status !== 'CLOSED' ? (
            <Popconfirm
              title="关闭管理评审(需 MFA 二次验证)"
              description="关闭后将记录评审输出与改进决议。"
              onConfirm={() => { setCloseTarget(r); closeForm.resetFields(); setMfaOpen(true); }}
            >
              <Button size="small" type="primary" icon={<CheckSquareOutlined />}>关闭</Button>
            </Popconfirm>
          ) : (
            <Button size="small" type="link" onClick={() => {
              Modal.info({
                title: `评审决议(${r.reviewNo})`,
                width: 640,
                content: (
                  <div>
                    <Text strong>评审输出:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.outputs ?? '(无)'}</Paragraph>
                    <Text strong>改进决议:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.decisions ?? '(无)'}</Paragraph>
                  </div>
                ),
              });
            }}>查看决议</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="管理评审"
        subtitle="CNAS-CL01:2018 §8.9 · 年度管理评审 → 输出/决议(MFA)+ 12 项输入自动汇总"
        icon={<SafetyCertificateOutlined />}
        extra={
          <Space>
            <Button icon={<FundProjectionScreenOutlined />} onClick={() => setInputsOpen(true)}>评审输入汇总(12 项)</Button>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['management-reviews'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>新建管理评审</Button>
          </Space>
        }
      />

      <DataTable<ManagementReview>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1050 }}
      />

      {/* 创建管理评审 */}
      <Modal
        title="新建管理评审"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={580}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="评审主题" name="title" rules={[{ required: true, message: '请输入评审主题' }]}>
            <Input placeholder="如:2026 年度管理体系管理评审" />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item label="评审期起" name="periodFrom" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item label="评审期止" name="periodTo" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
          </Space>
          <Form.Item label="评审日期" name="reviewDate" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="参会人员(多选)" name="attendees">
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="选择参会人员"
              options={(users?.data ?? []).map((u: any) => ({ value: u.id, label: `${u.name ?? u.username}(${u.role ?? ''})` }))}
            />
          </Form.Item>
          <Form.Item label="评审输入(inputs,可先粘贴自动汇总)" name="inputs">
            <Input.TextArea rows={3} placeholder="也可点击顶部「评审输入汇总」查看 12 项自动数据后填写结论" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关闭管理评审 */}
      <Modal
        title={`关闭管理评审(${closeTarget?.reviewNo ?? ''})`}
        open={!!closeTarget && !mfaOpen}
        onCancel={() => setCloseTarget(null)}
        onOk={() => setMfaOpen(true)}
        okText="下一步(MFA 验证)"
        cancelText="取消"
        width={580}
      >
        <Alert type="warning" showIcon message="关闭管理评审为敏感操作,需 MFA 二次验证;关闭后不可再修改。" style={{ marginBottom: 16 }} />
        <Form form={closeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="评审输出(outputs)" name="outputs" rules={[{ required: true, message: '请填写评审输出' }]}>
            <Input.TextArea rows={4} placeholder="如:体系运行有效,资源满足要求;需更新设备校准计划…" />
          </Form.Item>
          <Form.Item label="改进决议(decisions)" name="decisions" rules={[{ required: true, message: '请填写改进决议' }]}>
            <Input.TextArea rows={4} placeholder="如:2026 年新增 1 名 ICP 授权检测员;购置 1 台电子天平…" />
          </Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={mfaOpen}
        title="MFA 二次验证 · 关闭管理评审"
        description="关闭管理评审需二次验证(CNAS §8.9 敏感操作)。"
        onCancel={() => setMfaOpen(false)}
        onConfirm={(mfaToken) => closeMut.mutateAsync({ mfaToken })}
      />

      {/* 12 项评审输入自动汇总 */}
      <Modal
        title="管理评审输入自动汇总(CNAS §8.9 · 12 项)"
        open={inputsOpen}
        onCancel={() => setInputsOpen(false)}
        footer={<Button onClick={() => setInputsOpen(false)}>关闭</Button>}
        width={820}
      >
        {inputsLoading || !mrInputs ? (
          <Alert type="info" showIcon message="汇总生成中…(需质量管理/实验室主任/管理员角色)" />
        ) : (
          <>
            <Alert
              type="success" showIcon
              message={`统计周期:${mrInputs.period.from?.substring(0, 10)} ~ ${mrInputs.period.to?.substring(0, 10)} · 生成时间 ${new Date(mrInputs.generatedAt).toLocaleString('zh-CN', { hour12: false })}`}
              style={{ marginBottom: 16 }}
            />
            <Descriptions bordered size="small" column={1}>
              {(mrInputs.inputs ?? []).map((it) => (
                <Descriptions.Item key={it.key} label={<Text strong>{it.title}</Text>}>
                  {it.summary ?? (it.value != null ? String(it.value) : '—')}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
}
