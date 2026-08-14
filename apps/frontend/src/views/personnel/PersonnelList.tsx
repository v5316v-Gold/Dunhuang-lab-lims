// =====================================================
// 人员管理列表 — 前端填充(原空壳页补全)
// 功能: 人员列表 + 创建人员 + 能力矩阵
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Table, Tag, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../data/api';

interface PersonnelRow {
  id: string;
  employeeNo: string;
  name: string;
  title?: string;
  phone?: string;
  user?: { username: string };
}

export function PersonnelList() {
  const [data, setData] = useState<PersonnelRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/personnel', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载人员失败');
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
      await api.post('/personnel', values);
      message.success('人员已创建');
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
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>人员管理</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          创建人员
        </Button>
      </Space>

      <Table<PersonnelRow>
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => { setPage(p); load(p); } }}
        locale={{ emptyText: '暂无人员' }}
        columns={[
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'name' },
          { title: '职称', dataIndex: 'title', render: (v) => v ?? '—' },
          {
            title: '登录账号',
            dataIndex: ['user', 'username'],
            render: (v) => (v ? <Tag style={{ color: 'var(--gold)' }}>{v}</Tag> : '—'),
          },
          { title: '联系电话', dataIndex: 'phone', render: (v) => v ?? '—' },
        ]}
      />

      <Modal title="创建人员" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={create} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="employeeNo" label="工号" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="userId" label="关联用户 ID">
            <Input placeholder="系统用户 UUID(可选)" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="title" label="职称">
            <Input style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
