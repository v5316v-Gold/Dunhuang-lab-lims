// =====================================================
// 贵金属业务 — W4 前端
// 功能: 取样登记 + 贵金属条码 + 扫码追溯 + 合规摘要
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, message, Row, Col, Statistic, Divider, Tabs,
} from 'antd';
import {
  PlusOutlined, AlertOutlined, QrcodeOutlined, ScanOutlined, GoldOutlined, EnvironmentOutlined, IdcardOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';

interface SamplingRow {
  id: string;
  recordNo: string;
  method: string;
  location: string;
  locationDetail?: string;
  sampledAt: string;
  sampleForm: string;
  metalType: string;
  declaredWeightG?: string;
  declaredPurityPct?: string;
  sealNo?: string;
  sample?: { id: string; sampleNo: string };
  sampledBy?: { id: string; name: string };
}

interface BarRow {
  id: string;
  barCode: string;
  metalType: string;
  qualityGrade: string;
  weightG: string;
  purityPct: string;
  serialNo?: string;
  shape?: string;
  manufacturer?: string;
  certifiedAt?: string;
  custodyLocation?: string;
  qrCodeUrl?: string;
  status: string;
  sample?: { id: string; sampleNo: string; customerName?: string };
  inspectedBy?: { id: string; name: string };
}

const METHOD_LABEL: Record<string, { label: string; color: string }> = {
  ON_SITE: { label: '现场取样', color: 'blue' },
  CUSTOMER_DELIVERED: { label: '客户送样', color: 'cyan' },
  EXPRESS: { label: '快递寄样', color: 'orange' },
  COURT_SEIZURE: { label: '司法扣押', color: 'red' },
  PRODUCTION_LINE: { label: '生产线抽样', color: 'purple' },
  OTHER: { label: '其他', color: 'default' },
};

const LOCATION_LABEL: Record<string, { label: string; color: string }> = {
  MINE: { label: '矿山', color: 'volcano' },
  REFINERY: { label: '精炼厂', color: 'orange' },
  BANK: { label: '银行金库', color: 'gold' },
  EXCHANGE: { label: '交易所', color: 'geekblue' },
  WORKSHOP: { label: '生产车间', color: 'cyan' },
  CUSTOMER_OFFICE: { label: '客户处', color: 'purple' },
  LAB: { label: '实验室内', color: 'blue' },
  OTHER: { label: '其他', color: 'default' },
};

const FORM_LABEL: Record<string, { label: string; color: string }> = {
  INGOT: { label: '金锭', color: 'gold' },
  JEWELRY: { label: '首饰', color: 'magenta' },
  POWDER: { label: '金粉', color: 'orange' },
  SOLUTION: { label: '溶液', color: 'cyan' },
  WIRE: { label: '金丝', color: 'blue' },
  LEAF: { label: '金箔', color: 'purple' },
  SCRAP: { label: '回收料', color: 'volcano' },
  ALLOY: { label: '合金', color: 'green' },
  OTHER: { label: '其他', color: 'default' },
};

const METAL_LABEL: Record<string, { label: string; color: string }> = {
  AU: { label: '金', color: 'gold' },
  AG: { label: '银', color: 'default' },
  PT: { label: '铂', color: 'cyan' },
  PD: { label: '钯', color: 'purple' },
  RH: { label: '铑', color: 'magenta' },
  IR: { label: '铱', color: 'blue' },
  OS: { label: '锇', color: 'volcano' },
  RU: { label: '钌', color: 'orange' },
};

const GRADE_LABEL: Record<string, { label: string; color: string }> = {
  AU9999: { label: 'AU9999 足金', color: 'gold' },
  AU999: { label: 'AU999 千足金', color: 'gold' },
  AU995: { label: 'AU995 工业金', color: 'orange' },
  AU990: { label: 'AU990 足金', color: 'gold' },
  AU916: { label: 'AU916 22K', color: 'gold' },
  AU750: { label: 'AU750 18K', color: 'gold' },
  AU585: { label: 'AU585 14K', color: 'gold' },
  CUSTOM: { label: '其他定制', color: 'default' },
};

export function PreciousMetalList() {
  const [samplings, setSamplings] = useState<SamplingRow[]>([]);
  const [bars, setBars] = useState<BarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [createSamplingOpen, setCreateSamplingOpen] = useState(false);
  const [createBarOpen, setCreateBarOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const [samplingForm] = Form.useForm();
  const [barForm] = Form.useForm();
  const [scanForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [srRes, barRes] = await Promise.all([
        api.get('/precious-metal/sampling/list', { params: { page: 1, pageSize: 20 } }),
        api.get('/precious-metal/bar/list', { params: { page: 1, pageSize: 20 } }),
      ]);
      setSamplings(srRes.data.items ?? []);
      setBars(barRes.data.items ?? []);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/precious-metal/summary');
      setSummary(res.data);
      setSummaryOpen(true);
    } catch {
      message.error('加载合规摘要失败');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateSampling = async () => {
    try {
      const values = await samplingForm.validateFields();
      await api.post('/precious-metal/sampling', values);
      message.success('取样登记成功');
      setCreateSamplingOpen(false);
      samplingForm.resetFields();
      load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('登记失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleCreateBar = async () => {
    try {
      const values = await barForm.validateFields();
      await api.post('/precious-metal/bar', values);
      message.success('贵金属条码生成成功');
      setCreateBarOpen(false);
      barForm.resetFields();
      load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('条码生成失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleScan = async () => {
    try {
      const values = await scanForm.validateFields();
      const res = await api.get(`/precious-metal/bar/scan/${values.barCode}`);
      setScanResult(res.data);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('查询失败:' + (e?.response?.data?.message ?? e?.message));
      setScanResult(null);
    }
  };

  const samplingColumns = [
    {
      title: '取样单号',
      dataIndex: 'recordNo',
      key: 'recordNo',
      width: 150,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--gold, #D4AF37)' }}>{v}</span>,
    },
    {
      title: '方式',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (v: string) => {
        const meta = METHOD_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      width: 110,
      render: (v: string, r: SamplingRow) => {
        const meta = LOCATION_LABEL[v] ?? { label: v, color: 'default' };
        return <span><Tag color={meta.color}>{meta.label}</Tag>{r.locationDetail ?? ''}</span>;
      },
    },
    {
      title: '形态',
      dataIndex: 'sampleForm',
      key: 'sampleForm',
      width: 90,
      render: (v: string) => {
        const meta = FORM_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '金属',
      dataIndex: 'metalType',
      key: 'metalType',
      width: 80,
      render: (v: string) => {
        const meta = METAL_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '声明重量(g)',
      dataIndex: 'declaredWeightG',
      key: 'declaredWeightG',
      width: 130,
      render: (v?: string) => v ? parseFloat(v).toFixed(3) : '-',
    },
    {
      title: '声明纯度(%)',
      dataIndex: 'declaredPurityPct',
      key: 'declaredPurityPct',
      width: 130,
      render: (v?: string) => v ? parseFloat(v).toFixed(4) : '-',
    },
    {
      title: '封条号',
      dataIndex: 'sealNo',
      key: 'sealNo',
      width: 150,
    },
    {
      title: '取样人',
      dataIndex: ['sampledBy', 'name'],
      key: 'sampledBy',
      width: 90,
    },
    {
      title: '取样时间',
      dataIndex: 'sampledAt',
      key: 'sampledAt',
      width: 160,
      render: (v: string) => v?.substring(0, 19).replace('T', ' '),
    },
  ];

  const barColumns = [
    {
      title: '条码',
      dataIndex: 'barCode',
      key: 'barCode',
      width: 200,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--gold, #D4AF37)', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '金属',
      dataIndex: 'metalType',
      key: 'metalType',
      width: 80,
      render: (v: string) => {
        const meta = METAL_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '成色',
      dataIndex: 'qualityGrade',
      key: 'qualityGrade',
      width: 130,
      render: (v: string) => {
        const meta = GRADE_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '重量(g)',
      dataIndex: 'weightG',
      key: 'weightG',
      width: 100,
      render: (v: string) => parseFloat(v).toFixed(4),
    },
    {
      title: '纯度(%)',
      dataIndex: 'purityPct',
      key: 'purityPct',
      width: 100,
      render: (v: string) => parseFloat(v).toFixed(4),
    },
    {
      title: '厂家',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 130,
    },
    {
      title: '形状',
      dataIndex: 'shape',
      key: 'shape',
      width: 90,
    },
    {
      title: '出证',
      dataIndex: 'certifiedAt',
      key: 'certifiedAt',
      width: 150,
      render: (v?: string) => v ? v.substring(0, 10) : '-',
    },
    {
      title: '保管位置',
      dataIndex: 'custodyLocation',
      key: 'custodyLocation',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <GoldOutlined />
            <span>贵金属业务</span>
            <Tag color="gold">CNAS §7.5 + §7.8(抽样)+ §7.4(记录)</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>扫码追溯</Button>
            <Button icon={<AlertOutlined />} onClick={loadSummary}>合规摘要</Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateBarOpen(true)}>生成条码</Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="bars"
          items={[
            {
              key: 'bars',
              label: <span><QrcodeOutlined /> 贵金属条码 ({bars.length})</span>,
              children: (
                <Table
                  rowKey="id"
                  columns={barColumns}
                  dataSource={bars}
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'samplings',
              label: <span><EnvironmentOutlined /> 取样记录 ({samplings.length})</span>,
              children: (
                <div>
                  <Space style={{ marginBottom: 12 }}>
                    <Button icon={<PlusOutlined />} onClick={() => setCreateSamplingOpen(true)}>取样登记</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={samplingColumns}
                    dataSource={samplings}
                    loading={loading}
                    scroll={{ x: 1300 }}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 取样登记 */}
      <Modal title="取样登记(CNAS §7.8)" open={createSamplingOpen} onOk={handleCreateSampling} onCancel={() => setCreateSamplingOpen(false)} width={720}>
        <Form form={samplingForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="取样方式" name="method" rules={[{ required: true }]}>
                <Select options={Object.entries(METHOD_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="取样地点" name="location" rules={[{ required: true }]}>
                <Select options={Object.entries(LOCATION_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="详细地址" name="locationDetail">
            <Input placeholder="如:中国工商银行金库 B-12" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="样品形态" name="sampleForm" rules={[{ required: true }]}>
                <Select options={Object.entries(FORM_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="金属种类" name="metalType" rules={[{ required: true }]}>
                <Select options={Object.entries(METAL_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="客户代表姓名" name="customerRepName">
                <Input placeholder="如:李经理" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="客户代表身份证号" name="customerRepIdNo">
                <Input placeholder="18 位身份证" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="见证人姓名" name="witnessName">
                <Input placeholder="如:王会计" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="见证人身份证号" name="witnessIdNo">
                <Input placeholder="18 位身份证" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="声明重量(g)" name="declaredWeightG">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="声明纯度(%)" name="declaredPurityPct">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="封条号" name="sealNo">
                <Input placeholder="SEAL-AU-2026-001" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="包装形式" name="packagingType">
            <Input placeholder="铅封袋/真空袋/..." />
          </Form.Item>
          <Form.Item label="监管链说明" name="chainOfCustody">
            <Input.TextArea rows={2} placeholder="客户→取样人→实验室接样 全程双人双锁" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 生成条码 */}
      <Modal title={<Space><QrcodeOutlined />生成贵金属条码</Space>} open={createBarOpen} onOk={handleCreateBar} onCancel={() => setCreateBarOpen(false)} width={720}>
        <Form form={barForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="样品 ID(UUID)" name="sampleId" rules={[{ required: true }]}>
            <Input placeholder="如:952cf4a1-07a5-4cda-9e84-2d5e76c15e06" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="金属种类" name="metalType" rules={[{ required: true }]}>
                <Select options={Object.entries(METAL_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="成色" name="qualityGrade" rules={[{ required: true }]}>
                <Select options={Object.entries(GRADE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="实测重量(g)" name="weightG" rules={[{ required: true }]}>
                <InputNumber min={0.0001} step={0.0001} style={{ width: '100%' }} placeholder="31.1050" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="实测纯度(%)" name="purityPct" rules={[{ required: true }]}>
                <InputNumber min={0.01} max={100} step={0.01} style={{ width: '100%' }} placeholder="99.99" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="出厂序列号" name="serialNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="生产厂家" name="manufacturer">
                <Input placeholder="上海金交所" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="形状" name="shape">
                <Input placeholder="金锭" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="尺寸" name="dimensions">
                <Input placeholder="40×25×8 mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="二维码 URL" name="qrCodeUrl">
            <Input placeholder="https://lims.dunhuang.cn/qr/BAR-AU-..." />
          </Form.Item>
          <Form.Item label="保管位置" name="custodyLocation">
            <Input placeholder="金库 P-01 第 3 层" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫码追溯 */}
      <Modal
        title={<Space><ScanOutlined />扫码追溯</Space>}
        open={scanOpen}
        onCancel={() => { setScanOpen(false); setScanResult(null); }}
        footer={<Button onClick={() => { setScanOpen(false); setScanResult(null); }}>关闭</Button>}
        width={720}
      >
        <Form form={scanForm} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item label="条码" name="barCode" rules={[{ required: true }]}>
            <Input placeholder="BAR-AU-202608-0001" style={{ width: 320 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<ScanOutlined />} onClick={handleScan}>追溯</Button>
          </Form.Item>
        </Form>
        {scanResult && (
          <div style={{ background: 'rgba(212,175,55,0.08)', padding: 16, borderRadius: 4, border: '1px solid var(--gold, #D4AF37)' }}>
            <h3 style={{ color: 'var(--gold, #D4AF37)', marginTop: 0 }}>
              <QrcodeOutlined /> {scanResult.barCode}
            </h3>
            <Row gutter={[16, 8]}>
              <Col span={12}>金属:<Tag color={(METAL_LABEL[scanResult.metalType] ?? { color: 'default' }).color}>{(METAL_LABEL[scanResult.metalType] ?? { label: scanResult.metalType }).label}</Tag></Col>
              <Col span={12}>成色:<Tag color={(GRADE_LABEL[scanResult.qualityGrade] ?? { color: 'default' }).color}>{(GRADE_LABEL[scanResult.qualityGrade] ?? { label: scanResult.qualityGrade }).label}</Tag></Col>
              <Col span={12}>重量:<b>{parseFloat(scanResult.weightG).toFixed(4)} g</b></Col>
              <Col span={12}>纯度:<b>{parseFloat(scanResult.purityPct).toFixed(4)} %</b></Col>
              <Col span={24}>厂家:{scanResult.manufacturer ?? '-'} / 序列号:{scanResult.serialNo ?? '-'}</Col>
              <Col span={24}>检测员:{scanResult.inspectedBy?.name ?? '-'}</Col>
              <Col span={24}>出证:{scanResult.certifiedAt?.substring(0, 19)?.replace('T', ' ')}</Col>
              <Col span={24}>样品:<b>{scanResult.sample?.sampleNo ?? '-'}</b> / 客户:{scanResult.sample?.customerName ?? '-'}</Col>
              <Col span={24}>检测次数:{scanResult.sample?.tests?.length ?? 0} 次</Col>
              <Col span={24}>报告数:{scanResult.sample?.reports?.length ?? 0} 份</Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 合规摘要 */}
      <Modal
        title={<Space><AlertOutlined />贵金属合规摘要(CNAS §7.5 + §7.8)</Space>}
        open={summaryOpen}
        footer={<Button onClick={() => setSummaryOpen(false)}>关闭</Button>}
        onCancel={() => setSummaryOpen(false)}
        width={720}
      >
        {summary && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="取样记录总数" value={summary.totalSampling ?? 0} /></Col>
              <Col span={6}><Statistic title="今日取样" value={summary.todaySampling ?? 0} valueStyle={{ color: '#4A9A7A' }} /></Col>
              <Col span={6}><Statistic title="条码总数" value={summary.totalBars ?? 0} /></Col>
              <Col span={6}><Statistic title="已作废" value={summary.voidedBars ?? 0} valueStyle={{ color: '#B85450' }} /></Col>
            </Row>
            <Divider />
            <h4>按成色分布</h4>
            <Table
              rowKey={(r: any) => r.grade}
              size="small"
              pagination={false}
              showHeader={false}
              dataSource={summary.byGrade ?? []}
              columns={[
                { title: '成色', dataIndex: 'grade', key: 'grade', render: (g: string) => {
                  const meta = GRADE_LABEL[g] ?? { label: g, color: 'default' };
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                } },
                { title: '数量', dataIndex: 'count', key: 'count', align: 'right' },
                { title: '总重(g)', dataIndex: 'totalWeightG', key: 'totalWeightG', align: 'right', render: (w: string) => parseFloat(w).toFixed(4) },
              ]}
            />
            <Divider />
            <h4>按金属分布</h4>
            <Table
              rowKey={(r: any) => r.metal}
              size="small"
              pagination={false}
              showHeader={false}
              dataSource={summary.byMetal ?? []}
              columns={[
                { title: '金属', dataIndex: 'metal', key: 'metal', render: (m: string) => {
                  const meta = METAL_LABEL[m] ?? { label: m, color: 'default' };
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                } },
                { title: '数量', dataIndex: 'count', key: 'count', align: 'right' },
                { title: '总重(g)', dataIndex: 'totalWeightG', key: 'totalWeightG', align: 'right', render: (w: string) => parseFloat(w).toFixed(4) },
              ]}
            />
            <Divider />
            <div style={{ color: 'var(--text-secondary, #888)', fontSize: 12 }}>
              检查时间: {summary.checkedAt}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}