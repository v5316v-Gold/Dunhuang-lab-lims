// =====================================================
// 试剂库存列表 — 详情 / 批次 / 领用
// 功能: 试剂列表 + 批次管理 + 库存预警 + 加批次 + 领用
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import {
  AlertOutlined,
  DeleteOutlined,
  EyeOutlined,
  GoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  SelectOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';

// ---------- 类型 ----------
interface ReagentRow {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  casNo?: string | null;
  safetyStock?: string | null;
}

interface ReagentDetail extends ReagentRow {
  purity?: string | null;
  manufacturer?: string | null;
  storageCondition?: string | null;
  hazardClass?: string | null;
  lots: ReagentLot[];
}

interface ReagentLot {
  id: string;
  lotNo: string;
  receivedDate: string;
  expiryDate: string;
  quantity: string;
  remainingQty: string;
  supplier?: string | null;
}

interface UserOption {
  id: string;
  name?: string | null;
  username: string;
}

// ---------- 选项 ----------
const TYPE_OPTS = [
  { value: 'NITRIC_ACID', label: '硝酸' },
  { value: 'HYDROCHLORIC_ACID', label: '盐酸' },
  { value: 'AQUA_REGIA', label: '王水' },
  { value: 'GOLD_STANDARD', label: '金标准物质' },
  { value: 'OTHER', label: '其他' },
];

const inputStyle = { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' } as const;

export function ReagentsList() {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [detailId, setDetailId] = useState<string | null>(null);

  const [lotTarget, setLotTarget] = useState<ReagentRow | null>(null);
  const [lotForm] = Form.useForm();

  const [usageTarget, setUsageTarget] = useState<ReagentRow | null>(null);
  const [usageForm] = Form.useForm();

  const [alertOpen, setAlertOpen] = useState(false);

  // ---------- Queries ----------
  const listQuery = useQuery({
    queryKey: ['reagents-list', typeFilter, page],
    queryFn: async () =>
      (
        await api.get<{ data: ReagentRow[]; total: number }>('/reagents', {
          params: { page, pageSize: 20, type: typeFilter },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ['reagent-detail', detailId],
    queryFn: async () => (await api.get<ReagentDetail>(`/reagents/${detailId}`)).data,
    enabled: !!detailId,
  });

  // 批次列表(在 lot/usage Modal 打开时按需加载)
  const lotsQuery = useQuery({
    queryKey: ['reagent-lots', lotTarget?.id ?? usageTarget?.id],
    queryFn: async () =>
      (await api.get<ReagentLot[]>(`/reagents/${(lotTarget ?? usageTarget)!.id}/lots`)).data,
    enabled: !!lotTarget || !!usageTarget,
  });

  const alertsQuery = useQuery({
    queryKey: ['reagent-alerts'],
    queryFn: async () => (await api.get<any[]>('/reagents/inventory/alerts')).data,
    enabled: alertOpen,
  });

  const usersQuery = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: UserOption[] }>('/users', { params: { pageSize: 100 } })).data,
  });

  // ---------- Mutations ----------
  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/reagents', values)).data,
    onSuccess: () => {
      message.success('试剂已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['reagents-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const addLotMut = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.post(`/reagents/${id}/lots`, values)).data,
    onSuccess: () => {
      message.success('批次已添加');
      setLotTarget(null);
      lotForm.resetFields();
      qc.invalidateQueries({ queryKey: ['reagent-detail'] });
      qc.invalidateQueries({ queryKey: ['reagent-lots'] });
      qc.invalidateQueries({ queryKey: ['reagent-alerts'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '添加批次失败'),
  });

  const recordUsageMut = useMutation({
    mutationFn: async ({ lotId, values }: { lotId: string; values: any }) =>
      (await api.post(`/reagents/lots/${lotId}/usage`, values)).data,
    onSuccess: () => {
      message.success('领用已登记');
      setUsageTarget(null);
      usageForm.resetFields();
      qc.invalidateQueries({ queryKey: ['reagent-lots'] });
      qc.invalidateQueries({ queryKey: ['reagent-alerts'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '领用失败'),
  });

  // 删除试剂(软删,仅无批次)
  const removeMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/reagents/${id}`)).data,
    onSuccess: () => {
      message.success('试剂已删除');
      qc.invalidateQueries({ queryKey: ['reagent-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '删除失败'),
  });

  // 作废批次(仅未领用)
  const voidLotMut = useMutation({
    mutationFn: async (lotId: string) => (await api.post(`/reagents/lots/${lotId}/void`)).data,
    onSuccess: () => {
      message.success('批次已作废');
      qc.invalidateQueries({ queryKey: ['reagent-lots'] });
      qc.invalidateQueries({ queryKey: ['reagent-detail'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '作废失败'),
  });

  // 撤销领用(回补库存)
  const undoUsageMut = useMutation({
    mutationFn: async (usageId: string) => (await api.post(`/reagents/usages/${usageId}/undo`)).data,
    onSuccess: () => {
      message.success('领用已撤销,库存已回补');
      qc.invalidateQueries({ queryKey: ['reagent-lots'] });
      qc.invalidateQueries({ queryKey: ['reagent-detail'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '撤销失败'),
  });

  // ---------- 列 ----------
  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      width: 140,
      render: (v: string) => <span style={{ color: 'var(--gold)' }}>{v}</span>,
    },
    { title: '名称', dataIndex: 'name', width: 200 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 130,
      render: (v: string) => {
        const map = Object.fromEntries(TYPE_OPTS.map((o) => [o.value, o.label]));
        return <Tag>{map[v] ?? v}</Tag>;
      },
    },
    { title: 'CAS', dataIndex: 'casNo', width: 110, render: (v?: string) => v ?? '—' },
    { title: '单位', dataIndex: 'unit', width: 80 },
    {
      title: '安全库存',
      dataIndex: 'safetyStock',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, r: ReagentRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>
            详情
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={() => {
              setLotTarget(r);
              lotForm.resetFields();
            }}
          >
            加批次
          </Button>
          <Button
            size="small"
            icon={<ShoppingCartOutlined />}
            onClick={() => {
              setUsageTarget(r);
              usageForm.resetFields();
            }}
          >
            领用
          </Button>
          <Popconfirm
            title="删除试剂"
            description="仅无批次的试剂可删除(软删)。"
            onConfirm={() => removeMut.mutate(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={removeMut.isPending}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const list = listQuery.data;
  const total = list?.total ?? 0;
  const lots = lotsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="试剂库存"
        subtitle="CNAS §6.6 外部产品 · 试剂台账 + 库存预警"
        icon={<GoldOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 140 }}
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
              options={TYPE_OPTS}
            />
            <Button icon={<AlertOutlined />} onClick={() => setAlertOpen(true)}>
              库存预警
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['reagents-list'] })}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              创建试剂
            </Button>
          </Space>
        }
      />

      <DataTable<ReagentRow>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={list?.data ?? []}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 1100 }}
        locale={{ emptyText: '暂无试剂' }}
        columns={columns as any}
      />

      {/* 预警弹窗 */}
      <Modal
        title="库存预警(余量不足 / 即将过期)"
        open={alertOpen}
        onCancel={() => setAlertOpen(false)}
        footer={<Button onClick={() => setAlertOpen(false)}>关闭</Button>}
        width={760}
      >
        {alertsQuery.isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>加载中…</div>
        ) : !alertsQuery.data || alertsQuery.data.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>暂无预警</div>
        ) : (
          <Table
            rowKey="lotId"
            size="small"
            pagination={false}
            dataSource={alertsQuery.data}
            columns={[
              { title: '试剂编码', dataIndex: 'reagentCode', width: 130 },
              { title: '试剂名称', dataIndex: 'reagentName', width: 180 },
              { title: '批号', dataIndex: 'lotNo', width: 130 },
              { title: '剩余', dataIndex: 'remainingQty', width: 90 },
              {
                title: '过期日期',
                dataIndex: 'expiryDate',
                width: 110,
                render: (v: string) => v?.substring(0, 10),
              },
              {
                title: '预警类型',
                dataIndex: 'alertType',
                width: 110,
                render: (v: string) => {
                  if (v === 'EXPIRING') return <Tag color="warning">即将过期</Tag>;
                  if (v === 'LOW_STOCK') return <Tag color="error">余量不足</Tag>;
                  return <Tag>{v}</Tag>;
                },
              },
            ]}
          />
        )}
      </Modal>

      {/* 创建试剂 */}
      <Modal
        title="创建试剂"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            createMut.mutate({
              code: values.code,
              name: values.name,
              type: values.type,
              unit: values.unit,
              casNo: values.casNo,
              purity: values.purity,
              manufacturer: values.manufacturer,
              packageSize: values.packageSize != null ? String(values.packageSize) : undefined,
              storageCondition: values.storageCondition,
              hazardClass: values.hazardClass,
              safetyStock: values.safetyStock != null ? String(values.safetyStock) : undefined,
            })
          }
        >
          <Form.Item name="code" label="试剂编码" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:R-NIT-001" />
          </Form.Item>
          <Form.Item name="name" label="试剂名称" rules={[{ required: true }]}>
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="NITRIC_ACID" rules={[{ required: true }]}>
            <Select options={TYPE_OPTS} />
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="mL" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:mL / g / L" />
          </Form.Item>
          <Form.Item name="casNo" label="CAS 编号">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="purity" label="纯度">
            <Input style={inputStyle} placeholder="如:AR / GR / 99.99%" />
          </Form.Item>
          <Form.Item name="manufacturer" label="生产商">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="packageSize" label="包装规格">
            <InputNumber style={{ width: '100%' }} placeholder="数字,如 500" />
          </Form.Item>
          <Form.Item name="storageCondition" label="储存条件">
            <Input style={inputStyle} placeholder="如:常温避光 / 4°C" />
          </Form.Item>
          <Form.Item name="hazardClass" label="危险等级">
            <Input style={inputStyle} placeholder="如:易制毒 / 强腐蚀" />
          </Form.Item>
          <Form.Item name="safetyStock" label="安全库存">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="低于此值触发预警" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={
          detailQuery.data
            ? `${detailQuery.data.code} · ${detailQuery.data.name}`
            : '试剂详情'
        }
        width={780}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        loading={detailQuery.isLoading}
      >
        {detailQuery.data && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="编码">{detailQuery.data.code}</Descriptions.Item>
              <Descriptions.Item label="名称">{detailQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {TYPE_OPTS.find((t) => t.value === detailQuery.data?.type)?.label ?? detailQuery.data.type}
              </Descriptions.Item>
              <Descriptions.Item label="单位">{detailQuery.data.unit}</Descriptions.Item>
              <Descriptions.Item label="CAS">{detailQuery.data.casNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="纯度">{detailQuery.data.purity ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="生产商">{detailQuery.data.manufacturer ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="危险等级">{detailQuery.data.hazardClass ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="储存条件" span={2}>
                {detailQuery.data.storageCondition ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="安全库存" span={2}>
                {detailQuery.data.safetyStock ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ color: 'var(--gold)' }}>批次列表({detailQuery.data.lots.length})</h4>
            <Table<ReagentLot>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.lots}
              locale={{ emptyText: '暂无批次' }}
              columns={[
                { title: '批号', dataIndex: 'lotNo', width: 130 },
                { title: '到货日期', dataIndex: 'receivedDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                {
                  title: '有效期',
                  dataIndex: 'expiryDate',
                  width: 110,
                  render: (v: string) => v?.substring(0, 10),
                },
                { title: '入库量', dataIndex: 'quantity', width: 90 },
                {
                  title: '剩余量',
                  dataIndex: 'remainingQty',
                  width: 90,
                  render: (v: string) => {
                    const n = parseFloat(v);
                    if (isNaN(n)) return v;
                    if (n <= 0) return <Tag color="error">已耗尽</Tag>;
                    return <Tag color={n < 10 ? 'warning' : 'success'}>{v}</Tag>;
                  },
                },
                { title: '供应商', dataIndex: 'supplier', ellipsis: true, render: (v?: string) => v ?? '—' },
                {
                  title: '', width: 70,
                  render: (_: any, lot: ReagentLot) => (
                    <Popconfirm
                      title="作废批次"
                      description="仅未领用过的批次可作废(删除);已领用需先撤销领用。"
                      onConfirm={() => voidLotMut.mutate(lot.id)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} loading={voidLotMut.isPending}>作废</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* 加批次 Modal */}
      <Modal
        title={lotTarget ? `新增批次 · ${lotTarget.name}` : '新增批次'}
        open={!!lotTarget}
        onCancel={() => setLotTarget(null)}
        onOk={() => lotForm.submit()}
        confirmLoading={addLotMut.isPending}
        okText="登记"
        cancelText="取消"
        width={560}
      >
        {/* 现有批次提示 */}
        {lots.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>该试剂已有 {lots.length} 个批次:</span>
            {lots.slice(0, 3).map((l) => (
              <Tag key={l.id} style={{ marginLeft: 6 }}>
                {l.lotNo}
              </Tag>
            ))}
            {lots.length > 3 && <span style={{ color: 'var(--text-muted)' }}>…</span>}
          </div>
        )}
        <Form
          form={lotForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            addLotMut.mutate({
              id: lotTarget!.id,
              values: {
                lotNo: values.lotNo,
                receivedDate: (values.receivedDate as Dayjs).format('YYYY-MM-DD'),
                expiryDate: (values.expiryDate as Dayjs).format('YYYY-MM-DD'),
                quantity: String(values.quantity),
                unitPrice: values.unitPrice != null ? String(values.unitPrice) : undefined,
                supplier: values.supplier,
              },
            })
          }
        >
          <Form.Item name="lotNo" label="批号" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:LOT-2026-001" />
          </Form.Item>
          <Form.Item name="receivedDate" label="到货日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="expiryDate"
            label="有效期"
            rules={[{ required: true }]}
            initialValue={dayjs().add(2, 'year')}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity" label="入库数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数字" />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价(可选)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="元" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input style={inputStyle} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领用 Modal */}
      <Modal
        title={usageTarget ? `试剂领用 · ${usageTarget.name}` : '试剂领用'}
        open={!!usageTarget}
        onCancel={() => setUsageTarget(null)}
        onOk={() => usageForm.submit()}
        confirmLoading={recordUsageMut.isPending}
        okText="登记"
        cancelText="取消"
        width={560}
      >
        <Form
          form={usageForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            recordUsageMut.mutate({
              lotId: values.lotId,
              values: {
                quantity: String(values.quantity),
                remarks: values.remarks,
                usedById: values.usedById,
              },
            })
          }
        >
          <Form.Item
            name="lotId"
            label="选择批次"
            rules={[{ required: true, message: '请选择批次' }]}
          >
            <Select
              placeholder={
                lotsQuery.isLoading
                  ? '加载批次中…'
                  : lots.length === 0
                    ? '该试剂暂无批次,请先加批次'
                    : '选择批次(剩余量需 > 0)'
              }
              disabled={lotsQuery.isLoading || lots.length === 0}
              options={lots.map((l) => ({
                value: l.id,
                disabled: parseFloat(l.remainingQty) <= 0,
                label: `${l.lotNo} · 剩余 ${l.remainingQty} · 到期 ${l.expiryDate?.substring(0, 10)}`,
              }))}
              suffixIcon={<SelectOutlined />}
            />
          </Form.Item>
          <Form.Item name="quantity" label="领用数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数字" />
          </Form.Item>
          <Form.Item name="usedById" label="领用人" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择领用人"
              optionFilterProp="label"
              options={(usersQuery.data?.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.name ?? u.username} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="用途/备注">
            <Input.TextArea rows={2} placeholder="如:金锭样品 Au 含量检测" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}