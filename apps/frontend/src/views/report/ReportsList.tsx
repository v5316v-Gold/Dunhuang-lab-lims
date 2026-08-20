// =====================================================
// 检测报告列表 — 前端填充(原空壳页补全)
// 功能: 报告列表 + 创建报告 + 跳转详情 + 预览/下载 PDF
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, Modal, Tag, message, Space } from 'antd';
import { PlusOutlined, FileDoneOutlined, EyeOutlined, DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface ReportRow {
  id: string;
  reportNo: string;
  status: string;
  issuedAt?: string;
  createdAt: string;
  sample?: { sampleNo: string; customerName: string };
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  INTERNAL_REVIEW: 'var(--info)',
  FINAL_REVIEW: 'var(--warning)',
  APPROVED: 'var(--success)',
  ISSUED: 'var(--success)',
  REJECTED: 'var(--error)' };

export function ReportsList() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/reports', { params: { page: p, pageSize: 20 } });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 获取 PDF blob(带 JWT,axios 拦截器自动注入 token)
  const fetchPdfBlob = async (id: string): Promise<Blob> => {
    const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
    return res.data as Blob;
  };

  // 新窗口预览 PDF
  const previewPdf = async (row: ReportRow) => {
    try {
      const blob = await fetchPdfBlob(row.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // 稍后释放(延迟,避免预览未加载完就释放)
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '预览失败(报告可能尚未签发 PDF)');
    }
  };

  // 下载 PDF
  const downloadPdf = async (row: ReportRow) => {
    try {
      const blob = await fetchPdfBlob(row.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.reportNo || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('报告已下载');
    } catch (e: any) {
      message.error(e?.response?.data?.message || '下载失败(报告可能尚未签发 PDF)');
    }
  };

  const create = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败,保持弹窗打开
    }
    try {
      await api.post('/reports', { sampleId: values.sampleId });
      message.success('报告已创建');
      setCreateOpen(false);
      form.resetFields();
      load(1);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  return (
    <div>
      <PageHeader
        title="检测报告"
        subtitle="CNAS §7.8 结果报告 · 多级审核 + 电子签名 + PDF 预览/下载"
        icon={<FileDoneOutlined />}
        extra={<Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          创建报告
        </Button>}
      />

      <DataTable<ReportRow>
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => { setPage(p); load(p); } }}
        locale={{ emptyText: '暂无报告' }}
        columns={[
          { title: '报告编号', dataIndex: 'reportNo', render: (v) => <span style={{ color: 'var(--gold)' }}>{v}</span> },
          { title: '样品编号', dataIndex: ['sample', 'sampleNo'], render: (v) => v ?? '—' },
          { title: '客户', dataIndex: ['sample', 'customerName'], render: (v) => v ?? '—' },
          {
            title: '状态',
            dataIndex: 'status',
            render: statusTag },
          { title: '签发时间', dataIndex: 'issuedAt', render: (v) => (v ? new Date(v).toLocaleString() : '—') },
          {
            title: '操作',
            width: 200,
            render: (_, row) => (
              <Space size={4} wrap>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<EyeOutlined />}
                  onClick={() => previewPdf(row)}
                >
                  预览
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadPdf(row)}
                >
                  下载
                </Button>
                <Button
                  size="small"
                  icon={<FilePdfOutlined />}
                  onClick={() => navigate(`/reports/${row.id}`)}
                >
                  审核
                </Button>
              </Space>
            ) },
        ]}
      />

      <Modal title="创建报告" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={create} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="sampleId" label="样品 ID" rules={[{ required: true, message: '请输入样品 ID' }]}>
            <Input placeholder="粘贴样品 UUID(样品需已完成检测)" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
