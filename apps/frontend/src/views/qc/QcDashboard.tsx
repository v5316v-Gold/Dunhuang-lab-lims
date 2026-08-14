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
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { api } from '../../data/api';

const { Title, Text, Paragraph } = Typography;

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

export default function QcDashboard() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['qc-summary', days],
    queryFn: async () => (await api.get(`/qc/summary`, { params: { days } })).data as QcSummary,
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
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            <Title level={4} style={{ margin: 0 }}>
              QC 质量控制仪表盘
            </Title>
            <Text type="secondary">Phase 2 · Day 5</Text>
          </Space>
        }
        extra={
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
        }
      >
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

        {/* 违规警告 */}
        {data?.violations && data.violations.length > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={`发现 ${data.violations.length} 条 QC 失败记录`}
            description={
              <div>
                最近 QC 失败:&nbsp;
                {data.violations.slice(0, 3).map((v, i) => (
                  <Tag key={v.id} color="red">
                    {v.element} 测值 {v.measured}{' '}
                    {v.westgardRule && <span>(规则: {v.westgardRule})</span>}
                  </Tag>
                ))}
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
                  render: (v: boolean) =>
                    v ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        通过
                      </Tag>
                    ) : (
                      <Tag color="red" icon={<CloseCircleOutlined />}>
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
      </Card>
    </div>
  );
}