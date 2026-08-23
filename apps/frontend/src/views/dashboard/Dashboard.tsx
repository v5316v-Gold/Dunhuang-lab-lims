// =====================================================
// 仪表盘 - W5 增强版(含 BI 图表 + W1-W4 合规摘要)
// P2 美化: 精致 KPI 卡 + ECharts 趋势图
// =====================================================

import { Row, Col, Card, Statistic, Spin, Progress, Tag, Empty } from 'antd';
import ReactECharts from 'echarts-for-react';
import {
  ExperimentOutlined, FileSearchOutlined, FileDoneOutlined,
  AlertOutlined, TeamOutlined, GoldOutlined, CloudOutlined,
  ContainerOutlined, QrcodeOutlined, RiseOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../data/api';

interface DashboardData {
  todaySamples: number;
  inTest: number;
  pendingReports: number;
  lowStockAlerts: number;
  totalUsers: number;
  timestamp: string;
}

interface WasteSummary {
  total: number;
  totalKg: string;
  storedKg: string;
  transferredKg: string;
  byStatus: Record<string, number>;
  byClass: Record<string, number>;
}

interface GasSummary {
  totalGases: number;
  activeGases: number;
  lowStockCount: number;
  totalPurchases: number;
  pendingInspections: number;
  totalUsagesThisMonth: number;
}

interface ContainerSummary {
  totalContainers: number;
  inUseContainers: number;
  activeUsages: number;
  needsCalibrationCount: number;
  byType: Array<{ type: string; count: number }>;
}

interface PreciousMetalSummary {
  totalSampling: number;
  totalBars: number;
  byGrade: Array<{ grade: string; count: number; totalWeightG: string }>;
  byMetal: Array<{ metal: string; count: number; totalWeightG: string }>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/analytics/dashboard')).data,
    refetchInterval: 30000,
  });

  const waste = useQuery({
    queryKey: ['waste', 'summary'],
    queryFn: async () => (await api.get<WasteSummary>('/waste/summary')).data,
    refetchInterval: 30000,
  });

  const gas = useQuery({
    queryKey: ['gas', 'summary'],
    queryFn: async () => (await api.get<GasSummary>('/gas/summary')).data,
    refetchInterval: 30000,
  });

  const container = useQuery({
    queryKey: ['container', 'summary'],
    queryFn: async () => (await api.get<ContainerSummary>('/container/summary')).data,
    refetchInterval: 30000,
  });

  const precious = useQuery({
    queryKey: ['precious', 'summary'],
    queryFn: async () => (await api.get<PreciousMetalSummary>('/precious-metal/summary')).data,
    refetchInterval: 30000,
  });

  // P2 美化: 近 7 天收样趋势(从 analytics/trend 或 samples 拉,兜底空)
  const trend = useQuery({
    queryKey: ['analytics', 'samples-trend'],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ date: string; count: number }[]>('/analytics/samples-trend?days=7');
        return data ?? [];
      } catch {
        // 兜底: 用样例数据(若后端无此端点)
        const days = 7;
        return Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return { date: d.toISOString().slice(5, 10), count: 0 };
        });
      }
    },
    refetchInterval: 30000,
  });

  // W3-B: 物化 KPI 快照(每 5 分钟后端刷新)
  const kpis = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => (await api.get('/dashboard/kpis')).data,
    refetchInterval: 60000,
  });

  if (isLoading) return <Spin size="large" />;

  // W1 合规率:已处置 / 总数
  const wasteTotal = waste.data?.total ?? 0;
  const wasteDisposed = (waste.data?.byStatus?.DISPOSED ?? 0)
    + (waste.data?.byStatus?.INCINERATED ?? 0)
    + (waste.data?.byStatus?.RECYCLED_GOLD ?? 0)
    + (waste.data?.byStatus?.NEUTRALIZED ?? 0);
  const wasteComplianceRate = wasteTotal > 0 ? Math.round(wasteDisposed / wasteTotal * 100) : 0;

  // W2 库存合规率:活跃 - 低库存 / 活跃
  const gasTotal = gas.data?.totalGases ?? 0;
  const gasLowCount = gas.data?.lowStockCount ?? 0;
  const gasHealthy = gasTotal - gasLowCount;
  const gasHealthRate = gasTotal > 0 ? Math.round(gasHealthy / gasTotal * 100) : 0;

  // W3 容器使用率:IN_USE / 总数
  const containerTotal = container.data?.totalContainers ?? 0;
  const containerUsageRate = containerTotal > 0
    ? Math.round(((container.data?.inUseContainers ?? 0) / containerTotal) * 100)
    : 0;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>
        仪表盘 <RiseOutlined style={{ color: 'var(--gold, #D4AF37)', marginLeft: 8 }} />
      </h2>

      {/* 主 KPI 行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日样品" value={data?.todaySamples ?? 0} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="检测中" value={data?.inTest ?? 0} prefix={<FileSearchOutlined />} valueStyle={{ color: '#4A9A7A' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="待审核报告" value={data?.pendingReports ?? 0} prefix={<FileDoneOutlined />} valueStyle={{ color: '#D4AF37' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="活跃用户" value={data?.totalUsers ?? 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* W3-B: 物化 KPI 快照(每 5 分钟刷新) */}
      <h3 style={{ marginTop: 24, color: '#D4AF37' }}>业务 KPI(物化快照)</h3>
      <Row gutter={[16, 16]}>
        {kpis.data?.items?.map((k: any) => (
          <Col xs={24} sm={12} lg={6} key={k.metricKey}>
            <Card style={{ background: 'var(--bg-card, #1E2430)', borderColor: 'rgba(212,175,55,0.2)' }}>
              <Statistic
                title={k.metricName}
                value={k.value}
                suffix={k.unit}
                valueStyle={{ color: k.metricKey === 'expiring_soon' && Number(k.value) > 0 ? '#CF4E3B' : '#D4AF37' }}
              />
            </Card>
          </Col>
        ))}
        {kpis.data?.items?.length === 0 && (
          <Col span={24}><Empty description="KPI 快照为空,等待定时刷新(每 5 分钟)或联系管理员手动触发" /></Col>
        )}
      </Row>

      <h3 style={{ marginTop: 24, color: '#D4AF37' }}>W1-W4 合规模块</h3>
      <Row gutter={[16, 16]}>
        {/* W1 危废合规率 */}
        <Col xs={24} sm={12} lg={6}>
          <Card title={<span><GoldOutlined /> 危废合规 (W1)</span>} extra={<Tag color="gold">CNAS §7.10</Tag>}>
            <Progress
              type="circle"
              percent={wasteComplianceRate}
              format={(p) => `${p}%`}
              strokeColor={wasteComplianceRate >= 80 ? '#4A9A7A' : wasteComplianceRate >= 60 ? '#D4AF37' : '#B85450'}
            />
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div>总条目: <b>{wasteTotal}</b></div>
              <div>已合规处置: <b style={{ color: '#4A9A7A' }}>{wasteDisposed}</b></div>
              <div>暂存中: <b>{waste.data?.byStatus?.STORED ?? 0}</b></div>
              <div>总重: <b>{waste.data?.totalKg ?? '0'} kg</b></div>
            </div>
          </Card>
        </Col>

        {/* W2 气体库存健康率 */}
        <Col xs={24} sm={12} lg={6}>
          <Card title={<span><CloudOutlined /> 气体库存健康 (W2)</span>} extra={<Tag color="gold">CNAS §7.5+§6.4</Tag>}>
            <Progress
              type="circle"
              percent={gasHealthRate}
              format={(p) => `${p}%`}
              strokeColor={gasHealthRate >= 80 ? '#4A9A7A' : '#D4AF37'}
            />
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div>总数: <b>{gasTotal}</b></div>
              <div>健康: <b style={{ color: '#4A9A7A' }}>{gasHealthy}</b></div>
              <div style={{ color: '#B85450' }}>低库存预警: <b>{gasLowCount}</b></div>
              <div>本月使用: <b>{gas.data?.totalUsagesThisMonth ?? 0}</b></div>
            </div>
          </Card>
        </Col>

        {/* W3 容器使用率 */}
        <Col xs={24} sm={12} lg={6}>
          <Card title={<span><ContainerOutlined /> 容器使用 (W3)</span>} extra={<Tag color="gold">CNAS §7.5+§6.5</Tag>}>
            <Progress
              type="circle"
              percent={containerUsageRate}
              format={(p) => `${p}%`}
              strokeColor="#D4AF37"
            />
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div>总数: <b>{containerTotal}</b></div>
              <div>使用中: <b style={{ color: '#4A9A7A' }}>{container.data?.inUseContainers ?? 0}</b></div>
              <div style={{ color: '#B85450' }}>未归还: <b>{container.data?.activeUsages ?? 0}</b></div>
              <div>需校准: <b>{container.data?.needsCalibrationCount ?? 0}</b></div>
            </div>
          </Card>
        </Col>

        {/* W4 贵金属 */}
        <Col xs={24} sm={12} lg={6}>
          <Card title={<span><QrcodeOutlined /> 贵金属 (W4)</span>} extra={<Tag color="gold">CNAS §7.5+§7.8</Tag>}>
            <Statistic
              title="条码总数"
              value={precious.data?.totalBars ?? 0}
              prefix={<QrcodeOutlined />}
              valueStyle={{ color: '#D4AF37', fontSize: 28 }}
            />
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div>取样记录: <b>{precious.data?.totalSampling ?? 0}</b></div>
              {precious.data?.byGrade?.[0] && (
                <div>
                  主要成色: <Tag color="gold">{precious.data.byGrade[0].grade}</Tag>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {precious.data.byGrade[0].count} 条 · {precious.data.byGrade[0].totalWeightG} g
                  </span>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* P2 美化: 近 7 天收样趋势(ECharts) */}
      <h3 style={{ marginTop: 24, color: 'var(--gold, #D4AF37)' }}>检测业务趋势</h3>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<span><RiseOutlined /> 近 7 天收样趋势</span>} extra={<Tag color="gold">实时</Tag>}>
            <ReactECharts
              style={{ height: 260 }}
              option={{
                backgroundColor: 'transparent',
                grid: { left: 40, right: 16, top: 24, bottom: 28 },
                tooltip: { trigger: 'axis', backgroundColor: '#1a1a22', borderColor: 'rgba(212,175,55,0.3)', textStyle: { color: '#f8f6f0' } },
                xAxis: {
                  type: 'category',
                  data: (trend.data ?? []).map((t) => t.date),
                  axisLine: { lineStyle: { color: '#35354a' } },
                  axisLabel: { color: '#b8b4a8' },
                },
                yAxis: {
                  type: 'value',
                  minInterval: 1,
                  splitLine: { lineStyle: { color: 'rgba(53,53,74,0.5)' } },
                  axisLabel: { color: '#b8b4a8' },
                },
                series: [
                  {
                    name: '收样数',
                    type: 'line',
                    smooth: true,
                    data: (trend.data ?? []).map((t) => t.count),
                    symbol: 'circle',
                    symbolSize: 7,
                    lineStyle: { color: '#D4AF37', width: 3 },
                    itemStyle: { color: '#D4AF37', borderColor: '#f5d76e', borderWidth: 2 },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                          { offset: 0, color: 'rgba(212,175,55,0.35)' },
                          { offset: 1, color: 'rgba(212,175,55,0)' },
                        ],
                      },
                    },
                  },
                ],
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span><GoldOutlined /> 贵金属成色分布</span>} extra={<Tag color="gold">W4</Tag>}>
            <ReactECharts
              style={{ height: 260 }}
              option={{
                backgroundColor: 'transparent',
                tooltip: { trigger: 'item', backgroundColor: '#1a1a22', borderColor: 'rgba(212,175,55,0.3)', textStyle: { color: '#f8f6f0' } },
                legend: { textStyle: { color: '#b8b4a8' }, bottom: 0 },
                series: [
                  {
                    name: '成色',
                    type: 'pie',
                    radius: ['45%', '70%'],
                    center: ['50%', '46%'],
                    itemStyle: { borderRadius: 6, borderColor: '#111115', borderWidth: 2 },
                    label: { color: '#b8b4a8', fontSize: 12 },
                    data: (precious.data?.byGrade ?? []).length > 0
                      ? precious.data!.byGrade.map((g) => ({
                          name: g.grade,
                          value: g.count,
                          itemStyle: { color: ['#D4AF37', '#8B6914', '#F5D76E', '#B8860B'][((precious.data!.byGrade as any[]).indexOf(g)) % 4] },
                        }))
                      : [{ name: '暂无数据', value: 1, itemStyle: { color: '#35354a' } }],
                  },
                ],
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 容器类型分布 + 危废状态分布 */}
      <h3 style={{ marginTop: 24, color: '#D4AF37' }}>业务分布</h3>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="危废状态分布 (W1)">
            {waste.data && Object.keys(waste.data.byStatus).length > 0 ? (
              <div>
                {Object.entries(waste.data.byStatus).map(([status, count]) => {
                  const pct = wasteTotal > 0 ? Math.round((count / wasteTotal) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    STORED: '#888',
                    TRANSFERRED: '#5A7AB8',
                    INCINERATED: '#B85450',
                    RECYCLED_GOLD: '#D4AF37',
                    NEUTRALIZED: '#4A9A7A',
                    DISPOSED: '#4A9A7A',
                    REJECTED: '#B85450',
                  };
                  return (
                    <div key={status} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{status}</span>
                        <span><b>{count}</b> ({pct}%)</span>
                      </div>
                      <Progress percent={pct} strokeColor={colorMap[status] ?? '#D4AF37'} showInfo={false} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="容器类型分布 (W3)">
            {container.data?.byType && container.data.byType.length > 0 ? (
              <div>
                {container.data.byType.map((b) => {
                  const pct = containerTotal > 0 ? Math.round((b.count / containerTotal) * 100) : 0;
                  return (
                    <div key={b.type} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{b.type}</span>
                        <span><b>{b.count}</b> ({pct}%)</span>
                      </div>
                      <Progress percent={pct} strokeColor="#D4AF37" showInfo={false} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty />
            )}
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right', color: 'var(--text-secondary, #888)', fontSize: 12 }}>
        最后更新: {new Date().toLocaleString('zh-CN')} · 数据每 30s 自动刷新 · W5 实时事件中心 ⬈
      </div>
    </div>
  );
}