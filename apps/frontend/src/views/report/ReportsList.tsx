// =====================================================
// 检测报告列表 — 前端填充(原空壳页补全)
// 功能: 报告列表 + 创建报告 + 跳转详情(三级审核)
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Modal, Table, Tag, message, Space } from 'antd';
import { PlusOutlined, FileDoneOutlined } from '@ant-design/icons';
import { api } from '../../data/api';

interface ReportRow {
  id: string;
  reportNo: string;
  status: string;
  issuedAt?: string;
  createdAt: string;
  sample?: { sampleNo: string; customerName: string };
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  INTERNAL_REVIEW: 'var(--info)',
  FINAL_REVIEW: 'var(--warning)',
  APPROVED: 'var(--success)',
  ISSUED: 'var(--success)',
  REJECTED: 'var(--error)',
};

export function ReportsList() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/reports', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/reports', { sampleId: values.sampleId });
      message.success('报告已创建');
      setCreateOpen(false);
      form.resetFields();
      load(1);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  return (
    <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
      <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>检测报告</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          创建报告
        </Button>
      </Space>

      <Table<ReportRow>
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => { setPage(p); load(p); } }}
        locale={{ emptyText: '暂无报告' }}
        columns={[
          { title: '报告编号', dataIndex: 'reportNo', render: (v) => <span style={{ color: 'var(--gold)' }}>{v}</span> },
          { title: '样品编号', dataIndex: ['sample', 'sampleNo'], render: (v) => v ?? '—' },
          { title: '客户', dataIndex: ['sample', 'customerName'], render: (v) => v ?? '—' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v) => <Tag style={{ color: STATUS_COLOR[v] ?? 'var(--text-muted)' }}>{v}</Tag>,
          },
          { title: '签发时间', dataIndex: 'issuedAt', render: (v) => (v ? new Date(v).toLocaleString() : '—') },
          {
            title: '操作',
            render: (_, row) => (
              <Button
                size="small"
                icon={<FileDoneOutlined />}
                onClick={() => navigate(`/reports/${row.id}`)}
              >
                查看/审核
              </Button>
            ),
          },
        ]}
      />

      <Modal title="创建报告" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={create} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="sampleId" label="样品 ID" rules={[{ required: true, message: '请输入样品 ID' }]}>
            <Input placeholder="粘贴样品 UUID(样品需已完成检测)" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
