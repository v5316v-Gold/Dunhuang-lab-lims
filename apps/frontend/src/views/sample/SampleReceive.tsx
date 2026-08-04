// =====================================================
// 接收样品页
// =====================================================

import { Form, Input, Select, InputNumber, Button, Card, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../../data/api';
import type { SampleType } from '@dunhuang/lims-shared-types';

const sampleTypeOptions: { value: SampleType; label: string }[] = [
  { value: 'GOLD_INGOT', label: '金锭' },
  { value: 'GOLD_POWDER', label: '金粉' },
  { value: 'GOLD_ALLOY', label: '金合金' },
  { value: 'JEWELRY', label: '首饰' },
  { value: 'RECYCLED_GOLD', label: '回收金料' },
  { value: 'SILVER', label: '银' },
  { value: 'PLATINUM', label: '铂' },
  { value: 'PALLADIUM', label: '钯' },
  { value: 'OTHER', label: '其他' },
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

  const onFinish = async (values: FormValues) => {
    setLoading(true);
    try {
      const { data } = await api.post('/samples', values);
      message.success(`接收成功,样品编号: ${data.sampleNo}`);
      navigate('/samples');
    } catch (err) {
      message.error('接收失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="接收样品" extra={<Button onClick={() => navigate('/samples')}>返回列表</Button>}>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 800 }} initialValues={{ sampleType: 'GOLD_INGOT' }}>
        <Space size="large" style={{ width: '100%' }} wrap>
          <Form.Item label="客户名称" name="customerName" rules={[{ required: true }]} style={{ width: 380 }}>
            <Input placeholder="如:上海黄金交易所" />
          </Form.Item>

          <Form.Item label="客户委托单号" name="customerRef" style={{ width: 380 }}>
            <Input placeholder="选填" />
          </Form.Item>
        </Space>

        <Space size="large" style={{ width: '100%' }} wrap>
          <Form.Item label="样品类型" name="sampleType" rules={[{ required: true }]} style={{ width: 380 }}>
            <Select options={sampleTypeOptions} />
          </Form.Item>

          <Form.Item label="重量(g)" name="weightG" rules={[{ required: true }]} style={{ width: 380 }}>
            <InputNumber min={0} step={0.0001} precision={6} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        <Space size="large" style={{ width: '100%' }} wrap>
          <Form.Item label="客户声明纯度(%)" name="declaredPurityPct" style={{ width: 380 }}>
            <InputNumber min={0} max={100} step={0.001} precision={6} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="留样位置" name="storageLocation" style={{ width: 380 }}>
            <Input placeholder="如:金库A-01" />
          </Form.Item>
        </Space>

        <Form.Item label="备注" name="remarks">
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              提交接收
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}