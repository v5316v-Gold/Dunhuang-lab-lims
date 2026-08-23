// =====================================================
// 用户管理页 - W4 用户管理
// 列表 + 创建账号 + 激活/停用 + 重置密码 + 删除
// 操作需 MFA(管理端点已装饰)
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, App, Alert, Popconfirm, Tooltip, Drawer, Descriptions, message,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, StopOutlined, KeyOutlined, UserSwitchOutlined, DeleteOutlined, EyeOutlined, UserOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { api } from '../../data/api';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  phone?: string;
  title?: string;
  dept?: { id: string; code: string; name: string } | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '系统管理员' },
  { value: 'LAB_DIRECTOR', label: '实验室主任' },
  { value: 'QUALITY_MANAGER', label: '质量经理' },
  { value: 'EQUIPMENT_MANAGER', label: '设备管理员' },
  { value: 'REAGENT_MANAGER', label: '试剂管理员' },
  { value: 'SENIOR_ANALYST', label: '高级检测员' },
  { value: 'ANALYST', label: '检测员' },
  { value: 'INTERN', label: '实习生' },
  { value: 'EXTERNAL_AUDITOR', label: '外审员' },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'red', LAB_DIRECTOR: 'gold', QUALITY_MANAGER: 'purple', EQUIPMENT_MANAGER: 'cyan',
  REAGENT_MANAGER: 'blue', SENIOR_ANALYST: 'geekblue', ANALYST: 'green',
  INTERN: 'default', EXTERNAL_AUDITOR: 'magenta',
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: '活跃' },
  INACTIVE: { color: 'default', label: '停用' },
  PENDING: { color: 'gold', label: '待审核' },
  LOCKED: { color: 'red', label: '锁定' },
};

export default function UsersPage() {
  const { message: appMessage } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // 通用 MFA modal + pending payload
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaTarget, setMfaTarget] = useState<null | {
    type: 'activate' | 'deactivate' | 'resetPwd' | 'delete' | 'assignRole';
    userId: string;
    payload?: any;
  }>(null);
  const [resetPwdOpen, setResetPwdOpen] = useState<{ userId: string } | null>(null);
  const [resetPwdForm] = Form.useForm();
  const [assignRoleOpen, setAssignRoleOpen] = useState<{ userId: string; currentRole: string } | null>(null);
  const [assignRoleForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, keyword, role, status],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (keyword) params.username = keyword;
      if (role) params.role = role;
      if (status) params.status = status;
      return (await api.get('/users', { params })).data;
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['user-detail', detailId],
    queryFn: async () => (detailId ? (await api.get(`/users/${detailId}`)).data : null),
    enabled: !!detailId,
  });

  // 创建用户(无需 MFA — 内部 admin 端点)
  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/users', { ...v, status: 'ACTIVE' })).data,
    onSuccess: (data) => {
      appMessage.success(`用户 ${data.username} 创建成功,初始密码 Admin@Pass123,请告知本人首次登录后修改`);
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message ?? '创建失败';
      appMessage.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // 管理动作(均需 MFA)
  const adminActionMut = useMutation({
    mutationFn: async ({ endpoint, mfaToken }: { endpoint: string; mfaToken: string }) => {
      const [, method, , id, action] = endpoint.match(/^(\w+)\s+\/users\/([^/]+)\/(.+)$/) || [];
      return (await api.post(`/users/${id}/${action}`, mfaToken === '__DIRECT__' ? {} : {}, { headers: mfaToken === '__DIRECT__' ? {} : { 'x-mfa-token': mfaToken } })).data;
    },
    onSuccess: (_, vars) => {
      const label: Record<string, string> = { activate: '已激活', deactivate: '已停用', delete: '已删除', resetPwd: '密码已重置', assignRole: '角色已更新' };
      appMessage.success(label[vars.endpoint] ?? '操作成功');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user-detail'] });
      setMfaOpen(false);
      setResetPwdOpen(null);
      setAssignRoleOpen(null);
    },
    onError: (e: any) => {
      appMessage.error(e.response?.data?.message ?? '操作失败');
    },
  });

  const confirmAdmin = (mfaToken: string) => {
    if (!mfaTarget) return;
    adminActionMut.mutate({ endpoint: `${mfaTarget.type} /users/${mfaTarget.userId}/${actionPath(mfaTarget.type)}`, mfaToken });
  };

  const actionPath = (type: string) => {
    switch (type) {
      case 'activate': return 'activate';
      case 'deactivate': return 'deactivate';
      case 'delete': return ''; // delete uses different endpoint
      case 'resetPwd': return 'reset-password';
      case 'assignRole': return 'roles';
      default: return '';
    }
  };

  // 重置密码弹窗(走 MFA)
  const askResetPwd = (userId: string) => { setResetPwdOpen({ userId }); resetPwdForm.resetFields(); };
  const submitResetPwd = async () => {
    if (!resetPwdOpen) return;
    const v = await resetPwdForm.validateFields().catch(() => null);
    if (!v) return;
    setMfaTarget({ type: 'resetPwd', userId: resetPwdOpen.userId, payload: { newPassword: v.newPassword } });
    setResetPwdOpen(null);
    setMfaOpen(true);
  };

  // 分配角色
  const askAssignRole = (userId: string, currentRole: string) => {
    setAssignRoleOpen({ userId, currentRole });
    assignRoleForm.setFieldsValue({ role: currentRole });
  };
  const submitAssignRole = async () => {
    if (!assignRoleOpen) return;
    const v = await assignRoleForm.validateFields().catch(() => null);
    if (!v) return;
    setMfaTarget({ type: 'assignRole', userId: assignRoleOpen.userId, payload: { role: v.role } });
    setAssignRoleOpen(null);
    setMfaOpen(true);
  };

  // 直接调(带 MFA token)的 fetcher
  const doAdminCall = async (endpoint: string, mfaToken: string, body?: any) => {
    const tokens = endpoint.split('|');
    const method = tokens[0];
    const path = tokens[1];
    const cfg: any = { method, headers: { 'x-mfa-token': mfaToken, 'Content-Type': 'application/json' } };
    if (body) cfg.body = JSON.stringify(body);
    const r = await api.request({ ...cfg, url: path });
    return r.data;
  };

  // 重写 adminActionMut 用 doAdminCall
  // 为简化,删除原 adminActionMut,改用一个统一 handle
  const handleAdminConfirm = async (mfaToken: string) => {
    if (!mfaTarget) return;
    try {
      if (mfaTarget.type === 'activate') {
        await api.post(`/users/${mfaTarget.userId}/activate`, {}, { headers: { 'x-mfa-token': mfaToken } });
        appMessage.success('用户已激活');
      } else if (mfaTarget.type === 'deactivate') {
        await api.post(`/users/${mfaTarget.userId}/deactivate`, {}, { headers: { 'x-mfa-token': mfaToken } });
        appMessage.success('用户已停用');
      } else if (mfaTarget.type === 'resetPwd') {
        await api.post(`/users/${mfaTarget.userId}/reset-password`, { newPassword: mfaTarget.payload.newPassword }, { headers: { 'x-mfa-token': mfaToken } });
        appMessage.success(`密码已重置为新值,请告知本人`);
      } else if (mfaTarget.type === 'assignRole') {
        await api.post(`/users/${mfaTarget.userId}/roles`, { role: mfaTarget.payload.role }, { headers: { 'x-mfa-token': mfaToken } });
        appMessage.success(`角色已更新为 ${mfaTarget.payload.role}`);
      } else if (mfaTarget.type === 'delete') {
        await api.delete(`/users/${mfaTarget.userId}`, { headers: { 'x-mfa-token': mfaToken } });
        appMessage.success('用户已删除');
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user-detail'] });
      setMfaOpen(false);
      setMfaTarget(null);
    } catch (e: any) {
      appMessage.error(e.response?.data?.message ?? '操作失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 140, render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span> },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '邮箱', dataIndex: 'email', ellipsis: true },
    {
      title: '角色', dataIndex: 'role', width: 130,
      render: (v: string) => <Tag color={ROLE_COLOR[v] ?? 'default'}>{ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => {
        const m = STATUS_META[v] ?? { color: 'default', label: v };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: 'MFA', dataIndex: 'mfaEnabled', width: 70,
      render: (v: boolean) => v ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>,
    },
    {
      title: '最近登录', dataIndex: 'lastLoginAt', width: 160,
      render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-',
    },
    {
      title: '操作', width: 280, fixed: 'right' as const,
      render: (_: any, r: UserRow) => (
        <Space size={4} wrap>
          <Tooltip title="详情"><Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)} /></Tooltip>
          {r.status !== 'ACTIVE' && (
            <Tooltip title="审核激活/重激活"><Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => setMfaTarget({ type: 'activate', userId: r.id })} disabled={r.username === 'admin'}>激活</Button></Tooltip>
          )}
          {r.status === 'ACTIVE' && (
            <Tooltip title="停用"><Button size="small" danger icon={<StopOutlined />} disabled={r.username === 'admin'} onClick={() => setMfaTarget({ type: 'deactivate', userId: r.id })}>停用</Button></Tooltip>
          )}
          <Tooltip title="分配角色"><Button size="small" icon={<UserSwitchOutlined />} disabled={r.username === 'admin'} onClick={() => askAssignRole(r.id, r.role)}>角色</Button></Tooltip>
          <Tooltip title="重置密码"><Button size="small" icon={<KeyOutlined />} disabled={r.username === 'admin'} onClick={() => askResetPwd(r.id)}>重置</Button></Tooltip>
          <Tooltip title="软删除"><Button size="small" danger icon={<DeleteOutlined />} disabled={r.username === 'admin'} onClick={() => setMfaTarget({ type: 'delete', userId: r.id })} /></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="用户管理"
        subtitle="账号 · 角色 · MFA · 软删除 — 管理操作需 MFA 二次验证"
        icon={<KeyOutlined />}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['users'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>创建账号</Button>
          </Space>
        }
      />

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search placeholder="按用户名搜索" allowClear style={{ width: 200 }} value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
        <Select placeholder="角色" allowClear style={{ width: 160 }} value={role} onChange={(v) => { setRole(v); setPage(1); }} options={ROLE_OPTIONS} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))} />
      </Space>

      <Alert
        type="info"
        showIcon
        message={`共 ${data?.total ?? 0} 个账号,首页禁用 admin 操作以防误删。审核中 (PENDING) 用户请先点击「激活」改为 ACTIVE 角色后方可登录。`}
        style={{ marginBottom: 12 }}
      />

      <DataTable<UserRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        pagination={{
          current: page, total: data?.total ?? 0, pageSize: 20,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 1100 }}
      />

      {/* 创建账号 */}
      <Modal title="创建账号" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMut.isPending} width={520}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(v) => createMut.mutate(v)}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, min: 3, max: 50, pattern: /^[a-zA-Z0-9._-]+$/, message: '3-50 字符,仅字母数字 . _ -' }]}>
            <Input prefix={<UserOutlined />} placeholder="如:zhang.san" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱(唯一)" />
          </Form.Item>
          <Form.Item label="手机号(可选)" name="phone">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} placeholder="选择角色" />
          </Form.Item>
          <Alert type="info" message="初始密码固定为 Admin@Pass123,创建后请告知本人首次登录后修改。" showIcon style={{ marginTop: 4 }} />
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal title="重置密码" open={!!resetPwdOpen} onCancel={() => setResetPwdOpen(null)} onOk={submitResetPwd} width={420}>
        <Form form={resetPwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 8, max: 128, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/, message: '至少 8 位,大小写+数字+特殊字符' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="新密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配角色 */}
      <Modal title="分配角色" open={!!assignRoleOpen} onCancel={() => setAssignRoleOpen(null)} onOk={submitAssignRole} width={420}>
        <Form form={assignRoleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="新角色" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* MFA 验证 */}
      <MfaChallengeModal
        open={mfaOpen}
        title={`MFA 二次验证 · ${mfaTarget?.type === 'activate' ? '激活用户' : mfaTarget?.type === 'deactivate' ? '停用用户' : mfaTarget?.type === 'resetPwd' ? '重置密码' : mfaTarget?.type === 'assignRole' ? '分配角色' : mfaTarget?.type === 'delete' ? '删除用户' : '敏感操作'}`}
        description="用户管理敏感操作需二次验证。"
        onCancel={() => setMfaOpen(false)}
        onConfirm={handleAdminConfirm}
      />

      {/* 详情 */}
      <Drawer title="用户详情" width={520} open={!!detailId} onClose={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ['user-detail'] }); }}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">{detail.username}</Descriptions.Item>
            <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{detail.email}</Descriptions.Item>
            <Descriptions.Item label="角色"><Tag color={ROLE_COLOR[detail.role]}>{ROLE_OPTIONS.find((o) => o.value === detail.role)?.label ?? detail.role}</Tag></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={STATUS_META[detail.status]?.color}>{STATUS_META[detail.status]?.label}</Tag></Descriptions.Item>
            <Descriptions.Item label="MFA">{detail.mfaEnabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>}</Descriptions.Item>
            <Descriptions.Item label="手机">{detail.phone ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{detail.dept?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="最近登录">{detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
