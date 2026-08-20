// =====================================================
// 批次列表页 — Phase 2 Day 2
// =====================================================

import { useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Alert,
  message,
  Typography,
  Tooltip,
} from 'antd';
import {  PlusOutlined, EyeOutlined, FireOutlined, ExperimentOutlined, ClusterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';
import type { AssayMethod, BatchStatus } from '@dunhuang/lims-shared-types';

const { Title, Text } = Typography;

// 批次状态中文 + 颜色
const batchStatusColor: Record<BatchStatus, string> = {
  PENDING: 'default',
  MIXING: 'blue',
  FUSING: 'cyan',
  CUPELLING: 'geekblue',
  PARTING: 'purple',
  ANNEALING: 'magenta',
  WEIGHING: 'orange',
  CALCULATING: 'gold',
  COMPLETED: 'green',
  REJECTED: 'red',
};

const batchStatusLabel: Record<BatchStatus, string> = {
  PENDING: '待启动',
  MIXING: '混料',
  FUSING: '熔融',
  CUPELLING: '灰吹',
  PARTING: '分金',
  ANNEALING: '退火',
  WEIGHING: '称重',
  CALCULATING: '计算',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
};

interface Batch {
  id: string;
  batchNo: string;
  method: AssayMethod;
  status: BatchStatus;
  replicateCount: number;
  furnaceNo?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  operator?: { id: string; username: string; name: string };
  _count?: { samples: number };
}

const methodLabel: Record<AssayMethod, { label: string; color: string; icon: any }> = {
  FIRE_ASSAY: { label: '火试金', color: 'volcano', icon: <FireOutlined /> },
  ICP_OES: { label: 'ICP-OES', color: 'blue', icon: <ExperimentOutlined /> },
  ICP_MS: { label: 'ICP-MS', color: 'cyan', icon: <ExperimentOutlined /> },
  XRF: { label: 'XRF', color: 'gold', icon: <ExperimentOutlined /> },
  FIRE_ASSAY_GRAVIMETRIC: { label: '火试金-重量法', color: 'orange', icon: <FireOutlined /> },
  VOLUMETRIC: { label: '容量法', color: 'green', icon: <ExperimentOutlined /> },
  ICP_GBC: { label: 'ICP-GB', color: 'geekblue', icon: <ExperimentOutlined /> },
  OTHER: { label: '其他', color: 'default', icon: <ExperimentOutlined /> },
};

interface CreateBatchForm {
  method: AssayMethod;
  replicateCount: number;
  furnaceNo?: string;
  qcSampleId?: string;
}

export default function BatchesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [methodFilter, setMethodFilter] = useState<AssayMethod | undefined>();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<CreateBatchForm>();

  // 列表查询
  const { data, isLoading } = useQuery({
    queryKey: ['batches', page, pageSize, methodFilter, statusFilter],
    queryFn: async () =>
      (
        await api.get('/batches', {
          params: { page, pageSize, method: methodFilter, status: statusFilter },
        })
      ).data,
  });

  // 创建批次
  const createMut = useMutation({
    mutationFn: async (values: CreateBatchForm) =>
      (await api.post('/batches', values)).data,
    onSuccess: (batch) => {
      message.success(`✅ 批次创建成功: ${batch.batchNo}`);
      qc.invalidateQueries({ queryKey: ['batches'] });
      setCreateOpen(false);
      form.resetFields();
      navigate(`/batches/${batch.id}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '创建失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const columns = [
    {
      title: '批次编号',
      dataIndex: 'batchNo',
      width: 180,
      render: (v: string, r: Batch) => (
        <a onClick={() => navigate(`/batches/${r.id}`)}>
          <strong>{v}</strong>
        </a>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      width: 140,
      render: (m: AssayMethod) => {
        const conf = methodLabel[m];
        return (
          <Tag color={conf.color} icon={conf.icon}>
            {conf.label}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: BatchStatus) => (
        <Tag color={batchStatusColor[s]}>{batchStatusLabel[s] ?? s}</Tag>
      ),
    },
    {
      title: '平行样',
      dataIndex: 'replicateCount',
      width: 90,
      align: 'right' as const,
      render: (v: number) => `${v} 份`,
    },
    {
      title: '炉号',
      dataIndex: 'furnaceNo',
      width: 110,
      render: (v?: string) => v ?? <Text type="secondary">-</Text>,
    },
    {
      title: '样品数',
      dataIndex: ['_count', 'samples'],
      width: 90,
      align: 'right' as const,
      render: (v: number = 0) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag>,
    },
    {
      title: '操作员',
      dataIndex: ['operator', 'name'],
      width: 100,
      render: (v?: string) => v ?? <Text type="secondary">-</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 90,
      fixed: 'right' as const,
      render: (_: any, r: Batch) => (
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${r.id}`)}
          >
            详情
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
        <div>
      <PageHeader
        title="批次管理"
        subtitle="CNAS §7.4 · 火试金批次 + 状态机"
        icon={<ClusterOutlined />}
        extra={
          <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ method: 'FIRE_ASSAY', replicateCount: 3 });
            setCreateOpen(true);
          }}
        >
          创建批次
        </Button>
        }
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="检测方法"
          allowClear
          style={{ width: 180 }}
          value={methodFilter}
          onChange={setMethodFilter}
          options={Object.entries(methodLabel).map(([k, v]) => ({
            value: k,
            label: v.label,
          }))}
        />
        <Select
          placeholder="批次状态"
          allowClear
          style={{ width: 150 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(batchStatusLabel).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
        />
      </Space>

      <DataTable
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="创建检测批次"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="批次创建后,可在详情页加入样品并推进状态"
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => createMut.mutate(v)}
        >
          <Form.Item
            label="检测方法"
            name="method"
            rules={[{ required: true, message: '请选择检测方法' }]}
          >
            <Select
              options={Object.entries(methodLabel).map(([k, v]) => ({
                value: k,
                label: (
                  <span>
                    {v.icon} {v.label}
                  </span>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item
            label="平行样数"
            name="replicateCount"
            rules={[{ required: true, message: '请输入平行样数' }]}
            extra="GB/T 9288 要求至少 3 份平行样"
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="试金炉号(仅火试金)"
            name="furnaceNo"
          >
            <Input placeholder="如: FUR-001" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}