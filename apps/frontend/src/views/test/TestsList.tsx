// =====================================================
// 检测任务列表 — 交互完善(W4)
// 筛选(方法/状态) + 操作列(生成/查看原始记录单、跳样品)
// 创建检测: 样品远程搜索下拉(替代手输 UUID)
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Modal, Select, Table, Tag, Space, App, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, FileSearchOutlined, FileTextOutlined, EyeOutlined, LinkOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ElementResultForm from './ElementResultForm';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

interface TestRow {
  id: string;
  sampleId: string;
  method: string;
  status: string;
  purityPct?: string | null;
  createdAt: string;
  completedAt?: string | null;
  sample?: { id: string; sampleNo: string; sampleType?: string } | null;
  operator?: { name: string } | null;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待检测' },
  IN_PROGRESS: { color: 'processing', label: '检测中' },
  COMPLETED: { color: 'success', label: '已完成' },
  QC_FAILED: { color: 'error', label: 'QC 失败' },
  REJECTED: { color: 'error', label: '已拒绝' },
};

const METHOD_OPTS = [
  { value: 'FIRE_ASSAY', label: '火试金法' },
  { value: 'ICP_OES', label: 'ICP-OES' },
];

export function TestsList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [elementTestId, setElementTestId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tests', page, method, status],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (method) params.method = method;
      if (status) params.status = status;
      return (await api.get('/tests', { params })).data;
    },
  });

  const genRecordMut = useMutation({
    mutationFn: async (testId: string) => (await api.post('/raw-records/generate', { testId })).data,
    onSuccess: (sheet) => {
      message.success(`原始记录单 ${sheet.sheetNo} 已就绪`);
      qc.invalidateQueries({ queryKey: ['tests'] });
      navigate(`/raw-records/${sheet.id}`);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '生成失败'),
  });

  // ICP: 录完元素后手动完成检测
  const completeMut = useMutation({
    mutationFn: async (testId: string) => (await api.post(`/tests/icp/${testId}/complete`)).data,
    onSuccess: () => {
      message.success('检测已完成,样品状态已推进');
      qc.invalidateQueries({ queryKey: ['tests'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '完成失败(请先录入元素结果)'),
  });

  // 删除检测(仅未完成且无原始记录单)
  const removeMut = useMutation({
    mutationFn: async (testId: string) => (await api.delete(`/tests/${testId}`)).data,
    onSuccess: () => {
      message.success('检测任务已删除');
      qc.invalidateQueries({ queryKey: ['tests'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '删除失败'),
  });

  const create = async () => {
    const values = await form.validateFields();
    try {
      const ep = values.method === 'ICP_OES' ? '/tests/icp' : '/tests/fire-assay';
      await api.post(ep, { sampleId: values.sampleId });
      message.success('检测任务已创建');
      setCreateOpen(false);
      form.resetFields();
      setPage(1);
      qc.invalidateQueries({ queryKey: ['tests'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  const columns = [
    {
      title: '样品编号',
      width: 160,
      render: (_: any, r: TestRow) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/samples/${r.sampleId}`)}>
          {r.sample?.sampleNo ?? '—'}
        </Button>
      ),
    },
    { title: '方法', dataIndex: 'method', width: 110, render: (v: string) => <Tag color={v === 'FIRE_ASSAY' ? 'gold' : 'cyan'}>{v === 'FIRE_ASSAY' ? '火试金' : v}</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (v: string) => {
        const meta = STATUS_META[v] ?? { color: 'default', label: v };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '纯度%', dataIndex: 'purityPct', width: 100,
      render: (v: string | null) => (v != null && v !== '' ? <span style={{ color: '#D4AF37', fontFamily: 'monospace' }}>{parseFloat(String(v)).toFixed(4)}</span> : '—'),
    },
    { title: '操作员', width: 110, render: (_: any, r: TestRow) => r.operator?.name ?? '—' },
    {
      title: '完成时间', width: 160,
      render: (_: any, r: TestRow) => (r.completedAt ? new Date(r.completedAt).toLocaleString('zh-CN', { hour12: false }) : '—'),
    },
    {
      title: '操作', width: 210, fixed: 'right' as const,
      render: (_: any, r: TestRow) => (
        <Space size={4}>
          {r.method === 'ICP_OES' && r.status !== 'COMPLETED' && r.status !== 'QC_FAILED' && (
            <Tooltip title="ICP 多元素录入(含校准曲线 R²,批量提交)">
              <Button size="small" icon={<EditOutlined />} onClick={() => setElementTestId(r.id)}>元素录入</Button>
            </Tooltip>
          )}
          {r.method === 'ICP_OES' && r.status !== 'COMPLETED' && (
            <Tooltip title="元素录入完毕后完成检测">
              <Popconfirm title="确认完成检测?完成后生成原始记录单入口。" onConfirm={() => completeMut.mutate(r.id)}>
                <Button size="small" type="primary" ghost loading={completeMut.isPending}>完成</Button>
              </Popconfirm>
            </Tooltip>
          )}
          {r.status === 'COMPLETED' && (
            <Tooltip title="检测完成 → 生成原始记录单(数据快照冻结)">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<FileTextOutlined />}
                loading={genRecordMut.isPending}
                onClick={() => genRecordMut.mutate(r.id)}
              >记录单</Button>
            </Tooltip>
          )}
          {r.status !== 'COMPLETED' && r.status !== 'QC_FAILED' && (
            <Popconfirm
              title="删除检测任务"
              description="删除后不可恢复;已完成的检测不可删除。"
              onConfirm={() => removeMut.mutate(r.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={removeMut.isPending} />
            </Popconfirm>
          )}
          <Tooltip title="查看样品">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/samples/${r.sampleId}`)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="检测任务"
        subtitle="CNAS §7.5 检测流程 · 火试金 / ICP 任务 · 完成自动生成原始记录单"
        icon={<FileSearchOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="方法"
              style={{ width: 120 }}
              value={method}
              onChange={setMethod}
              options={METHOD_OPTS}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 130 }}
              value={status}
              onChange={setStatus}
              options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
              创建检测
            </Button>
          </Space>
        }
      />

      <DataTable<TestRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        pagination={{
          current: page,
          total: data?.total ?? 0,
          pageSize: 20,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="创建检测任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="sampleId"
            label="样品(按编号搜索)"
            rules={[{ required: true, message: '请选择样品' }]}
            extra="远程搜索样品编号,选中的样品将创建检测任务"
          >
            <SampleSelect />
          </Form.Item>
          <Form.Item name="method" label="检测方法" initialValue="FIRE_ASSAY" rules={[{ required: true }]}>
            <Select options={METHOD_OPTS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ICP 多元素批量录入(含校准曲线 R²) */}
      {elementTestId && (
        <ElementResultForm
          open={!!elementTestId}
          testId={elementTestId}
          onClose={() => setElementTestId(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['tests'] })}
        />
      )}
    </div>
  );
}

/** 样品远程搜索下拉 */
function SampleSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['sample-options', keyword],
    queryFn: async () => {
      const params: any = { page: 1, pageSize: 30 };
      if (keyword) params.sampleNo = keyword;
      return (await api.get('/samples', { params })).data;
    },
  });
  const options = (data?.data ?? []).map((s: any) => ({
    value: s.id,
    label: `${s.sampleNo}${s.sampleType ? `(${s.sampleType})` : ''}${s.customerName ? ` · ${s.customerName}` : ''}`,
  }));
  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      loading={isLoading}
      options={options}
      placeholder="输入样品编号搜索…"
      filterOption={false}
      onSearch={(v) => setKeyword(v)}
      notFoundContent="未找到样品"
      style={{ width: '100%' }}
    />
  );
}
