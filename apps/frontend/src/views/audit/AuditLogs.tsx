// =====================================================
// 审计日志页面 - 关键合规视图
// 详见 ADR-0003 / docs/04-CNAS-COMPLIANCE.md §3.1
// =====================================================

import { useState } from 'react';
import { Table, Tag, Button, Space, Card, message, Modal, Descriptions, Alert } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../data/api';

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

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize],
    queryFn: async () => (await api.get('/audit-logs', { params: { page, pageSize } })).data,
  });

  const handleVerify = async () => {
    try {
      const { data } = await api.get<VerifyResult>('/audit-logs/verify');
      setVerifyResult(data);
      if (data.passed) {
        message.success(`✅ 审计链验证通过:${data.totalRecords} 条记录,耗时 ${data.durationMs}ms`);
      } else {
        message.error(`🚨 审计链断链!共 ${data.errors.length} 处错误`);
      }
    } catch (err) {
      message.error('验证失败');
    }
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
      render: (_: any, record: AuditLog) => (
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
    <Card
      title="审计日志(SHA256 链 · 不可篡改)"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleVerify}>
            断链自检
          </Button>
        </Space>
      }
    >
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

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Card>
  );
}