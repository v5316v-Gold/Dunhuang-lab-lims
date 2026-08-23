// =====================================================
// 主布局 - 侧边栏(可折叠+分组) + Header(面包屑/搜索/通知) + 内容区
// 主题: 新中式奢华科技风(墨黑 + 辉金)
// 响应式: 手机(<768px)侧边栏改 Drawer 抽屉,Header 精简
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
  Drawer,
  Grid,
  Modal,
  Spin,
  message,
} from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  ClusterOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  FileWordOutlined,
  FileTextOutlined,
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
  MenuOutlined,
  BellOutlined,
  SearchOutlined,
  DeploymentUnitOutlined,
  UploadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../data/api';
import { RealtimeCenter } from '../../components/RealtimeCenter';
import { useI18n } from '../../i18n/I18nProvider';

const { Sider, Header, Content, Footer } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

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
      { key: '/documents', icon: <FileWordOutlined />, label: <Link to="/documents">文档中心</Link> },
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
      { key: '/authorized-signatories', icon: <SafetyCertificateOutlined />, label: <Link to="/authorized-signatories">授权签字人</Link> },
      { key: '/sod-policies', icon: <SafetyOutlined />, label: <Link to="/sod-policies">SoD 与留样期</Link> },
      { key: '/proficiency-tests', icon: <SafetyCertificateOutlined />, label: <Link to="/proficiency-tests">能力验证 PT</Link> },
      { key: '/raw-records', icon: <FileTextOutlined />, label: <Link to="/raw-records">原始记录单</Link> },
      { key: '/data-import', icon: <UploadOutlined />, label: <Link to="/data-import">数据导入</Link> },
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
  const screens = useBreakpoint();
  const isMobile = !screens.md; // <768px 视为手机

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ---- MFA 启用弹窗(账号安全)----
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaStep, setMfaStep] = useState<'loading' | 'qr'>('loading');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQr, setMfaQr] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  const openMfa = async () => {
    setMfaOpen(true);
    setMfaStep('loading');
    setMfaCode('');
    try {
      const res = await api.post('/auth/mfa/enable');
      setMfaSecret(res.data?.secret ?? '');
      setMfaQr(res.data?.qrCodeDataUrl ?? '');
      setMfaBackupCodes(res.data?.backupCodes ?? []);
      setMfaStep('qr');
    } catch {
      setMfaOpen(false);
    }
  };

  const verifyMfa = async () => {
    if (mfaCode.length !== 6) {
      message.warning('请输入 6 位 TOTP 验证码');
      return;
    }
    setMfaBusy(true);
    try {
      const res = await api.post('/auth/mfa/verify', { code: mfaCode });
      if (res.data?.verified) {
        const me = await api.get('/auth/me');
        useAuthStore.getState().setUser(me.data);
        message.success('MFA 已启用,敏感操作(签发/审核)需二次验证');
        setMfaOpen(false);
      } else {
        message.error('验证码无效,请重试');
      }
    } catch {
      // 具体错误由 api 拦截器统一提示
    } finally {
      setMfaBusy(false);
    }
  };

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

  // 折叠状态持久化(仅桌面)
  useEffect(() => {
    const saved = localStorage.getItem('dsh-sider-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  // 路由变化时关闭抽屉(手机)
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('dsh-sider-collapsed', next ? '1' : '0');
  };

  const userMenuItems = [
    {
      key: 'mfa',
      icon: <SafetyOutlined />,
      label: user?.mfaEnabled ? '账号安全 · MFA 已启用' : '账号安全 · 启用 MFA',
    },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  // 菜单 items(分组 + 子项)
  const menuItems = menuGroups.map((g) => ({
    key: g.key,
    icon: g.icon,
    label: g.label,
    children: g.children.map((c) => ({ key: c.key, icon: c.icon, label: c.label })),
  }));

  // 菜单内容(供 Sider + Drawer 复用)
  const menuContent = (
    <>
      {/* Logo 区 */}
      <div
        className="dsh-logo-area"
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 16px',
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
        <div style={{ lineHeight: 1.2 }}>
          <div className="text-gold-shimmer" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.05em' }}>
            敦煌金质检
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            DUNHUANG GOLD LIMS
          </div>
        </div>
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
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color={ENV_BADGE.color} style={{ margin: 0, fontSize: 10 }}>{ENV_BADGE.text}</Tag>
            <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>v1.0.0</Text>
          </div>
        </Space>
      </div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ============ 侧边栏(桌面) / 抽屉(手机) ============ */}
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0, background: 'var(--bg-secondary)' } }}
          closable={false}
          style={{ background: 'var(--bg-secondary)' }}
        >
          {menuContent}
        </Drawer>
      ) : (
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
          {menuContent}
        </Sider>
      )}

      {/* ============ 主区 ============ */}
      <Layout>
        <Header
          style={{
            background: 'var(--bg-card)',
            padding: isMobile ? '0 8px' : '0 16px 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 6 : 12,
            height: 56,
            lineHeight: '56px',
            borderBottom: '1px solid rgba(212,175,55,0.12)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* 折叠/汉堡按钮 */}
          <Button
            type="text"
            icon={isMobile ? <MenuOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={isMobile ? () => setDrawerOpen(true) : toggleCollapse}
            style={{ color: 'var(--text-secondary)' }}
          />

          {/* 面包屑(手机隐藏分组名,只留页面名) */}
          {!isMobile && (
            <Space size={4} style={{ fontSize: 14 }}>
              <DeploymentUnitOutlined style={{ color: 'var(--gold)' }} />
              <Text style={{ color: 'var(--text-muted)' }}>{breadcrumb.group}</Text>
              {breadcrumb.page && <Text style={{ color: 'var(--text-primary)' }}>/</Text>}
              {breadcrumb.page && <Text strong style={{ color: 'var(--text-primary)' }}>{breadcrumb.page}</Text>}
            </Space>
          )}
          {isMobile && (
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>
              {breadcrumb.page || '敦煌金质检'}
            </Text>
          )}

          <div style={{ flex: 1 }} />

          {/* 全局搜索(手机隐藏) */}
          {!isMobile && (
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="搜索…"
              style={{ width: searchOpen ? 200 : 130, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
            />
          )}

          {/* 实时中心 */}
          <RealtimeCenter />

          {/* 语言切换 */}
          {!isMobile && (
            <Button
              type="text"
              size="small"
              onClick={() => useI18n().setLang(useI18n().lang === 'zh' ? 'en' : 'zh')}
              style={{ color: '#D4AF37', fontWeight: 600 }}
            >
              {useI18n().lang === 'zh' ? 'EN' : '中文'}
            </Button>
          )}

          {/* 通知铃铛(占位) */}
          {!isMobile && (
            <Tooltip title="通知中心">
              <Badge dot offset={[-2, 6]}>
                <BellOutlined style={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'pointer' }} />
              </Badge>
            </Tooltip>
          )}

          {/* 用户 */}
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === 'logout') {
                  logout();
                  navigate('/login');
                }
                if (key === 'mfa') {
                  openMfa();
                }
              },
            }}
          >
            <Space style={{ cursor: 'pointer', padding: '0 4px' }}>
              <Avatar
                size={isMobile ? 26 : 30}
                style={{
                  background: 'linear-gradient(135deg, #d4af37, #8b6914)',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {user?.name?.charAt(0) ?? '客'}
              </Avatar>
              {!isMobile && <Text style={{ color: 'var(--text-primary)' }}>{user?.name ?? '未登录'}</Text>}
            </Space>
          </Dropdown>
        </Header>

        {/* 内容区 */}
        <Content
          className="dsh-content-area"
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 20,
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
            padding: isMobile ? '4px 12px 8px' : '8px 24px 12px',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: isMobile ? 10 : 12,
          }}
        >
          敦煌金质检 LIMS · CNAS-CL01:2018 / ISO 17025:2017 合规 · 内部系统,请勿外传
        </Footer>
      </Layout>

      {/* MFA 启用弹窗 */}
      <Modal
        title={user?.mfaEnabled ? 'MFA 已启用 · 重新设置' : '启用 MFA 二次验证'}
        open={mfaOpen}
        onCancel={() => setMfaOpen(false)}
        footer={
          mfaStep === 'qr' ? (
            <Space>
              <Button onClick={() => setMfaOpen(false)}>关闭</Button>
              <Button type="primary" loading={mfaBusy} onClick={verifyMfa} disabled={mfaCode.length !== 6}>
                验证并启用
              </Button>
            </Space>
          ) : null
        }
        width={420}
      >
        {mfaStep === 'loading' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        )}
        {mfaStep === 'qr' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <img src={mfaQr} alt="MFA 二维码" style={{ width: 180, height: 180, borderRadius: 8 }} />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
              使用手机验证器(Google Authenticator / 支付宝 / 微信小程序)扫码绑定
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>密钥(Secret)</div>
              <Input readOnly value={mfaSecret} style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>备份码(仅显示一次,请妥善保存)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {mfaBackupCodes.map((c) => (
                  <Tag key={c} style={{ fontFamily: 'var(--font-mono)' }}>{c}</Tag>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                输入验证器当前 6 位验证码完成启用
              </div>
              <Input
                value={mfaCode}
                maxLength={6}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="TOTP 6 位验证码"
                size="large"
                style={{ letterSpacing: 6, textAlign: 'center', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
