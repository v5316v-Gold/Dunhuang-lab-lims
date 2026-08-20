// =====================================================
// DataTable - 通用数据表格封装
// 卡片包裹 + 标题栏 + 工具栏(刷新/导出) + 状态徽章映射
// 主题: 新中式奢华科技风(墨黑 + 辉金)
// =====================================================

import { ReactNode } from 'react';
import { Card, Table, Space, Button, Tooltip, Empty, Tag } from 'antd';
import type { TableProps } from 'antd';
import { ReloadOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';

// ---------- 状态徽章映射(国风语义色) ----------
export const STATUS_TAG_COLORS: Record<string, string> = {
  // 通用
  ACTIVE: 'success', INACTIVE: 'default', PENDING: 'warning', LOCKED: 'error',
  // 样品
  RECEIVED: 'processing', BATCHED: 'cyan', IN_TEST: 'gold', TESTED: 'success',
  REPORT_DRAFT: 'default', REPORT_REVIEW: 'warning', REPORT_APPROVED: 'processing', ARCHIVED: 'geekblue',
  DISPOSED: 'default', REJECTED: 'error',
  // 批次
  MIXING: 'gold', FUSING: 'orange', CUPELLING: 'volcano', PARTING: 'magenta', ANNEALING: 'purple',
  WEIGHING: 'cyan', CALCULATING: 'geekblue', COMPLETED: 'success',
  // 报告
  DRAFT: 'default', INTERNAL_REVIEW: 'warning', FINAL_REVIEW: 'processing', APPROVED: 'gold',
  ISSUED: 'success', SUPERSEDED: 'default',
  // 设备
  MAINTENANCE: 'warning', CALIBRATION: 'processing', QUARANTINED: 'error', BROKEN: 'error', RETIRED: 'default',
  // 危废
  STORED: 'default', TRANSFERRED: 'processing', INCINERATED: 'error', RECYCLED_GOLD: 'gold',
  NEUTRALIZED: 'success',
  // 合规
  OPEN: 'error', INVESTIGATING: 'warning', CAPA_IN_PROGRESS: 'processing', CLOSED: 'success',
  RESOLVED: 'success',
  // PT / 盲样
  SATISFACTORY: 'success', QUESTIONABLE: 'warning', UNSATISFACTORY: 'error',
};

/** 状态列渲染器: 自动匹配语义色 */
export function statusTag(status?: string | null): ReactNode {
  if (!status) return <Tag>—</Tag>;
  const color = STATUS_TAG_COLORS[status] ?? 'default';
  const labelMap: Record<string, string> = {
    RECEIVED: '已接收', BATCHED: '已分批', IN_TEST: '检测中', TESTED: '已检测',
    REPORT_DRAFT: '报告草稿', REPORT_REVIEW: '审核中', REPORT_APPROVED: '已批准', ARCHIVED: '已留样',
    DISPOSED: '已处置', REJECTED: '已拒收',
    DRAFT: '草稿', INTERNAL_REVIEW: '内部审核', FINAL_REVIEW: '终审', APPROVED: '已批准',
    ISSUED: '已签发', SUPERSEDED: '已作废',
    ACTIVE: '正常', INACTIVE: '停用', PENDING: '待处理', LOCKED: '锁定',
    MAINTENANCE: '维护中', CALIBRATION: '校准中', QUARANTINED: '已隔离', BROKEN: '故障', RETIRED: '已报废',
    STORED: '暂存', TRANSFERRED: '已转运', INCINERATED: '已焚毁', RECYCLED_GOLD: '已回收', NEUTRALIZED: '已中和',
    OPEN: '开启', INVESTIGATING: '调查中', CAPA_IN_PROGRESS: '整改中', CLOSED: '已关闭', RESOLVED: '已解决',
    SATISFACTORY: '满意', QUESTIONABLE: '可疑', UNSATISFACTORY: '不满意',
  };
  return <Tag color={color}>{labelMap[status] ?? status}</Tag>;
}

// ---------- 通用表格 ----------
interface DataTableProps<T> extends TableProps<T> {
  title?: ReactNode;
  subtitle?: ReactNode;
  onRefresh?: () => void;
  onExport?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  cardExtra?: ReactNode;
  loading?: boolean;
}

export function DataTable<T extends object>({
  title,
  subtitle,
  onRefresh,
  onExport,
  onAdd,
  addLabel = '新增',
  cardExtra,
  loading,
  locale,
  ...tableProps
}: DataTableProps<T>) {
  return (
    <Card
      className="dsh-data-table animate-fade-in"
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
      }}
      styles={{ body: { padding: '0 0 16px' } }}
      title={
        title ? (
          <div>
            <span className="text-gold-gradient" style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
            {subtitle && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</span>}
          </div>
        ) : null
      }
      extra={
        <Space size={8}>
          {cardExtra}
          {onExport && (
            <Tooltip title="导出">
              <Button size="small" icon={<DownloadOutlined />} onClick={onExport}>导出</Button>
            </Tooltip>
          )}
          {onRefresh && (
            <Tooltip title="刷新">
              <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />
            </Tooltip>
          )}
          {onAdd && (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {addLabel}
            </Button>
          )}
        </Space>
      }
    >
      <Table<T>
        {...tableProps}
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: 'var(--text-muted)' }}>暂无数据</span>}
            />
          ),
          ...locale,
        }}
        pagination={
          tableProps.pagination === undefined
            ? { pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }
            : tableProps.pagination
        }
      />
    </Card>
  );
}
