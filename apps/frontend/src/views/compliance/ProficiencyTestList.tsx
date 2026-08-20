// =====================================================
// W+7-1: PT 能力验证流程(zScore 自动判定 + UI)
// 后端端点 /compliance/proficiency-test(Phase 1B 已实现)
// zScore 三档判定:≤2 SATISFACTORY / <3 QUESTIONABLE / ≥3 UNSATISFACTORY
// =====================================================

import { useState } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, App, Popconfirm, Alert,
} from 'antd';
import {  PlusOutlined, ReloadOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface ProficiencyTest {
  id: string;
  ptNo: string;
  organizer: string;
  item: string;
  method: string;
  startDate: string;
  zScore?: string;
  result?: 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY';
  endDate?: string;
  reportFileId?: string;
  remarks?: string;
}

const RESULT_OPTS = [
  { value: 'SATISFACTORY', label: '满意', color: 'green' },
  { value: 'QUESTIONABLE', label: '可疑', color: 'orange' },
  { value: 'UNSATISFACTORY', label: '不满意', color: 'red' },
];

const RESULT_COLOR = Object.fromEntries(RESULT_OPTS.map((o) => [o.value, o.color]));

const ITEM_OPTS = [
  { value: 'Au 纯度', label: 'Au 纯度(黄金)' },
  { value: 'Ag 纯度', label: 'Ag 纯度(白银)' },
  { value: 'Pt 纯度', label: 'Pt 纯度(铂)' },
  { value: 'Pd 纯度', label: 'Pd 纯度(钯)' },
];

export default function ProficiencyTestList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [editing, setEditing] = useState<ProficiencyTest | null>(null);
  const [createForm] = Form.useForm();
  const [resultForm] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['pts'],
    queryFn: async () => (await api.get<{ items: ProficiencyTest[]; total: number }>('/compliance/proficiency-test')).data,
    refetchInterval: 30000,
  });

  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/compliance/proficiency-test', v)).data,
    onSuccess: () => {
      message.success('PT 已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['pts'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const resultMut = useMutation({
    mutationFn: async (v: any) => (await api.post(`/compliance/proficiency-test/${v.id}/result`, { zScore: v.zScore, reportFileId: v.reportFileId, remarks: v.remarks })).data,
    onSuccess: (data) => {
      message.success(`PT 结果已录入:${data.result}(z=${data.zScore})`);
      setResultOpen(false);
      setEditing(null);
      resultForm.resetFields();
      qc.invalidateQueries({ queryKey: ['pts'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '录入失败'),
  });

  const columns = [
    { title: '编号', dataIndex: 'ptNo', width: 130, render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span> },
    { title: '组织方', dataIndex: 'organizer', width: 140, ellipsis: true },
    { title: '项目', dataIndex: 'item', width: 110 },
    { title: '方法', dataIndex: 'method', width: 100 },
    { title: '开始日期', dataIndex: 'startDate', width: 110, render: (v: string) => v?.substring(0, 10) },
    {
      title: 'zScore', dataIndex: 'zScore', width: 90,
      render: (v: string) => v ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{parseFloat(v).toFixed(2)}</span> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '结果', dataIndex: 'result', width: 100,
      render: (v: string) => v ? <Tag color={RESULT_COLOR[v] ?? 'default'}>{RESULT_OPTS.find((o) => o.value === v)?.label ?? v}</Tag> : <Tag>待评</Tag>,
    },
    {
      title: '操作', width: 90, fixed: 'right' as const,
      render: (_: any, r: ProficiencyTest) => (
        <Button
          size="small"
          icon={<CheckCircleOutlined />}
          disabled={r.zScore != null}
          onClick={() => { setEditing(r); resultForm.setFieldsValue({ zScore: '', remarks: '' }); setResultOpen(true); }}
        >录入</Button>
      ),
    },
  ];

  const stats = {
    total: list?.total ?? 0,
    sat: list?.items.filter((i: ProficiencyTest) => i.result === 'SATISFACTORY').length ?? 0,
    que: list?.items.filter((i: ProficiencyTest) => i.result === 'QUESTIONABLE').length ?? 0,
    unSat: list?.items.filter((i: ProficiencyTest) => i.result === 'UNSATISFACTORY').length ?? 0,
  };

  return (
        <div>
      <PageHeader
        title="能力验证 PT"
        subtitle="PT zScore 三档判定 · 外部能力验证"
        icon={<SafetyOutlined />}
        extra={
          <Space>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['pts'] })}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>新建 PT</Button>
        </Space>
        }
      />
      <Space size="middle" style={{ marginBottom: 12 }}>
        <Tag color="blue">总数: {stats.total}</Tag>
        <Tag color="green">满意: {stats.sat}</Tag>
        <Tag color="orange">可疑: {stats.que}</Tag>
        <Tag color="red">不满意: {stats.unSat}</Tag>
      </Space>
      <DataTable<ProficiencyTest>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
      />
      <Modal title="新建 PT" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMut.isPending} okText="创建" cancelText="取消" width={520}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item label="组织方" name="organizer" rules={[{ required: true }]}>
            <Input placeholder="如:CNAS PT 计划 / 国家计量院" />
          </Form.Item>
          <Form.Item label="项目" name="item" rules={[{ required: true }]} initialValue="Au 纯度">
            <Select options={ITEM_OPTS} />
          </Form.Item>
          <Form.Item label="方法" name="method" rules={[{ required: true }]} initialValue="FIRE_ASSAY">
            <Input placeholder="如:GB/T 9288 火试金法" />
          </Form.Item>
          <Form.Item label="开始日期" name="startDate" rules={[{ required: true }]}>
            <Input type="date" placeholder="选择开始日期" />
          </Form.Item>
          <Form.Item label="备注" name="remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal
        title={editing ? `录入 PT 结果(${editing.ptNo})` : '录入 PT 结果'}
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        onOk={() => resultForm.submit()}
        confirmLoading={resultMut.isPending}
        okText="录入"
        cancelText="取消"
        width={520}
      >
        {editing && (
          <Alert
            type="info"
            showIcon
            message={`PT ${editing.ptNo} (${editing.item}) | 判定规则:≤2 SATISFACTORY / 2-3 QUESTIONABLE / ≥3 UNSATISFACTORY`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={resultForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => resultMut.mutate({ id: editing?.id, ...values })}>
          <Form.Item label="zScore" name="zScore" rules={[{ required: true }]}>
            <InputNumber min={-5} max={5} step={0.01} precision={4} style={{ width: '100%' }} placeholder="如:0.8" />
          </Form.Item>
          <Form.Item label="PT 报告附件 ID (可选)" name="reportFileId">
            <Input placeholder="FileAttachment UUID" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}