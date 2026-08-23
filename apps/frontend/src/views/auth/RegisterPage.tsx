// =====================================================
// 自注册页 - W4 用户管理(公开端点)
// 默认角色 INTERN、status PENDING,需管理员激活后才能登录
// =====================================================

import { useState } from 'react';
import { Form, Input, Button, Typography, Alert, Card, Space, App } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, IdcardOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../data/api';

const { Title, Text } = Typography;

interface RegisterValues {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  phone?: string;
}

export default function RegisterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<RegisterValues>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ username: string } | null>(null);

  const onFinish = async (values: RegisterValues) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ username: string; status: string; message: string }>('/auth/register', {
        username: values.username,
        password: values.password,
        name: values.name,
        email: values.email,
        phone: values.phone,
      });
      setSuccess({ username: data.username });
      message.success('注册成功,请等待管理员审核激活');
      form.resetFields();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? '注册失败';
      message.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary, #08080a)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg-card, #121216)',
          borderColor: 'var(--border-color, rgba(212,175,55,0.25))',
        }}
        styles={{ body: { padding: 32 } }}
      >
        <Space direction="vertical" size={4} style={{ marginBottom: 24, textAlign: 'center', width: '100%' }}>
          <Title level={3} style={{ margin: 0, color: '#D4AF37', letterSpacing: '0.05em' }}>账号注册</Title>
          <Text type="secondary">CNAS-CL01:2018 · 敦煌金质检 LIMS</Text>
        </Space>

        {success ? (
          <Alert
            type="success"
            showIcon
            message={`账号 ${success.username} 注册成功`}
            description="需管理员审核激活后才能登录。审核结果请联系实验室主任。"
            action={
              <Button type="primary" onClick={() => navigate('/login')}>前往登录</Button>
            }
          />
        ) : (
          <Form form={form} layout="vertical" size="large" onFinish={onFinish}>
            <Form.Item label="用户名" name="username" rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 50, message: '3-50 字符' },
              { pattern: /^[a-zA-Z0-9._-]+$/, message: '仅允许字母数字 . _ -' },
            ]}>
              <Input prefix={<UserOutlined />} placeholder="如:zhang.san" />
            </Form.Item>
            <Form.Item label="姓名" name="name" rules={[{ required: true, max: 50 }]}>
              <Input prefix={<IdcardOutlined />} placeholder="真实姓名" />
            </Form.Item>
            <Form.Item label="邮箱" name="email" rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱(唯一)" />
            </Form.Item>
            <Form.Item label="手机号(可选)" name="phone">
              <Input prefix={<PhoneOutlined />} placeholder="如:13800138000" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[
              { required: true, message: '请输入密码' },
              { min: 8, max: 128, message: '8-128 字符' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/,
                message: '密码须包含大小写字母、数字、特殊字符',
              },
            ]}>
              <Input.Password prefix={<LockOutlined />} placeholder="≥8 位,大小写+数字+特殊字符" />
            </Form.Item>
            <Form.Item label="确认密码" name="confirmPassword" rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}>
              <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" />
            </Form.Item>
            <Form.Item style={{ marginTop: 8 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>提交注册</Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">已有账号?<Link to="/login">前往登录</Link></Text>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}
