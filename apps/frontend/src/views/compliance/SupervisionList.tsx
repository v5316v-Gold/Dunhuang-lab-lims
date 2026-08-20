// =====================================================
// W+6-2: 监督记录 CRUD + 报表
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Input, Select, Table, Tag, Space, Modal, App, Popconfirm,
} from 'antd';
import {  PlusOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface Supervision {
  id: string;
  supNo: string;
  supervisorId: string;
  supervisorName?: string;
  superviseeId: string;
  superviseeName?: string;
  supDate: string;
  content: string;
  result: 'PASS' | 'CONCERN' | 'FAIL';
  correctiveAction?: string;
  createdById: string;
}

const RESULT_OPTS = [
  { value: 'PASS', label: '通过', color: 'green' },
  { value: 'CONCERN', label: '需关注', color: 'orange' },
  { value: 'FAIL', label: '不通过', color: 'red' },
];

const RESULT_COLOR = Object.fromEntries(RESULT_OPTS.map((o) => [o.value, o.color]));

export default function SupervisionList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supervision | null>(null);
  const [form] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['supervisions'],
    queryFn: async () => (await api.get<{ items: Supervision[]; total: number }>('/compliance/supervision')).data,
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: any[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userMap = new Map((users?.data ?? []).map((u: any) => [u.id, u.name ?? u.username]));

  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/compliance/supervision', values)).data,
    onSuccess: () => {
      message.success('监督记录已创建');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['supervisions'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const stats = {
    total: list?.total ?? 0,
    pass: list?.items.filter((i: Supervision) => i.result === 'PASS').length ?? 0,
    concern: list?.items.filter((i: Supervision) => i.result === 'CONCERN').length ?? 0,
    fail: list?.items.filter((i: Supervision) => i.result === 'FAIL').length ?? 0,
  };

  const columns = [
    { title: '编号', dataIndex: 'supNo', width: 130, render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span> },
    { title: '监督员', dataIndex: 'supervisorId', width: 90, render: (id: string) => userMap.get(id) ?? id.slice(0, 8) },
    { title: '被监督', dataIndex: 'superviseeId', width: 90, render: (id: string) => userMap.get(id) ?? id.slice(0, 8) },
    { title: '日期', dataIndex: 'supDate', width: 150, render: (v: string) => v?.substring(0, 16).replace('T', ' ') },
    {
      title: '结果', dataIndex: 'result', width: 90,
      render: (v: string) => <Tag color={RESULT_COLOR[v] ?? 'default'}>{RESULT_OPTS.find((o) => o.value === v)?.label ?? v}</Tag>,
    },
    { title: '监督内容', dataIndex: 'content', ellipsis: true },
    {
      title: '整改', dataIndex: 'correctiveAction', width: 200, ellipsis: true,
      render: (v: string) => v ? <span style={{ color: '#fa8c16' }}>{v}</span> : <span style={{ color: '#999' }}>-</span>,
    },
  ];

  return (
        <div>
      <PageHeader
        title="监督记录"
        subtitle="CNAS §7.2 人员监督 · 记录 + 整改"
        icon={<SafetyOutlined />}
        extra={
          <Space>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['supervisions'] })}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建监督</Button>
        </Space>
        }
      />
      <Space size="middle" style={{ marginBottom: 12 }}>
        <Tag color="blue">总数: {stats.total}</Tag>
        <Tag color="green">通过: {stats.pass}</Tag>
        <Tag color="orange">需关注: {stats.concern}</Tag>
        <Tag color="red">不通过: {stats.fail}</Tag>
      </Space>
      <DataTable<Supervision>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
      />
      <Modal
        title="新建监督记录"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="监督员" name="supervisorId" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="选择监督员"
              options={(users?.data ?? []).map((u: any) => ({ value: u.id, label: `${u.name ?? u.username}` }))}
            />
          </Form.Item>
          <Form.Item label="被监督人" name="superviseeId" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="选择被监督人"
              options={(users?.data ?? []).map((u: any) => ({ value: u.id, label: `${u.name ?? u.username}` }))}
            />
          </Form.Item>
          <Form.Item label="监督日期" name="supDate" rules={[{ required: true }]}>
            <Input type="date" placeholder="选择监督日期" />
          </Form.Item>
          <Form.Item label="监督内容" name="content" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="如:现场观察 ICP 操作是否规范" />
          </Form.Item>
          <Form.Item label="结果" name="result" rules={[{ required: true }]} initialValue="PASS">
            <Select options={RESULT_OPTS.map(({ value, label, color }) => ({ value, label }))} />
          </Form.Item>
          <Form.Item label="整改措施(若结果不为 PASS)" name="correctiveAction">
            <Input.TextArea rows={2} placeholder="若 CONCERN/FAIL 必填" />
          </Form.Item>
        </Form>
        {createMut.error && (
          <div style={{ color: 'red', marginTop: 8 }}>
            失败:{String((createMut.error as any)?.response?.data?.message ?? '')}
          </div>
        )}
      </Modal>
    </div>
  );
}