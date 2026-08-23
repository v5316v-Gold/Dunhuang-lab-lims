// =====================================================
// 检测报告列表 — 交互完善(远程样品选择 + 状态筛选 + PDF 按状态启用)
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, Modal, Tag, Space, App, Select, Tooltip, Badge } from 'antd';
import { PlusOutlined, FileDoneOutlined, EyeOutlined, DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface ReportRow {
  id: string;
  reportNo: string;
  status: string;
  issuedAt?: string;
  createdAt: string;
  sample?: { sampleNo: string; customerName: string };
}

const STATUS_OPTS = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'INTERNAL_REVIEW', label: '内部审核' },
  { value: 'FINAL_REVIEW', label: '终审' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'ISSUED', label: '已签发' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'SUPERSEDED', label: '已作废' },
];

export function ReportsList() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['reports', page, status],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (status) params.status = status;
      return (await api.get('/reports', { params })).data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (sampleId: string) => (await api.post('/reports', { sampleId })).data,
    onSuccess: (created) => {
      message.success('报告草稿已创建');
      setCreateOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['reports'] });
      navigate(`/reports/${created.id}`);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '创建失败'),
  });

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

  return (
    <div>
      <PageHeader
        title="检测报告"
        subtitle="CNAS §7.8 结果报告 · 多级审核 + 电子签名 + PDF 预览/下载(仅已签发)"
        icon={<FileDoneOutlined />}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="状态筛选"
              style={{ width: 140 }}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={STATUS_OPTS}
            />
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['reports'] })}>刷新</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setCreateOpen(true); }}
              style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
            >
              创建报告
            </Button>
          </Space>
        }
      />

      <DataTable<ReportRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={{
          current: page,
          total: data?.total ?? 0,
          pageSize: 20,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
        columns={[
          { title: '报告编号', dataIndex: 'reportNo', width: 160, render: (v: string) => <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{v}</span> },
          { title: '样品编号', dataIndex: ['sample', 'sampleNo'], width: 140, render: (v: string) => v ?? '—' },
          { title: '客户', dataIndex: ['sample', 'customerName'], ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
          {
            title: '签发时间', dataIndex: 'issuedAt', width: 160,
            render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—'),
          },
          {
            title: '操作',
            width: 220,
            fixed: 'right' as const,
            render: (_: any, row: ReportRow) => {
              const issued = row.status === 'ISSUED';
              return (
                <Space size={4} wrap>
                  <Tooltip title={issued ? '预览 PDF' : '签发后才可预览 PDF'}>
                    <Button size="small" type="primary" ghost icon={<EyeOutlined />} disabled={!issued} onClick={() => previewPdf(row)}>
                      预览
                    </Button>
                  </Tooltip>
                  <Tooltip title={issued ? '下载 PDF' : '签发后才可下载 PDF'}>
                    <Button size="small" icon={<DownloadOutlined />} disabled={!issued} onClick={() => downloadPdf(row)}>
                      下载
                    </Button>
                  </Tooltip>
                  <Button size="small" icon={<FilePdfOutlined />} onClick={() => navigate(`/reports/${row.id}`)}>
                    详情/审核
                  </Button>
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        title="创建报告(选已完成检测的样品)"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createMut.mutate(values.sampleId)}>
          <Form.Item
            name="sampleId"
            label="样品"
            rules={[{ required: true, message: '请选择样品' }]}
            extra="远程搜索样品编号;样品需处于已检测/报告流转状态"
          >
            <ReportSampleSelect />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** 可建报告的样品远程搜索(TESTED 及之后状态) */
function ReportSampleSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['report-sample-options', keyword],
    queryFn: async () => {
      const params: any = { page: 1, pageSize: 30 };
      if (keyword) params.sampleNo = keyword;
      return (await api.get('/samples', { params })).data;
    },
  });
  const options = (data?.data ?? [])
    .filter((s: any) => ['TESTED', 'REPORT_DRAFT', 'REPORT_REVIEW', 'REPORT_APPROVED'].includes(s.status))
    .map((s: any) => ({
      value: s.id,
      label: `${s.sampleNo}(${s.sampleType}) · ${s.customerName ?? ''}`,
    }));
  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      loading={isLoading}
      options={options}
      placeholder="输入样品编号搜索…"
      filterOption={false}
      onSearch={(v) => setKeyword(v)}
      notFoundContent="未找到可建报告的样品(需已检测)"
      style={{ width: '100%' }}
    />
  );
}
