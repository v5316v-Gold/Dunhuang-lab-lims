// =====================================================
// 检测任务列表 — Phase 2 填充
// 功能: 任务列表(方法/状态/纯度)+ 创建火试金/ICP 任务
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Table, Tag, message, Space } from 'antd';
import {  PlusOutlined, FileSearchOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface TestRow {
  id: string;
  sampleId: string;
  method: string;
  status: string;
  purityPct?: string;
  createdAt: string;
  sample?: { sampleNo: string };
  operator?: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--warning)',
  IN_PROGRESS: 'var(--info)',
  COMPLETED: 'var(--success)',
  QC_FAILED: 'var(--error)',
  REJECTED: 'var(--error)' };

const columns = [
  {
    title: '样品编号',
    dataIndex: ['sample', 'sampleNo'],
    render: (v: string) => v ?? '—' },
  { title: '方法', dataIndex: 'method', render: (v: string) => <Tag>{v}</Tag> },
  {
    title: '状态',
    dataIndex: 'status',
    render: (v: string) => <Tag style={{ color: STATUS_COLOR[v] ?? 'var(--text-muted)' }}>{v}</Tag> },
  {
    title: '纯度%',
    dataIndex: 'purityPct',
    render: (v: string) => (v ? <span style={{ color: 'var(--gold)' }}>{v}</span> : '—') },
  { title: '操作员', dataIndex: ['operator', 'name'], render: (v: string) => v ?? '—' },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    render: (v: string) => new Date(v).toLocaleString() },
];

export function TestsList() {
  const [data, setData] = useState<TestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/tests', { params: { page: 1, pageSize: 20 } });
        if (!cancelled) {
          setData(res.data.data ?? []);
          setTotal(res.data.total ?? 0);
        }
      } catch {
        if (!cancelled) message.error('加载检测任务失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPageChange = async (p: number) => {
    setPage(p);
    setLoading(true);
    try {
      const res = await api.get('/tests', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    try {
      const ep = values.method === 'ICP_OES' ? '/tests/icp' : '/tests/fire-assay';
      await api.post(ep, { sampleId: values.sampleId });
      message.success('检测任务已创建');
      setCreateOpen(false);
      form.resetFields();
      onPageChange(1);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  return (
    <div>
      <PageHeader
        title="检测任务"
        subtitle="CNAS §7.5 检测流程 · 火试金 / ICP 任务"
        icon={<FileSearchOutlined />}
        extra={<Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          创建检测
        </Button>}
      />

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{ current: page, total, pageSize: 20, onChange: onPageChange }}
        locale={{ emptyText: '暂无检测任务' }}
      />

      <Modal
        title="创建检测任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="创建"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="sampleId"
            label="样品 ID"
            rules={[
              { required: true, message: '请输入样品 ID' },
              { pattern: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, message: '样品 ID 必须是有效的 UUID 格式(如 4542c828-0308-46d6-bd64-df7605f10ed3)' },
            ]}
          >
            <Input placeholder="粘贴样品 UUID(完整格式)" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="method" label="检测方法" initialValue="FIRE_ASSAY" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'FIRE_ASSAY', label: '火试金法' },
                { value: 'ICP_OES', label: 'ICP-OES' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
