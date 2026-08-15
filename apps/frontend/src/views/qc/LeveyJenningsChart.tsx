// =====================================================
// W+5-4: Levey-Jennings 图(纯 SVG 零依赖)
// CNAS §7.9 质控图:中心线 ±1/2/3 SD,Westgard 规则异常标红
// =====================================================

import { useEffect, useState } from 'react';
import { Card, Select, Space, Typography, Empty, Tag } from 'antd';
import { api } from '../../data/api';

interface QcPoint {
  zScore: number;
  run: number;
  passed: boolean;
}

interface Props {
  testId?: string;
  element?: string;
}

export default function LeveyJenningsChart({ testId: defaultTestId, element: defaultElement }: Props = {}) {
  const [testId, setTestId] = useState(defaultTestId ?? '');
  const [element, setElement] = useState(defaultElement ?? 'Au');
  const [data, setData] = useState<QcPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    api.get(`/qc/trend?testId=${testId}&element=${element}&take=30`)
      .then((r) => {
        const items = r.data?.items ?? r.data ?? [];
        const points = items.map((m: any, i: number) => ({
          zScore: parseFloat(String(m.zScore ?? 0)),
          run: i + 1,
          passed: m.passed ?? Math.abs(parseFloat(String(m.zScore ?? 0))) <= 2,
        }));
        setData(points);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [testId, element]);

  // SVG 参数
  const W = 720;
  const H = 280;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;
  const maxRun = Math.max(12, data.length);
  const xScale = (i: number) => margin.left + (i / (maxRun - 1)) * innerW;
  const yScale = (z: number) => margin.top + innerH / 2 - (z / 3) * (innerH / 2);  // ±3 SD 占一半

  return (
    <Card
      title="Levey-Jennings 质控图"
      size="small"
      extra={
        <Space>
          <Select
            size="small"
            value={element}
            onChange={setElement}
            options={['Au', 'Ag', 'Cu', 'Fe', 'Pb', 'Pt', 'Pd'].map((e) => ({ value: e, label: e }))}
            style={{ width: 80 }}
          />
          <input
            placeholder="Test ID"
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            style={{ width: 200, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
          />
        </Space>
      }
    >
      {data.length === 0 ? (
        <Empty description={loading ? '加载中...' : '无数据(输入 testId 并选择元素)'} />
      ) : (
        <svg width={W} height={H} style={{ background: '#fafafa', borderRadius: 4 }}>
          {/* SD lines: +3 / +2 / +1 / 0 / -1 / -2 / -3 */}
          {[3, 2, 1, 0, -1, -2, -3].map((sd) => {
            const y = yScale(sd);
            const color = sd === 0 ? '#333' : sd === 1 || sd === -1 ? '#999' : '#fa8c16';
            return (
              <g key={sd}>
                <line x1={margin.left} x2={margin.left + innerW} y1={y} y2={y} stroke={color} strokeDasharray={sd === 0 ? '0' : '4 4'} strokeWidth={sd === 0 ? 1.5 : 0.8} />
                <text x={W - 18} y={y + 4} fontSize={10} fill={color}>{sd > 0 ? `+${sd}` : sd}</text>
                <text x={2} y={y + 4} fontSize={10} fill={color}>{sd > 0 ? `+${sd}` : sd}SD</text>
              </g>
            );
          })}

          {/* X axis labels */}
          {data.map((_, i) => i % Math.ceil(data.length / 10) === 0 && (
            <text key={i} x={xScale(i)} y={H - 10} fontSize={10} fill="#666" textAnchor="middle">{i + 1}</text>
          ))}

          {/* Points */}
          {data.map((p, i) => (
            <g key={i}>
              <line
                x1={xScale(i)} x2={xScale(i)}
                y1={margin.top} y2={margin.top + innerH}
                stroke={p.passed ? '#d9d9d9' : '#ff4d4f'}
                strokeDasharray={p.passed ? '2 4' : '3 2'}
                strokeWidth={p.passed ? 0.5 : 1.5}
              />
              <circle
                cx={xScale(i)} cy={yScale(p.zScore)} r={4}
                fill={p.passed ? '#1890ff' : '#ff4d4f'}
                stroke="#fff" strokeWidth={1}
              >
                <title>{`Run ${p.run}: z=${p.zScore.toFixed(2)}${p.passed ? '' : ' ⚠ OUT'}`}</title>
              </circle>
            </g>
          ))}

          {/* Y axis label */}
          <text x={2} y={margin.top + 8} fontSize={10} fill="#333">z-score</text>
          <text x={W - 30} y={H - 2} fontSize={10} fill="#666" textAnchor="end">Run</text>
        </svg>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {data.length > 0 && `${data.length} 个质控点 · 红色=失控(z>3)· 蓝色=受控`}
      </Typography.Text>
    </Card>
  );
}