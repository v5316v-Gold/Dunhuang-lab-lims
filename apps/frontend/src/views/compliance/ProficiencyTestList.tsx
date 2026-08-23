// =====================================================
// W4-A: 能力验证 PT 模块(CNAS-CL01:2018 §7.7)
// 端点: /proficiency-tests(W4 独立模块)
// z 判定: |z| ≤ 2 满意 / 2 < |z| < 3 可疑 / |z| ≥ 3 不满意
// =====================================================

import { useMemo, useState } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, App, Alert, Card, Col, Row, Statistic, Typography, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, SafetyCertificateOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

const { Text } = Typography;

interface ProficiencyTest {
  id: string;
  ptNo: string;
  organizer: string;
  item: string;
  method: string;
  startDate: string;
  endDate?: string | null;
  zScore?: string | number | null; // Prisma Decimal → JSON 字符串
  result?: 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY' | null;
  remarks?: string | null;
  createdBy?: { id: string; name: string } | null;
}

interface PtSummary {
  years: number[];
  byYear: Record<string, ProficiencyTest[]>;
  total: number;
  satisfactory: number;
  questionable: number;
  unsatisfactory: number;
}

const RESULT_OPTS = [
  { value: 'SATISFACTORY', label: '满意', color: 'green' },
  { value: 'QUESTIONABLE', label: '可疑', color: 'orange' },
  { value: 'UNSATISFACTORY', label: '不满意', color: 'red' },
] as const;

const RESULT_COLOR: Record<string, string> = Object.fromEntries(
  RESULT_OPTS.map((o) => [o.value, o.color]),
);
const RESULT_LABEL: Record<string, string> = Object.fromEntries(
  RESULT_OPTS.map((o) => [o.value, o.label]),
);

const ITEM_OPTS = [
  { value: 'Au 纯度', label: 'Au 纯度(黄金)' },
  { value: 'Ag 纯度', label: 'Ag 纯度(白银)' },
  { value: 'Pt 纯度', label: 'Pt 纯度(铂)' },
  { value: 'Pd 纯度', label: 'Pd 纯度(钯)' },
];

/** 与后端 ProficiencyTestService.judgeByZ 一致的判定 */
function judgeByZ(z: number): 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY' {
  const abs = Math.abs(z);
  if (abs <= 2) return 'SATISFACTORY';
  if (abs < 3) return 'QUESTIONABLE';
  return 'UNSATISFACTORY';
}

export default function ProficiencyTestList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [editing, setEditing] = useState<ProficiencyTest | null>(null);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [createForm] = Form.useForm();
  const [resultForm] = Form.useForm();

  const { data: list, isLoading } = useQuery({
    queryKey: ['pts', year],
    queryFn: async () => {
      const q = year ? `?year=${year}` : '';
      return (await api.get<{ items: ProficiencyTest[]; total: number }>(`/proficiency-tests${q}`)).data;
    },
    refetchInterval: 30000,
  });

  const { data: summary } = useQuery({
    queryKey: ['pt-summary'],
    queryFn: async () => (await api.get<PtSummary>('/proficiency-tests/summary')).data,
    refetchInterval: 60000,
  });

  const createMut = useMutation({
    mutationFn: async (v: any) => (await api.post('/proficiency-tests', v)).data,
    onSuccess: () => {
      message.success('PT 计划已创建');
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['pts'] });
      qc.invalidateQueries({ queryKey: ['pt-summary'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

  const resultMut = useMutation({
    mutationFn: async (v: any) => {
      const z = parseFloat(v.zScore);
      // 前端同规则判定,后端 RecordResultDto 需要 result 字段
      return (await api.post(`/proficiency-tests/${v.id}/result`, {
        zScore: String(z),
        result: judgeByZ(z),
        remarks: v.remarks,
      })).data;
    },
    onSuccess: (data) => {
      message.success(`PT 结果已录入:${RESULT_LABEL[data.result]}(z=${data.zScore})`);
      setResultOpen(false);
      setEditing(null);
      resultForm.resetFields();
      qc.invalidateQueries({ queryKey: ['pts'] });
      qc.invalidateQueries({ queryKey: ['pt-summary'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '录入失败'),
  });

  // 删除 PT(仅未录结果,MFA)
  const [delTarget, setDelTarget] = useState<ProficiencyTest | null>(null);
  const [delMfaOpen, setDelMfaOpen] = useState(false);
  const removeMut = useMutation({
    mutationFn: async ({ mfaToken }: { mfaToken: string }) =>
      (await api.delete(`/proficiency-tests/${delTarget!.id}`, { headers: { 'x-mfa-token': mfaToken } })).data,
    onSuccess: () => {
      message.success('PT 计划已删除');
      setDelMfaOpen(false);
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ['pts'] });
      qc.invalidateQueries({ queryKey: ['pt-summary'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '删除失败'),
  });

  const columns = [
    { title: '编号', dataIndex: 'ptNo', width: 140, render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{v}</span> },
    { title: '组织方', dataIndex: 'organizer', width: 160, ellipsis: true },
    { title: '项目', dataIndex: 'item', width: 120 },
    { title: '方法', dataIndex: 'method', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: '开始日期', dataIndex: 'startDate', width: 110, render: (v: string) => v?.substring(0, 10) },
    {
      title: 'zScore', dataIndex: 'zScore', width: 90,
      render: (v: string | number | null) => v != null && v !== '' && !Number.isNaN(parseFloat(String(v)))
        ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{parseFloat(String(v)).toFixed(2)}</span>
        : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '结果', dataIndex: 'result', width: 100,
      render: (v: string | null) => v
        ? <Tag color={RESULT_COLOR[v] ?? 'default'}>{RESULT_LABEL[v] ?? v}</Tag>
        : <Tag>待评</Tag>,
    },
    {
      title: '操作', width: 160, fixed: 'right' as const,
      render: (_: any, r: ProficiencyTest) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={r.zScore != null}
            onClick={() => { setEditing(r); resultForm.setFieldsValue({ zScore: '', remarks: '' }); setResultOpen(true); }}
          >录入</Button>
          {r.zScore == null && (
            <Popconfirm
              title="删除 PT 计划(需 MFA)"
              description="仅未录结果的 PT 可删除。"
              onConfirm={() => { setDelTarget(r); setDelMfaOpen(true); }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const yearOptions = useMemo(() => {
    const years = summary?.years ?? [];
    const cur = new Date().getFullYear();
    return [...new Set([...years, cur, cur - 1])].sort((a, b) => b - a);
  }, [summary]);

  return (
    <div>
      <PageHeader
        title="能力验证 PT"
        subtitle="CNAS-CL01:2018 §7.7 · z 值三档判定 · 每年≥1 次覆盖在用方法"
        icon={<SafetyCertificateOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="按年度过滤"
              style={{ width: 140 }}
              value={year}
              onChange={(v) => setYear(v)}
              options={yearOptions.map((y) => ({ value: y, label: `${y} 年` }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => { qc.invalidateQueries({ queryKey: ['pts'] }); qc.invalidateQueries({ queryKey: ['pt-summary'] }); }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>新建 PT</Button>
          </Space>
        }
      />

      {/* 年度汇总卡(评审展示) */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderColor: 'var(--border-color)' }}>
            <Statistic title="PT 总次数" value={summary?.total ?? 0} suffix="次" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: 'var(--border-color)' }}>
            <Statistic title="满意" value={summary?.satisfactory ?? 0} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: 'var(--border-color)' }}>
            <Statistic title="可疑" value={summary?.questionable ?? 0} valueStyle={{ color: '#d48806' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: 'var(--border-color)' }}>
            <Statistic title="不满意" value={summary?.unsatisfactory ?? 0} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>
      {(summary?.years?.length ?? 0) > 0 && (
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          {summary!.years.map((y) => {
            const pts = summary!.byYear[String(y)] ?? [];
            const sat = pts.filter((p) => p.result === 'SATISFACTORY').length;
            return (
              <Tag key={y} color={pts.length > 0 && sat === pts.length ? 'green' : 'orange'}>
                {y} 年: {pts.length} 次 / 满意 {sat} 次
              </Tag>
            );
          })}
        </Space>
      )}

      <DataTable<ProficiencyTest>
        rowKey="id"
        columns={columns}
        dataSource={list?.items ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 900 }}
      />

      <Modal title="新建 PT 计划" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMut.isPending} okText="创建" cancelText="取消" width={540}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values)}>
          <Form.Item
            label="PT 编号"
            name="ptNo"
            rules={[{ required: true, message: '请输入 PT 编号(需唯一)' }]}
            initialValue={`PT-${Date.now()}`}
          >
            <Input placeholder="如:PT-2026-0001" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item label="组织方" name="organizer" rules={[{ required: true }]}>
            <Input placeholder="如:CNAS 能力验证计划 / 国家金银制品质量检验检测中心" />
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
          <Form.Item label="结束日期" name="endDate"><Input type="date" /></Form.Item>
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
        width={540}
      >
        {editing && (
          <Alert
            type="info"
            showIcon
            message={`PT ${editing.ptNo} (${editing.item})`}
            description="判定规则: |z| ≤ 2 满意 / 2 < |z| < 3 可疑 / |z| ≥ 3 不满意,系统将自动判定并同步结果。"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={resultForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => resultMut.mutate({ id: editing?.id, ...values })}>
          <Form.Item label="zScore(能力评定值)" name="zScore" rules={[{ required: true, message: '请输入 z 值' }]}>
            <InputNumber min={-5} max={5} step={0.01} precision={4} style={{ width: '100%' }} placeholder="如:0.8" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={delMfaOpen}
        title="MFA 二次验证 · 删除 PT"
        description="删除 PT 计划为敏感操作,需二次验证。"
        onCancel={() => setDelMfaOpen(false)}
        onConfirm={(mfaToken) => removeMut.mutateAsync({ mfaToken })}
      />
    </div>
  );
}
