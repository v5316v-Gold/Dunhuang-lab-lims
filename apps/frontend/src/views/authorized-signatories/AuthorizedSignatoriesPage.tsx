// =====================================================
// 授权签字人管理页面(W1 架构 — CNAS-CL01:2018 §7.5.3)
// 实验室主任维护签字人名录;新增时扫码/选择用户
// =====================================================

import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  DatePicker,
  message,
  Switch,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;

interface AuthorizedSignatory {
  id: string;
  userId: string;
  user?: { id: string; username: string; name: string; role: string };
  approvedBy?: { id: string; name: string };
  methods: string[];
  sampleTypes: string[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

const METHOD_OPTIONS = [
  { value: 'FIRE_ASSAY', label: '火试金法' },
  { value: 'ICP_OES', label: 'ICP-OES' },
  { value: 'ICP_MS', label: 'ICP-MS' },
  { value: 'XRF', label: 'X 荧光' },
];

const SAMPLE_TYPE_OPTIONS = [
  { value: 'GOLD_INGOT', label: '金锭' },
  { value: 'GOLD_POWDER', label: '金粉' },
  { value: 'GOLD_ALLOY', label: '金合金' },
  { value: 'JEWELRY', label: '首饰' },
  { value: 'RECYCLED_GOLD', label: '回收金料' },
  { value: 'SILVER', label: '银' },
  { value: 'PLATINUM', label: '铂' },
  { value: 'PALLADIUM', label: '钯' },
  { value: 'OTHER', label: '其他' },
];

export default function AuthorizedSignatoriesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthorizedSignatory | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [form] = Form.useForm();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['authorized-signatories', activeOnly],
    queryFn: async () => (await api.get('/authorized-signatories', { params: { activeOnly } })).data,
  });

  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/authorized-signatories', values)).data,
    onSuccess: () => {
      message.success('新增成功');
      setModalOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['authorized-signatories'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '新增失败'),
  });

  const disableMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/authorized-signatories/${id}`)).data,
    onSuccess: () => {
      message.success('停用成功');
      qc.invalidateQueries({ queryKey: ['authorized-signatories'] });
    },
  });

  const columns = [
    { title: '签字人', dataIndex: ['user', 'name'], render: (v: string, r: AuthorizedSignatory) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.user?.username} · {r.user?.role}</Text>
      </Space>
    ) },
    { title: '授权方法', dataIndex: 'methods', render: (v: string[]) => v.length ? v.map(m => <Tag key={m} color="gold">{m}</Tag>) : <Text type="secondary">不限</Text> },
    { title: '授权样品类型', dataIndex: 'sampleTypes', render: (v: string[]) => v.length ? v.map(s => <Tag key={s}>{s}</Tag>) : <Text type="secondary">不限</Text> },
    { title: '生效期', render: (_: unknown, r: AuthorizedSignatory) => (
      <Space direction="vertical" size={0}>
        <Text>{new Date(r.effectiveFrom).toLocaleDateString('zh-CN')} 起</Text>
        {r.effectiveTo && <Text type="secondary">至 {new Date(r.effectiveTo).toLocaleDateString('zh-CN')}</Text>}
      </Space>
    ) },
    { title: '状态', dataIndex: 'isActive', render: (v: boolean) => v ? <Tag color="success">生效中</Tag> : <Tag>已停用</Tag> },
    { title: '批准人', dataIndex: ['approvedBy', 'name'] },
    {
      title: '操作',
      render: (_: unknown, r: AuthorizedSignatory) => (
        <Space>
          <Button size="small" disabled={!r.isActive} onClick={() => disableMut.mutate(r.id)}>
            停用
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="授权签字人名录"
        subtitle="CNAS-CL01:2018 §7.5.3 · 实验室主任维护 · 报告签发校验"
        extra={
          <Space>
            <Switch checkedChildren="仅生效中" unCheckedChildren="全部" checked={activeOnly} onChange={setActiveOnly} />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['authorized-signatories'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
              新增签字人
            </Button>
          </Space>
        }
      />

      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Table<AuthorizedSignatory>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={items}
          columns={columns as any}
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑授权签字人' : '新增授权签字人'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item label="签字人用户 ID" name="userId" rules={[{ required: true, message: '请填写签字人用户 UUID' }]}>
            <Input placeholder="如:00000000-0000-0000-0000-000000000003" />
          </Form.Item>
          <Form.Item label="授权方法(空 = 不限)" name="methods">
            <Select mode="multiple" allowClear options={METHOD_OPTIONS} placeholder="选择授权方法" />
          </Form.Item>
          <Form.Item label="授权样品类型(空 = 不限)" name="sampleTypes">
            <Select mode="multiple" allowClear options={SAMPLE_TYPE_OPTIONS} placeholder="选择授权样品类型" />
          </Form.Item>
          <Form.Item label="生效起" name="effectiveFrom" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="生效止(可选)" name="effectiveTo">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={2} placeholder="如:授权依据 CNAS-CL01:2018 §7.5.3" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
