// =====================================================
// 审计日志页面 - 关键合规视图
// 详见 ADR-0003 / docs/04-CNAS-COMPLIANCE.md §3.1
// =====================================================

import { useMemo, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Descriptions,
  Alert,
  Input,
  Select,
  DatePicker,
  Form,
  Card,
  Row,
  Col,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AuditOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';

const { RangePicker } = DatePicker;

interface AuditLog {
  id: number;
  userId: string;
  username: string;
  action: string;
  tableName: string;
  recordId: string;
  ip: string;
  prevHash: string;
  currHash: string;
  createdAt: string;
  newData?: any;
}

interface VerifyResult {
  passed: boolean;
  totalRecords: number;
  errors: Array<{ id: number; reason: string; expected?: string; actual?: string }>;
  verifiedAt: string;
  durationMs: number;
}

// ---------- CSV 工具 ----------
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  // RFC 4180:含 , " \n 时用双引号包裹,内部 " 转义为 ""
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const r of rows) {
    lines.push(r.map(csvEscape).join(','));
  }
  // UTF-8 BOM,Excel 打开中文不乱码
  return '\ufeff' + lines.join('\r\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // 服务端过滤参数
  const [username, setUsername] = useState('');
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  const [tableNameInput, setTableNameInput] = useState('');
  const [actionKeyword, setActionKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // 先拉一整页(不传过滤)用于表名下拉去重;再做带过滤的查询
  const { data: baseList } = useQuery({
    queryKey: ['audit-logs-table-names'],
    queryFn: async () =>
      (await api.get('/audit-logs', { params: { page: 1, pageSize: 200 } })).data as {
        data: AuditLog[];
        total: number;
      },
    staleTime: 60_000,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, username, tableName, actionKeyword, dateRange],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize };
      if (username.trim()) params.username = username.trim();
      if (tableName) params.tableName = tableName;
      if (actionKeyword.trim()) params.action = actionKeyword.trim();
      if (dateRange?.[0]) params.from = dateRange[0].toISOString();
      if (dateRange?.[1]) params.to = dateRange[1].toISOString();
      return (await api.get('/audit-logs', { params })).data as { data: AuditLog[]; total: number };
    },
  });

  // 表名去重(仅显示服务端有数据的表)
  const tableNameOptions = useMemo(() => {
    const set = new Set<string>();
    (baseList?.data ?? []).forEach((r) => r.tableName && set.add(r.tableName));
    return Array.from(set).sort().map((t) => ({ value: t, label: t }));
  }, [baseList]);

  const handleVerify = async () => {
    try {
      const { data } = await api.get<VerifyResult>('/audit-logs/verify');
      setVerifyResult(data);
      if (data.passed) {
        // 不弹 message,由下方 Alert 提示;避免重复
      }
    } catch {
      // 拦截器已提示
    }
  };

  const handleExport = () => {
    const list = data?.data ?? [];
    if (list.length === 0) {
      Modal.info({ title: '提示', content: '当前页无数据可导出' });
      return;
    }
    const headers = ['ID', '时间', '操作者', '操作', '表名', '记录ID', 'IP', '当前哈希'];
    const rows = list.map((r) => [
      r.id,
      new Date(r.createdAt).toLocaleString('zh-CN'),
      r.username,
      r.action,
      r.tableName,
      r.recordId,
      r.ip,
      r.currHash,
    ]);
    const csv = rowsToCsv(headers, rows);
    const ts = dayjs().format('YYYYMMDD_HHmmss');
    downloadCsv(`审计日志_${ts}.csv`, csv);
  };

  const handleResetFilters = () => {
    setUsername('');
    setTableName(undefined);
    setTableNameInput('');
    setActionKeyword('');
    setDateRange(null);
    setPage(1);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作者', dataIndex: 'username', width: 120 },
    { title: '操作', dataIndex: 'action', width: 150, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '表名', dataIndex: 'tableName', width: 120 },
    { title: '记录 ID', dataIndex: 'recordId', width: 100 },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    {
      title: '当前哈希',
      dataIndex: 'currHash',
      width: 130,
      render: (v: string) => <code style={{ fontSize: 11 }}>{v.slice(0, 16)}…</code>,
    },
    {
      title: '详情',
      width: 80,
      render: (_: unknown, record: AuditLog) => (
        <Button
          size="small"
          onClick={() =>
            Modal.info({
              title: `审计日志 #${record.id}`,
              width: 800,
              content: (
                <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
                  <Descriptions.Item label="操作">{record.action}</Descriptions.Item>
                  <Descriptions.Item label="表名">{record.tableName}</Descriptions.Item>
                  <Descriptions.Item label="记录 ID">{record.recordId}</Descriptions.Item>
                  <Descriptions.Item label="prev_hash">{record.prevHash}</Descriptions.Item>
                  <Descriptions.Item label="curr_hash">{record.currHash}</Descriptions.Item>
                  <Descriptions.Item label="new_data">
                    <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(record.newData, null, 2)}
                    </pre>
                  </Descriptions.Item>
                </Descriptions>
              ),
            })
          }
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="审计日志"
        subtitle="CNAS §7.11 数据控制 · SHA256 链不可篡改"
        icon={<AuditOutlined />}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 CSV
            </Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleVerify}>
              断链自检
            </Button>
          </Space>
        }
      />

      {verifyResult && (
        <Alert
          style={{ marginBottom: 16 }}
          type={verifyResult.passed ? 'success' : 'error'}
          showIcon
          icon={verifyResult.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={
            verifyResult.passed
              ? `✅ 审计链验证通过: ${verifyResult.totalRecords} 条记录,耗时 ${verifyResult.durationMs}ms`
              : `🚨 审计链断链: ${verifyResult.errors.length} 处错误`
          }
          description={
            !verifyResult.passed && (
              <ul>
                {verifyResult.errors.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    记录 #{e.id}: {e.reason}
                  </li>
                ))}
              </ul>
            )
          }
        />
      )}

      {/* 筛选栏 */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
        }}
        title={
          <Space size={8}>
            <SearchOutlined style={{ color: '#D4AF37' }} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>服务端筛选</span>
          </Space>
        }
        extra={
          <Button size="small" onClick={handleResetFilters}>
            重置
          </Button>
        }
      >
        <Form layout="inline" style={{ rowGap: 8 }}>
          <Row gutter={[12, 8]} style={{ width: '100%' }}>
            <Col>
              <Form.Item label="操作者" style={{ marginBottom: 0 }}>
                <Input
                  allowClear
                  placeholder="按用户名筛选"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 180 }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="表名" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  showSearch
                  placeholder="选择或搜索表名"
                  value={tableName}
                  onChange={(v) => {
                    setTableName(v);
                    setPage(1);
                  }}
                  onSearch={setTableNameInput}
                  searchValue={tableNameInput}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={tableNameOptions}
                  style={{ width: 200 }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="操作关键字" style={{ marginBottom: 0 }}>
                <Input
                  allowClear
                  placeholder="如 CREATE / UPDATE / DELETE"
                  value={actionKeyword}
                  onChange={(e) => {
                    setActionKeyword(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 200 }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="时间范围" style={{ marginBottom: 0 }}>
                <RangePicker
                  showTime
                  value={dateRange ?? undefined}
                  onChange={(v) => {
                    setDateRange(v as [Dayjs | null, Dayjs | null] | null);
                    setPage(1);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <DataTable<AuditLog>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
}