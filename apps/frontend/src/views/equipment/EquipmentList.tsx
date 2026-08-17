// =====================================================
// 设备管理列表 — P2 美化版(PageHeader + DataTable + statusTag)
// 功能: 设备列表 + 创建设备 + 校准/维护/期间核查入口
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Tag, message, Space } from 'antd';
import { PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface EquipmentRow {
  id: string;
  equipmentNo: string;
  name: string;
  type: string;
  status: string;
  model?: string;
  location?: string;
}

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
    <div>
      <PageHeader
        title="设备管理"
        subtitle="CNAS §6.4 设备 + §7.7 期间核查 · 校准/核查状态实时监控"
        icon={<ToolOutlined />}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建设备
          </Button>
        }
      />

      <DataTable<EquipmentRow>
        title="设备列表"
        subtitle={`共 ${total} 台`}
        rowKey="id"
        loading={loading}
        dataSource={data}
        onRefresh={() => load(page)}
        onAdd={() => setCreateOpen(true)}
        addLabel="创建设备"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showSizeChanger: false,
          onChange: (p) => { setPage(p); load(p); },
        }}
        columns={[
          { title: '设备编号', dataIndex: 'equipmentNo', width: 130 },
          { title: '名称', dataIndex: 'name', width: 160 },
          {
            title: '类型',
            dataIndex: 'type',
            width: 140,
            render: (v) => {
              const map: Record<string, string> = {
                FIRE_ASSAY_FURNACE: '试金炉', CUPELLATION_FURNACE: '灰吹炉',
                ANALYTICAL_BALANCE: '分析天平', ICP_OES: 'ICP-OES', ICP_MS: 'ICP-MS',
                XRF: 'XRF', OTHER: '其他',
              };
              return <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{map[v] ?? v}</Tag>;
            },
          },
          { title: '型号', dataIndex: 'model', render: (v) => v ?? '—' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            render: statusTag,
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
    </div>
  );
}
