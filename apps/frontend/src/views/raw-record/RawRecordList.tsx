// =====================================================
// W4-B: 原始记录单列表(CNAS-CL01:2018 §7.5 记录控制)
// 端点: /raw-records
// 生成(数据快照冻结) → 锁定 → 三签(操作/校核/审核,SoD 互斥)
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Table, Tag, Space, Modal, App, Alert, Select,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, FileTextOutlined, EyeOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface RawRecordSheet {
  id: string;
  sheetNo: string;
  method: string;
  status: 'DRAFT' | 'LOCKED' | 'SIGNED';
  createdAt: string;
  lockedAt?: string | null;
  pdfSha256?: string | null;
  sample?: { sampleNo?: string } | null;
  operator?: { name?: string } | null;
  reviewer?: { name?: string } | null;
  approver?: { name?: string } | null;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  LOCKED: { color: 'gold', label: '已锁定' },
  SIGNED: { color: 'green', label: '已签署' },
};

function statusRender(status: string) {
  const meta = STATUS_META[status] ?? { color: 'default', label: status };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function nameRender(name?: string) {
  return name ? <span>{name}</span> : <span style={{ color: '#999' }}>待签</span>;
}

export default function RawRecordList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [genOpen, setGenOpen] = useState(false);
  const [genForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: list, isLoading } = useQuery({
    queryKey: ['raw-records', statusFilter],
    queryFn: async () => {
      const params: any = { pageSize: 50 };
      if (statusFilter) params.status = statusFilter;
      return (await api.get<{ items: RawRecordSheet[]; total: number }>('/raw-records', { params })).data;
    },
    refetchInterval: 30000,
  });

  const genMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/raw-records/generate', { testId: v.testId })).data,
    onSuccess: (data) => {
      message.success(`原始记录单已生成: ${data.sheetNo}(状态 ${STATUS_META[data.status]?.label ?? data.status})`);
      setGenOpen(false);
      genForm.resetFields();
      qc.invalidateQueries({ queryKey: ['raw-records'] });
      navigate(`/raw-records/${data.id}`);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '生成失败'),
  });

  const columns = [
    {
      title: '记录单号', dataIndex: 'sheetNo', width: 150,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span>,
    },
    { title: '样品编号', width: 130, render: (_: any, r: RawRecordSheet) => r.sample?.sampleNo ?? '-' },
    { title: '方法', dataIndex: 'method', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => statusRender(v) },
    { title: '操作员', width: 100, render: (_: any, r: RawRecordSheet) => nameRender(r.operator?.name) },
    { title: '校核', width: 100, render: (_: any, r: RawRecordSheet) => nameRender(r.reviewer?.name) },
    { title: '审核', width: 100, render: (_: any, r: RawRecordSheet) => nameRender(r.approver?.name) },
    {
      title: '创建时间', dataIndex: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '操作', width: 90, fixed: 'right' as const,
      render: (_: any, r: RawRecordSheet) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/raw-records/${r.id}`)}>详情</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="原始记录单"
        subtitle="CNAS-CL01:2018 §7.5 · 数据快照冻结 · 操作/校核/审核三签(SoD 互斥)"
        icon={<FileTextOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['raw-records'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { genForm.resetFields(); setGenOpen(true); }}>生成记录单</Button>
          </Space>
        }
      />
      <Alert
        type="info"
        showIcon
        message="记录单在检测完成后生成,自动冻结称样量 / 工艺参数 / 元素结果等原始数据;锁定后不可更改,三签完成后生成 SHA256 指纹(PDF)。"
        style={{ marginBottom: 16 }}
      />
      <DataTable<RawRecordSheet>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title="生成原始记录单"
        open={genOpen}
        onCancel={() => setGenOpen(false)}
        onOk={() => genForm.submit()}
        confirmLoading={genMut.isPending}
        okText="生成"
        cancelText="取消"
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          message="同一检测只能生成一份记录单(幂等),重复生成将返回已有记录单。"
          style={{ marginBottom: 16 }}
        />
        <Form form={genForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => genMut.mutate(values)}>
          <Form.Item
            label="检测任务(已完成)"
            name="testId"
            rules={[{ required: true, message: '请选择已完成的检测任务' }]}
            extra="仅显示状态为「已完成」的检测;同一检测幂等,重复生成返回已有记录单"
          >
            <CompletedTestSelect />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** 已完成检测任务远程下拉 */
function CompletedTestSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['completed-tests', keyword],
    queryFn: async () => {
      const params: any = { status: 'COMPLETED', page: 1, pageSize: 50 };
      if (keyword) params.sampleId = keyword;
      return (await api.get('/tests', { params })).data;
    },
  });
  const options = (data?.data ?? []).map((t: any) => ({
    value: t.id,
    label: `${t.sample?.sampleNo ?? '未知样品'} · ${t.method === 'FIRE_ASSAY' ? '火试金' : t.method}${t.purityPct != null ? ` · ${parseFloat(String(t.purityPct)).toFixed(4)}%` : ''}`,
  }));
  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      loading={isLoading}
      options={options}
      placeholder="选择已完成检测…"
      filterOption={false}
      onSearch={(v) => setKeyword(v)}
      notFoundContent="暂无已完成检测"
      style={{ width: '100%' }}
    />
  );
}
