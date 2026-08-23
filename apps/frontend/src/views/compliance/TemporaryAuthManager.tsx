// =====================================================
// W+6-1: 临时授权 UI
// 检测员外出时代班(TA-YYYYMMDD-NNNN + 有效期 + 撤销)
// =====================================================

import { useMemo, useState } from 'react';
import {
  Button, Form, Input, Select, Table, Tag, Space, DatePicker, Modal,
  App, Popconfirm, Switch, Tooltip, Segmented,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, StopOutlined, KeyOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';

interface TempAuth {
  id: string;
  authNo: string;
  grantorId: string;
  grantor?: { name?: string; username?: string } | null;
  granteeId: string;
  grantee?: { name?: string; username?: string } | null;
  method: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  username: string;
  role?: string;
}

const METHOD_OPTS = [
  { value: 'FIRE_ASSAY', label: '火试金法' },
  { value: 'ICP_OES', label: 'ICP-OES' },
  { value: 'GRAVIMETRY', label: '重量法' },
  { value: 'VOLUMETRY', label: '容量法' },
  { value: 'ALL', label: '全部方法' },
];

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', EXPIRED: 'default', REVOKED: 'red',
};

// 即将到期阈值(24h)
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

function isExpiringSoon(auth: TempAuth): boolean {
  if (auth.status !== 'ACTIVE') return false;
  const to = new Date(auth.effectiveTo).getTime();
  const now = Date.now();
  return to > now && to - now < EXPIRING_SOON_MS;
}

export default function TemporaryAuthManager() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  // 顶部 Segmented:'active' = 仅活跃(default), 'all' = 全部(含已撤销/已过期)
  const [scope, setScope] = useState<'active' | 'all'>('active');

  const { data: list, isLoading } = useQuery({
    queryKey: ['temp-auths', scope],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (scope === 'all') params.all = 'true';
      return (await api.get<{ items: TempAuth[]; total: number }>('/compliance/temp-auth', { params })).data;
    },
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userMap = useMemo(
    () => new Map((users?.data ?? []).map((u) => [u.id, u.name ?? u.username])),
    [users?.data],
  );

  const createMut = useMutation({
    mutationFn: async (values: any) => {
      const dto = {
        granteeId: values.granteeId,
        method: values.method,
        effectiveFrom: (values.effectiveFrom as Dayjs).toISOString(),
        effectiveTo: (values.effectiveTo as Dayjs).toISOString(),
        reason: values.reason,
      };
      return (await api.post('/compliance/temp-auth', dto)).data;
    },
    onSuccess: () => {
      message.success('临时授权已授予');
      setCreateOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['temp-auths'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/compliance/temp-auth/${id}/revoke`)).data,
    onSuccess: () => {
      message.success('已撤销');
      qc.invalidateQueries({ queryKey: ['temp-auths'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '撤销失败'),
  });

  const columns = [
    {
      title: '授权号', dataIndex: 'authNo', width: 140,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span>
      ),
    },
    {
      title: '批准人', dataIndex: 'grantorId', width: 110,
      render: (id: string, r: TempAuth) => r.grantor?.name ?? userMap.get(id) ?? id.slice(0, 8),
    },
    {
      title: '被授权人', dataIndex: 'granteeId', width: 110,
      render: (id: string, r: TempAuth) => r.grantee?.name ?? userMap.get(id) ?? id.slice(0, 8),
    },
    {
      title: '方法', dataIndex: 'method', width: 100,
      render: (m: string) => <Tag color="cyan">{METHOD_OPTS.find((o) => o.value === m)?.label ?? m}</Tag>,
    },
    {
      title: '生效', dataIndex: 'effectiveFrom', width: 150,
      render: (v: string) => v?.substring(0, 16).replace('T', ' '),
    },
    {
      title: '到期', dataIndex: 'effectiveTo', width: 160,
      render: (v: string, r: TempAuth) => (
        <Space size={4}>
          <span>{v?.substring(0, 16).replace('T', ' ')}</span>
          {isExpiringSoon(r) && (
            <Tooltip title="距到期 < 24 小时">
              <Tag color="red" icon={<ClockCircleOutlined />}>即将到期</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '创建时间', dataIndex: 'createdAt', width: 150,
      render: (v: string) => (v ? v.substring(0, 16).replace('T', ' ') : '—'),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    {
      title: '操作', width: 90, fixed: 'right' as const,
      render: (_: unknown, r: TempAuth) => (
        <Popconfirm title="确认撤销?" onConfirm={() => revokeMut.mutate(r.id)} okText="撤销" cancelText="取消">
          <Button size="small" danger icon={<StopOutlined />} disabled={r.status !== 'ACTIVE'}>撤销</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="临时授权"
        subtitle="CNAS §7.2 人员授权 · 代班管理"
        icon={<KeyOutlined />}
        extra={
          <Space>
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as 'active' | 'all')}
              options={[
                { value: 'active', label: '仅活跃' },
                { value: 'all', label: '显示全部' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['temp-auths'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>授予临时权限</Button>
          </Space>
        }
      />
      <DataTable<TempAuth>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="授予临时权限"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        okText="授予"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="被授权人(代班)" name="granteeId" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择检测员"
              optionFilterProp="label"
              options={(users?.data ?? []).map((u) => ({ value: u.id, label: `${u.name}(${u.username})` }))}
            />
          </Form.Item>
          <Form.Item label="授权方法" name="method" rules={[{ required: true }]} initialValue="FIRE_ASSAY">
            <Select options={METHOD_OPTS} />
          </Form.Item>
          <Form.Item label="生效时间" name="effectiveFrom" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="到期时间" name="effectiveTo" rules={[{ required: true }]} initialValue={dayjs().add(7, 'day')}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="授权原因" name="reason" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="如:张三休假,由李四代班一周" />
          </Form.Item>
        </Form>
        {createMut.error && (
          <div style={{ color: 'red', marginTop: 8 }}>
            创建失败:{String((createMut.error as any)?.response?.data?.message ?? '')}
          </div>
        )}
      </Modal>
    </div>
  );
}