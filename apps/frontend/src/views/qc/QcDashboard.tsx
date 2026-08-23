// =====================================================
// QC Dashboard — Phase 2 Day 5
// Westgard 规则 + Levey-Jennings 趋势 + 通过率统计
// =====================================================

import { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Table,
  Progress,
  Select,
  Space,
  Typography,
  Alert,
  Empty,
  Badge,
  Divider,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Descriptions,
  App,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';

const { Title, Text, Paragraph } = Typography;

// 后端 QcType 枚举(apps/backend/prisma/schema.prisma §enum QcType)
const QC_TYPE_OPTIONS = [
  { value: 'BLANK', label: '空白' },
  { value: 'PARALLEL', label: '平行样' },
  { value: 'SPIKE', label: '加标' },
  { value: 'STANDARD', label: 'QC 样(标准物质)' },
];

interface QcSummary {
  window: { days: number; since: string };
  total: number;
  passed: number;
  passRate: number;
  byElement: Array<{ element: string; count: number }>;
  recent: Array<{
    id: string;
    element: string;
    measured: string;
    expected: string | null;
    sd: string | null;
    zScore: string | null;
    passed: boolean;
    westgardRule: string | null;
    measuredAt: string;
    test: {
      id: string;
      purityPct: string | null;
      sample: { sampleNo: string; customerName: string } | null;
    } | null;
  }>;
  violations: Array<{
    id: string;
    element: string;
    measured: string;
    westgardRule: string | null;
    measuredAt: string;
  }>;
}

// 测试任务远程搜索下拉
function TestSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['qc-tests', keyword],
    queryFn: async () => {
      const params: Record<string, unknown> = { pageSize: 30 };
      if (keyword.trim()) params.sampleId = keyword.trim();
      return (await api.get('/tests', { params })).data as {
        data: Array<{
          id: string;
          method: string;
          sample?: { sampleNo: string } | null;
        }>;
      };
    },
  });
  const options = (data?.data ?? []).map((t) => ({
    value: t.id,
    label: `${t.sample?.sampleNo ?? '未知样品'} · ${t.method === 'FIRE_ASSAY' ? '火试金' : t.method}`,
  }));
  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={onChange}
      loading={isLoading}
      options={options}
      placeholder="搜索样品编号(可选,关联已有检测)"
      filterOption={false}
      onSearch={(v) => setKeyword(v)}
      notFoundContent="暂无检测任务"
      style={{ width: '100%' }}
    />
  );
}

export default function QcDashboard() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [violationDetail, setViolationDetail] = useState<QcSummary['violations'][number] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['qc-summary', days],
    queryFn: async () => (await api.get(`/qc/summary`, { params: { days } })).data as QcSummary,
  });

  const createMut = useMutation({
    mutationFn: async (values: any) => {
      const dto: Record<string, string> = {
        qcType: values.qcType,
        element: String(values.element ?? '').trim(),
        measured: String(values.measured),
      };
      if (values.expected !== undefined && values.expected !== null && values.expected !== '') {
        dto.expected = String(values.expected);
      }
      if (values.sd !== undefined && values.sd !== null && values.sd !== '') {
        dto.sd = String(values.sd);
      }
      if (values.testId) dto.testId = values.testId;
      return (await api.post('/qc/measurements', dto)).data;
    },
    onSuccess: (res: any) => {
      if (res?.passed) {
        message.success('QC 测量已记录,规则通过');
      } else {
        message.warning(`QC 测量已记录,但触发 Westgard ${res?.westgard?.violatedRule ?? '规则'}`);
      }
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['qc-summary'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '提交失败'),
  });

  // 趋势图配置(Levey-Jennings)
  const trendOption = (() => {
    if (!data?.recent.length) return null;
    // 按元素分组
    const byElement: Record<string, { date: string; value: number; passed: boolean; rule: string | null }[]> = {};
    for (const r of data.recent) {
      if (!byElement[r.element]) byElement[r.element] = [];
      byElement[r.element].push({
        date: new Date(r.measuredAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        value: parseFloat(r.measured),
        passed: r.passed,
        rule: r.westgardRule,
      });
    }
    const series = Object.entries(byElement).map(([el, points]) => ({
      name: el,
      type: 'line' as const,
      data: points.map((p) => [p.date, p.value, p.passed]),
      symbol: (val: number[]) => (val[2] ? 'circle' : 'diamond'),
      symbolSize: 10,
      itemStyle: {
        color: (params: { value: number[] }) => (params.value[2] ? '#52c41a' : '#cf1322'),
      },
    }));
    return {
      title: { text: 'Levey-Jennings 趋势图', left: 'left' },
      tooltip: { trigger: 'axis' },
      legend: { data: Object.keys(byElement) },
      grid: { left: 50, right: 30, top: 50, bottom: 40 },
      xAxis: { type: 'category', data: data.recent.map((r) => new Date(r.measuredAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })) },
      yAxis: { type: 'value', name: '测量值', scale: true },
      series,
    };
  })();

  return (
    <div>
      <PageHeader
        title="QC 监控"
        subtitle="CNAS §7.7 期间核查 · Westgard 多规则"
        icon={<ExperimentOutlined />}
        extra={
          <Space>
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: '最近 7 天' },
                { value: 30, label: '最近 30 天' },
                { value: 90, label: '最近 90 天' },
              ]}
              style={{ width: 150 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              录入 QC 测量
            </Button>
          </Space>
        }
      />
        {/* 顶部统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总测量数"
                value={data?.total ?? 0}
                suffix="次"
                valueStyle={{ color: 'var(--gold)' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="通过"
                value={data?.passed ?? 0}
                suffix="次"
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="失败"
                value={(data?.total ?? 0) - (data?.passed ?? 0)}
                suffix="次"
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="通过率"
                value={data?.passRate ?? 0}
                precision={2}
                suffix="%"
                valueStyle={{
                  color: (data?.passRate ?? 0) >= 95 ? '#52c41a' : '#cf1322',
                }}
              />
              <Progress
                percent={data?.passRate ?? 0}
                showInfo={false}
                strokeColor={(data?.passRate ?? 0) >= 95 ? '#52c41a' : '#cf1322'}
              />
            </Card>
          </Col>
        </Row>

        {/* 按元素统计 */}
        {data?.byElement && data.byElement.length > 0 && (
          <Card size="small" style={{ marginBottom: 16 }} title="按元素统计">
            <Space wrap>
              {data.byElement.map((b) => (
                <Tag key={b.element} color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
                  {b.element} <strong style={{ marginLeft: 4 }}>{b.count}</strong> 次
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {/* 违规警告 — 失败项可点击查看详情 */}
        {data?.violations && data.violations.length > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={`发现 ${data.violations.length} 条 QC 失败记录`}
            description={
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>点击失败项查看详情:</Text>
                {data.violations.slice(0, 3).map((v) => (
                  <Tag
                    key={v.id}
                    color="red"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViolationDetail(v)}
                  >
                    {v.element} 测值 {v.measured}{' '}
                    {v.westgardRule && <span>(规则: {v.westgardRule})</span>}
                  </Tag>
                ))}
                {data.violations.length > 3 && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    等 {data.violations.length} 条…
                  </Text>
                )}
              </div>
            }
          />
        )}

        {/* Levey-Jennings 趋势图 */}
        {trendOption && (
          <Card title="Levey-Jennings 趋势图(Westgard 多规则)" style={{ marginBottom: 16 }}>
            <ReactECharts option={trendOption} style={{ height: 400 }} />
            <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
              <Space>
                <Badge color="green" text="绿色圆点 = QC 通过" />
                <Badge color="red" text="红色菱形 = QC 失败" />
                <Text>Westgard 规则: 1₃s / 2₂s / R₄s / 4₁s / 10x</Text>
              </Space>
            </Paragraph>
          </Card>
        )}

        {/* 最近测量记录 */}
        <Card title="最近 QC 测量记录" size="small">
          {data?.recent && data.recent.length > 0 ? (
            <Table
              rowKey="id"
              size="small"
              dataSource={data.recent}
              pagination={{ pageSize: 20 }}
              columns={[
                {
                  title: '测量时间',
                  dataIndex: 'measuredAt',
                  width: 150,
                  render: (v: string) => new Date(v).toLocaleString('zh-CN'),
                },
                {
                  title: '元素',
                  dataIndex: 'element',
                  width: 70,
                  render: (v: string) => <Tag color="blue">{v}</Tag>,
                },
                {
                  title: '测量值',
                  dataIndex: 'measured',
                  width: 130,
                  align: 'right' as const,
                  render: (v: string) => <Text strong>{parseFloat(v).toFixed(6)}</Text>,
                },
                {
                  title: '期望值',
                  dataIndex: 'expected',
                  width: 130,
                  align: 'right' as const,
                  render: (v: string | null) => (v ? parseFloat(v).toFixed(4) : '-'),
                },
                {
                  title: 'Z-score',
                  dataIndex: 'zScore',
                  width: 100,
                  align: 'right' as const,
                  render: (v: string | null) => {
                    if (!v) return <Text type="secondary">-</Text>;
                    const z = parseFloat(v);
                    const color = Math.abs(z) > 2 ? 'red' : Math.abs(z) > 1 ? 'orange' : 'green';
                    return <Tag color={color}>{z.toFixed(2)}</Tag>;
                  },
                },
                {
                  title: '样品',
                  dataIndex: ['test', 'sample', 'sampleNo'],
                  width: 130,
                  render: (v: string | undefined) => v ?? <Text type="secondary">-</Text>,
                },
                {
                  title: '客户',
                  dataIndex: ['test', 'sample', 'customerName'],
                  width: 160,
                  render: (v: string | undefined) => v ?? <Text type="secondary">-</Text>,
                },
                {
                  title: '结果',
                  dataIndex: 'passed',
                  width: 90,
                  fixed: 'right' as const,
                  render: (v: boolean, r: QcSummary['recent'][number]) =>
                    v ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        通过
                      </Tag>
                    ) : (
                      <Tag
                        color="red"
                        icon={<CloseCircleOutlined />}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setViolationDetail({
                            id: r.id,
                            element: r.element,
                            measured: r.measured,
                            westgardRule: r.westgardRule,
                            measuredAt: r.measuredAt,
                          })
                        }
                      >
                        失败
                      </Tag>
                    ),
                },
              ]}
            />
          ) : (
            <Empty description="暂无 QC 测量数据" />
          )}
        </Card>

        {/* 录入 QC 测量 Modal */}
        <Modal
          title="录入 QC 测量"
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          onOk={() => createForm.submit()}
          confirmLoading={createMut.isPending}
          okText="提交"
          cancelText="取消"
          width={560}
          destroyOnClose
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="提交后服务端自动计算 Z-score / Westgard 多规则 / OOS 触发"
          />
          <Form
            form={createForm}
            layout="vertical"
            onFinish={(v) => createMut.mutate(v)}
            initialValues={{ qcType: 'STANDARD', element: 'Au' }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="QC 类型" name="qcType" rules={[{ required: true }]}>
                  <Select options={QC_TYPE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="元素" name="element" rules={[{ required: true, message: '请输入元素符号' }]}>
                  <Input placeholder="如 Au / Ag / Cu" maxLength={10} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="测量值" name="measured" rules={[{ required: true, message: '请输入测量值' }]}>
                  <InputNumber step={0.0001} style={{ width: '100%' }} placeholder="如 99.95" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="标准偏差(SD)"
                  name="sd"
                  rules={[{ required: true, message: 'SD 不能为 0(Westgard 计算依赖)' }]}
                  tooltip="必须 > 0,服务端用于算 Z-score"
                >
                  <InputNumber step={0.001} min={0.000001} style={{ width: '100%' }} placeholder="如 0.05" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="期望值(可选)" name="expected">
              <InputNumber step={0.0001} style={{ width: '100%' }} placeholder="标准物质认证值,留空则不计算回收率" />
            </Form.Item>
            <Form.Item label="关联检测任务(可选)" name="testId" tooltip="若本次 QC 关联某已检测/检测中的任务,选择后会触发 OOS 流程">
              <TestSelect />
            </Form.Item>
          </Form>
        </Modal>

        {/* 违规详情 Modal(无详情路由时使用) */}
        <Modal
          title={`QC 违规详情 · ${violationDetail?.element ?? ''}`}
          open={!!violationDetail}
          onCancel={() => setViolationDetail(null)}
          footer={<Button onClick={() => setViolationDetail(null)}>关闭</Button>}
          width={520}
        >
          {violationDetail && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="违规 ID">{violationDetail.id}</Descriptions.Item>
              <Descriptions.Item label="元素">{violationDetail.element}</Descriptions.Item>
              <Descriptions.Item label="测量值">{violationDetail.measured}</Descriptions.Item>
              <Descriptions.Item label="Westgard 规则">
                <Tag color="red">{violationDetail.westgardRule ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="测量时间">
                {new Date(violationDetail.measuredAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="处理建议">
                按 CNAS §7.10 不符合工作流程:复测 → 调查 → 启动 OOS/NC。
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
        </div>
  );
}