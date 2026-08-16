// =====================================================
// 登录页面
// =====================================================

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined } from '@ant-design/icons';
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
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          width: 420,
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-gold)',
          boxShadow: 'var(--shadow-xl), var(--shadow-gold-glow)',
          borderRadius: 'var(--radius-2xl)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              <span className="text-gold-shimmer">敦煌金质检</span>
            </Title>
            <Text type="secondary">CNAS 合规实验室信息管理系统</Text>
          </div>

          {error && <Alert type="error" message={error} showIcon closable />}

          <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
            </Form.Item>

            {mfaRequired && (
              <Form.Item
                name="totpCode"
                rules={[{ required: true, message: '请输入 TOTP 验证码' }, { pattern: /^\d{6}$/, message: '6 位数字' }]}
              >
                <Input prefix={<KeyOutlined />} placeholder="TOTP 验证码" size="large" maxLength={6} />
              </Form.Item>
            )}

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} size="large" block>
                {mfaRequired ? '验证并登录' : '登录'}
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
            黄金检测 · 火试金法 · ICP-OES/MS · ALCOA+ · SHA256 审计链
          </Text>
        </Space>
      </Card>
    </div>
  );
}