// =====================================================
// 仪表盘 - 业务指标
// =====================================================

import { Row, Col, Card, Statistic, Spin } from 'antd';
import {
  ExperimentOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  AlertOutlined,
  TeamOutlined,
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

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/analytics/dashboard')).data,
    refetchInterval: 30000, // 30 秒刷新
  });

  if (isLoading) return <Spin size="large" />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>仪表盘</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日样品"
              value={data?.todaySamples ?? 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: 'var(--gold)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="检测中"
              value={data?.inTest ?? 0}
              prefix={<FileSearchOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待审核报告"
              value={data?.pendingReports ?? 0}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="库存预警"
              value={data?.lowStockAlerts ?? 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: data?.lowStockAlerts ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="活跃用户" value={data?.totalUsers ?? 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="系统状态">
        <p>最后更新: {data?.timestamp}</p>
        <p style={{ color: '#52c41a', margin: 0 }}>● 所有服务运行正常</p>
      </Card>
    </div>
  );
}