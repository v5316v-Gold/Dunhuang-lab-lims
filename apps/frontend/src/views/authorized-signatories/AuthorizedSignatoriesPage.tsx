// =====================================================
// 授权签字人管理页面(W1 架构 — CNAS-CL01:2018 §7.5.3)
// 实验室主任维护签字人名录;新增时扫码/选择用户
// =====================================================

import { useEffect, useState } from 'react';
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
  App,
  Switch,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  StopOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;

// 即将到期阈值(7 天)
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

interface UserLite {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthorizedSignatory {
  id: string;
  userId: string;
  user?: { id: string; username: string; name: string; role: string } | null;
  approvedBy?: { id: string; name: string } | null;
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

// 距到期 < 7 天判定(且已生效、未过期)
function isExpiringSoon(r: AuthorizedSignatory): boolean {
  if (!r.isActive || !r.effectiveTo) return false;
  const to = new Date(r.effectiveTo).getTime();
  const now = Date.now();
  return to > now && to - now < EXPIRING_SOON_MS;
}

export default function AuthorizedSignatoriesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthorizedSignatory | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [form] = Form.useForm();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['authorized-signatories', activeOnly],
    queryFn: async () =>
      (await api.get('/authorized-signatories', { params: { activeOnly } })).data as AuthorizedSignatory[],
  });

  const { data: usersResp } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: UserLite[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userOptions = (usersResp?.data ?? []).map((u) => ({
    value: u.id,
    label: `${u.name ?? u.username}(${u.username} · ${u.role})`,
  }));

  // 打开 Modal 时:若是新增则清空;编辑则预填
  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        userId: editing.userId,
        methods: editing.methods ?? [],
        sampleTypes: editing.sampleTypes ?? [],
        effectiveFrom: editing.effectiveFrom ? dayjs(editing.effectiveFrom) : null,
        effectiveTo: editing.effectiveTo ? dayjs(editing.effectiveTo) : null,
        description: editing.description ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/authorized-signatories', values)).data,
    onSuccess: () => {
      message.success('新增成功');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['authorized-signatories'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '新增失败'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.patch(`/authorized-signatories/${id}`, values)).data,
    onSuccess: () => {
      message.success('编辑已保存');
      setModalOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['authorized-signatories'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '编辑失败'),
  });

  const disableMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/authorized-signatories/${id}`)).data,
    onSuccess: () => {
      message.success('停用成功');
      qc.invalidateQueries({ queryKey: ['authorized-signatories'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '停用失败'),
  });

  // 提交时根据 editing 判断走 POST 还是 PATCH
  const handleSubmit = async () => {
    try {
      const raw = await form.validateFields();
      // 表单 → DTO(只提交后端接受的字段;空数组也带上,避免歧义)
      const dto: Record<string, unknown> = {
        methods: raw.methods ?? [],
        sampleTypes: raw.sampleTypes ?? [],
        effectiveFrom: (raw.effectiveFrom as Dayjs).format('YYYY-MM-DD'),
        description: raw.description ?? '',
      };
      if (raw.effectiveTo) dto.effectiveTo = (raw.effectiveTo as Dayjs).format('YYYY-MM-DD');
      if (editing) {
        updateMut.mutate({ id: editing.id, values: dto });
      } else {
        dto.userId = raw.userId;
        createMut.mutate(dto);
      }
    } catch {
      // 校验失败 antd 已提示
    }
  };

  const openEdit = (r: AuthorizedSignatory) => {
    setEditing(r);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const columns = [
    {
      title: '签字人', dataIndex: ['user', 'name'], width: 200,
      render: (v: string, r: AuthorizedSignatory) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.user?.username} · {r.user?.role}</Text>
        </Space>
      ),
    },
    {
      title: '授权方法', dataIndex: 'methods', width: 220,
      render: (v: string[]) => v.length ? v.map(m => <Tag key={m} color="gold">{m}</Tag>) : <Text type="secondary">不限</Text>,
    },
    {
      title: '授权样品类型', dataIndex: 'sampleTypes', width: 220,
      render: (v: string[]) => v.length ? v.map(s => <Tag key={s}>{s}</Tag>) : <Text type="secondary">不限</Text>,
    },
    {
      title: '生效期', width: 200,
      render: (_: unknown, r: AuthorizedSignatory) => (
        <Space direction="vertical" size={0}>
          <Text>{new Date(r.effectiveFrom).toLocaleDateString('zh-CN')} 起</Text>
          {r.effectiveTo && (
            <Space size={4}>
              <Text type="secondary">至 {new Date(r.effectiveTo).toLocaleDateString('zh-CN')}</Text>
              {isExpiringSoon(r) && (
                <Tooltip title="7 天内到期,请及时续期">
                  <Tag color="orange" icon={<ClockCircleOutlined />}>即将到期</Tag>
                </Tooltip>
              )}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'isActive', width: 110,
      render: (v: boolean) => v ? <Tag color="success">生效中</Tag> : <Tag>已停用</Tag>,
    },
    { title: '批准人', dataIndex: ['approvedBy', 'name'], width: 110 },
    {
      title: '操作', width: 160, fixed: 'right' as const,
      render: (_: unknown, r: AuthorizedSignatory) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm
            title="停用此签字人?"
            description="停用后该签字人不再出现在报告签发校验中(可重新编辑启用)"
            okText="停用"
            cancelText="取消"
            onConfirm={() => disableMut.mutate(r.id)}
            disabled={!r.isActive}
          >
            <Button size="small" danger icon={<StopOutlined />} disabled={!r.isActive}>停用</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const submitting = createMut.isPending || updateMut.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="授权签字人名录"
        subtitle="CNAS-CL01:2018 §7.5.3 · 实验室主任维护 · 报告签发校验"
        extra={
          <Space>
            <Switch checkedChildren="仅生效中" unCheckedChildren="全部" checked={activeOnly} onChange={setActiveOnly} />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['authorized-signatories'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑授权签字人' : '新增授权签字人'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        width={560}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="签字人"
            name="userId"
            rules={[{ required: true, message: '请选择签字人' }]}
            tooltip={editing ? '签字人不可修改,如需变更请停用后新增' : undefined}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="按姓名/账号搜索选择检测员"
              options={userOptions}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
              }
              disabled={!!editing}
            />
          </Form.Item>
          <Form.Item label="授权方法(空 = 不限)" name="methods">
            <Select mode="multiple" allowClear options={METHOD_OPTIONS} placeholder="选择授权方法" />
          </Form.Item>
          <Form.Item label="授权样品类型(空 = 不限)" name="sampleTypes">
            <Select mode="multiple" allowClear options={SAMPLE_TYPE_OPTIONS} placeholder="选择授权样品类型" />
          </Form.Item>
          <Form.Item label="生效起" name="effectiveFrom" rules={[{ required: true, message: '请选择生效起始日期' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="生效止(可选)" name="effectiveTo">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={2} placeholder="如:授权依据 CNAS-CL01:2018 §7.5.3" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}