// =====================================================
// 敦煌金质检 LIMS - React 入口
// =====================================================

import { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { App } from './app/App';
import { antdTheme } from './styles/theme';
import './styles/design-tokens.css';
import './styles/global.css';

dayjs.locale('zh-cn');

// Error Boundary 用于诊断 Phase 2 开发期 React 错误
class DebugErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; stack: string | null }
> {
  state: { hasError: boolean; error: Error | null; stack: string | null } = {
    hasError: false,
    error: null,
    stack: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, stack: error.stack ?? null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[React ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>⚠️ React 渲染错误</h1>
          <pre style={{ background: '#ffe', padding: 16, overflow: 'auto' }}>
            <b>Error:</b> {this.state.error?.message}
            {'\n\n'}
            <b>Stack:</b>
            {'\n'}
            {this.state.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <DebugErrorBoundary>
      <ConfigProvider
        locale={zhCN}
        theme={antdTheme}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </DebugErrorBoundary>
  </StrictMode>,
);