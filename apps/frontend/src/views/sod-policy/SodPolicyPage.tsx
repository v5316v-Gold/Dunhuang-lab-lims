// =====================================================
// SoD 策略 + 留样期 配置页面(W1 架构 — CNAS-CL01 §7.5.2/§7.8.4)
// 实验室主任维护:策略模式(STRICT/RELAXED)+ 各类实体留样期
// =====================================================

import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
  Tag,
  Alert,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { MfaChallengeModal } from '../../components/MfaChallengeModal';

const { Text } = Typography;

interface SodPolicy {
  id: string;
  mode: 'STRICT' | 'RELAXED';
  applyToSampleTypes: string[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  description?: string | null;
  approvedBy?: { id: string; name: string };
}

interface RetentionPolicy {
  id: string;
  entityType: string;
  retentionMonths: number;
  archiveAfterMonths: number;
  description?: string | null;
}

const MODE_OPTIONS = [
  { value: 'STRICT', label: '严格(5 段 5 角色互斥,推荐评审)' },
  { value: 'RELAXED', label: '宽松(AUTHORIZER=ISSUER,4 段 4 角色)' },
];

const ENTITY_LABELS: Record<string, string> = {
  sample: '样品',
  report: '报告',
  audit_log: '审计日志',
  qc_record: 'QC 记录',
  equipment_record: '设备记录',
};

export default function SodPolicyPage() {
  const qc = useQueryClient();
  const [editingSod, setEditingSod] = useState<SodPolicy | null>(null);
  const [editingRetention, setEditingRetention] = useState<RetentionPolicy | null>(null);
  const [sodForm] = Form.useForm();
  const [retForm] = Form.useForm();

  const { data: sodPolicies = [], isLoading: sodLoading } = useQuery({
    queryKey: ['sod-policies'],
    queryFn: async () => (await api.get('/sod-policies')).data ?? [],
  });

  const { data: retentionPolicies = [], isLoading: retLoading } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: async () => (await api.get('/retention-policies')).data ?? [],
  });

  // SoD 策略更新(版本化,需 MFA)
  const [sodMfaOpen, setSodMfaOpen] = useState(false);
  const [sodPending, setSodPending] = useState<any>(null);
  const updateSodMut = useMutation({
    mutationFn: async ({ mfaToken }: { mfaToken: string }) =>
      (await api.patch(`/sod-policies/${editingSod!.id}`, sodPending, { headers: { 'x-mfa-token': mfaToken } })).data,
    onSuccess: () => {
      message.success('SoD 策略已更新(版本化,审计留痕)');
      setSodMfaOpen(false);
      setSodPending(null);
      setEditingSod(null);
      qc.invalidateQueries({ queryKey: ['sod-policies'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '更新失败'),
  });

  // 留样期更新(需 MFA)
  const [retMfaOpen, setRetMfaOpen] = useState(false);
  const [retPending, setRetPending] = useState<any>(null);
  const updateRetMut = useMutation({
    mutationFn: async ({ mfaToken }: { mfaToken: string }) =>
      (await api.patch(`/retention-policies/${editingRetention!.entityType}`, retPending, { headers: { 'x-mfa-token': mfaToken } })).data,
    onSuccess: () => {
      message.success('留样期已更新(版本化,审计留痕)');
      setRetMfaOpen(false);
      setRetPending(null);
      setEditingRetention(null);
      qc.invalidateQueries({ queryKey: ['retention-policies'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '更新失败'),
  });

  const sodCols = [
    { title: '模式', dataIndex: 'mode', render: (v: string) => <Tag color={v === 'STRICT' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '适用范围', dataIndex: 'applyToSampleTypes', render: (v: string[]) => v.length === 0 ? <Tag>全部样品类型</Tag> : v.map(s => <Tag key={s}>{s}</Tag>) },
    { title: '生效起', dataIndex: 'effectiveFrom', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    { title: '生效止', dataIndex: 'effectiveTo', render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : <Tag color="success">至今</Tag> },
    { title: '说明', dataIndex: 'description' },
    { title: '批准人', dataIndex: ['approvedBy', 'name'] },
    {
      title: '操作',
      render: (_: unknown, r: SodPolicy) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditingSod(r);
          sodForm.setFieldsValue({ mode: r.mode, applyToSampleTypes: r.applyToSampleTypes, description: r.description });
        }}>
          更新
        </Button>
      ),
    },
  ];

  const retCols = [
    { title: '实体', dataIndex: 'entityType', render: (v: string) => ENTITY_LABELS[v] ?? v },
    {
      title: '保存期',
      dataIndex: 'retentionMonths',
      render: (v: number) => v === -1 ? <Tag color="success">永久</Tag> : <Tag>{v} 月</Tag>,
    },
    {
      title: '归档阈值',
      dataIndex: 'archiveAfterMonths',
      render: (v: number) => <Text>{v} 月</Text>,
    },
    { title: '说明', dataIndex: 'description' },
    {
      title: '操作',
      render: (_: unknown, r: RetentionPolicy) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditingRetention(r);
          retForm.setFieldsValue({ retentionMonths: r.retentionMonths, archiveAfterMonths: r.archiveAfterMonths, description: r.description });
        }}>
          更新
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="SoD 互斥 + 留样期策略" subtitle="CNAS-CL01:2018 §7.5.2/§7.8.4 · 实验室主任维护 · 变更需 MFA 二次验证" />

      <Alert
        type="info"
        showIcon
        message="合规配置(SoD 模式 / 留样期)更新属 CNAS 评审敏感操作,需 MFA 二次验证;策略变更走版本化(关闭旧+创建新),审计链完整留痕。"
        style={{ marginBottom: 0 }}
      />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="SoD 互斥策略" extra={<Text type="secondary">六角色互斥规则</Text>}>
            <Table<SodPolicy>
              rowKey="id" size="small" loading={sodLoading}
              dataSource={sodPolicies} columns={sodCols as any}
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="留样/记录保存期" extra={<Text type="secondary">按实体类型</Text>}>
            <Table<RetentionPolicy>
              rowKey="id" size="small" loading={retLoading}
              dataSource={retentionPolicies} columns={retCols as any}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Modal title="更新 SoD 策略" open={!!editingSod && !sodMfaOpen} onCancel={() => { setEditingSod(null); sodForm.resetFields(); }} onOk={() => sodForm.submit()} width={500}>
        <Form form={sodForm} layout="vertical" onFinish={(v) => { setSodPending(v); setSodMfaOpen(true); }}>
          <Form.Item label="模式" name="mode" rules={[{ required: true }]}>
            <Select options={MODE_OPTIONS} />
          </Form.Item>
          <Form.Item label="适用范围(空=全部)" name="applyToSampleTypes">
            <Select mode="multiple" allowClear placeholder="如: ['GOLD_INGOT']" />
          </Form.Item>
          <Form.Item label="说明" name="description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="更新留样期" open={!!editingRetention && !retMfaOpen} onCancel={() => { setEditingRetention(null); retForm.resetFields(); }} onOk={() => retForm.submit()} width={500}>
        <Form form={retForm} layout="vertical" onFinish={(v) => { setRetPending(v); setRetMfaOpen(true); }}>
          <Form.Item label="保存期(月,-1=永久)" name="retentionMonths" rules={[{ required: true }]}>
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="归档阈值(月)" name="archiveAfterMonths" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="说明" name="description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <MfaChallengeModal
        open={sodMfaOpen}
        title="MFA 二次验证 · 更新 SoD 策略"
        description="SoD 模式变更影响报告流转约束,需二次验证(CNAS §7.8.4)。"
        onCancel={() => setSodMfaOpen(false)}
        onConfirm={(mfaToken) => updateSodMut.mutateAsync({ mfaToken })}
      />

      <MfaChallengeModal
        open={retMfaOpen}
        title="MFA 二次验证 · 更新留样期"
        description="留样期变更影响记录保留时长,需二次验证(CNAS §7.5.2)。"
        onCancel={() => setRetMfaOpen(false)}
        onConfirm={(mfaToken) => updateRetMut.mutateAsync({ mfaToken })}
      />
    </div>
  );
}
