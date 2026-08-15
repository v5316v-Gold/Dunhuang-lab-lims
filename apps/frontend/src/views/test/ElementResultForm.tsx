// =====================================================
// W+5-3: ICP-OES 多元素录入弹窗(含校准曲线 R²)
// 评审必查:"校准曲线 R² 怎么录入?"
// =====================================================

import { useState } from 'react';
import {
  Button, Modal, Form, InputNumber, Input, Row, Col, Table, Space, Typography, Tag, message, Alert,
} from 'antd';
import { api } from '../../data/api';
import { useQuery } from '@tanstack/react-query';

interface ElementRow {
  element: string;       // Au / Ag / Cu ...
  wavelengthNm?: number;
  concentration: number;  // ppm
  unit: string;
  lod?: number;
  loq?: number;
  uncertainty?: number;
  calibrationR2?: number;  // W+5-3 新增
  calibrationCurveFileId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  testId: string;
}

export default function ElementResultForm({ open, onClose, onSuccess, testId }: Props) {
  const [form] = Form.useForm<ElementRow>();
  const [submitting, setSubmitting] = useState(false);

  // W+5-3: 加载已录元素(用于编辑/追加)
  const { data: existing } = useQuery({
    queryKey: ['icp-results', testId],
    queryFn: async () => (await api.get(`/tests/icp/${testId}`)).data,
    enabled: open,
  });

  const submit = async () => {
    const row = await form.validateFields().catch(() => null);
    if (!row) return;
    setSubmitting(true);
    try {
      await api.post(`/tests/icp/${testId}/results`, {
        results: [{
          element: row.element,
          wavelengthNm: row.wavelengthNm,
          concentration: row.concentration,
          unit: row.unit ?? 'ppm',
          lod: row.lod,
          loq: row.loq,
          uncertainty: row.uncertainty,
          calibrationR2: row.calibrationR2,           // W+5-3
          calibrationCurveFileId: row.calibrationCurveFileId,
        }],
      });
      message.success(`已录入 ${row.element} 浓度 + R² = ${row.calibrationR2 ?? 'N/A'}`);
      form.resetFields();
      onSuccess?.();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? e?.message ?? '录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const r2Color = (r2?: number) => {
    if (r2 == null) return 'default';
    if (r2 >= 0.999) return 'green';
    if (r2 >= 0.995) return 'cyan';
    if (r2 >= 0.99) return 'blue';
    return 'orange';
  };

  return (
    <Modal
      title={`ICP-OES 多元素录入(测试 ${testId.slice(0, 8)})`}
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={submit}>录入该元素</Button>,
      ]}
    >
      {existing?.elementResults && existing.elementResults.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`已录入 ${existing.elementResults.length} 个元素`}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="元素符号" name="element" rules={[{ required: true }]}>
              <Input placeholder="Au / Ag / Cu ..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="波长 (nm)" name="wavelengthNm">
              <InputNumber min={100} max={1000} step={0.01} style={{ width: '100%' }} placeholder="如:328.07" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="单位" name="unit" initialValue="ppm">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="浓度" name="concentration" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.0001} style={{ width: '100%' }} placeholder="0.0123" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="不确定度 U (k=2)" name="uncertainty">
              <InputNumber min={0} step={0.0001} style={{ width: '100%' }} placeholder="0.0005" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="LOD (检出限)" name="lod">
              <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="LOQ (定量限)" name="loq">
              <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {/* W+5-3: 校准曲线 R² — 评审必查 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={
                <Space>
                  <span>校准曲线 R²</span>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    (CNAS §7.9 必填,需 ≥ 0.999)
                  </Typography.Text>
                </Space>
              }
              name="calibrationR2"
              rules={[{ required: true, message: 'R² 必填(校准曲线拟合度)' }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.0001}
                precision={6}
                style={{ width: '100%' }}
                placeholder="如:0.9998"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="校准曲线附件 ID (可选)" name="calibrationCurveFileId">
              <Input placeholder="FileAttachment UUID" />
            </Form.Item>
          </Col>
        </Row>
        {form.isFieldTouched('calibrationR2') && (
          <Alert
            type={r2Color(form.getFieldValue('calibrationR2')) === 'green' ? 'success' : 'warning'}
            showIcon
            message={`R² 等级:${r2Color(form.getFieldValue('calibrationR2')) === 'green' ? '✓ 优(≥0.999)' : r2Color(form.getFieldValue('calibrationR2')) === 'cyan' ? '良好(0.995-0.999)' : r2Color(form.getFieldValue('calibrationR2')) === 'blue' ? '可用(0.99-0.995)' : '⚠ 警告(<0.99)'}`}
            style={{ marginBottom: 12 }}
          />
        )}
      </Form>
    </Modal>
  );
}