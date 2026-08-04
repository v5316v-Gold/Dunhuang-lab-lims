// 检测方法标签
import { Tag } from 'antd';

const methodLabels: Record<string, { label: string; color: string }> = {
  FIRE_ASSAY: { label: '火试金法', color: 'gold' },
  ICP_OES: { label: 'ICP-OES', color: 'blue' },
  ICP_MS: { label: 'ICP-MS', color: 'cyan' },
  XRF: { label: 'XRF', color: 'purple' },
  FIRE_ASSAY_GRAVIMETRIC: { label: '火试金重量法', color: 'orange' },
  VOLUMETRIC: { label: '滴定法', color: 'magenta' },
  ICP_GBC: { label: 'ICP 比较法', color: 'geekblue' },
  OTHER: { label: '其他', color: 'default' },
};

export function MethodTag({ method }: { method: string }) {
  const { label, color } = methodLabels[method] ?? { label: method, color: 'default' };
  return <Tag color={color}>{label}</Tag>;
}