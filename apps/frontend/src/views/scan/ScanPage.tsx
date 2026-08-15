// =====================================================
// W5 QR 扫码追溯页
// 浏览器原生 BarcodeDetector API
// 支持输入手动 / 扫设备 / 扫 URL 路由
// =====================================================

import { useState } from 'react';
import { Card, Input, Button, Space, Result, Form, Alert, message, Tag, Divider } from 'antd';
import { ScanOutlined, QrcodeOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../data/api';

interface ScanResult {
  type: string;
  data: any;
}

export default function ScanPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const detectType = (code: string): { type: string; route: string; title: string } => {
    if (code.startsWith('BAR-')) return { type: 'BAR', route: `/precious-metal`, title: '贵金属条码' };
    if (code.startsWith('CT-')) return { type: 'CONTAINER', route: `/container`, title: '容器编号' };
    if (code.startsWith('WT-')) return { type: 'WASTE', route: `/waste`, title: '危废编号' };
    if (code.startsWith('GAS-')) return { type: 'GAS', route: `/gas`, title: '气体编号' };
    if (code.startsWith('SR-')) return { type: 'SAMPLING', route: `/precious-metal`, title: '取样单号' };
    if (/^\d{6}-\d{4}$/.test(code)) return { type: 'SAMPLE', route: `/samples`, title: '样品编号' };
    return { type: 'UNKNOWN', route: '/', title: '未知' };
  };

  const handleScan = async () => {
    if (!code) return;
    setLoading(true);
    const detected = detectType(code);

    try {
      let detailData: any = null;
      if (detected.type === 'BAR') {
        const r = await api.get(`/precious-metal/bar/scan/${code}`);
        detailData = r.data;
      } else if (detected.type === 'GAS') {
        const r = await api.get(`/gas`);
        detailData = r.data.items?.find((g: any) => g.code === code);
      } else if (detected.type === 'CONTAINER') {
        const r = await api.get(`/container`);
        detailData = r.data.items?.find((c: any) => c.code === code);
        if (detailData) {
          const r2 = await api.get(`/container/${detailData.id}`);
          detailData = r2.data;
        }
      } else if (detected.type === 'WASTE') {
        const r = await api.get(`/waste`);
        detailData = r.data.data?.find((w: any) => w.code === code);
      } else if (detected.type === 'SAMPLING') {
        const r = await api.get(`/precious-metal/sampling/list`);
        detailData = r.data.items?.find((s: any) => s.recordNo === code);
      }
      setResult({ type: detected.title, data: detailData });
      setHistory((prev) => [code, ...prev.filter((c) => c !== code)].slice(0, 10));
      if (detailData) {
        message.success(`已识别:${detected.title} - ${code}`);
      } else {
        message.warning(`未找到编号为 ${code} 的记录`);
      }
    } catch (e: any) {
      message.error('查询失败:' + (e?.response?.data?.message ?? e?.message));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // 浏览器原生 BarcodeDetector(支持 Chrome/Edge)
  const startCameraScan = async () => {
    try {
      // @ts-ignore
      const BarcodeDetector = window.BarcodeDetector;
      if (!BarcodeDetector) {
        message.error('当前浏览器不支持 BarcodeDetector,请使用 Chrome / Edge / Android Chrome');
        return;
      }
      // @ts-ignore
      const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.style.width = '100%';
      video.style.maxWidth = '480px';
      video.style.borderRadius = '8px';
      const container = document.getElementById('qr-video-container');
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }
      await video.play();
      const interval = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            clearInterval(interval);
            stream.getTracks().forEach((t: any) => t.stop());
            setCode(codes[0].rawValue);
            handleScan();
          }
        } catch (e) { /* frame skipped */ }
      }, 500);
      message.info('摄像头已启动,请将二维码/条码对准屏幕');
    } catch (e: any) {
      message.error('启动摄像头失败:' + (e?.message ?? ''));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Space><ScanOutlined style={{ color: '#D4AF37' }} /><span>扫码追溯</span><Tag color="gold">W5</Tag></Space>}
      >
        <Alert
          message="支持格式:贵金属条码 (BAR-*)、容器 (CT-*)、危废 (WT-*)、气体 (GAS-*)、取样单 (SR-*)、样品编号 (YYMMDD-NNNN)"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="inline" form={form}>
          <Form.Item style={{ flex: 1 }}>
            <Input
              size="large"
              placeholder="输入或扫描条码/编号..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPressEnter={handleScan}
              prefix={<QrcodeOutlined />}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<ScanOutlined />} loading={loading} onClick={handleScan}>
              追溯
            </Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<ScanOutlined />} onClick={startCameraScan}>
              摄像头扫码
            </Button>
          </Form.Item>
        </Form>

        <div id="qr-video-container" style={{ marginTop: 16 }} />

        {history.length > 0 && (
          <>
            <Divider>最近查询</Divider>
            <Space wrap>
              {history.map((h) => (
                <Tag
                  key={h}
                  color="gold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setCode(h); handleScan(); }}
                >
                  {h}
                </Tag>
              ))}
            </Space>
          </>
        )}

        {result && (
          <div style={{ marginTop: 24 }}>
            {result.data ? (
              <Result
                status="success"
                title={<Space><Tag color="green">{result.type}</Tag>追溯成功</Space>}
                subTitle={<span>已找到数据,详情请见下方</span>}
                extra={[
                  <Button key="go" type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(detectType(code).route)}>
                    跳转 {detectType(code).title}
                  </Button>,
                ]}
              >
                <div style={{ background: 'rgba(212,175,55,0.08)', padding: 16, borderRadius: 4, textAlign: 'left', border: '1px solid #D4AF37' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                    {JSON.stringify(result.data, null, 2).slice(0, 800)}
                  </pre>
                </div>
              </Result>
            ) : (
              <Result status="warning" title={`未找到 ${detectType(code).title} ${code}`} subTitle="请检查编号是否正确,或联系系统管理员" />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}