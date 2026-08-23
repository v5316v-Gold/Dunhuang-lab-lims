// =====================================================
// 文档中心 — DOC/DOCX 上传 + 文本识别
// 功能: 拖拽上传 Word 文档 → 后端自动提取正文 → 预览/下载
// 主题: 新中式奢华科技风(墨黑 + 辉金)
// =====================================================

import { useState } from 'react';
import { Button, Card, Space, Table, Tag, Typography, message, Modal, Upload, Popconfirm } from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileWordOutlined,
  EyeOutlined,
  InboxOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;
const { Dragger } = Upload;

interface FileRow {
  id: string;
  originalName: string;
  mimeType: string;
  size: number | string;
  category: string;
  extractedText?: string | null;
  docMeta?: { format?: string; wordCount?: number; paragraphCount?: number } | null;
  createdAt: string;
  uploadedBy?: { name?: string; username?: string };
}

function fmtSize(size: number | string): string {
  const n = Number(size);
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [preview, setPreview] = useState<FileRow | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['files', page, pageSize],
    queryFn: async () => (await api.get('/files', { params: { category: 'DOCUMENT', page, pageSize } })).data,
  });

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const fd = new FormData();
    fd.append('file', file as File);
    setUploading(true);
    try {
      const res = await api.post('/files/upload', fd, { params: { category: 'DOCUMENT' } });
      const chars = res.data?.extractedText?.length ?? 0;
      message.success(
        chars > 0 ? `上传成功,已识别 ${chars} 字符正文` : '上传成功(该文件未提取到文本)',
      );
      setPreview(res.data);
      qc.invalidateQueries({ queryKey: ['files'] });
      onSuccess?.(res.data);
    } catch (e) {
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  const download = async (row: FileRow) => {
    try {
      const res = await api.get(`/files/download/${row.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  // 删除文档(DB 记录 + MinIO 对象)
  const handleRemove = async (row: FileRow) => {
    try {
      await api.delete(`/files/${row.id}`);
      message.success('文档已删除');
      qc.invalidateQueries({ queryKey: ['files'] });
    } catch (e: any) {
      message.error('删除失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'originalName',
      render: (v: string, r: FileRow) => (
        <Space>
          <FileWordOutlined style={{ color: 'var(--gold)' }} />
          <Text style={{ color: 'var(--text-primary)' }}>{v}</Text>
          {r.docMeta?.format && <Tag color="gold">{r.docMeta.format.toUpperCase()}</Tag>}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (v: number | string) => fmtSize(v),
    },
    {
      title: '识别状态',
      width: 120,
      render: (_: unknown, r: FileRow) =>
        r.extractedText ? (
          <Tag color="success">已识别 {r.docMeta?.wordCount ?? '-'} 词</Tag>
        ) : (
          <Tag>无文本</Tag>
        ),
    },
    {
      title: '上传人',
      width: 120,
      render: (_: unknown, r: FileRow) => r.uploadedBy?.name ?? r.uploadedBy?.username ?? '-',
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 210,
      render: (_: unknown, r: FileRow) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            disabled={!r.extractedText}
            onClick={() => setPreview(r)}
          >
            识别文本
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => download(r)}>
            下载
          </Button>
          <Popconfirm
            title="删除文档"
            description="将删除数据库记录与 MinIO 对象,不可恢复。"
            onConfirm={() => handleRemove(r)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="文档中心"
        subtitle="DOC/DOCX 上传 + 文本识别 · 委托单/标准/作业指导书归档"
        icon={<FileWordOutlined />}
      />

      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Dragger
          accept=".doc,.docx"
          multiple={false}
          showUploadList={false}
          disabled={uploading}
          customRequest={customUpload}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: 'var(--gold)' }} />
          </p>
          <p className="ant-upload-text" style={{ color: 'var(--text-secondary)' }}>
            点击或拖拽 Word 文档到此区域上传(.doc / .docx,≤10MB)
          </p>
          <p className="ant-upload-hint" style={{ color: 'var(--text-muted)' }}>
            上传后自动提取正文文本,支持检测委托单、方法标准、作业指导书归档检索
          </p>
        </Dragger>
      </Card>

      <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <Table<FileRow>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: 820 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* 识别文本预览 */}
      <Modal
        title={preview ? `识别结果 — ${preview.originalName}` : ''}
        open={!!preview}
        onCancel={() => setPreview(null)}
        footer={
          preview ? (
            <Button icon={<DownloadOutlined />} onClick={() => download(preview)}>
              下载原文件
            </Button>
          ) : null
        }
        width={680}
      >
        {preview?.extractedText ? (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
              padding: 16,
              borderRadius: 8,
              maxHeight: 420,
              overflow: 'auto',
              lineHeight: 1.8,
            }}
          >
            {preview.extractedText}
          </pre>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>该文件未提取到文本内容</div>
        )}
      </Modal>
    </div>
  );
}
