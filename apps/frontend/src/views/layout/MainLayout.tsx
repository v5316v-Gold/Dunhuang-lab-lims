// =====================================================
// 主布局 - 侧边栏 + Header + Outlet
// =====================================================

import { Layout, Menu, Avatar, Dropdown, Space, Typography, Button } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  ClusterOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  ToolOutlined,
  TeamOutlined,
  ExperimentOutlined as ExperimentLabOutlined,
  CloudOutlined,
  GoldOutlined,
  ContainerOutlined,
  QrcodeOutlined,
  ScanOutlined,
  AuditOutlined,
  SafetyOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { RealtimeCenter } from '../../components/RealtimeCenter';
import { useI18n } from '../../i18n/I18nProvider';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
  { key: '/samples', icon: <ExperimentOutlined />, label: <Link to="/samples">样品管理</Link> },
  { key: '/batches', icon: <ClusterOutlined />, label: <Link to="/batches">批次管理</Link> },
  { key: '/tests', icon: <FileSearchOutlined />, label: <Link to="/tests">检测任务</Link> },
  { key: '/reports', icon: <FileDoneOutlined />, label: <Link to="/reports">检测报告</Link> },
  { key: '/equipment', icon: <ToolOutlined />, label: <Link to="/equipment">设备管理</Link> },
  { key: '/personnel', icon: <TeamOutlined />, label: <Link to="/personnel">人员管理</Link> },
  { key: '/reagents', icon: <ExperimentLabOutlined />, label: <Link to="/reagents">试剂库存</Link> },
  { key: '/gas', icon: <CloudOutlined />, label: <Link to="/gas">气体管理</Link> },
  { key: '/waste', icon: <GoldOutlined />, label: <Link to="/waste">危废管理</Link> },
  { key: '/container', icon: <ContainerOutlined />, label: <Link to="/container">容器管理</Link> },
  { key: '/precious-metal', icon: <QrcodeOutlined />, label: <Link to="/precious-metal">贵金属业务</Link> },
  { key: '/scan', icon: <ScanOutlined />, label: <Link to="/scan">扫码追溯</Link> },
  { key: '/qc', icon: <ExperimentOutlined />, label: <Link to="/qc">QC 监控</Link> },
  { key: '/audit-logs', icon: <AuditOutlined />, label: <Link to="/audit-logs">审计日志</Link> },
  { key: '/compliance', icon: <SafetyOutlined />, label: <Link to="/compliance">合规管理</Link> },
];

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const selectedKey = menuItems.find((m) => location.pathname.startsWith(m.key))?.key ?? '/dashboard';

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(212,175,55,0.15)',
          }}
        >
          <span className="text-gold-shimmer">敦煌金质检 LIMS</span>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>

      <Layout>
        <Header
          style={{
            background: 'var(--bg-card)',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          }}
        >
          <Text strong style={{ fontSize: 18 }}>
            {menuItems.find((m) => m.key === selectedKey)?.label?.props?.children ?? '敦煌金质检 LIMS'}
          </Text>
          <RealtimeCenter />
          <Button
            type="text"
            size="small"
            onClick={() => useI18n().setLang(useI18n().lang === 'zh' ? 'en' : 'zh')}
            style={{ color: '#D4AF37', fontWeight: 600 }}
          >
            {useI18n().lang === 'zh' ? 'EN' : '中文'}
          </Button>
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === 'logout') {
                  logout();
                  navigate('/login');
                }
              },
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.name ?? '未登录'}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16, padding: 24, background: 'var(--bg-card)', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}