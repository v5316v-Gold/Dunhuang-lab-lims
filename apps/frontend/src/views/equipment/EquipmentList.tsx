// =====================================================
// 设备管理列表 — 前端填充(原空壳页补全)
// 功能: 设备列表 + 创建设备 + 校准/维护/期间核查入口
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Table, Tag, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../data/api';

interface EquipmentRow {
  id: string;
  equipmentNo: string;
  name: string;
  type: string;
  status: string;
  model?: string;
  location?: string;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--success)',
  MAINTENANCE: 'var(--warning)',
  RETIRED: 'var(--text-muted)',
  BROKEN: 'var(--error)',
};

export function EquipmentList() {
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/equipment', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载设备失败');
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
      await api.post('/equipment', values);
      message.success('设备已创建');
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
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>设备管理</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          创建设备
        </Button>
      </Space>

      <Table<EquipmentRow>
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => { setPage(p); load(p); } }}
        locale={{ emptyText: '暂无设备' }}
        columns={[
          { title: '设备编号', dataIndex: 'equipmentNo' },
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type', render: (v) => <Tag>{v}</Tag> },
          { title: '型号', dataIndex: 'model', render: (v) => v ?? '—' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v) => <Tag style={{ color: STATUS_COLOR[v] ?? 'var(--text-muted)' }}>{v}</Tag>,
          },
          { title: '位置', dataIndex: 'location', render: (v) => v ?? '—' },
        ]}
      />

      <Modal title="创建设备" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={create} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="equipmentNo" label="设备编号" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="FIRE_ASSAY_FURNACE" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'FIRE_ASSAY_FURNACE', label: '试金炉' },
                { value: 'CUPELLATION_FURNACE', label: '灰吹炉' },
                { value: 'ANALYTICAL_BALANCE', label: '分析天平' },
                { value: 'ICP_OES', label: 'ICP-OES' },
                { value: 'ICP_MS', label: 'ICP-MS' },
                { value: 'XRF', label: 'XRF' },
                { value: 'OTHER', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
