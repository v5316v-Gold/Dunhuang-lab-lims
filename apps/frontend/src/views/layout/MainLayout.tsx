// =====================================================
// 主布局 - 侧边栏(可折叠+分组) + Header(面包屑/搜索/通知) + 内容区
// 主题: 新中式奢华科技风(墨黑 + 辉金)
// =====================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
  Tooltip,
  Input,
  Badge,
  Tag,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  ClusterOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  ToolOutlined,
  TeamOutlined,
  CloudOutlined,
  GoldOutlined,
  ContainerOutlined,
  QrcodeOutlined,
  ScanOutlined,
  AuditOutlined,
  SafetyOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  SearchOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { RealtimeCenter } from '../../components/RealtimeCenter';
import { useI18n } from '../../i18n/I18nProvider';

const { Sider, Header, Content, Footer } = Layout;
const { Text } = Typography;

// ---------- 菜单分组 ----------
const menuGroups = [
  {
    key: 'g-overview',
    label: '总览',
    icon: <DashboardOutlined />,
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
    ],
  },
  {
    key: 'g-testing',
    label: '检测业务',
    icon: <ExperimentOutlined />,
    children: [
      { key: '/samples', icon: <ExperimentOutlined />, label: <Link to="/samples">样品管理</Link> },
      { key: '/batches', icon: <ClusterOutlined />, label: <Link to="/batches">批次管理</Link> },
      { key: '/tests', icon: <FileSearchOutlined />, label: <Link to="/tests">检测任务</Link> },
      { key: '/reports', icon: <FileDoneOutlined />, label: <Link to="/reports">检测报告</Link> },
    ],
  },
  {
    key: 'g-resource',
    label: '资源管理',
    icon: <ToolOutlined />,
    children: [
      { key: '/equipment', icon: <ToolOutlined />, label: <Link to="/equipment">设备管理</Link> },
      { key: '/personnel', icon: <TeamOutlined />, label: <Link to="/personnel">人员管理</Link> },
      { key: '/reagents', icon: <GoldOutlined />, label: <Link to="/reagents">试剂库存</Link> },
      { key: '/gas', icon: <CloudOutlined />, label: <Link to="/gas">气体管理</Link> },
      { key: '/waste', icon: <GoldOutlined />, label: <Link to="/waste">危废管理</Link> },
      { key: '/container', icon: <ContainerOutlined />, label: <Link to="/container">容器管理</Link> },
    ],
  },
  {
    key: 'g-precious',
    label: '贵金属业务',
    icon: <QrcodeOutlined />,
    children: [
      { key: '/precious-metal', icon: <QrcodeOutlined />, label: <Link to="/precious-metal">贵金属业务</Link> },
      { key: '/scan', icon: <ScanOutlined />, label: <Link to="/scan">扫码追溯</Link> },
    ],
  },
  {
    key: 'g-quality',
    label: '质量合规',
    icon: <SafetyOutlined />,
    children: [
      { key: '/qc', icon: <ExperimentOutlined />, label: <Link to="/qc">QC 监控</Link> },
      { key: '/audit-logs', icon: <AuditOutlined />, label: <Link to="/audit-logs">审计日志</Link> },
      { key: '/compliance', icon: <SafetyOutlined />, label: <Link to="/compliance">合规管理</Link> },
    ],
  },
];

// 扁平化,用于路由匹配 / 面包屑
const allMenuItems = menuGroups.flatMap((g) => g.children);

// 环境徽章
const ENV_BADGE =
  process.env.NODE_ENV === 'production'
    ? { color: 'error', text: 'PROD' }
    : { color: 'gold', text: 'DEV' };

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedKey =
    allMenuItems.find((m) => location.pathname.startsWith(m.key))?.key ?? '/dashboard';

  // 面包屑: 分组名 / 页面名
  const breadcrumb = useMemo(() => {
    const item = allMenuItems.find((m) => location.pathname.startsWith(m.key));
    const group = item ? menuGroups.find((g) => g.children.some((c) => c.key === item.key)) : null;
    return {
      group: group?.label ?? '',
      page: typeof item?.label === 'object' ? (item.label as any).props?.children : item?.label ?? '',
    };
  }, [location.pathname]);

  // 折叠状态持久化
  useEffect(() => {
    const saved = localStorage.getItem('dsh-sider-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('dsh-sider-collapsed', next ? '1' : '0');
  };

  const userMenuItems = [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }];

  // 菜单 items(分组 + 子项)
  const menuItems = menuGroups.map((g) => ({
    key: g.key,
    icon: g.icon,
    label: g.label,
    children: g.children.map((c) => ({ key: c.key, icon: c.icon, label: c.label })),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ============ 侧边栏 ============ */}
      <Sider
        theme="dark"
        width={224}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
        }}
      >
        {/* Logo 区 */}
        <div
          className="dsh-logo-area"
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            gap: 10,
            cursor: 'pointer',
            borderBottom: '1px solid rgba(212,175,55,0.15)',
            background: 'rgba(212,175,55,0.04)',
          }}
          onClick={() => navigate('/dashboard')}
        >
          <div
            className="dsh-logo-mark glow-icon"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #d4af37, #f5d76e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#08080a',
              fontWeight: 800,
              fontSize: 18,
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(212,175,55,0.35)',
            }}
          >
            敦
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.2 }}>
              <div className="text-gold-shimmer" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.05em' }}>
                敦煌金质检
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
                DUNHUANG GOLD LIMS
              </div>
            </div>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={[breadcrumb.group ? menuGroups.find((g) => g.label === breadcrumb.group)?.key ?? 'g-overview' : 'g-overview']}
          items={menuItems}
          style={{ borderRight: 'none', marginTop: 4 }}
        />

        {/* 底部: 环境徽章 + 版本 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            borderTop: '1px solid rgba(212,175,55,0.1)',
            background: 'var(--bg-secondary)',
          }}
        >
          {!collapsed && (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={ENV_BADGE.color} style={{ margin: 0, fontSize: 10 }}>{ENV_BADGE.text}</Tag>
                <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>v1.0.0</Text>
              </div>
            </Space>
          )}
        </div>
      </Sider>

      {/* ============ 主区 ============ */}
      <Layout>
        <Header
          style={{
            background: 'var(--bg-card)',
            padding: '0 16px 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 56,
            lineHeight: '56px',
            borderBottom: '1px solid rgba(212,175,55,0.12)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* 折叠按钮 */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapse}
            style={{ color: 'var(--text-secondary)' }}
          />

          {/* 面包屑 */}
          <Space size={4} style={{ fontSize: 14 }}>
            <DeploymentUnitOutlined style={{ color: 'var(--gold)' }} />
            <Text style={{ color: 'var(--text-muted)' }}>{breadcrumb.group}</Text>
            {breadcrumb.page && <Text style={{ color: 'var(--text-primary)' }}>/</Text>}
            {breadcrumb.page && <Text strong style={{ color: 'var(--text-primary)' }}>{breadcrumb.page}</Text>}
          </Space>

          <div style={{ flex: 1 }} />

          {/* 全局搜索(简版) */}
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            placeholder="搜索…"
            style={{ width: searchOpen ? 200 : 130, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
          />

          {/* 实时中心 */}
          <RealtimeCenter />

          {/* 语言切换 */}
          <Button
            type="text"
            size="small"
            onClick={() => useI18n().setLang(useI18n().lang === 'zh' ? 'en' : 'zh')}
            style={{ color: '#D4AF37', fontWeight: 600 }}
          >
            {useI18n().lang === 'zh' ? 'EN' : '中文'}
          </Button>

          {/* 通知铃铛(占位) */}
          <Tooltip title="通知中心">
            <Badge dot offset={[-2, 6]}>
              <BellOutlined style={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'pointer' }} />
            </Badge>
          </Tooltip>

          {/* 用户 */}
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
            <Space style={{ cursor: 'pointer', padding: '0 8px' }}>
              <Avatar
                size={30}
                style={{
                  background: 'linear-gradient(135deg, #d4af37, #8b6914)',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {user?.name?.charAt(0) ?? '客'}
              </Avatar>
              <Text style={{ color: 'var(--text-primary)' }}>{user?.name ?? '未登录'}</Text>
            </Space>
          </Dropdown>
        </Header>

        {/* 内容区 */}
        <Content
          className="dsh-content-area"
          style={{
            margin: 16,
            padding: 20,
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {/* 顶部金色细线 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, var(--gold) 50%, transparent)',
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />
          <div className="animate-fade-in" style={{ minHeight: 'calc(100vh - 140px)' }}>
            <Outlet />
          </div>
        </Content>

        {/* 页脚 */}
        <Footer
          style={{
            textAlign: 'center',
            padding: '8px 24px 12px',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 12,
          }}
        >
          敦煌金质检 LIMS · CNAS-CL01:2018 / ISO 17025:2017 合规 · 内部系统,请勿外传
        </Footer>
      </Layout>
    </Layout>
  );
}
