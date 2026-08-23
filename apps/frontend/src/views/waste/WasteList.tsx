// =====================================================
// 危废管理列表 — W1 前端
// 功能: 危废登记 + 转移 + 处置 + 合规摘要
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, message, Row, Col, Statistic, Divider, Radio,
} from 'antd';
import {
  PlusOutlined, AlertOutlined, TruckOutlined, FireOutlined, GoldOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface WasteRow {
  id: string;
  code: string;
  type: string;
  hazardClass: string;
  hazardDesc?: string;
  sourceType?: string;
  weightKg: string;
  volumeL?: string;
  containerCount?: number;
  containerType?: string;
  storageLocation?: string;
  hazardManagerId?: string;
  status: string;
  generatedAt: string;
  transferredAt?: string;
  receiverName?: string;
  receiverLicenceNo?: string;
  transferManifestNo?: string;
  disposalAt?: string;
  disposalMethod?: string;
  recoveredGoldWeightG?: string;
  remarks?: string;
}

const WASTE_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  WASTE_LIQUID: { label: '废液', color: 'blue' },
  WASTE_SOLID: { label: '固废', color: 'orange' },
  WASTE_GOLD_BEARING: { label: '含金废物', color: 'gold' },
  WASTE_REAGENT: { label: '失效试剂', color: 'magenta' },
  CONTAMINATED_SAMPLE: { label: '污染样品', color: 'volcano' },
  OTHER: { label: '其他', color: 'default' },
};

const HAZARD_CLASS_LABEL: Record<string, { label: string; color: string }> = {
  HW34: { label: 'HW34 废酸', color: 'red' },
  HW29: { label: 'HW29 含汞废物', color: 'purple' },
  HW37: { label: 'HW37 有机磷化合物', color: 'volcano' },
  HW35: { label: 'HW35 废碱', color: 'orange' },
  GENERIC_HAZARDOUS: { label: '一般危废', color: 'gold' },
  NON_HAZARDOUS: { label: '非危废', color: 'green' },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  STORED: { label: '已暂存', color: 'default' },
  TRANSFERRED: { label: '已转移', color: 'blue' },
  INCINERATED: { label: '已焚烧', color: 'volcano' },
  RECYCLED_GOLD: { label: '海绵金回收', color: 'gold' },
  NEUTRALIZED: { label: '已中和', color: 'cyan' },
  DISPOSED: { label: '已处置', color: 'green' },
  REJECTED: { label: '已拒收', color: 'red' },
};

export function WasteList() {
  const [data, setData] = useState<WasteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [summary, setSummary] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<WasteRow | null>(null);

  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterHazardClass, setFilterHazardClass] = useState<string | undefined>();

  const [createForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [disposeForm] = Form.useForm();

  const load = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await api.get('/waste', {
        params: {
          page: p, pageSize: ps,
          type: filterType, status: filterStatus, hazardClass: filterHazardClass,
        },
      });
      setData(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载危废失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/waste/summary');
      setSummary(res.data);
      setSummaryOpen(true);
    } catch {
      message.error('加载合规摘要失败');
    }
  };

  useEffect(() => {
    load(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus, filterHazardClass]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await api.post('/waste', values);
      message.success('危废登记成功');
      setCreateOpen(false);
      createForm.resetFields();
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('登记失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleTransfer = async () => {
    if (!currentRecord) return;
    try {
      const values = await transferForm.validateFields();
      await api.post(`/waste/${currentRecord.id}/transfer`, values);
      message.success('转移登记成功,状态更新为 TRANSFERRED');
      setTransferOpen(false);
      transferForm.resetFields();
      setCurrentRecord(null);
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('转移失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleDispose = async () => {
    if (!currentRecord) return;
    try {
      const values = await disposeForm.validateFields();
      await api.post(`/waste/${currentRecord.id}/dispose`, values);
      message.success('处置完成');
      setDisposeOpen(false);
      disposeForm.resetFields();
      setCurrentRecord(null);
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('处置失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const columns = [
    {
      title: '编号',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--gold, #D4AF37)' }}>{v}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => {
        const meta = WASTE_TYPE_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '危险类别',
      dataIndex: 'hazardClass',
      key: 'hazardClass',
      width: 150,
      render: (v: string) => {
        const meta = HAZARD_CLASS_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '重量(kg)',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 100,
      render: (v: string) => parseFloat(v).toFixed(3),
    },
    {
      title: '体积(L)',
      dataIndex: 'volumeL',
      key: 'volumeL',
      width: 90,
      render: (v?: string) => v ? parseFloat(v).toFixed(3) : '-',
    },
    {
      title: '容器',
      key: 'count',
      width: 110,
      render: (_: any, r: WasteRow) =>
        r.containerCount ? `${r.containerCount}×${r.containerType ?? '?'}` : '-',
    },
    {
      title: '存放位置',
      dataIndex: 'storageLocation',
      key: 'storageLocation',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => {
        const meta = STATUS_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '产生时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      width: 160,
      render: (v: string) => v ? v.substring(0, 19).replace('T', ' ') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: WasteRow) => (
        <Space size="small">
          {r.status === 'STORED' && (
            <Button
              size="small"
              type="primary"
              icon={<TruckOutlined />}
              onClick={() => {
                setCurrentRecord(r);
                setTransferOpen(true);
              }}
            >
              转移
            </Button>
          )}
          {r.status === 'TRANSFERRED' && (
            <Button
              size="small"
              type="primary"
              icon={<FireOutlined />}
              onClick={() => {
                setCurrentRecord(r);
                setDisposeOpen(true);
              }}
            >
              处置
            </Button>
          )}
          {(r.status === 'STORED' || r.status === 'TRANSFERRED') && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={async () => {
                try {
                  await api.post(`/waste/${r.id}/dispose`, { method: '其他方式处置', recoveredGoldWeightG: '0' });
                  message.success('已处置');
                  load(1, pageSize);
                } catch (e: any) {
                  message.error('处置失败:' + (e?.response?.data?.message ?? e?.message));
                }
              }}
            >
              处置
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
          <div>
      <PageHeader
        title="危废管理"
        subtitle="CNAS §7.10 不符合工作 · 危废台账 + 处置"
        icon={<GoldOutlined />}
        extra={
          <Space>
            <Button icon={<AlertOutlined />} onClick={loadSummary}>合规摘要</Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>危废登记</Button>
          </Space>
        }
      />
        {/* 筛选 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="危废类型"
            allowClear
            style={{ width: 130 }}
            value={filterType}
            onChange={setFilterType}
            options={Object.entries(WASTE_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            placeholder="危险类别"
            allowClear
            style={{ width: 170 }}
            value={filterHazardClass}
            onChange={setFilterHazardClass}
            options={Object.entries(HAZARD_CLASS_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 130 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Space>

        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); load(p, ps); },
          }}
        />
      </div>

      {/* 创建危废 */}
      <Modal title="危废登记" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} width={720}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                <Select options={Object.entries(WASTE_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="危险类别" name="hazardClass" rules={[{ required: true }]}>
                <Select options={Object.entries(HAZARD_CLASS_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="危险描述" name="hazardDesc">
            <Input placeholder="如:王水废液、含黄金滤纸残渣等" />
          </Form.Item>
          <Form.Item label="来源类型" name="sourceType" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'TEST', label: '检测产生' },
                { value: 'SAMPLE_PREP', label: '样品制备' },
                { value: 'EQUIPMENT_CLEAN', label: '设备清洗' },
                { value: 'OTHER', label: '其他' },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="重量(kg)" name="weightKg" rules={[{ required: true }]}>
                <InputNumber min={0.001} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="体积(L)" name="volumeL">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="容器数量" name="containerCount" initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="容器类型" name="containerType">
                <Input placeholder="如:25L 塑料桶" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="存放位置" name="storageLocation" rules={[{ required: true }]}>
                <Input placeholder="危废暂存间 A-01" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转移登记 */}
      <Modal
        title={<Space><TruckOutlined />危废转移登记(CNAS §7.10)</Space>}
        open={transferOpen}
        onOk={handleTransfer}
        onCancel={() => setTransferOpen(false)}
        width={720}
      >
        {currentRecord && (
          <div style={{ background: 'rgba(212,175,55,0.08)', padding: 12, marginTop: 16, marginBottom: 12, borderRadius: 4, border: '1px solid var(--gold, #D4AF37)' }}>
            <Space direction="vertical" size={0}>
              <div>登记编号:<b style={{ color: 'var(--gold, #D4AF37)' }}>{currentRecord.code}</b></div>
              <div>类型:{WASTE_TYPE_LABEL[currentRecord.type]?.label ?? currentRecord.type} | 重量:{parseFloat(currentRecord.weightKg).toFixed(3)} kg | 类别:{HAZARD_CLASS_LABEL[currentRecord.hazardClass]?.label ?? currentRecord.hazardClass}</div>
              <div>状态:<Tag>{STATUS_LABEL[currentRecord.status]?.label}</Tag></div>
            </Space>
          </div>
        )}
        <Form form={transferForm} layout="vertical">
          <Form.Item label="接收企业名称" name="receiverName" rules={[{ required: true }]}>
            <Input placeholder="如:甘肃金亿环保科技有限公司" />
          </Form.Item>
          <Form.Item label="接收企业资质证号(CNAS §7.10 必填)" name="receiverLicenceNo" rules={[{ required: true, message: '危废接收企业资质证号必填(CNAS §7.10)' }]}>
            <Input placeholder="如:GS-HW-2024-0815" />
          </Form.Item>
          <Form.Item label="危废转移联单号" name="transferManifestNo" rules={[{ required: true }]}>
            <Input placeholder="如:MAN-WT-20260815-0001" />
          </Form.Item>
          <Form.Item label="转移联单附件 ID" name="transferManifestFileId">
            <Input placeholder="(可选)MinIO 文件 UUID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 处置确认 */}
      <Modal
        title={<Space><FireOutlined />危废处置确认</Space>}
        open={disposeOpen}
        onOk={handleDispose}
        onCancel={() => setDisposeOpen(false)}
        width={640}
      >
        {currentRecord && (
          <div style={{ background: 'rgba(212,175,55,0.08)', padding: 12, marginTop: 16, marginBottom: 12, borderRadius: 4, border: '1px solid var(--gold, #D4AF37)' }}>
            <Space direction="vertical" size={0}>
              <div>登记编号:<b style={{ color: 'var(--gold, #D4AF37)' }}>{currentRecord.code}</b></div>
              <div>类型:{WASTE_TYPE_LABEL[currentRecord.type]?.label ?? currentRecord.type} | 重量:{parseFloat(currentRecord.weightKg).toFixed(3)} kg</div>
            </Space>
          </div>
        )}
        <Form form={disposeForm} layout="vertical">
          <Form.Item label="处置方式" name="method" rules={[{ required: true }]}>
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="高温焚烧1200°C以上">高温焚烧(&gt;1200°C) — INCINERATED</Radio>
                <Radio value="海绵金回收">海绵金回收 — RECYCLED_GOLD</Radio>
                <Radio value="中和处理">中和处理 — NEUTRALIZED</Radio>
                <Radio value="安全填埋">安全填埋 — DISPOSED</Radio>
                <Radio value="其他合规处置">其他合规处置 — DISPOSED</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="回收黄金重量(g,仅含金废物)" name="recoveredGoldWeightG">
            <InputNumber min={0} step={0.001} style={{ width: '100%' }} placeholder="可选,如 0.0123" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合规摘要 */}
      <Modal
        title={<Space><AlertOutlined />危废合规摘要(CNAS §7.10)</Space>}
        open={summaryOpen}
        footer={<Button onClick={() => setSummaryOpen(false)}>关闭</Button>}
        onCancel={() => setSummaryOpen(false)}
        width={800}
      >
        {summary && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="总条目数" value={summary.total ?? 0} /></Col>
              <Col span={6}><Statistic title="总重量(kg)" value={summary.totalKg ?? '0'} valueStyle={{ color: '#D4AF37' }} /></Col>
              <Col span={6}><Statistic title="暂存中(kg)" value={summary.storedKg ?? '0'} /></Col>
              <Col span={6}><Statistic title="已转移(kg)" value={summary.transferredKg ?? '0'} /></Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <h4>按状态分布</h4>
                <DataTable
                  rowKey={(r: any) => r.status}
                  size="small"
                  pagination={false}
                  showHeader={false}
                  dataSource={Object.entries(summary.byStatus ?? {}).map(([status, count]) => ({
                    status, count,
                  }))}
                  columns={[
                    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
                      const meta = STATUS_LABEL[s] ?? { label: s, color: 'default' };
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    } },
                    { title: '数量', dataIndex: 'count', key: 'count', align: 'right' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <h4>按危险类别分布</h4>
                <DataTable
                  rowKey={(r: any) => r.cls}
                  size="small"
                  pagination={false}
                  showHeader={false}
                  dataSource={Object.entries(summary.byClass ?? {}).map(([cls, count]) => ({
                    cls, count,
                  }))}
                  columns={[
                    { title: '类别', dataIndex: 'cls', key: 'cls', render: (c: string) => {
                      const meta = HAZARD_CLASS_LABEL[c] ?? { label: c, color: 'default' };
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    } },
                    { title: '数量', dataIndex: 'count', key: 'count', align: 'right' },
                  ]}
                />
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}