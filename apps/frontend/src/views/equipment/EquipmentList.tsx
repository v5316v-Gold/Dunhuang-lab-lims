// =====================================================
// 设备管理列表 — P2 美化版(PageHeader + DataTable + statusTag)
// 功能: 设备列表 + 详情 Drawer + 校准/维护/期间核查 + 报废(MFA)
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
  Switch,
  Table,
  Tag,
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

// ---------- 类型 ----------
interface EquipmentRow {
  id: string;
  equipmentNo: string;
  name: string;
  type: string;
  status: string;
  model?: string | null;
  serialNo?: string | null;
  location?: string | null;
  purchaseDate?: string | null;
  _count?: { calibrations: number; maintenances: number; periodicChecks: number };
}

interface EquipmentDetail extends EquipmentRow {
  manufacturer?: string | null;
  accuracy?: string | null;
  range?: string | null;
  nextCalibrationAt?: string | null;
  nextPeriodicCheckAt?: string | null;
  calibrations: Calibration[];
  maintenances: Maintenance[];
  periodicChecks: PeriodicCheck[];
}

interface Calibration {
  id: string;
  calibrationDate: string;
  calibrationOrg: string;
  certificateNo: string;
  result?: string | null;
  nextDueDate: string;
}

interface Maintenance {
  id: string;
  maintenanceType: string;
  maintenanceDate: string;
  content?: string | null;
  nextDueDate?: string | null;
}

interface PeriodicCheck {
  id: string;
  checkDate: string;
  result?: string | null;
  zScore?: string | null;
  passed: boolean;
  remarks?: string | null;
}

interface UserOption {
  id: string;
  name?: string;
  username: string;
  role?: string;
}

// ---------- 选项 ----------
const TYPE_OPTS = [
  { value: 'FIRE_ASSAY_FURNACE', label: '试金炉' },
  { value: 'CUPELLATION_FURNACE', label: '灰吹炉' },
  { value: 'ANALYTICAL_BALANCE', label: '分析天平' },
  { value: 'ICP_OES', label: 'ICP-OES' },
  { value: 'ICP_MS', label: 'ICP-MS' },
  { value: 'XRF', label: 'XRF' },
  { value: 'MICROWAVE_DIGESTION', label: '微波消解' },
  { value: 'WATER_PURIFIER', label: '纯水机' },
  { value: 'OTHER', label: '其他' },
];

const STATUS_OPTS = [
  { value: 'ACTIVE', label: '正常' },
  { value: 'MAINTENANCE', label: '维护中' },
  { value: 'QUARANTINED', label: '已隔离' },
  { value: 'BROKEN', label: '故障' },
  { value: 'RETIRED', label: '已报废' },
];

const MAINT_TYPE_OPTS = [
  { value: 'PREVENTIVE', label: '预防性维护' },
  { value: 'CORRECTIVE', label: '故障维修' },
  { value: 'INSPECTION', label: '日常巡检' },
  { value: 'OTHER', label: '其他' },
];

const inputStyle = { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' } as const;

export function EquipmentList() {
  const { message } = App.useApp();
  const qc = useQueryClient();

  // 筛选
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  // 创建
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  // 详情 Drawer
  const [detailId, setDetailId] = useState<string | null>(null);

  // 校准 / 维护 / 核查
  const [calTarget, setCalTarget] = useState<EquipmentRow | null>(null);
  const [maintTarget, setMaintTarget] = useState<EquipmentRow | null>(null);
  const [checkTarget, setCheckTarget] = useState<EquipmentRow | null>(null);
  const [calForm] = Form.useForm();
  const [maintForm] = Form.useForm();
  const [checkForm] = Form.useForm();

  // 报废 MFA
  const [retireTarget, setRetireTarget] = useState<EquipmentRow | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);

  // 作废记录(校准/维护/核查)
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ equipmentId: string; type: string; recId: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const submitVoidRecord = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      message.warning('作废原因必填');
      return;
    }
    voidRecordMut.mutate({ equipmentId: voidTarget.equipmentId, type: voidTarget.type, recId: voidTarget.recId, reason: voidReason.trim() });
    setVoidOpen(false);
    setVoidTarget(null);
    setVoidReason('');
  };

  // ---------- Queries ----------
  const listQuery = useQuery({
    queryKey: ['equipment-list', typeFilter, statusFilter, page],
    queryFn: async () =>
      (
        await api.get<{ data: EquipmentRow[]; total: number }>('/equipment', {
          params: { page, pageSize: 20, type: typeFilter, status: statusFilter },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ['equipment-detail', detailId],
    queryFn: async () => (await api.get<EquipmentDetail>(`/equipment/${detailId}`)).data,
    enabled: !!detailId,
  });

  const usersQuery = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: UserOption[] }>('/users', { params: { pageSize: 100 } })).data,
  });

  // ---------- Mutations ----------
  const createMut = useMutation({
    mutationFn: async (values: any) => (await api.post('/equipment', values)).data,
    onSuccess: () => {
      message.success('设备已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const submitCal = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.post(`/equipment/${id}/calibrations`, values)).data,
    onSuccess: () => {
      message.success('校准记录已登记');
      setCalTarget(null);
      calForm.resetFields();
      qc.invalidateQueries({ queryKey: ['equipment-detail'] });
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '登记失败'),
  });

  const submitMaint = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.post(`/equipment/${id}/maintenances`, values)).data,
    onSuccess: () => {
      message.success('维护记录已登记');
      setMaintTarget(null);
      maintForm.resetFields();
      qc.invalidateQueries({ queryKey: ['equipment-detail'] });
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '登记失败'),
  });

  const submitCheck = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) =>
      (await api.post(`/equipment/${id}/periodic-checks`, values)).data,
    onSuccess: () => {
      message.success('期间核查已登记');
      setCheckTarget(null);
      checkForm.resetFields();
      qc.invalidateQueries({ queryKey: ['equipment-detail'] });
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '登记失败'),
  });

  // 删除设备(软删,仅无记录)
  const removeMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/equipment/${id}`)).data,
    onSuccess: () => {
      message.success('设备已删除');
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '删除失败'),
  });

  // 作废校准/维护/核查记录(误录纠正)
  const voidRecordMut = useMutation({
    mutationFn: async ({ equipmentId, type, recId, reason }: { equipmentId: string; type: string; recId: string; reason: string }) =>
      (await api.post(`/equipment/${equipmentId}/${type}/${recId}/void`, { reason })).data,
    onSuccess: () => {
      message.success('记录已作废(审计留痕)');
      qc.invalidateQueries({ queryKey: ['equipment-detail'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '作废失败'),
  });

  const retireMut = useMutation({
    mutationFn: async ({ id, mfaToken }: { id: string; mfaToken: string }) =>
      (
        await api.post(`/equipment/${id}/retire`, undefined, {
          headers: { 'x-mfa-token': mfaToken },
        })
      ).data,
    onSuccess: () => {
      message.success('设备已报废');
      setRetireTarget(null);
      setMfaOpen(false);
      qc.invalidateQueries({ queryKey: ['equipment-list'] });
      qc.invalidateQueries({ queryKey: ['equipment-detail'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '报废失败'),
  });

  // ---------- 列 ----------
  const columns = [
    { title: '设备编号', dataIndex: 'equipmentNo', width: 130 },
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 130,
      render: (v: string) => {
        const map = Object.fromEntries(TYPE_OPTS.map((o) => [o.value, o.label]));
        return <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{map[v] ?? v}</Tag>;
      },
    },
    { title: '型号', dataIndex: 'model', render: (v?: string) => v ?? '—' },
    {
      title: '校准/维护/核查',
      width: 180,
      render: (_: any, r: EquipmentRow) => {
        const c = r._count;
        if (!c) return '—';
        return (
          <Space size={4} wrap>
            <Tag color="processing">校 {c.calibrations}</Tag>
            <Tag color="warning">维 {c.maintenances}</Tag>
            <Tag color="cyan">查 {c.periodicChecks}</Tag>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => statusTag(v),
    },
    { title: '位置', dataIndex: 'location', render: (v?: string) => v ?? '—' },
    {
      title: '操作',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, r: EquipmentRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>
            详情
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<FileProtectOutlined />}
            onClick={() => {
              setCalTarget(r);
              calForm.resetFields();
            }}
            disabled={r.status === 'RETIRED'}
          >
            校准
          </Button>
          <Button
            size="small"
            icon={<ToolOutlined />}
            onClick={() => {
              setMaintTarget(r);
              maintForm.resetFields();
            }}
            disabled={r.status === 'RETIRED'}
          >
            维护
          </Button>
          <Button
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => {
              setCheckTarget(r);
              checkForm.resetFields();
            }}
            disabled={r.status === 'RETIRED'}
          >
            期间核查
          </Button>
          {r.status !== 'RETIRED' && (
            <Popconfirm
              title="报废设备(需 MFA)"
              description="报废后设备状态不可逆,需 MFA 二次验证"
              onConfirm={() => {
                setRetireTarget(r);
                setMfaOpen(true);
              }}
              okText="下一步"
              cancelText="取消"
            >
              <Button size="small" danger icon={<StopOutlined />}>
                报废
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="删除设备"
            description="仅无校准/维护/核查记录的设备可删除(软删)。"
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

  return (
    <div>
      <PageHeader
        title="设备管理"
        subtitle="CNAS §6.4 设备 + §7.7 期间核查 · 校准/核查状态实时监控"
        icon={<ToolOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 140 }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_OPTS}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTS}
            />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['equipment-list'] })}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              创建设备
            </Button>
          </Space>
        }
      />

      <DataTable<EquipmentRow>
        title="设备列表"
        subtitle={`共 ${total} 台`}
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={list?.data ?? []}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['equipment-list'] })}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 1280 }}
        columns={columns as any}
      />

      {/* 创建 */}
      <Modal
        title="创建设备"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
        width={620}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) => {
            const dto = {
              equipmentNo: values.equipmentNo,
              name: values.name,
              type: values.type,
              model: values.model,
              serialNo: values.serialNo,
              manufacturer: values.manufacturer,
              purchaseDate: (values.purchaseDate as Dayjs | undefined)?.format('YYYY-MM-DD'),
              warrantyExpiresAt: (values.warrantyExpiresAt as Dayjs | undefined)?.format('YYYY-MM-DD'),
              location: values.location,
              accuracy: values.accuracy,
              range: values.range,
              status: values.status,
            };
            createMut.mutate(dto);
          }}
        >
          <Form.Item name="equipmentNo" label="设备编号" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:EQ-001" />
          </Form.Item>
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}>
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="FIRE_ASSAY_FURNACE" rules={[{ required: true }]}>
            <Select options={TYPE_OPTS} />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="serialNo" label="出厂编号">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="manufacturer" label="制造商">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="purchaseDate" label="购置日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warrantyExpiresAt" label="保修期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="accuracy" label="精度">
            <Input style={inputStyle} placeholder="如:0.001mg" />
          </Form.Item>
          <Form.Item name="range" label="量程">
            <Input style={inputStyle} placeholder="如:0~200g" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select options={STATUS_OPTS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={detailQuery.data ? `${detailQuery.data.equipmentNo} · ${detailQuery.data.name}` : '设备详情'}
        width={780}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        loading={detailQuery.isLoading}
      >
        {detailQuery.data && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="设备编号">{detailQuery.data.equipmentNo}</Descriptions.Item>
              <Descriptions.Item label="名称">{detailQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {TYPE_OPTS.find((t) => t.value === detailQuery.data?.type)?.label ?? detailQuery.data.type}
              </Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(detailQuery.data.status)}</Descriptions.Item>
              <Descriptions.Item label="型号">{detailQuery.data.model ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="出厂编号">{detailQuery.data.serialNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="制造商">{detailQuery.data.manufacturer ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="购置日期">
                {detailQuery.data.purchaseDate?.substring(0, 10) ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="位置">{detailQuery.data.location ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="精度/量程">
                {detailQuery.data.accuracy ?? '—'} / {detailQuery.data.range ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="下次校准">
                {detailQuery.data.nextCalibrationAt?.substring(0, 10) ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="下次期间核查">
                {detailQuery.data.nextPeriodicCheckAt?.substring(0, 10) ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ color: 'var(--gold)' }}>校准记录(最近 5 条)</h4>
            <Table<Calibration>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.calibrations}
              locale={{ emptyText: '暂无校准记录' }}
              columns={[
                { title: '校准日期', dataIndex: 'calibrationDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: '校准机构', dataIndex: 'calibrationOrg', ellipsis: true },
                { title: '证书编号', dataIndex: 'certificateNo', width: 140 },
                {
                  title: '结果',
                  dataIndex: 'result',
                  width: 90,
                  render: (v?: string) => (v ? <Tag color={/pass|合格|通过/i.test(v) ? 'success' : 'error'}>{v}</Tag> : '—'),
                },
                { title: '下次到期', dataIndex: 'nextDueDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                {
                  title: '', width: 60,
                  render: (_: any, rec: Calibration) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setVoidTarget({ equipmentId: detailQuery.data.id, type: 'calibrations', recId: rec.id }); setVoidReason(''); setVoidOpen(true); }} />
                  ),
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            <h4 style={{ color: 'var(--gold)' }}>维护记录(最近 5 条)</h4>
            <Table<Maintenance>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.maintenances}
              locale={{ emptyText: '暂无维护记录' }}
              columns={[
                { title: '类型', dataIndex: 'maintenanceType', width: 100 },
                { title: '维护日期', dataIndex: 'maintenanceDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: '内容', dataIndex: 'content', ellipsis: true, render: (v?: string) => v ?? '—' },
                {
                  title: '下次维护',
                  dataIndex: 'nextDueDate',
                  width: 110,
                  render: (v?: string) => v?.substring(0, 10) ?? '—',
                },
                {
                  title: '', width: 60,
                  render: (_: any, rec: Maintenance) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setVoidTarget({ equipmentId: detailQuery.data.id, type: 'maintenances', recId: rec.id }); setVoidReason(''); setVoidOpen(true); }} />
                  ),
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            <h4 style={{ color: 'var(--gold)' }}>期间核查(最近 5 条)</h4>
            <Table<PeriodicCheck>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQuery.data.periodicChecks}
              locale={{ emptyText: '暂无核查记录' }}
              columns={[
                { title: '核查日期', dataIndex: 'checkDate', width: 110, render: (v: string) => v?.substring(0, 10) },
                { title: 'Z 比分数', dataIndex: 'zScore', width: 90, render: (v?: string) => v ?? '—' },
                {
                  title: '结果',
                  dataIndex: 'passed',
                  width: 90,
                  render: (v: boolean) => (
                    <Tag color={v ? 'success' : 'error'}>{v ? '通过' : '未通过'}</Tag>
                  ),
                },
                { title: '结果描述', dataIndex: 'result', ellipsis: true, render: (v?: string) => v ?? '—' },
                { title: '备注', dataIndex: 'remarks', ellipsis: true, render: (v?: string) => v ?? '—' },
                {
                  title: '', width: 60,
                  render: (_: any, rec: PeriodicCheck) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setVoidTarget({ equipmentId: detailQuery.data.id, type: 'periodic-checks', recId: rec.id }); setVoidReason(''); setVoidOpen(true); }} />
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* 作废记录 Modal(校准/维护/核查) */}
      <Modal
        title="作废记录(误录纠正)"
        open={voidOpen}
        onCancel={() => setVoidOpen(false)}
        onOk={submitVoidRecord}
        confirmLoading={voidRecordMut.isPending}
        okText="确认作废"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Input.TextArea
          rows={3}
          placeholder="作废原因(必填)"
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* 校准 Modal */}
      <Modal
        title={calTarget ? `登记校准 · ${calTarget.equipmentNo}` : '登记校准'}
        open={!!calTarget}
        onCancel={() => setCalTarget(null)}
        onOk={() => calForm.submit()}
        confirmLoading={submitCal.isPending}
        okText="登记"
        cancelText="取消"
      >
        <Form
          form={calForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            submitCal.mutate({
              id: calTarget!.id,
              values: {
                calibrationDate: (values.calibrationDate as Dayjs).format('YYYY-MM-DD'),
                calibrationOrg: values.calibrationOrg,
                certificateNo: values.certificateNo,
                result: values.result,
                nextDueDate: (values.nextDueDate as Dayjs).format('YYYY-MM-DD'),
              },
            })
          }
        >
          <Form.Item name="calibrationDate" label="校准日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="calibrationOrg" label="校准机构" rules={[{ required: true }]}>
            <Input style={inputStyle} placeholder="如:中国计量院" />
          </Form.Item>
          <Form.Item name="certificateNo" label="证书编号" rules={[{ required: true }]}>
            <Input style={inputStyle} />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Select
              allowClear
              placeholder="合格/不合格"
              options={[
                { value: '合格', label: '合格' },
                { value: '不合格', label: '不合格' },
              ]}
            />
          </Form.Item>
          <Form.Item name="nextDueDate" label="下次校准到期日" rules={[{ required: true }]} initialValue={dayjs().add(1, 'year')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 维护 Modal */}
      <Modal
        title={maintTarget ? `登记维护 · ${maintTarget.equipmentNo}` : '登记维护'}
        open={!!maintTarget}
        onCancel={() => setMaintTarget(null)}
        onOk={() => maintForm.submit()}
        confirmLoading={submitMaint.isPending}
        okText="登记"
        cancelText="取消"
      >
        <Form
          form={maintForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            submitMaint.mutate({
              id: maintTarget!.id,
              values: {
                maintenanceType: values.maintenanceType,
                maintenanceDate: (values.maintenanceDate as Dayjs).format('YYYY-MM-DD'),
                performedBy: values.performedBy,
                content: values.content,
                nextDueDate: values.nextDueDate ? (values.nextDueDate as Dayjs).format('YYYY-MM-DD') : undefined,
              },
            })
          }
        >
          <Form.Item name="maintenanceType" label="维护类型" rules={[{ required: true }]} initialValue="PREVENTIVE">
            <Select options={MAINT_TYPE_OPTS} />
          </Form.Item>
          <Form.Item name="maintenanceDate" label="维护日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performedBy" label="执行人" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择执行人"
              optionFilterProp="label"
              options={(usersQuery.data?.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.name ?? u.username} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="content" label="维护内容">
            <Input.TextArea rows={3} placeholder="如:更换熔样坩埚、清理炉膛…" />
          </Form.Item>
          <Form.Item name="nextDueDate" label="下次维护日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 期间核查 Modal */}
      <Modal
        title={checkTarget ? `期间核查 · ${checkTarget.equipmentNo}` : '期间核查'}
        open={!!checkTarget}
        onCancel={() => setCheckTarget(null)}
        onOk={() => checkForm.submit()}
        confirmLoading={submitCheck.isPending}
        okText="提交"
        cancelText="取消"
      >
        <Form
          form={checkForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) =>
            submitCheck.mutate({
              id: checkTarget!.id,
              values: {
                checkDate: (values.checkDate as Dayjs).format('YYYY-MM-DD'),
                performedBy: values.performedBy,
                result: values.result,
                zScore: values.zScore !== undefined && values.zScore !== null ? String(values.zScore) : undefined,
                passed: values.passed ?? true,
                remarks: values.remarks,
              },
            })
          }
        >
          <Form.Item name="checkDate" label="核查日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performedBy" label="执行人" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择执行人"
              optionFilterProp="label"
              options={(usersQuery.data?.data ?? []).map((u) => ({
                value: u.id,
                label: `${u.name ?? u.username} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="zScore" label="Z 比分数">
            <InputNumber step={0.1} style={{ width: '100%' }} placeholder="如:1.2" />
          </Form.Item>
          <Form.Item name="passed" label="是否通过" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="通过" unCheckedChildren="未通过" />
          </Form.Item>
          <Form.Item name="result" label="结果描述">
            <Input.TextArea rows={2} placeholder="如:偏差在允许范围内" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 报废 MFA */}
      <MfaChallengeModal
        open={mfaOpen}
        title="MFA 二次验证 · 设备报废"
        description={`报废设备 ${retireTarget?.equipmentNo ?? ''} 需二次验证,操作不可逆。`}
        onCancel={() => {
          setMfaOpen(false);
          setRetireTarget(null);
        }}
        onConfirm={async (mfaToken) => {
          if (!retireTarget) return;
          await retireMut.mutateAsync({ id: retireTarget.id, mfaToken });
        }}
      />
    </div>
  );
}