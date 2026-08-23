// =====================================================
// MfaChallengeModal - 敏感操作 MFA 二次验证弹窗(共享)
// 流程: 输入 TOTP 6 位 → POST /auth/mfa/challenge → onConfirm(mfaToken)
// =====================================================

import { useState } from 'react';
import { Modal, Input, Space, Button, App, Alert } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { api } from '../data/api';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (mfaToken: string) => Promise<void>;
}

export function MfaChallengeModal({ open, title, description, onCancel, onConfirm }: Props) {
  const { message } = App.useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.length !== 6) {
      message.warning('请输入 6 位 TOTP 验证码');
      return;
    }
    setBusy(true);
    try {
      const ch = await api.post('/auth/mfa/challenge', { code });
      const mfaToken = ch.data?.mfaToken;
      if (!mfaToken) throw new Error('未获取到 MFA token');
      await onConfirm(mfaToken);
      setCode('');
    } catch {
      // 错误提示由 api 拦截器统一处理
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title ?? 'MFA 二次验证'}
      open={open}
      onCancel={() => { setCode(''); onCancel(); }}
      footer={
        <Space>
          <Button onClick={() => { setCode(''); onCancel(); }}>取消</Button>
          <Button type="primary" loading={busy} onClick={submit} disabled={code.length !== 6}>
            验证并提交
          </Button>
        </Space>
      }
      width={420}
    >
      <Alert
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="敏感操作需 MFA 二次验证"
        description={description ?? '请输入手机验证器(Google Authenticator 等)当前的 6 位验证码。'}
        style={{ marginBottom: 16 }}
      />
      <Input
        value={code}
        maxLength={6}
        autoFocus
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        onPressEnter={submit}
        placeholder="TOTP 6 位验证码"
        size="large"
        style={{ letterSpacing: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}
      />
    </Modal>
  );
}
