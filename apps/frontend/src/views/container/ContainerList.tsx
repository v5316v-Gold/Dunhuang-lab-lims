// =====================================================
// 容器管理列表 — W3 前端
// 功能: 容器档案 + 领用/归还 + 合规摘要
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, message, Row, Col, Statistic, Divider, Radio,
} from 'antd';
import {
  PlusOutlined, AlertOutlined, ContainerOutlined, ExportOutlined, ImportOutlined,
} from '@ant-design/icons';
import { api } from '../../data/api';

interface ContainerRow {
  id: string;
  code: string;
  name: string;
  type: string;
  material: string;
  capacityMl?: string;
  toleranceMl?: string;
  toleranceClass?: string;
  serialNo?: string;
  manufacturer?: string;
  location?: string;
  status: string;
  calibrationDate?: string;
  nextCalDate?: string;
  responsible?: { id: string; name: string };
}

interface UsageRow {
  id: string;
  usageNo: string;
  container: { code: string; name: string; type: string };
  quantity: string;
  usedBy?: { name: string };
  purpose?: string;
  borrowedAt: string;
  returnedAt?: string;
  conditionBefore?: string;
  conditionAfter?: string;
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  CRUCIBLE: { label: '坩埚', color: 'volcano' },
  VOLUMETRIC_FLASK: { label: '容量瓶', color: 'blue' },
  BURETTE: { label: '滴定管', color: 'cyan' },
  BEAKER: { label: '烧杯', color: 'green' },
  TEST_TUBE: { label: '试管', color: 'orange' },
  CONICAL_FLASK: { label: '锥形瓶', color: 'geekblue' },
  CYLINDER: { label: '量筒', color: 'purple' },
  PIPETTE: { label: '移液管', color: 'magenta' },
  WEIGHING_BOTTLE: { label: '称量瓶', color: 'gold' },
  OTHER: { label: '其他', color: 'default' },
};

const MATERIAL_LABEL: Record<string, { label: string; color: string }> = {
  PORCELAIN: { label: '瓷', color: 'orange' },
  PLATINUM: { label: '铂', color: 'gold' },
  QUARTZ: { label: '石英', color: 'purple' },
  BOROSILICATE: { label: '硼硅玻璃', color: 'blue' },
  PTFE: { label: 'PTFE', color: 'cyan' },
  STAINLESS_STEEL: { label: '不锈钢', color: 'default' },
  POLYETHYLENE: { label: '聚乙烯', color: 'green' },
  OTHER: { label: '其他', color: 'default' },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  IN_STOCK: { label: '在库', color: 'default' },
  IN_USE: { label: '使用中', color: 'processing' },
  CLEANING: { label: '清洗中', color: 'cyan' },
  MAINTENANCE: { label: '维护中', color: 'orange' },
  RETIRED: { label: '已退役', color: 'volcano' },
  LOST: { label: '丢失', color: 'red' },
};

export function ContainerList() {
  const [data, setData] = useState<ContainerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [summary, setSummary] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ContainerRow | null>(null);

  const [usages, setUsages] = useState<UsageRow[]>([]);

  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterMaterial, setFilterMaterial] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [createForm] = Form.useForm();
  const [borrowForm] = Form.useForm();

  const load = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await api.get('/container', {
        params: { page: p, pageSize: ps, type: filterType, material: filterMaterial, status: filterStatus },
      });
      setData(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载容器失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/container/summary');
      setSummary(res.data);
      setSummaryOpen(true);
    } catch {
      message.error('加载合规摘要失败');
    }
  };

  const loadUsages = async () => {
    try {
      const res = await api.get('/container/usage/list', { params: { page: 1, pageSize: 50 } });
      setUsages(res.data.items ?? []);
    } catch {
      message.error('加载使用记录失败');
    }
  };

  useEffect(() => {
    load(1, pageSize);
    loadUsages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterMaterial, filterStatus]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await api.post('/container', values);
      message.success('容器档案创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('创建失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleBorrow = async () => {
    if (!currentRecord) return;
    try {
      const values = await borrowForm.validateFields();
      await api.post('/container/usage/borrow', {
        ...values,
        containerId: currentRecord.id,
      });
      message.success('领用登记成功,容器状态已更新为 IN_USE');
      setBorrowOpen(false);
      borrowForm.resetFields();
      setCurrentRecord(null);
      load(1, pageSize);
      loadUsages();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('领用失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleReturn = async (usageId: string, condition: string) => {
    try {
      await api.post(`/container/usage/${usageId}/return`, { conditionAfter: condition });
      message.success('归还成功');
      load(1, pageSize);
      loadUsages();
    } catch (e: any) {
      message.error('归还失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const columns = [
    {
      title: '编号',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--gold, #D4AF37)' }}>{v}</span>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => {
        const meta = TYPE_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '材质',
      dataIndex: 'material',
      key: 'material',
      width: 110,
      render: (v: string) => {
        const meta = MATERIAL_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '容量',
      key: 'capacity',
      width: 110,
      render: (_: any, r: ContainerRow) =>
        r.capacityMl ? `${r.capacityMl} mL${r.toleranceClass ? ` ${r.toleranceClass}级` : ''}` : '-',
    },
    {
      title: '厂家/编号',
      key: 'mfg',
      width: 200,
      render: (_: any, r: ContainerRow) =>
        r.manufacturer ? `${r.manufacturer} / ${r.serialNo ?? '-'}` : '-',
    },
    {
      title: '存放',
      dataIndex: 'location',
      key: 'location',
      width: 130,
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
      title: '下次校准',
      dataIndex: 'nextCalDate',
      key: 'nextCalDate',
      width: 130,
      render: (v?: string) => v ? v.substring(0, 10) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right' as const,
      render: (_: any, r: ContainerRow) => {
        const canBorrow = r.status === 'IN_STOCK' || r.status === 'IN_USE';
        return canBorrow ? (
          <Button
            size="small"
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => {
              setCurrentRecord(r);
              setBorrowOpen(true);
            }}
          >
            领用
          </Button>
        ) : (
          <Tag color="default">{STATUS_LABEL[r.status]?.label}</Tag>
        );
      },
    },
  ];

  const usageColumns = [
    { title: '使用编号', dataIndex: 'usageNo', key: 'usageNo', width: 170 },
    {
      title: '容器',
      key: 'container',
      render: (_: any, r: UsageRow) => (
        <span>
          <Tag color={(TYPE_LABEL[r.container.type] ?? { color: 'default' }).color}>
            {(TYPE_LABEL[r.container.type] ?? { label: r.container.type }).label}
          </Tag>
          {r.container.code}
        </span>
      ),
    },
    { title: '用途', dataIndex: 'purpose', key: 'purpose' },
    { title: '使用人', dataIndex: ['usedBy', 'name'], key: 'usedBy', width: 100 },
    {
      title: '借出时间',
      dataIndex: 'borrowedAt',
      key: 'borrowedAt',
      width: 160,
      render: (v: string) => v?.substring(0, 19).replace('T', ' '),
    },
    {
      title: '归还时间',
      dataIndex: 'returnedAt',
      key: 'returnedAt',
      width: 160,
      render: (v?: string) => v ? v.substring(0, 19).replace('T', ' ') : <Tag color="orange">未归还</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, r: UsageRow) => {
        if (r.returnedAt) return <Tag color="default">已归还</Tag>;
        return (
          <Space size="small">
            <Button size="small" type="primary" onClick={() => handleReturn(r.id, '完好')}>归还</Button>
            <Button size="small" danger onClick={() => handleReturn(r.id, '破损,需要维修')}>破损归还</Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ContainerOutlined />
            <span>容器管理</span>
            <Tag color="gold">CNAS §7.5 + §6.5</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<AlertOutlined />} onClick={loadSummary}>合规摘要</Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>容器建档</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="容器类型"
            allowClear
            style={{ width: 130 }}
            value={filterType}
            onChange={setFilterType}
            options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            placeholder="材质"
            allowClear
            style={{ width: 140 }}
            value={filterMaterial}
            onChange={setFilterMaterial}
            options={Object.entries(MATERIAL_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 110 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Space>

        <Table
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

        <Divider style={{ margin: '32px 0 16px' }}>最近使用记录</Divider>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={loadUsages} size="small">刷新</Button>
        </Space>
        <Table
          rowKey="id"
          columns={usageColumns}
          dataSource={usages}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      {/* 创建容器 */}
      <Modal title="容器建档" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} width={720}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="如:30mL 瓷坩埚" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                <Select options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="材质" name="material" rules={[{ required: true }]}>
                <Select options={Object.entries(MATERIAL_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="容量(mL)" name="capacityMl">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="允差(mL)" name="toleranceMl">
                <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="允差等级" name="toleranceClass">
                <Select allowClear placeholder="A/B级">
                  <Select.Option value="A">A级</Select.Option>
                  <Select.Option value="B">B级</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="厂家" name="manufacturer">
                <Input placeholder="唐山陶瓷" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="出厂编号" name="serialNo">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="存放位置" name="location">
            <Input placeholder="容器柜 B-03" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领用 */}
      <Modal
        title={<Space><ExportOutlined />容器领用登记</Space>}
        open={borrowOpen}
        onOk={handleBorrow}
        onCancel={() => setBorrowOpen(false)}
        width={640}
      >
        {currentRecord && (
          <div style={{ background: 'rgba(212,175,55,0.08)', padding: 12, marginTop: 16, marginBottom: 12, borderRadius: 4, border: '1px solid var(--gold, #D4AF37)' }}>
            <Space direction="vertical" size={0}>
              <div>容器编号:<b style={{ color: 'var(--gold, #D4AF37)' }}>{currentRecord.code}</b></div>
              <div>名称:{currentRecord.name}</div>
              <div>类型:{TYPE_LABEL[currentRecord.type]?.label} | 材质:{MATERIAL_LABEL[currentRecord.material]?.label} | 容量:{currentRecord.capacityMl} mL</div>
              <div>当前状态:<Tag color={(STATUS_LABEL[currentRecord.status] ?? { color: 'default' }).color}>{(STATUS_LABEL[currentRecord.status] ?? { label: currentRecord.status }).label}</Tag></div>
            </Space>
          </div>
        )}
        <Form form={borrowForm} layout="vertical">
          <Form.Item label="用途" name="purpose" rules={[{ required: true }]}>
            <Input placeholder="如:王水消解 / ICP 定容 / 火试金熔融" />
          </Form.Item>
          <Form.Item label="借出状态" name="conditionBefore">
            <Radio.Group>
              <Radio value="完好">完好</Radio>
              <Radio value="有划痕">有划痕</Radio>
              <Radio value="其他">其他(备注说明)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合规摘要 */}
      <Modal
        title={<Space><AlertOutlined />容器合规摘要(CNAS §7.5 + §6.5)</Space>}
        open={summaryOpen}
        footer={<Button onClick={() => setSummaryOpen(false)}>关闭</Button>}
        onCancel={() => setSummaryOpen(false)}
        width={720}
      >
        {summary && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="容器总数" value={summary.totalContainers ?? 0} /></Col>
              <Col span={6}><Statistic title="使用中" value={summary.inUseContainers ?? 0} valueStyle={{ color: '#4A9A7A' }} /></Col>
              <Col span={6}><Statistic title="未归还" value={summary.activeUsages ?? 0} valueStyle={{ color: '#B85450' }} /></Col>
              <Col span={6}><Statistic title="需校准" value={summary.needsCalibrationCount ?? 0} valueStyle={{ color: '#B85450' }} /></Col>
            </Row>
            <Divider />
            <h4>按类型分布</h4>
            <Table
              rowKey={(r: any) => r.type}
              size="small"
              pagination={false}
              showHeader={false}
              dataSource={summary.byType ?? []}
              columns={[
                { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => {
                  const meta = TYPE_LABEL[t] ?? { label: t, color: 'default' };
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                } },
                { title: '数量', dataIndex: 'count', key: 'count', align: 'right' },
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