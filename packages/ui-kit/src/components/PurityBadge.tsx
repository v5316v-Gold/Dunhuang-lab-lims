// 黄金纯度徽章(显示 Au 99.999% 等级)
import { Tag } from 'antd';

interface Props {
  purityPct: string | number;
}

function getGrade(purityPct: string | number): { label: string; color: string } {
  const p = typeof purityPct === 'string' ? parseFloat(purityPct) : purityPct;
  if (p >= 99.999) return { label: 'Au99999 (5N)', color: 'gold' };
  if (p >= 99.99) return { label: 'Au9999 (4N)', color: 'orange' };
  if (p >= 99.9) return { label: 'Au999 (3N)', color: 'cyan' };
  if (p >= 99.0) return { label: 'Au990', color: 'blue' };
  if (p >= 95.0) return { label: 'Au950', color: 'purple' };
  return { label: '其他', color: 'default' };
}

export function PurityBadge({ purityPct }: Props) {
  const { label, color } = getGrade(purityPct);
  return <Tag color={color}>{label}</Tag>;
}