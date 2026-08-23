// =====================================================
// 气体管理列表 — W2 前端
// 功能: 气体主数据 + 采购登记 + 验收 + 领用记录 + 合规摘要
// 样式: 设计令牌(墨黑+辉金)
// =====================================================

import { useEffect, useState } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Table, Tag, Space, Modal, message, Row, Col, Statistic, Divider, Popconfirm } from 'antd';
import { 
  PlusOutlined, AlertOutlined, CheckCircleOutlined, WarningOutlined, RocketOutlined, ExperimentOutlined, CloudOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, statusTag } from '../../components/DataTable';

interface GasRow {
  id: string;
  code: string;
  name: string;
  type: string;
  purity?: string;
  unit: string;
  currentStock: string;
  minStock: string;
  maxStock?: string;
  storageLocation?: string;
  hazardLevel?: string;
  status: string;
  responsible?: { id: string; name: string };
}

interface PurchaseRow {
  id: string;
  purchaseNo: string;
  gasId: string;
  supplier: string;
  quantity: string;
  unit: string;
  totalAmount?: string;
  orderDate: string;
  status: string;
  batchNo?: string;
}

interface UsageRow {
  id: string;
  usageNo: string;
  quantity: string;
  unit: string;
  usedAt: string;
  purpose?: string;
  gas: { code: string; name: string; type: string };
  usedBy?: { name: string };
}

const GAS_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  ARGON: { label: '氩气', color: 'blue' },
  NITROGEN: { label: '氮气', color: 'cyan' },
  OXYGEN: { label: '氧气', color: 'red' },
  HYDROGEN: { label: '氢气', color: 'magenta' },
  HELIUM: { label: '氦气', color: 'purple' },
  ACETYLENE: { label: '乙炔', color: 'orange' },
  COMPRESSED_AIR: { label: '压缩空气', color: 'default' } };

const PURCHASE_STATUS: Record<string, { label: string; color: string }> = {
  ORDERED: { label: '已下单', color: 'blue' },
  SHIPPED: { label: '在途', color: 'cyan' },
  RECEIVED: { label: '已到货', color: 'geekblue' },
  INSPECTED: { label: '已验收', color: 'green' },
  REJECTED: { label: '拒收', color: 'red' },
  RETURNED: { label: '退货', color: 'volcano' } };

export function GasList() {
  const [data, setData] = useState<GasRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [summary, setSummary] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [usages, setUsages] = useState<UsageRow[]>([]);

  const [filterType, setFilterType] = useState<string | undefined>();
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [createForm] = Form.useForm();
  const [purchaseForm] = Form.useForm();
  const [usageForm] = Form.useForm();

  const load = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await api.get('/gas', {
        params: { page: p, pageSize: ps, type: filterType, lowStockOnly: onlyLowStock } });
      setData(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error('加载气体失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/gas/summary');
      setSummary(res.data);
      setSummaryOpen(true);
    } catch {
      message.error('加载合规摘要失败');
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await api.get('/gas/purchase/list', { params: { page: 1, pageSize: 50 } });
      setPurchases(res.data.items ?? res.data.data ?? []);
    } catch {
      // 兜底:GasPurchase 没有 list 端点时返回 []
    }
  };

  const loadUsages = async () => {
    try {
      const res = await api.get('/gas/usage/list', { params: { page: 1, pageSize: 50 } });
      setUsages(res.data.items ?? []);
    } catch {
      message.error('加载使用记录失败');
    }
  };

  useEffect(() => {
    load(1, pageSize);
    loadPurchases();
    loadUsages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, onlyLowStock]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await api.post('/gas', values);
      message.success('气体主数据创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;  // 表单校验失败
      message.error('创建失败:' + (e?.message ?? '未知错误'));
    }
  };

  const handleCreatePurchase = async () => {
    try {
      const values = await purchaseForm.validateFields();
      await api.post('/gas/purchase', values);
      message.success('采购单创建成功');
      setPurchaseOpen(false);
      purchaseForm.resetFields();
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('创建采购单失败:' + (e?.message ?? '未知错误'));
    }
  };

  const handleInspect = async (id: string, passed: boolean) => {
    try {
      await api.post(`/gas/purchase/${id}/inspect`, { passed });
      message.success(passed ? '已验收,库存已增加' : '已拒收');
      loadPurchases();
      load(1, pageSize);
    } catch (e: any) {
      message.error('验收失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  // 退货(已验收 → RETURNED,回扣库存)
  const handleReturn = async (id: string) => {
    try {
      await api.post(`/gas/purchase/${id}/return`, { reason: '质量问题退货' });
      message.success('已退货,库存已回扣');
      loadPurchases();
      load(1, pageSize);
    } catch (e: any) {
      message.error('退货失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  // 删除气体主数据(软删,仅无采购/领用)
  const handleRemoveGas = async (id: string) => {
    try {
      await api.delete(`/gas/${id}`);
      message.success('气体主数据已删除');
      load(1, pageSize);
    } catch (e: any) {
      message.error('删除失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const handleRecordUsage = async () => {
    try {
      const values = await usageForm.validateFields();
      await api.post('/gas/usage', values);
      message.success('使用记录成功,库存已扣减');
      setUsageOpen(false);
      usageForm.resetFields();
      load(1, pageSize);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('领用失败:' + (e?.response?.data?.message ?? e?.message));
    }
  };

  const columns = [
    {
      title: '编号',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--gold, #D4AF37)' }}>{v}</span> },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: string) => {
        const meta = GAS_TYPE_LABEL[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      } },
    {
      title: '纯度',
      dataIndex: 'purity',
      key: 'purity',
      width: 100 },
    {
      title: '库存(瓶)',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 100,
      render: (v: string, r: GasRow) => {
        const isLow = parseFloat(v) <= parseFloat(r.minStock);
        return (
          <span style={{ color: isLow ? '#B85450' : 'var(--text-primary)', fontWeight: isLow ? 600 : 400 }}>
            {isLow && <WarningOutlined style={{ marginRight: 4 }} />}
            {v}
          </span>
        );
      } },
    {
      title: '最低库存',
      dataIndex: 'minStock',
      key: 'minStock',
      width: 90 },
    {
      title: '存放位置',
      dataIndex: 'storageLocation',
      key: 'storageLocation',
      width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, r: GasRow) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => {
              usageForm.setFieldsValue({ gasId: r.id, unit: r.unit });
              setUsageOpen(true);
            }}
          >
            领用
          </Button>
          <Button
            size="small"
            icon={<RocketOutlined />}
            onClick={() => {
              purchaseForm.setFieldsValue({ gasId: r.id, unit: r.unit });
              setPurchaseOpen(true);
            }}
          >
            采购
          </Button>
          <Popconfirm
            title="删除气体主数据"
            description="仅无采购/领用记录的气体可删除(软删)。"
            onConfirm={() => handleRemoveGas(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  const purchaseColumns = [
    { title: '采购单号', dataIndex: 'purchaseNo', key: 'purchaseNo', width: 160 },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const meta = PURCHASE_STATUS[v] ?? { label: v, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      } },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, r: PurchaseRow) =>
        r.status === 'ORDERED' || r.status === 'SHIPPED' || r.status === 'RECEIVED' ? (
          <Space size="small">
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleInspect(r.id, true)}>
              验收
            </Button>
            <Button size="small" danger onClick={() => handleInspect(r.id, false)}>
              拒收
            </Button>
          </Space>
        ) : r.status === 'INSPECTED' ? (
          <Popconfirm
            title="退货"
            description="退货将回扣库存,状态变为已退货。"
            onConfirm={() => handleReturn(r.id)}
          >
            <Button size="small" danger icon={<RollbackOutlined />}>退货</Button>
          </Popconfirm>
        ) : (
          <Tag color="default">已处理</Tag>
        ) },
  ];

  const usageColumns = [
    { title: '使用编号', dataIndex: 'usageNo', key: 'usageNo', width: 160 },
    {
      title: '气体',
      key: 'gas',
      render: (_: any, r: UsageRow) => (
        <span>
          <Tag color={(GAS_TYPE_LABEL[r.gas.type] ?? { color: 'default' }).color}>
            {(GAS_TYPE_LABEL[r.gas.type] ?? { label: r.gas.type }).label}
          </Tag>
          {r.gas.code}
        </span>
      ) },
    { title: '使用量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: '用途', dataIndex: 'purpose', key: 'purpose' },
    { title: '使用人', dataIndex: ['usedBy', 'name'], key: 'usedBy', width: 100 },
    {
      title: '使用时间',
      dataIndex: 'usedAt',
      key: 'usedAt',
      width: 170,
      render: (v: string) => v?.substring(0, 19).replace('T', ' ') },
  ];

  return (
    <div style={{ padding: 24 }}>
          <div>
      <PageHeader
        title="气体管理"
        subtitle="CNAS §6.4 + §7.5 · 气瓶台账 + 采购 + 使用"
        icon={<CloudOutlined />}
        extra={
          <Space>
            <Button icon={<AlertOutlined />} onClick={loadSummary}>合规摘要</Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>创建气体</Button>
          </Space>
        }
      />
        {/* 筛选 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="气体类型"
            allowClear
            style={{ width: 140 }}
            value={filterType}
            onChange={setFilterType}
            options={Object.entries(GAS_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Button type={onlyLowStock ? 'primary' : 'default'} danger={onlyLowStock} onClick={() => setOnlyLowStock(!onlyLowStock)}>
            <WarningOutlined /> 仅低库存
          </Button>
        </Space>

        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); load(p, ps); } }}
        />

        <Divider style={{ margin: '32px 0 16px' }}>采购记录</Divider>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={loadPurchases} size="small">刷新</Button>
        </Space>
        <DataTable
          rowKey="id"
          columns={purchaseColumns}
          dataSource={purchases}
          pagination={{ pageSize: 5 }}
          size="small"
        />

        <Divider style={{ margin: '32px 0 16px' }}>最近使用记录</Divider>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={loadUsages} size="small">刷新</Button>
        </Space>
        <DataTable
          rowKey="id"
          columns={usageColumns}
          dataSource={usages}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </div>

      {/* 创建气体 */}
      <Modal title="创建气体主数据" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} width={640}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="如:高纯氩气" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                <Select options={Object.entries(GAS_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="纯度" name="purity">
                <Input placeholder="99.999%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="当前库存(瓶)" name="currentStock" initialValue="0">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="最低库存(瓶)" name="minStock" initialValue="0">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="存放位置" name="storageLocation">
                <Input placeholder="气瓶间 A-01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="危险等级" name="hazardLevel">
                <Input placeholder="惰性 / 易燃 / 有毒" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 采购 */}
      <Modal title="创建采购单" open={purchaseOpen} onOk={handleCreatePurchase} onCancel={() => setPurchaseOpen(false)} width={640}>
        <Form form={purchaseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="气体 ID" name="gasId" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item label="供应商" name="supplier" rules={[{ required: true }]}>
            <Input placeholder="液化空气(中国)投资有限公司" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="数量(瓶)" name="quantity" rules={[{ required: true }]}>
                <InputNumber min={0.0001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="单价(元)" name="unitPrice">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="批次号" name="batchNo">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领用 */}
      <Modal title="气体领用记录" open={usageOpen} onOk={handleRecordUsage} onCancel={() => setUsageOpen(false)} width={640}>
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="气体 ID" name="gasId" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item label="使用单位" name="unit" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'CYLINDER', label: '瓶' },
                { value: 'M3', label: '立方米' },
                { value: 'LITER', label: '升' },
                { value: 'KG', label: '公斤' },
              ]}
            />
          </Form.Item>
          <Form.Item label="使用量" name="quantity" rules={[{ required: true }]}>
            <InputNumber min={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="用途" name="purpose">
            <Input placeholder="ICP-OES 载气 / 火焰熔融保护气 ..." />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合规摘要 */}
      <Modal
        title={<Space><AlertOutlined />气体合规摘要(CNAS §7.5 + §6.4)</Space>}
        open={summaryOpen}
        footer={<Button onClick={() => setSummaryOpen(false)}>关闭</Button>}
        onCancel={() => setSummaryOpen(false)}
        width={720}
      >
        {summary && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="气体总数" value={summary.totalGases ?? 0} /></Col>
              <Col span={6}><Statistic title="活跃气体" value={summary.activeGases ?? 0} valueStyle={{ color: '#4A9A7A' }} /></Col>
              <Col span={6}><Statistic title="采购总数" value={summary.totalPurchases ?? 0} /></Col>
              <Col span={6}><Statistic title="待验收" value={summary.pendingInspections ?? 0} valueStyle={{ color: '#B85450' }} /></Col>
            </Row>
            <Divider />
            <h4>本月使用 <Tag color="gold">{summary.totalUsagesThisMonth ?? 0}</Tag></h4>
            <h4>低库存预警 <Tag color="red">{summary.lowStockCount ?? 0}</Tag></h4>
            {(summary.lowStock ?? []).length > 0 && (
              <DataTable
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={summary.lowStock}
                columns={[
                  { title: '编号', dataIndex: 'code', key: 'code' },
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  { title: '当前', dataIndex: 'currentStock', key: 'currentStock' },
                  { title: '最低', dataIndex: 'minStock', key: 'minStock' },
                ]}
              />
            )}
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