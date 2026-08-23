// =====================================================
// 批次详情页 — Phase 2 Day 2
// 状态机推进 + 加入样品 + 工艺参数 + 状态时间线
// =====================================================

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Table,
  Modal,
  Select,
  Form,
  Input,
  InputNumber,
  message,
  Typography,
  Alert,
  Row,
  Col,
  Timeline,
  Empty,
  Spin,
  Divider,
  Tabs,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  FireOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  UndoOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { useAuthStore } from '../../stores/auth.store';
import FireAssayForm from './FireAssayForm';
import type {
  AssayMethod,
  BatchStatus,
  SampleType,
  SampleStatus,
} from '@dunhuang/lims-shared-types';

const { Title, Text, Paragraph } = Typography;

// ============== 状态机定义 ==============
const BATCH_FLOW: BatchStatus[] = [
  'PENDING',
  'MIXING',
  'FUSING',
  'CUPELLING',
  'PARTING',
  'ANNEALING',
  'WEIGHING',
  'CALCULATING',
  'COMPLETED',
];

const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  PENDING: '待启动',
  MIXING: '混料',
  FUSING: '熔融',
  CUPELLING: '灰吹',
  PARTING: '分金',
  ANNEALING: '退火',
  WEIGHING: '称重',
  CALCULATING: '计算',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
};

const BATCH_STATUS_COLOR: Record<BatchStatus, string> = {
  PENDING: 'default',
  MIXING: 'blue',
  FUSING: 'cyan',
  CUPELLING: 'geekblue',
  PARTING: 'purple',
  ANNEALING: 'magenta',
  WEIGHING: 'orange',
  CALCULATING: 'gold',
  COMPLETED: 'green',
  REJECTED: 'red',
};

const NEXT_ACTION: Record<BatchStatus, { action: string; label: string; type: 'primary' | 'danger' } | null> = {
  PENDING: { action: 'START', label: '开始批次', type: 'primary' },
  MIXING: { action: 'ADVANCE', label: '推进 → 熔融', type: 'primary' },
  FUSING: { action: 'ADVANCE', label: '推进 → 灰吹', type: 'primary' },
  CUPELLING: { action: 'ADVANCE', label: '推进 → 分金', type: 'primary' },
  PARTING: { action: 'ADVANCE', label: '推进 → 退火', type: 'primary' },
  ANNEALING: { action: 'ADVANCE', label: '推进 → 称重', type: 'primary' },
  WEIGHING: { action: 'ADVANCE', label: '推进 → 计算', type: 'primary' },
  CALCULATING: { action: 'COMPLETE', label: '完成批次', type: 'primary' },
  COMPLETED: null,
  REJECTED: null,
};

const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = {
  RECEIVED: '已接收',
  BATCHED: '已分批',
  IN_TEST: '检测中',
  TESTED: '已检测',
  REPORT_DRAFT: '报告草稿',
  REPORT_REVIEW: '报告审核',
  REPORT_APPROVED: '报告已批',
  ARCHIVED: '已归档',
  DISPOSED: '已处置',
  REJECTED: '已拒收',
};

const SAMPLE_STATUS_COLOR: Record<SampleStatus, string> = {
  RECEIVED: 'blue',
  BATCHED: 'cyan',
  IN_TEST: 'orange',
  TESTED: 'gold',
  REPORT_DRAFT: 'purple',
  REPORT_REVIEW: 'magenta',
  REPORT_APPROVED: 'green',
  ARCHIVED: 'default',
  DISPOSED: 'default',
  REJECTED: 'red',
};

const SAMPLE_TYPE_LABEL: Record<SampleType, string> = {
  GOLD_INGOT: '金锭',
  GOLD_POWDER: '金粉',
  GOLD_ALLOY: '金合金',
  JEWELRY: '首饰',
  RECYCLED_GOLD: '回收金料',
  SILVER: '银',
  PLATINUM: '铂',
  PALLADIUM: '钯',
  OTHER: '其他',
};

const METHOD_LABEL: Record<AssayMethod, string> = {
  FIRE_ASSAY: '火试金法',
  ICP_OES: 'ICP-OES',
  ICP_MS: 'ICP-MS',
  XRF: 'XRF',
  FIRE_ASSAY_GRAVIMETRIC: '火试金-重量法',
  VOLUMETRIC: '容量法',
  ICP_GBC: 'ICP-GB',
  OTHER: '其他',
};

interface BatchDetail {
  id: string;
  batchNo: string;
  method: AssayMethod;
  status: BatchStatus;
  replicateCount: number;
  furnaceNo?: string;
  qcSampleId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  operator?: { id: string; username: string; name: string };
  samples: Array<{
    id: string;
    sampleNo: string;
    customerName: string;
    sampleType: SampleType;
    weightG: string;
    status: SampleStatus;
    tests?: Array<{
      id: string;
      status: string;
      purityPct?: string;
      uncertainty?: string;
      qcPassed?: boolean;
    }>;
  }>;
}

interface SampleToAdd {
  id: string;
  sampleNo: string;
  customerName: string;
  sampleType: SampleType;
  weightG: string;
  status: SampleStatus;
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [addSamplesOpen, setAddSamplesOpen] = useState(false);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);
  const [fireAssayOpen, setFireAssayOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackForm] = Form.useForm();

  // 批次详情
  const { data: batch, isLoading, error } = useQuery<BatchDetail>({
    queryKey: ['batch', id],
    queryFn: async () => (await api.get(`/batches/${id}`)).data,
    enabled: !!id,
  });

  // 可加入的样品(状态 = RECEIVED 且未分批,支持按编号/客户搜索)
  const [sampleSearch, setSampleSearch] = useState('');
  const { data: availableSamples } = useQuery({
    queryKey: ['available-samples', sampleSearch],
    queryFn: async () => {
      const params: any = { status: 'RECEIVED', pageSize: 100 };
      if (sampleSearch) params.sampleNo = sampleSearch;
      const r = await api.get('/samples', { params });
      // 过滤掉已分批的(后端查询可能不过滤)
      return r.data.data.filter((s: SampleToAdd) => s.status === 'RECEIVED');
    },
    enabled: addSamplesOpen,
  });

  // 称重完成回调:关闭弹窗 + 推进批次到 CALCULATING
  const handleFireAssayComplete = async () => {
    setFireAssayOpen(false);
    // 重新查 test 列表获取 testId(因为称重后 test.purityPct 已有)
    qc.invalidateQueries({ queryKey: ['batch', id] });
    // 推进到 CALCULATING
    await transitionMut.mutateAsync({ action: 'ADVANCE' });
  };

  // 工艺参数表单(MIXING→ANNEALING 状态推进时弹出)
  const [processForm] = Form.useForm();

  // 状态推进(支持 process 工艺参数)
  const transitionMut = useMutation({
    mutationFn: async (payload: { action: string; process?: Record<string, string> }) =>
      (await api.post(`/batches/${id}/transition`, payload)).data,
    onSuccess: () => {
      message.success('✅ 状态推进成功');
      qc.invalidateQueries({ queryKey: ['batch', id] });
      setConfirmAction(null);
      processForm.resetFields();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '推进失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setConfirmAction(null);
    },
  });

  // 加入样品
  const addSamplesMut = useMutation({
    mutationFn: async (sampleIds: string[]) =>
      (await api.post(`/batches/${id}/samples`, { sampleIds })).data,
    onSuccess: () => {
      message.success(`✅ 已加入 ${selectedSampleIds.length} 个样品`);
      qc.invalidateQueries({ queryKey: ['batch', id] });
      qc.invalidateQueries({ queryKey: ['available-samples'] });
      setAddSamplesOpen(false);
      setSelectedSampleIds([]);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '加入失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // 回退上一工序
  const rollbackMut = useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/batches/${id}/rollback`, { reason })).data,
    onSuccess: (b) => {
      message.success(`批次已回退到 ${BATCH_STATUS_LABEL[b.status as BatchStatus] ?? b.status}`);
      setRollbackOpen(false);
      rollbackForm.resetFields();
      qc.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '回退失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // 从批次移除样品(批次未开始检测前)
  const removeSampleMut = useMutation({
    mutationFn: async (sampleId: string) =>
      (await api.post(`/batches/${id}/samples/remove`, { sampleIds: [sampleId] })).data,
    onSuccess: () => {
      message.success('样品已从批次移除(恢复为已接收)');
      qc.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '移除失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <Spin tip="加载中..." style={{ width: '100%' }} />
      </Card>
    );
  }

  if (error || !batch) {
    return (
      <Card>
        <Alert
          type="error"
          message="批次不存在或加载失败"
          description={(error as any)?.message}
          action={<Button onClick={() => navigate('/batches')}>返回列表</Button>}
        />
      </Card>
    );
  }

  const next = NEXT_ACTION[batch.status];
  const currentStep = BATCH_FLOW.indexOf(batch.status);
  const isRejected = batch.status === 'REJECTED';
  const isCompleted = batch.status === 'COMPLETED';

  // 当前进度步骤(状态时间线)
  const flowItems = BATCH_FLOW.map((s, i) => ({
    status: s,
    label: BATCH_STATUS_LABEL[s],
    done: i < currentStep || isCompleted,
    current: i === currentStep && !isCompleted,
  }));

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/batches')}
            />
            <Title level={4} style={{ margin: 0 }}>
              批次详情
            </Title>
            <Tag color="blue">{batch.batchNo}</Tag>
            <Tag color={BATCH_STATUS_COLOR[batch.status]}>
              {BATCH_STATUS_LABEL[batch.status]}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            {/* 状态推进按钮 */}
            {!isCompleted && !isRejected && next && (
              <Button
                type={next.type === 'danger' ? 'default' : 'primary'}
                danger={next.type === 'danger'}
                icon={next.type === 'danger' ? <CloseCircleOutlined /> : <PlayCircleOutlined />}
                loading={transitionMut.isPending}
                onClick={() => {
                  // WEIGHING 状态:先弹称重录入表单,称重完成后再推进
                  if (batch.status === 'WEIGHING' && batch.method === 'FIRE_ASSAY') {
                    setFireAssayOpen(true);
                    return;
                  }
                  // 非火试金(ICP 等)在 WEIGHING 时:提示去检测任务页录入元素结果
                  if (batch.status === 'WEIGHING' && batch.method !== 'FIRE_ASSAY') {
                    Modal.confirm({
                      title: '非火试金方法无需称重',
                      content: 'ICP 等方法应在「检测任务」页完成多元素录入与检测完成操作,随后回到本页推进。现在跳转?',
                      okText: '去检测任务页',
                      cancelText: '留在本页',
                      onOk: () => navigate('/tests'),
                    });
                    return;
                  }
                  setConfirmAction({ action: next.action, label: next.label });
                }}
              >
                {next.label}
              </Button>
            )}
            {/* 驳回按钮(PENDING 之后任意状态可驳回) */}
            {!isCompleted && !isRejected && batch.status !== 'PENDING' && (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() =>
                  setConfirmAction({ action: 'REJECT', label: '驳回批次' })
                }
              >
                驳回
              </Button>
            )}
            {/* 回退上一工序(仅中间状态,原因必填) */}
            {!isCompleted && !isRejected && batch.status !== 'PENDING' && (
              <Popconfirm
                title="回退上一工序"
                description="回退将撤销上一步工序状态(审计留痕),工艺参数保留。"
                onConfirm={() => setRollbackOpen(true)}
              >
                <Button icon={<UndoOutlined />}>回退工序</Button>
              </Popconfirm>
            )}
            <Button
              icon={<PlusOutlined />}
              onClick={() => setAddSamplesOpen(true)}
              disabled={isCompleted || isRejected}
            >
              加入样品
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '总览',
              children: (
                <Row gutter={24}>
                  <Col span={14}>
                    <Card type="inner" title="批次信息">
                      <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="批次编号">
                          <Text strong>{batch.batchNo}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="检测方法">
                          <Tag
                            color={
                              batch.method === 'FIRE_ASSAY' ? 'volcano' : 'blue'
                            }
                            icon={
                              batch.method === 'FIRE_ASSAY' ? (
                                <FireOutlined />
                              ) : (
                                <ExperimentOutlined />
                              )
                            }
                          >
                            {METHOD_LABEL[batch.method]}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="平行样数">
                          {batch.replicateCount} 份
                        </Descriptions.Item>
                        <Descriptions.Item label="试金炉号">
                          {batch.furnaceNo ?? '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="操作员">
                          {batch.operator?.name ?? '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="QC 标准物质">
                          {batch.qcSampleId ? (
                            <Tag color="green">已关联</Tag>
                          ) : (
                            <Tag>未关联</Tag>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {new Date(batch.createdAt).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                        <Descriptions.Item label="开始时间">
                          {batch.startedAt
                            ? new Date(batch.startedAt).toLocaleString('zh-CN')
                            : '未开始'}
                        </Descriptions.Item>
                        <Descriptions.Item label="完成时间">
                          {batch.completedAt
                            ? new Date(batch.completedAt).toLocaleString('zh-CN')
                            : '未完成'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>

                  <Col span={10}>
                    <Card type="inner" title="状态时间线">
                      <Timeline
                        items={flowItems.map((it) => ({
                          color: it.done
                            ? 'green'
                            : it.current
                            ? 'blue'
                            : 'gray',
                          dot: it.current ? <ClockCircleOutlined /> : undefined,
                          children: (
                            <Text
                              type={
                                it.done || it.current ? undefined : 'secondary'
                              }
                              strong={it.current}
                            >
                              {it.label}
                            </Text>
                          ),
                        }))}
                      />
                      {isRejected && (
                        <Alert
                          type="error"
                          message="批次已驳回"
                          description="请联系 QA 经理处理"
                          showIcon
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'samples',
              label: `样品 (${batch.samples.length})`,
              children: (
                <Card type="inner" title="批次内样品">
                  {batch.samples.length === 0 ? (
                    <Empty description="尚未加入样品" />
                  ) : (
                    <Table
                      rowKey="id"
                      dataSource={batch.samples}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '样品编号',
                          dataIndex: 'sampleNo',
                          width: 140,
                        },
                        {
                          title: '客户',
                          dataIndex: 'customerName',
                          width: 200,
                        },
                        {
                          title: '类型',
                          dataIndex: 'sampleType',
                          width: 100,
                          render: (t: SampleType) =>
                            SAMPLE_TYPE_LABEL[t] ?? t,
                        },
                        {
                          title: '重量(g)',
                          dataIndex: 'weightG',
                          width: 100,
                          align: 'right' as const,
                          render: (v: string) => parseFloat(v).toFixed(4),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 110,
                          render: (s: SampleStatus) => (
                            <Tag color={SAMPLE_STATUS_COLOR[s]}>
                              {SAMPLE_STATUS_LABEL[s] ?? s}
                            </Tag>
                          ),
                        },
                        {
                          title: '操作',
                          width: 110,
                          fixed: 'right' as const,
                          render: (_: any, s: { id: string; sampleNo: string }) => (
                            <Space size={4}>
                              <Button type="link" size="small" onClick={() => navigate(`/samples/${s.id}`)}>详情</Button>
                              {(batch.status === 'PENDING' || batch.status === 'MIXING') && (
                                <Popconfirm
                                  title="从批次移除样品"
                                  description={`移除 ${s.sampleNo}?样品将恢复为「已接收」。`}
                                  onConfirm={() => removeSampleMut.mutate(s.id)}
                                >
                                  <Button size="small" danger icon={<DeleteOutlined />} loading={removeSampleMut.isPending}>移除</Button>
                                </Popconfirm>
                              )}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  )}
                </Card>
              ),
            },
            {
              key: 'process',
              label: '工艺参数',
              children: (
                <Card
                  type="inner"
                  title={
                    <Space>
                      <FireOutlined />
                      <span>火试金工艺参数(已录入)</span>
                    </Space>
                  }
                  extra={
                    <Tag color="blue">
                      {batch.samples.length} 个样品 × {batch.replicateCount} 份平行样
                    </Tag>
                  }
                >
                  {batch.samples.length === 0 ? (
                    <Empty description="尚未加入样品" />
                  ) : (
                    <ProcessHistoryView batchId={batch.id} />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Card>

      {/* 加入样品弹窗 */}
      <Modal
        title="加入样品到批次"
        open={addSamplesOpen}
        onCancel={() => setAddSamplesOpen(false)}
        onOk={() => addSamplesMut.mutate(selectedSampleIds)}
        confirmLoading={addSamplesMut.isPending}
        width={800}
        okText={`加入 (${selectedSampleIds.length})`}
        okButtonProps={{ disabled: selectedSampleIds.length === 0 }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="只能加入状态为「已接收」且未分批的样品"
        />
        <Input.Search
          allowClear
          placeholder="按样品编号搜索(如 260823-…)"
          value={sampleSearch}
          onChange={(e) => setSampleSearch(e.target.value)}
          style={{ marginBottom: 12, maxWidth: 360 }}
        />
        <Table
          rowKey="id"
          size="small"
          dataSource={availableSamples ?? []}
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys: selectedSampleIds,
            onChange: (keys) => setSelectedSampleIds(keys as string[]),
          }}
          columns={[
            { title: '样品编号', dataIndex: 'sampleNo', width: 140 },
            { title: '客户', dataIndex: 'customerName', width: 200 },
            {
              title: '类型',
              dataIndex: 'sampleType',
              width: 100,
              render: (t: SampleType) => SAMPLE_TYPE_LABEL[t] ?? t,
            },
            {
              title: '重量(g)',
              dataIndex: 'weightG',
              width: 100,
              align: 'right' as const,
              render: (v: string) => parseFloat(v).toFixed(4),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (s: SampleStatus) => (
                <Tag color={SAMPLE_STATUS_COLOR[s]}>
                  {SAMPLE_STATUS_LABEL[s] ?? s}
                </Tag>
              ),
            },
          ]}
        />
      </Modal>

      {/* 状态推进 + 工艺参数录入弹窗 */}
      <Modal
        title="状态推进确认"
        open={!!confirmAction}
        onCancel={() => {
          setConfirmAction(null);
          processForm.resetFields();
        }}
        onOk={async () => {
          if (!confirmAction) return;
          // 火试金 + MIXING→ANNEALING 任意推进时,收集工艺参数
          const needsProcess =
            batch.method === 'FIRE_ASSAY' &&
            ['MIXING', 'FUSING', 'CUPELLING', 'PARTING', 'ANNEALING'].includes(batch.status) &&
            confirmAction.action === 'ADVANCE';
          let process: Record<string, string> | undefined;
          if (needsProcess) {
            const values = await processForm.validateFields().catch(() => null);
            if (values) process = values as Record<string, string>;
          }
          transitionMut.mutate({ action: confirmAction.action, process });
        }}
        confirmLoading={transitionMut.isPending}
        okText="确认推进"
        cancelText="取消"
        width={650}
      >
        {confirmAction && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Paragraph>
              您即将执行操作: <Text strong>{confirmAction.label}</Text>
            </Paragraph>
            <Paragraph type="secondary">
              批次 <Text code>{batch.batchNo}</Text> 当前状态:{' '}
              <Tag color={BATCH_STATUS_COLOR[batch.status]}>
                {BATCH_STATUS_LABEL[batch.status]}
              </Tag>
            </Paragraph>

            {/* 火试金 + 工艺推进时显示工艺参数录入表单 */}
            {batch.method === 'FIRE_ASSAY' &&
              ['MIXING', 'FUSING', 'CUPELLING', 'PARTING', 'ANNEALING'].includes(batch.status) &&
              confirmAction.action === 'ADVANCE' && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Alert
                    type="info"
                    showIcon
                    message="录入本工序工艺参数(全部可选)"
                    description="按当前状态填实际有意义的几项,数据自动入库到 fire_assay_details"
                  />
                  <Form form={processForm} layout="vertical" style={{ marginTop: 12 }}>
                    {batch.status === 'MIXING' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="混料温度 ℃" name="mixingTempC">
                            <InputNumber min={0} max={1500} step={1} style={{ width: '100%' }} placeholder="如:1050" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="混料时长 min" name="mixingDurationMin">
                            <InputNumber min={0} max={300} step={1} style={{ width: '100%' }} placeholder="如:30" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                    {batch.status === 'FUSING' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="熔融温度 ℃" name="fusingTempC">
                            <InputNumber min={0} max={1500} step={1} style={{ width: '100%' }} placeholder="如:1100" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="熔融时长 min" name="fusingDurationMin">
                            <InputNumber min={0} max={300} step={1} style={{ width: '100%' }} placeholder="如:60" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                    {batch.status === 'CUPELLING' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="灰吹温度 ℃" name="cupellationTempC">
                            <InputNumber min={0} max={1500} step={1} style={{ width: '100%' }} placeholder="如:900" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="灰吹时长 min" name="cupellationDurationMin">
                            <InputNumber min={0} max={300} step={1} style={{ width: '100%' }} placeholder="如:45" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                    {batch.status === 'PARTING' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="分金硝酸浓度" name="partingAcid">
                            <Input placeholder="如:1:1 / 1:2 / 1:4" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="分金时长 min" name="partingDurationMin">
                            <InputNumber min={0} max={300} step={1} style={{ width: '100%' }} placeholder="如:30" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                    {batch.status === 'ANNEALING' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="退火温度 ℃" name="annealingTempC">
                            <InputNumber min={0} max={1500} step={1} style={{ width: '100%' }} placeholder="如:800" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="退火时长 min" name="annealingDurationMin">
                            <InputNumber min={0} max={300} step={1} style={{ width: '100%' }} placeholder="如:30" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </Form>
                </>
              )}

            {confirmAction.action === 'REJECT' && (
              <Alert
                type="error"
                message="驳回后无法恢复,需要 QA 经理处理"
                showIcon
              />
            )}
            {confirmAction.action === 'COMPLETE' && (
              <Alert
                type="success"
                message="完成后批次进入归档状态,样品进入检测后流程"
                showIcon
              />
            )}
          </Space>
        )}
      </Modal>

      {/* 回退工序弹窗 */}
      <Modal
        title="回退上一工序"
        open={rollbackOpen}
        onCancel={() => setRollbackOpen(false)}
        onOk={() => rollbackForm.submit()}
        confirmLoading={rollbackMut.isPending}
        okText="确认回退"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Alert
          type="warning"
          showIcon
          message="回退将撤销上一步工序状态(如 熔融→混料),工艺参数保留并审计留痕;不可连续回退。"
          style={{ marginBottom: 16 }}
        />
        <Form form={rollbackForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(v) => rollbackMut.mutate(v.reason)}>
          <Form.Item label="回退原因" name="reason" rules={[{ required: true, message: '回退原因必填' }]}>
            <Input.TextArea rows={3} placeholder="如:工艺参数录入错误,需退回上一步修正" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 火试金称重录入弹窗(WEIGHING 状态专用) */}
      <FireAssayForm
        open={fireAssayOpen}
        batchNo={batch.batchNo}
        method={batch.method}
        samples={batch.samples.map((s) => ({
          id: s.id,
          sampleNo: s.sampleNo,
          customerName: s.customerName,
          weightG: s.weightG,
          testId: s.tests?.[0]?.id ?? '',
        }))}
        replicateCount={batch.replicateCount}
        onCancel={() => setFireAssayOpen(false)}
        onSuccess={handleFireAssayComplete}
      />
    </div>
  );
}
// =====================================================
// 工艺参数历史子组件(Phase 2 Day 3)
// =====================================================
interface ProcessParamRow {
  testId: string;
  sample: { id: string; sampleNo: string; customerName: string };
  method: string;
  // W3-C: 新独立工艺字段
  mixingTempC: string | null;
  mixingDurationMin: string | null;
  fusingTempC: string | null;
  fusingDurationMin: string | null;
  cupellationTempC: string | null;
  cupellationDurationMin: string | null;
  partingAcid: string | null;
  partingDurationMin: string | null;
  annealingTempC: string | null;
  annealingDurationMin: string | null;
  recordedAt: string;
}

function ProcessHistoryView({ batchId }: { batchId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['batch-process-params', batchId],
    queryFn: async () => (await api.get(`/batches/${batchId}/process-params`)).data,
  });

  // W4: 工艺完成后可一键生成/查看原始记录单(幂等)
  const genRecordMut = useMutation({
    mutationFn: async (testId: string) => (await api.post('/raw-records/generate', { testId })).data,
    onSuccess: (sheet) => {
      message.success(`原始记录单 ${sheet.sheetNo} 已就绪`);
      qc.invalidateQueries({ queryKey: ['batch-process-params', batchId] });
      navigate(`/raw-records/${sheet.id}`);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '生成失败'),
  });

  if (isLoading) {
    return <Spin tip="加载工艺参数..." style={{ width: '100%' }} />;
  }

  const params: ProcessParamRow[] = data?.params ?? [];

  if (params.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="尚无工艺参数"
        description="状态推进时(MIXING → ANNEALING)录入的工艺参数会自动显示在这里"
      />
    );
  }

  return (
    <Table
      rowKey="testId"
      dataSource={params}
      pagination={false}
      size="small"
      columns={[
        {
          title: '样品编号',
          dataIndex: ['sample', 'sampleNo'],
          width: 140,
        },
        {
          title: '客户',
          dataIndex: ['sample', 'customerName'],
          width: 180,
        },
        {
          title: '混料温度 ℃',
          dataIndex: 'mixingTempC',
          width: 100,
          align: 'right' as const,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '熔融温度 ℃',
          dataIndex: 'fusingTempC',
          width: 100,
          align: 'right' as const,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '灰吹温度 ℃',
          dataIndex: 'cupellationTempC',
          width: 100,
          align: 'right' as const,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '分金硝酸',
          dataIndex: 'partingAcid',
          width: 100,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '分金 min',
          dataIndex: 'partingDurationMin',
          width: 100,
          align: 'right' as const,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '退火 min',
          dataIndex: 'annealingDurationMin',
          width: 100,
          align: 'right' as const,
          render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
        },
        {
          title: '记录时间',
          dataIndex: 'recordedAt',
          width: 170,
          render: (v: string) => new Date(v).toLocaleString('zh-CN'),
        },
        {
          title: '操作',
          width: 100,
          fixed: 'right' as const,
          render: (_: any, r: ProcessParamRow) => (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<FileTextOutlined />}
              loading={genRecordMut.isPending}
              onClick={() => genRecordMut.mutate(r.testId)}
            >记录单</Button>
          ),
        },
      ]}
    />
  );
}
