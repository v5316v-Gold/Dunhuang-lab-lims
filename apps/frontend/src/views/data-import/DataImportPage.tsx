// =====================================================
// 数据导入中心 — W3-A 飞书多维表格 Excel 导入
// 流程:选实体 → 上传 Excel → 预览(绿/红行)→ 确认导入 → 历史
// =====================================================

import { useState } from 'react';
import {
  Button, Card, Col, Form, Modal, Row, Select, Space, Table, Tag, Typography, Upload, message,
} from 'antd';
import { UploadOutlined, DownloadOutlined, CheckOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;
const { Dragger } = Upload;

interface EntityType { entityType: string; label: string }
interface PreviewRow { rowNumber: number; parsed: Record<string, any>; valid: boolean; errors: Array<{ field: string; message: string }> }
interface ImportBatch { id: string; entityType: string; originalName: string; totalRows: number; successRows: number; failedRows: number; status: string; createdAt: string; uploadedBy?: { name?: string } }

export default function DataImportPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState<string | null>(null);
  const [file, setFile] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ valid: number; invalid: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [detailOpen, setDetailOpen] = useState<ImportBatch | null>(null);

  const { data: entityTypes = [] } = useQuery({
    queryKey: ['import-entity-types'],
    queryFn: async () => (await api.get('/imports/entity-types')).data,
  });

  const { data: history = { items: [], total: 0 } } = useQuery({
    queryKey: ['import-history'],
    queryFn: async () => (await api.get('/imports', { params: { page: 1, pageSize: 20 } })).data,
  });

  const handleUpload = async () => {
    if (!file || !entityType) {
      message.warning('请先选择实体类型和文件');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('entityType', entityType);
      const res = await api.post('/imports/upload', fd);
      setPreview(res.data.preview ?? []);
      setStats(res.data.stats ?? null);
      setBatchId(res.data.batchId ?? null);
      message.success(`解析完成:共 ${res.data.totalRows} 行,有效 ${res.data.stats?.valid} 行`);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '解析失败');
    } finally {
      setUploading(false);
    }
  };

  const confirmMut = useMutation({
    mutationFn: async () => (await api.post(`/imports/${batchId}/confirm`, {})).data,
    onSuccess: (data) => {
      message.success(`导入完成:成功 ${data.stats?.success} 行,失败 ${data.stats?.failed} 行`);
      setPreview([]);
      setBatchId(null);
      setStats(null);
      setFile(null);
      qc.invalidateQueries({ queryKey: ['import-history'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '导入失败'),
  });

  const columns = [
    { title: '实体类型', dataIndex: 'entityType', render: (v: string) => <Tag color="gold">{v}</Tag> },
    { title: '文件名', dataIndex: 'originalName' },
    { title: '总行', dataIndex: 'totalRows', width: 70 },
    {
      title: '结果',
      render: (_: unknown, r: ImportBatch) => (
        <Space>
          <Tag color="success">✓{r.successRows}</Tag>
          {r.failedRows > 0 && <Tag color="error">✗{r.failedRows}</Tag>}
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'CONFIRMED' ? 'success' : 'warning'}>{v}</Tag> },
    { title: '时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作',
      render: (_: unknown, r: ImportBatch) => (
        <Button size="small" onClick={() => setDetailOpen(r)}>详情</Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="数据导入" subtitle="飞书多维表格 Excel 上传 · 22 张表 → LIMS · 自动校验/识别" />

      <Card title="① 选择实体类型 + 上传飞书 Excel" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Row gutter={12}>
            <Col span={16}>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="选择要导入的实体类型(22 种)"
                value={entityType}
                onChange={setEntityType}
                options={entityTypes.map((t: EntityType) => ({ value: t.entityType, label: `${t.label} (${t.entityType})` }))}
                optionFilterProp="label"
              />
            </Col>
            <Col span={8}>
              <Button
                icon={<DownloadOutlined />}
                disabled={!entityType}
                onClick={async () => {
                  const res = await api.get(`/imports/templates/${entityType}`, { responseType: 'blob' });
                  const url = URL.createObjectURL(res.data as Blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${entityType}_template.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                下载模板
              </Button>
            </Col>
          </Row>

          <Dragger
            accept=".xlsx,.xls,.csv"
            maxCount={1}
            beforeUpload={(f) => { setFile(f); return false; }}
            onRemove={() => setFile(null)}
            fileList={file ? [{ uid: '-1', name: (file as any).name, status: 'done' }] : []}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: 'var(--gold)' }} /></p>
            <p className="ant-upload-text" style={{ color: 'var(--text-secondary)' }}>
              点击或拖拽飞书导出的 Excel 文件到此处(.xlsx / .xls / .csv,≤10MB)
            </p>
            <p className="ant-upload-hint" style={{ color: 'var(--text-muted)' }}>
              从飞书多维表格 → 右上角 ··· → 导出为 Excel
            </p>
          </Dragger>

          <Space>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} onClick={handleUpload} disabled={!file || !entityType}>
              解析并预览
            </Button>
            {batchId && (
              <Button type="primary" danger icon={<CheckOutlined />} loading={confirming} onClick={() => confirmMut.mutate()} disabled={!stats || stats.valid === 0}>
                确认导入 {stats ? `(${stats.valid} 行有效)` : ''}
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {preview.length > 0 && (
        <Card title={`② 预览结果 ${stats ? `· 有效 ${stats.valid} 行 / 无效 ${stats.invalid} 行` : ''}`} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <Table<PreviewRow>
            rowKey="rowNumber"
            size="small"
            dataSource={preview.slice(0, 100)}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 900 }}
            columns={[
              { title: '行号', dataIndex: 'rowNumber', width: 60 },
              {
                title: '状态', width: 80,
                render: (_: unknown, r: PreviewRow) => r.valid ? <Tag color="success">✓ 有效</Tag> : <Tag color="error">✗ 错误</Tag>,
              },
              {
                title: '解析数据',
                render: (_: unknown, r: PreviewRow) => (
                  <pre style={{ margin: 0, fontSize: 11, maxWidth: 400, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(r.parsed, null, 0).slice(0, 200)}
                  </pre>
                ),
              },
              {
                title: '错误',
                render: (_: unknown, r: PreviewRow) => r.errors.map((e, i) => (
                  <Tag key={i} color="error">{e.field}: {e.message}</Tag>
                )),
              },
            ]}
          />
        </Card>
      )}

      <Card title="③ 导入历史" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Table<ImportBatch>
          rowKey="id"
          size="small"
          dataSource={history.items ?? []}
          columns={columns}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={detailOpen ? `导入详情 — ${detailOpen.originalName}` : ''}
        open={!!detailOpen}
        onCancel={() => setDetailOpen(null)}
        footer={null}
        width={720}
      >
        {detailOpen && (
          <ImportDetail id={detailOpen.id} />
        )}
      </Modal>
    </div>
  );
}

// 批次详情(含每行明细)
function ImportDetail({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['import-detail', id],
    queryFn: async () => (await api.get(`/imports/${id}`)).data,
  });
  if (isLoading) return <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>;
  const details = data?.details ?? [];
  return (
    <Table
      rowKey="id"
      size="small"
      dataSource={details}
      pagination={{ pageSize: 20 }}
      columns={[
        { title: '行号', dataIndex: 'rowNumber', width: 60 },
        { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'OK' ? 'success' : v === 'ERROR' ? 'error' : 'warning'}>{v}</Tag> },
        { title: '创建 ID', dataIndex: 'createdId', render: (v: string | null) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : '-' },
        { title: '错误', dataIndex: 'errorJson', render: (v: any) => v ? <Text type="danger" style={{ fontSize: 11 }}>{JSON.stringify(v)}</Text> : '-' },
      ]}
    />
  );
}
