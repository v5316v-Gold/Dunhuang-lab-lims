// =====================================================
// 登录页面 - 新中式奢华科技风(双栏: 品牌区 + 登录卡)
// 左: 品牌展示 + 金条 SVG 动画 + 合规徽章
// 右: 玻璃拟态登录卡
// =====================================================

import { useState } from 'react';
import { Form, Input, Button, Typography, Alert, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined, SafetyCertificateOutlined, AuditOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../data/api';
import { useAuthStore } from '../../stores/auth.store';
import type { LoginResponse } from '@dunhuang/lims-shared-types';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
  totpCode?: string;
}

// 金条 SVG(呼吸光晕)
function GoldBarSVG() {
  return (
    <svg width="120" height="48" viewBox="0 0 120 48" fill="none" style={{ filter: 'drop-shadow(0 6px 20px rgba(212,175,55,0.45))' }}>
      <defs>
        <linearGradient id="goldBarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d76e" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#8b6914" />
        </linearGradient>
      </defs>
      {/* 金条主体 */}
      <rect x="4" y="8" width="112" height="32" rx="4" fill="url(#goldBarGrad)" stroke="#f5d76e" strokeWidth="1.5" />
      {/* 高光 */}
      <rect x="12" y="12" width="96" height="6" rx="2" fill="rgba(255,255,255,0.35)" />
      {/* 徽记 */}
      <text x="60" y="31" textAnchor="middle" fontSize="13" fontWeight="800" fill="#3a2e05" fontFamily="'PingFang SC', sans-serif">
        DH · 金
      </text>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', values);
      if (data.mfaRequired) {
        setMfaRequired(true);
        setError('请输入 TOTP 验证码');
        return;
      }
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bg-auth animate-fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      {/* ============ 双栏容器 ============ */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 1080,
          margin: 'auto',
          borderRadius: 'var(--radius-3xl)',
          overflow: 'hidden',
          border: '1px solid var(--border-gold)',
          boxShadow: 'var(--shadow-xl), var(--shadow-gold-glow)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          minHeight: 540,
        }}
      >
        {/* ============ 左: 品牌区 ============ */}
        <div
          className="dsh-login-brand"
          style={{
            flex: 1.2,
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 20,
            background:
              'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(212,175,55,0.1) 0%, transparent 60%), var(--bg-secondary)',
            borderRight: '1px solid rgba(212,175,55,0.15)',
            position: 'relative',
          }}
        >
          {/* 装饰印章 */}
          <div
            className="animate-float"
            style={{
              position: 'absolute',
              top: 28,
              right: 28,
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '2px solid rgba(212,175,55,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: 'rgba(212,175,55,0.5)',
            }}
          >
            ☯
          </div>

          {/* 金条动画 */}
          <div className="animate-float" style={{ alignSelf: 'flex-start' }}>
            <GoldBarSVG />
          </div>

          <div>
            <Title level={1} style={{ margin: 0, letterSpacing: '0.08em' }}>
              <span className="text-gold-shimmer">敦煌金质检</span>
            </Title>
            <Title level={4} style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontWeight: 400 }}>
              贵金属检测实验室信息管理系统
            </Title>
          </div>

          <div className="divider-gold" style={{ width: 120 }} />

          <div>
            <Text style={{ color: 'var(--text-muted)', lineHeight: 1.9, display: 'block' }}>
              面向黄金 / 白银 / 铂 / 钯检测业务,实现
              <br />
              「收样 → 检测 → 出证 → 溯源」全流程数字化闭环
            </Text>
          </div>

          {/* 合规徽章 */}
          <Space size={10} wrap>
            <Tag color="gold" icon={<SafetyCertificateOutlined />} style={{ margin: 0 }}>CNAS-CL01:2018</Tag>
            <Tag color="gold" icon={<SafetyCertificateOutlined />} style={{ margin: 0 }}>ISO/IEC 17025</Tag>
            <Tag color="gold" icon={<SafetyCertificateOutlined />} style={{ margin: 0 }}>CMA</Tag>
          </Space>
          <Space size={10} wrap>
            <Tag icon={<AuditOutlined />} style={{ margin: 0 }}>SHA256 审计链</Tag>
            <Tag icon={<ExperimentOutlined />} style={{ margin: 0 }}>火试金 GB/T 9288</Tag>
            <Tag icon={<ExperimentOutlined />} style={{ margin: 0 }}>ICP-OES/MS</Tag>
          </Space>
        </div>

        {/* ============ 右: 登录卡 ============ */}
        <div
          style={{
            flex: 1,
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'var(--bg-glass)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Title level={3} style={{ margin: 0 }}>
              <span className="text-gold-gradient">欢迎登录</span>
            </Title>
            <Text type="secondary">内部受控系统 · 请使用授权账号</Text>
          </div>

          <Divider style={{ borderColor: 'var(--border-gold)', opacity: 0.5, margin: '16px 0 24px' }} />

          {error && <Alert type="error" message={error} showIcon closable style={{ marginBottom: 16 }} />}

          <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark="optional">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
            </Form.Item>

            {mfaRequired && (
              <Form.Item
                name="totpCode"
                rules={[{ required: true, message: '请输入 TOTP 验证码' }, { pattern: /^\d{6}$/, message: '6 位数字' }]}
              >
                <Input prefix={<KeyOutlined />} placeholder="TOTP 验证码" size="large" maxLength={6} autoFocus />
              </Form.Item>
            )}

            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" loading={loading} size="large" block style={{ height: 44 }}>
                {mfaRequired ? '验证并登录' : '登 录'}
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block', marginTop: 8 }}>
            ALCOA+ 数据完整性 · 21 CFR Part 11 电子签名 · 敏感操作强制 MFA
          </Text>
        </div>
      </div>
    </div>
  );
}
