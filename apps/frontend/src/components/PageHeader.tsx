// =====================================================
// PageHeader - 页面统一标题栏
// 标题 + 副标题 + 右侧操作区(导出/新增等)
// 主题: 新中式奢华科技风
// =====================================================

import { ReactNode } from 'react';
import { Typography, Space } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, extra, icon }: PageHeaderProps) {
  return (
    <div
      className="dsh-page-header animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border-gold)',
        position: 'relative',
      }}
    >
      <Space align="center" size={12}>
        {icon && (
          <span
            className="glow-icon"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gold, #D4AF37)',
              fontSize: 18,
            }}
          >
            {icon}
          </span>
        )}
        <div>
          <Title level={4} style={{ margin: 0, letterSpacing: '0.03em' }}>
            {typeof title === 'string' ? <span className="text-gold-gradient">{title}</span> : title}
          </Title>
          {subtitle && (
            <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>{subtitle}</Text>
          )}
        </div>
      </Space>
      {extra && <Space wrap>{extra}</Space>}
    </div>
  );
}
