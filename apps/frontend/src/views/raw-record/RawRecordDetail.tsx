// =====================================================
// W4-B: 原始记录单详情(CNAS-CL01:2018 §7.5)
// 数据快照展示 + 锁定 + 三签(SoD 互斥) + SHA256 指纹
// =====================================================

import { useMemo, useState } from 'react';
import {
  Button, Card, Descriptions, Table, Tag, Space, App, Spin, Alert, Typography, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, LockOutlined, EditOutlined, SafetyCertificateOutlined, FileTextOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';

const { Text, Paragraph } = Typography;

interface RawRecordDetail {
  id: string;
  sheetNo: string;
  method: string;
  status: 'DRAFT' | 'LOCKED' | 'SIGNED';
  dataJson: any;
  operatorId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  lockedAt?: string | null;
  pdfSha256?: string | null;
  createdAt: string;
  sample?: { id: string; sampleNo?: string } | null;
  test?: { id: string; status?: string } | null;
  operator?: { id: string; name?: string } | null;
  reviewer?: { id: string; name?: string } | null;
  approver?: { id: string; name?: string } | null;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  LOCKED: { color: 'gold', label: '已锁定' },
  SIGNED: { color: 'green', label: '已签署' },
};

const SIGN_ROLES = [
  { key: 'OPERATOR', label: '操作员', field: 'operator' as const },
  { key: 'REVIEWER', label: '校核人', field: 'reviewer' as const },
  { key: 'APPROVER', label: '审核人', field: 'approver' as const },
];

export default function RawRecordDetail() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const { data: sheet, isLoading } = useQuery({
    queryKey: ['raw-record', id],
    queryFn: async () => (await api.get<RawRecordDetail>(`/raw-records/${id}`)).data,
    enabled: !!id,
    refetchInterval: 20000,
  });

  const lockMut = useMutation({
    mutationFn: async () => (await api.post(`/raw-records/${id}/lock`)).data,
    onSuccess: () => {
      message.success('记录单已锁定,数据冻结不可再改');
      qc.invalidateQueries({ queryKey: ['raw-record', id] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '锁定失败'),
  });

  const signMut = useMutation({
    mutationFn: async (role: string) => (await api.post(`/raw-records/${id}/sign`, { role })).data,
    onSuccess: (data) => {
      message.success(`已签署:${STATUS_META[data.status]?.label ?? data.status}`);
      qc.invalidateQueries({ queryKey: ['raw-record', id] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? '签署失败'),
  });

  const d = sheet?.dataJson ?? {};
  const fa = d.fireAssay ?? {};

  // SoD:当前用户已签署任一角色 → 其余角色禁用
  const signedIds = useMemo(() => [sheet?.operatorId, sheet?.reviewerId, sheet?.approverId].filter(Boolean), [sheet]);
  const meSignedAny = me ? signedIds.includes(me.id) : false;

  const elementColumns = [
    { title: '元素', dataIndex: 'element', width: 120 },
    { title: '浓度', dataIndex: 'concentration', width: 140 },
    { title: '单位', dataIndex: 'unit', width: 100, render: (v: string) => v ?? '-' },
  ];

  if (isLoading || !sheet) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const statusMeta = STATUS_META[sheet.status] ?? { color: 'default', label: sheet.status };
  const isDraft = sheet.status === 'DRAFT';
  const isSigned = sheet.status === 'SIGNED';

  return (
    <div>
      <PageHeader
        title={`原始记录单 ${sheet.sheetNo}`}
        subtitle={`CNAS-CL01:2018 §7.5 记录控制 · 数据快照冻结 · 三签(操作/校核/审核)`}
        icon={<FileTextOutlined />}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/raw-records')}>返回列表</Button>
            {sheet.sample?.id && (
              <Button icon={<EyeOutlined />} onClick={() => navigate(`/samples/${sheet.sample!.id}`)}>查看样品</Button>
            )}
            {isDraft && (
              <Popconfirm title="锁定后数据冻结,不可再修改,确认锁定?" onConfirm={() => lockMut.mutate()}>
                <Button type="primary" danger icon={<LockOutlined />} loading={lockMut.isPending}>锁定记录单</Button>
              </Popconfirm>
            )}
          </Space>
        }
      />

      {/* 基本信息 */}
      <Card
        size="small"
        title={<span className="text-gold-gradient">基本信息</span>}
        style={{ marginBottom: 16, borderColor: 'var(--border-color)' }}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="记录单号">
            <span style={{ fontFamily: 'monospace', color: '#D4AF37' }}>{sheet.sheetNo}</span>
          </Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusMeta.color}>{statusMeta.label}</Tag></Descriptions.Item>
          <Descriptions.Item label="方法"><Tag>{sheet.method}</Tag></Descriptions.Item>
          <Descriptions.Item label="样品编号">{sheet.sample?.sampleNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(sheet.createdAt).toLocaleString('zh-CN', { hour12: false })}</Descriptions.Item>
          <Descriptions.Item label="锁定时间">{sheet.lockedAt ? new Date(sheet.lockedAt).toLocaleString('zh-CN', { hour12: false }) : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 数据快照 */}
      <Card
        size="small"
        title={<span className="text-gold-gradient">原始数据快照(冻结)</span>}
        style={{ marginBottom: 16, borderColor: 'var(--border-color)' }}
        extra={<Tag color="cyan">生成时冻结</Tag>}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="样品类型">{d.sampleType ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="样品重量">{d.weightG ?? '-'} g</Descriptions.Item>
          <Descriptions.Item label="纯度">{d.purityPct ?? '-'}%</Descriptions.Item>
          <Descriptions.Item label="不确定度">{d.uncertainty ?? '-'}%</Descriptions.Item>
          <Descriptions.Item label="QC 判定">
            {d.qcPassed === true ? <Tag color="green">通过</Tag> : d.qcPassed === false ? <Tag color="red">失败</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">{d.completedAt ? new Date(d.completedAt).toLocaleString('zh-CN', { hour12: false }) : '-'}</Descriptions.Item>
        </Descriptions>

        {fa && Object.keys(fa).length > 0 && (
          <>
            <Text strong style={{ display: 'block', marginBottom: 8, color: 'var(--text-primary)' }}>火试金工艺参数</Text>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="称样量">{fa.sampleWeightG ?? '-'} g</Descriptions.Item>
              <Descriptions.Item label="混料">{fa.mixingTempC ?? '-'}°C / {fa.mixingDurationMin ?? '-'} min</Descriptions.Item>
              <Descriptions.Item label="熔融">{fa.fusingTempC ?? '-'}°C / {fa.fusingDurationMin ?? '-'} min</Descriptions.Item>
              <Descriptions.Item label="灰吹">{fa.cupellationTempC ?? '-'}°C / {fa.cupellationDurationMin ?? '-'} min</Descriptions.Item>
              <Descriptions.Item label="分金">{fa.partingAcid ?? '-'} / {fa.partingDurationMin ?? '-'} min</Descriptions.Item>
              <Descriptions.Item label="退火">{fa.annealingTempC ?? '-'}°C</Descriptions.Item>
              <Descriptions.Item label="灰吹后金粒重">{fa.prillWeightG ?? '-'} g</Descriptions.Item>
              <Descriptions.Item label="QC 回收率">{fa.qcRecoveryPct ?? '-'}%</Descriptions.Item>
            </Descriptions>
          </>
        )}

        {(d.elementResults?.length ?? 0) > 0 && (
          <>
            <Text strong style={{ display: 'block', marginBottom: 8, color: 'var(--text-primary)' }}>ICP 元素结果</Text>
            <Table
              rowKey="element"
              size="small"
              columns={elementColumns}
              dataSource={d.elementResults}
              pagination={false}
              locale={{ emptyText: '暂无元素结果' }}
            />
          </>
        )}
      </Card>

      {/* 三签区 */}
      <Card
        size="small"
        title={<span className="text-gold-gradient">三签(SoD 互斥)</span>}
        extra={<SafetyCertificateOutlined style={{ color: 'var(--gold)' }} />}
        style={{ marginBottom: 16, borderColor: 'var(--border-color)' }}
      >
        <Space size={16} wrap>
          {SIGN_ROLES.map((r) => {
            const person = sheet[r.field];
            const signed = !!person;
            return (
              <Card key={r.key} size="small" style={{ width: 180, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.label}</div>
                <div style={{ margin: '8px 0', minHeight: 24 }}>
                  {signed ? (
                    <Tag color="green" icon={<SafetyCertificateOutlined />}>{person?.name ?? '已签'}</Tag>
                  ) : (
                    <Tag>{'待签'}</Tag>
                  )}
                </div>
                <Button
                  size="small"
                  type={signed ? 'default' : 'primary'}
                  icon={<EditOutlined />}
                  disabled={signed || isSigned || meSignedAny}
                  loading={signMut.isPending}
                  onClick={() => signMut.mutate(r.key)}
                >
                  {signed ? '已签署' : '签署'}
                </Button>
              </Card>
            );
          })}
        </Space>
        {meSignedAny && !isSigned && (
          <Alert type="warning" showIcon message="您已签署其中一个角色,同一人不能签署多个角色(SoD 互斥),请由其他人员签署。" style={{ marginTop: 12 }} />
        )}
        {!isDraft && !isSigned && (
          <Alert type="info" showIcon message="记录单已锁定,可进行签署;锁定仅冻结数据,签署仍可继续。" style={{ marginTop: 12 }} />
        )}
      </Card>

      {/* 完整性指纹 */}
      {sheet.pdfSha256 && (
        <Card size="small" title={<span className="text-gold-gradient">完整性指纹(SHA256)</span>} style={{ borderColor: 'var(--border-color)' }}>
          <Paragraph copyable style={{ fontFamily: 'var(--font-mono)', fontSize: 12, margin: 0 }}>
            {sheet.pdfSha256}
          </Paragraph>
          <Text type="secondary" style={{ fontSize: 12 }}>三签完成后生成的 PDF 摘要,用于审计追溯与电子档案核验。</Text>
        </Card>
      )}
    </div>
  );
}
