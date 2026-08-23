// =====================================================
// 接收样品页 — Phase 2 Day 1 完整化
// 详见 ADR-0011 §样品接收规则
// =====================================================

import { useState } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Card,
  Space,
  Alert,
  Row,
  Col,
  Typography,
  Tag,
  message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../../data/api';
import { useAuthStore } from '../../stores/auth.store';
import type { SampleType } from '@dunhuang/lims-shared-types';

const { Title, Text } = Typography;

// 样品类型中文映射(ADR-0011 §1 业务画像)
const sampleTypeOptions: { value: SampleType; label: string; color?: string }[] = [
  { value: 'GOLD_INGOT', label: '金锭', color: 'gold' },
  { value: 'GOLD_POWDER', label: '金粉', color: 'orange' },
  { value: 'GOLD_ALLOY', label: '金合金', color: 'orange' },
  { value: 'JEWELRY', label: '首饰', color: 'cyan' },
  { value: 'RECYCLED_GOLD', label: '回收金料', color: 'purple' },
  { value: 'SILVER', label: '银', color: 'default' },
  { value: 'PLATINUM', label: '铂', color: 'blue' },
  { value: 'PALLADIUM', label: '钯', color: 'geekblue' },
  { value: 'OTHER', label: '其他', color: 'default' },
];

interface FormValues {
  customerName: string;
  customerRef?: string;
  sampleType: SampleType;
  declaredPurityPct?: number;
  weightG: number;
  storageLocation?: string;
  remarks?: string;
}

export default function SampleReceivePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ sampleNo: string; id: string } | null>(null);
  const [lastCustomerName, setLastCustomerName] = useState<string>('');
  const currentUser = useAuthStore((s) => s.user);

  // 保存成功 → 返回 false 表示"继续录入下一份"(重置表单保留客户名)
  const submitSample = async (values: FormValues): Promise<{ id: string; sampleNo: string } | null> => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 后端要求 weightG / declaredPurityPct 是 string(Decimal 类型)
      const payload = {
        customerName: values.customerName,
        customerRef: values.customerRef,
        sampleType: values.sampleType,
        declaredPurityPct:
          values.declaredPurityPct != null ? String(values.declaredPurityPct) : undefined,
        weightG: String(values.weightG),
        storageLocation: values.storageLocation,
        remarks: values.remarks,
      };

      const { data } = await api.post<{ id: string; sampleNo: string; status: string }>(
        '/samples',
        payload,
      );
      return { id: data.id, sampleNo: data.sampleNo };
    } catch (err: any) {
      const msg =
        err.response?.data?.message
          ? Array.isArray(err.response.data.message)
            ? err.response.data.message.join('; ')
            : err.response.data.message
          : '接收失败';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 保存成功 → "提交并返回列表":成功后不自动跳转,由用户主动选择继续录入或返回
  const onFinish = async (values: FormValues) => {
    const data = await submitSample(values);
    if (!data) return;
    setSuccess({ sampleNo: data.sampleNo, id: data.id });
    message.success(`✅ 接收成功,样品编号: ${data.sampleNo} — 可继续录入下一份或返回列表`);
  };

  // 保存并继续录入下一份(现场批量收样)
  const onFinishAndContinue = async (values: FormValues) => {
    const data = await submitSample(values);
    if (!data) return;
    message.success(`✅ 已接收 ${data.sampleNo},继续录入下一份`);
    setLastCustomerName(values.customerName);
    form.resetFields();
    form.setFieldsValue({ customerName: values.customerName, sampleType: values.sampleType, declaredPurityPct: values.declaredPurityPct });
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              接收样品
            </Title>
            <Text type="secondary">Phase 2 · Day 1</Text>
          </Space>
        }
        extra={
          <Button onClick={() => navigate('/samples')}>返回列表</Button>
        }
      >
        {/* 接收员信息 */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <Text>接收员:</Text>
              <Tag color="blue">{currentUser?.name ?? '未知'}</Tag>
              <Text type="secondary">
                ({currentUser?.role} · 样品编号自动生成 YYMMDD-NNNN)
              </Text>
            </Space>
          }
        />

        {error && (
          <Alert
            type="error"
            showIcon
            closable
            style={{ marginBottom: 16 }}
            message="接收失败"
            description={error}
            onClose={() => setError(null)}
          />
        )}

        {success && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message={`样品接收成功`}
            description={
              <Space direction="vertical">
                <span>样品编号: <Tag color="green">{success.sampleNo}</Tag></span>
                <span>正在跳转到样品列表...</span>
              </Space>
            }
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 900 }}
          initialValues={{ sampleType: 'GOLD_INGOT' }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="客户名称"
                name="customerName"
                rules={[{ required: true, message: '请输入客户名称' }]}
              >
                <Input placeholder="如:上海黄金交易所" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="客户委托单号" name="customerRef">
                <Input placeholder="选填,如 SGE-2026-08-001" maxLength={100} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="样品类型"
                name="sampleType"
                rules={[{ required: true, message: '请选择样品类型' }]}
              >
                <Select options={sampleTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="重量(克)"
                name="weightG"
                rules={[
                  { required: true, message: '请输入样品重量' },
                  { type: 'number', min: 0.0001, max: 100000, message: '重量必须在 0.0001-100000g 之间' },
                ]}
              >
                <InputNumber
                  min={0.0001}
                  max={100000}
                  step={0.0001}
                  precision={6}
                  placeholder="如:1023.4567"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="客户声明纯度(%)"
                name="declaredPurityPct"
                rules={[
                  { type: 'number', min: 0, max: 100, message: '纯度必须在 0-100% 之间' },
                ]}
                extra="选填,只作参考,以实测为准"
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.001}
                  precision={6}
                  placeholder="如:99.99"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="留样位置" name="storageLocation">
                <Input placeholder="如:金库 A-01" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="备注"
            name="remarks"
            extra="选填,最多 500 字"
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
              >
                提交并返回列表
              </Button>
              <Button
                size="large"
                loading={loading}
                onClick={async () => {
                  const values = await form.validateFields().catch(() => null);
                  if (values) await onFinishAndContinue(values);
                }}
              >
                保存并继续录入下一份
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setError(null);
                  setSuccess(null);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}