// =====================================================
// 样品列表页
// =====================================================

import { useState } from 'react';
import { Table, Tag, Space, Button, Input, Select, Card } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../data/api';
import type { SampleType, SampleStatus } from '@dunhuang/lims-shared-types';

interface Sample {
  id: string;
  sampleNo: string;
  customerName: string;
  sampleType: SampleType;
  weightG: string;
  status: SampleStatus;
  receivedAt: string;
  receivedBy?: { name: string };
}

const statusColorMap: Record<SampleStatus, string> = {
  RECEIVED: 'blue',
  BATCHED: 'cyan',
  IN_TEST: 'orange',
  TESTED: 'gold',
  REPORT_DRAFT: 'purple',
  REPORT_REVIEW: 'magenta',
  REPORT_APPROVED: 'green',
  ARCHIVED: 'default',
  REJECTED: 'red',
};

const sampleTypeLabel: Record<SampleType, string> = {
  GOLD_INGOT: '金锭',
  GOLD_POWDER: '金粉',
  GOLD_ALLOY: '金合金',
  JEWELRY: '首饰',
  RECYCLED_GOLD: '回收金料',
  SILVER: '银',
  PLATINUM: '铂',
  PALLADIUM: '钯',
  OTHER: '其他',
};

export default function SamplesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ customerName?: string; sampleType?: SampleType; status?: SampleStatus }>({});

  const { data, isLoading } = useQuery({
    queryKey: ['samples', page, pageSize, filters],
    queryFn: async () => (await api.get('/samples', { params: { page, pageSize, ...filters } })).data,
  });

  const columns = [
    { title: '样品编号', dataIndex: 'sampleNo', width: 140 },
    { title: '客户', dataIndex: 'customerName', width: 200 },
    {
      title: '类型',
      dataIndex: 'sampleType',
      width: 100,
      render: (t: SampleType) => sampleTypeLabel[t] ?? t,
    },
    {
      title: '重量(g)',
      dataIndex: 'weightG',
      width: 100,
      align: 'right' as const,
      render: (v: string) => parseFloat(v).toFixed(4),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: SampleStatus) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    {
      title: '接收时间',
      dataIndex: 'receivedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '接收人',
      dataIndex: ['receivedBy', 'name'],
      width: 100,
    },
  ];

  return (
    <Card
      title="样品管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/samples/receive')}>
          接收样品
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="客户名称"
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          onChange={(e) => setFilters((f) => ({ ...f, customerName: e.target.value }))}
        />
        <Select
          placeholder="样品类型"
          allowClear
          style={{ width: 150 }}
          options={Object.entries(sampleTypeLabel).map(([k, v]) => ({ value: k, label: v }))}
          onChange={(v) => setFilters((f) => ({ ...f, sampleType: v as SampleType }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 150 }}
          options={Object.entries(statusColorMap).map(([k, v]) => ({ value: k, label: k }))}
          onChange={(v) => setFilters((f) => ({ ...f, status: v as SampleStatus }))}
        />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 900 }}
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
        onRow={(record) => ({
          onClick: () => navigate(`/samples/${record.id}`),
        })}
      />
    </Card>
  );
}