// =====================================================
// 试剂库存列表 — 前端填充(原空壳页补全)
// 功能: 试剂列表 + 创建试剂 + 库存预警入口
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Table, Tag, message, Space } from 'antd';
import {  PlusOutlined, AlertOutlined, GoldOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface ReagentRow {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  casNo?: string;
  safetyStock?: string;
}

export function ReagentsList() {
  const [data, setData] = useState<ReagentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [form] = Form.useForm();

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/reagents', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载试剂失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAlerts = async () => {
    try {
      const res = await api.get('/reagents/inventory/alerts');
      setAlerts(res.data ?? []);
      setAlertOpen(true);
    } catch {
      message.error('加载预警失败');
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/reagents', values);
      message.success('试剂已创建');
      setCreateOpen(false);
      form.resetFields();
      load(1);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  return (
    <div>
      <PageHeader
        title="试剂库存"
        subtitle="CNAS §6.6 外部产品 · 试剂台账 + 库存预警"
        icon={<GoldOutlined />}
        extra={<Button icon={<AlertOutlined />} onClick={showAlerts}>
            库存预警
          </Button>}
      />

      <DataTable<ReagentRow>
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => { setPage(p); load(p); } }}
        locale={{ emptyText: '暂无试剂' }}
        columns={[
          { title: '编码', dataIndex: 'code', render: (v) => <span style={{ color: 'var(--gold)' }}>{v}</span> },
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type', render: (v) => <Tag>{v}</Tag> },
          { title: 'CAS', dataIndex: 'casNo', render: (v) => v ?? '—' },
          { title: '单位', dataIndex: 'unit' },
          { title: '安全库存', dataIndex: 'safetyStock', render: (v) => v ?? '—' },
        ]}
      />

      {/* 预警弹窗 */}
      <Modal
        title="库存预警"
        open={alertOpen}
        onCancel={() => setAlertOpen(false)}
        footer={<Button onClick={() => setAlertOpen(false)}>关闭</Button>}
      >
        {alerts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>暂无预警</div>
        ) : (
          alerts.map((a, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{a.name}</span>{' '}
              <Tag style={{ color: a.low ? 'var(--error)' : 'var(--warning)' }}>
                {a.low ? '低库存' : '注意'}
              </Tag>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                剩余 {a.totalRemaining} {a.unit} / 安全 {a.safetyStock}
              </div>
            </div>
          ))
        )}
      </Modal>

      <Modal title="创建试剂" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={create} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="试剂编码" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="name" label="试剂名称" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="NITRIC_ACID" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'NITRIC_ACID', label: '硝酸' },
                { value: 'HYDROCHLORIC_ACID', label: '盐酸' },
                { value: 'AQUA_REGIA', label: '王水' },
                { value: 'GOLD_STANDARD', label: '金标准物质' },
                { value: 'OTHER', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="mL" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="safetyStock" label="安全库存">
            <Input placeholder="低于此值触发预警" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
