// =====================================================
// W+6-3: 盲样考核流程(创建 + 录入结果 + 偏差自动判定)
// =====================================================

import { useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, App, Popconfirm, Progress, Alert,
} from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface BlindSample {
  id: string;
  blindNo: string;
  sampleCode: string;
  assignedToId: string;
  assignedToName?: string;
  trueValue: string;
  measuredValue?: string;
  deviationPct?: string;
  passed?: boolean;
  assessDate?: string;
  remarks?: string;
}

const PASS_THRESHOLD = 5;  // % 偏差容差

export default function BlindSampleList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [editing, setEditing] = useState<BlindSample | null>(null);
  const [createForm] = Form.useForm();
  const [assessForm] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['blind-samples'],
    queryFn: async () => (await api.get<{ items: BlindSample[]; total: number }>('/compliance/blind-sample')).data,
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get<{ data: any[] }>('/users', { params: { pageSize: 100 } })).data,
  });
  const userMap = new Map((users?.data ?? []).map((u: any) => [u.id, u.name ?? u.username]));

  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/compliance/blind-sample', v)).data,
    onSuccess: () => {
      message.success('盲样已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['blind-samples'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const assessMut = useMutation({
    mutationFn: async (v: any) => (await api.post(`/compliance/blind-sample/${v.id}/assess`, { measuredValue: v.measuredValue, remarks: v.remarks })).data,
    onSuccess: (data) => {
      message.success(`考核完成${data.passed ? '✓ 通过' : '✗ 不通过'}偏差 ${data.deviationPct}%`);
      setAssessOpen(false);
      setEditing(null);
      assessForm.resetFields();
      qc.invalidateQueries({ queryKey: ['blind-samples'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '考核失败'),
  });

  const columns = [
    { title: '编号', dataIndex: 'blindNo', width: 130, render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span> },
    { title: '盲样码', dataIndex: 'sampleCode', width: 100 },
    { title: '被考核人', dataIndex: 'assignedToId', width: 90, render: (id: string) => userMap.get(id) ?? id.slice(0, 8) },
    { title: '真值', dataIndex: 'trueValue', width: 80 },
    {
      title: '测得值', dataIndex: 'measuredValue', width: 90,
      render: (v: string) => v ?? <span style={{ color: '#999' }}>未评</span>,
    },
    {
      title: '偏差(%)', dataIndex: 'deviationPct', width: 130,
      render: (v: string, r: BlindSample) => v ? (
        <Progress
          percent={Math.min(parseFloat(v), 100)}
          size="small"
          status={r.passed ? 'success' : 'exception'}
          format={(p) => `${p}%`}
        />
      ) : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '结果', dataIndex: 'passed', width: 80,
      render: (_: any, r: BlindSample) => r.passed === undefined ? <Tag>未评</Tag> : r.passed ? <Tag color="green">通过</Tag> : <Tag color="red">不通过</Tag>,
    },
    {
      title: '操作', width: 90, fixed: 'right' as const,
      render: (_: any, r: BlindSample) => (
        <Button
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => { setEditing(r); assessForm.setFieldsValue({ measuredValue: '', remarks: '' }); setAssessOpen(true); }}
          disabled={r.measuredValue != null}
        >录入</Button>
      ),
    },
  ];

  const stats = {
    total: list?.total ?? 0,
    assessed: list?.items.filter((i: BlindSample) => i.passed !== undefined).length ?? 0,
    passed: list?.items.filter((i: BlindSample) => i.passed === true).length ?? 0,
  };
  const passRate = stats.assessed > 0 ? Math.round((stats.passed / stats.assessed) * 100) : 0;

  return (
    <Card
      title="盲样考核(5% 偏差容差)"
      size="small"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['blind-samples'] })}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>新建盲样</Button>
        </Space>
      }
    >
      <Space size="middle" style={{ marginBottom: 12 }}>
        <Tag color="blue">总数: {stats.total}</Tag>
        <Tag color="cyan">已评: {stats.assessed}</Tag>
        <Tag color="green">通过: {stats.passed}</Tag>
        <Progress percent={passRate} size="small" style={{ width: 120 }} format={(p) => `通过率 ${p}%`} />
      </Space>
      <Table<BlindSample>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
      />

      <Modal title="新建盲样" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMut.isPending} okText="创建" cancelText="取消" width={520}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="盲样编号" name="sampleCode" rules={[{ required: true }]}>
            <Input placeholder="如:BL-AU-2026-001" />
          </Form.Item>
          <Form.Item label="真值(已知)" name="trueValue" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} step={0.0001} precision={4} style={{ width: '100%' }} placeholder="如:99.99" />
          </Form.Item>
          <Form.Item label="被考核人" name="assignedToId" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择检测员" options={(users?.data ?? []).map((u: any) => ({ value: u.id, label: u.name ?? u.username }))} />
          </Form.Item>
          <Form.Item label="备注" name="remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editing ? `录入考核结果(${editing.blindNo})` : '录入考核结果'}
        open={assessOpen}
        onCancel={() => setAssessOpen(false)}
        onOk={() => assessForm.submit()}
        confirmLoading={assessMut.isPending}
        okText="提交"
        cancelText="取消"
        width={520}
      >
        {editing && (
          <Alert
            type="info"
            showIcon
            message={`盲样 ${editing.blindNo} 真值 = ${editing.trueValue}% | 偏差容差 = 5%`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={assessForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => assessMut.mutate({ id: editing?.id, ...values })}>
          <Form.Item label="被考核人测得值" name="measuredValue" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} step={0.0001} precision={4} style={{ width: '100%' }} placeholder="如:99.95" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}