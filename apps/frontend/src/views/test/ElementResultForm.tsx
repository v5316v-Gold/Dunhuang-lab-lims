// =====================================================
// W+5-3 / W4 交互完善: ICP-OES 多元素批量录入弹窗(含校准曲线 R²)
// 评审必查:"校准曲线 R² 怎么录入?"(CNAS §7.9)
// 批量表格模式: 一次提交多元素 results[]
// =====================================================

import { useEffect, useState } from 'react';
import {
  Button, Modal, Form, InputNumber, Input, Row, Col, Table, Space, Typography, Tag, message, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../data/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ElementRow {
  key: string;
  element: string;       // Au / Ag / Cu ...
  wavelengthNm?: number | null;
  concentration?: number | null;  // ppm
  unit: string;
  lod?: number | null;
  loq?: number | null;
  uncertainty?: number | null;
  calibrationR2?: number | null;  // 校准曲线 R²(评审必查)
  calibrationCurveFileId?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  testId: string;
}

let rowSeq = 0;
const newKey = () => `row-${Date.now()}-${rowSeq++}`;

function r2Color(r2?: number | null) {
  if (r2 == null) return 'default';
  if (r2 >= 0.999) return 'green';
  if (r2 >= 0.995) return 'cyan';
  if (r2 >= 0.99) return 'blue';
  return 'orange';
}

function r2Label(r2?: number | null) {
  if (r2 == null) return null;
  if (r2 >= 0.999) return '✓ 优(≥0.999)';
  if (r2 >= 0.995) return '良好(0.995~0.999)';
  if (r2 >= 0.99) return '可用(0.99~0.995)';
  return '⚠ 警告(<0.99)';
}

export default function ElementResultForm({ open, onClose, onSuccess, testId }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ElementRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 加载已录元素(编辑/追加)
  const { data: existing } = useQuery({
    queryKey: ['icp-results', testId],
    queryFn: async () => (await api.get(`/tests/icp/${testId}`)).data,
    enabled: open,
  });

  // 弹窗打开时同步已录元素到表格行
  useEffect(() => {
    if (!open) return;
    const el = existing?.elementResults ?? [];
    setRows(
      el.length > 0
        ? el.map((r: any) => ({
            key: r.id ?? newKey(),
            element: r.element,
            wavelengthNm: r.wavelengthNm,
            concentration: r.concentration,
            unit: r.unit ?? 'ppm',
            lod: r.lod,
            loq: r.loq,
            uncertainty: r.uncertainty,
            calibrationR2: r.calibrationR2,
            calibrationCurveFileId: r.calibrationCurveFileId,
          }))
        : [{ key: newKey(), element: '', unit: 'ppm', concentration: null }],
    );
  }, [open, existing]);

  const addRow = () => setRows((rs) => [...rs, { key: newKey(), element: '', unit: 'ppm', concentration: null }]);

  const removeRow = (key: string) => setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.key !== key)));

  const patchRow = (key: string, patch: Partial<ElementRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // 批量提交:所有行一次 POST
  const submit = async () => {
    const valid = rows.filter((r) => r.element && r.element.trim() !== '' && r.concentration != null);
    if (valid.length === 0) {
      message.warning('请至少录入一个元素及其浓度');
      return;
    }
    const missingR2 = valid.some((r) => r.calibrationR2 == null);
    if (missingR2) {
      message.warning('校准曲线 R² 为评审必填项(CNAS §7.9),请为每个元素填写');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/tests/icp/${testId}/results`, {
        results: valid.map((r) => ({
          element: r.element.trim(),
          wavelengthNm: r.wavelengthNm,
          concentration: r.concentration,
          unit: r.unit ?? 'ppm',
          lod: r.lod,
          loq: r.loq,
          uncertainty: r.uncertainty,
          calibrationR2: r.calibrationR2,
          calibrationCurveFileId: r.calibrationCurveFileId,
        })),
      });
      message.success(`已批量录入 ${valid.length} 个元素(含校准曲线 R²)`);
      qc.invalidateQueries({ queryKey: ['icp-results', testId] });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? e?.message ?? '录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '元素', dataIndex: 'element', width: 90,
      render: (v: string, r: ElementRow) => (
        <Input value={v} placeholder="Au/Ag/Cu" onChange={(e) => patchRow(r.key, { element: e.target.value })} />
      ),
    },
    {
      title: '波长 nm', dataIndex: 'wavelengthNm', width: 100,
      render: (v: number | null, r: ElementRow) => (
        <InputNumber min={100} max={1000} step={0.01} value={v} placeholder="328.07" style={{ width: '100%' }} onChange={(n) => patchRow(r.key, { wavelengthNm: n })} />
      ),
    },
    {
      title: '浓度', dataIndex: 'concentration', width: 120,
      render: (v: number | null, r: ElementRow) => (
        <InputNumber min={0} step={0.0001} value={v} placeholder="0.0123" style={{ width: '100%' }} onChange={(n) => patchRow(r.key, { concentration: n })} />
      ),
    },
    {
      title: '单位', dataIndex: 'unit', width: 90,
      render: (v: string, r: ElementRow) => (
        <Input value={v} onChange={(e) => patchRow(r.key, { unit: e.target.value })} />
      ),
    },
    {
      title: 'R²', dataIndex: 'calibrationR2', width: 130,
      render: (v: number | null, r: ElementRow) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <InputNumber
            min={0} max={1} step={0.0001} precision={6} value={v}
            placeholder="≥0.999" style={{ width: '100%' }}
            onChange={(n) => patchRow(r.key, { calibrationR2: n })}
          />
          {v != null && <Tag color={r2Color(v)} style={{ marginInlineEnd: 0, fontSize: 10 }}>{r2Label(v)}</Tag>}
        </Space>
      ),
    },
    {
      title: '', key: 'op', width: 40,
      render: (_: any, r: ElementRow) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} />
      ),
    },
  ];

  return (
    <Modal
      title={`ICP-OES 多元素批量录入(${existing?.sample?.sampleNo ? `样品 ${existing.sample.sampleNo}` : `测试 ${testId.slice(0, 8)}`})`}
      open={open}
      onCancel={onClose}
      width={860}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={submit}>批量提交</Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        message="批量录入多元素浓度;校准曲线 R² 为评审必填(CNAS §7.9,需 ≥ 0.999)。已录入元素会载入表格,可直接修改后重新提交。"
        style={{ marginBottom: 12 }}
      />
      <Table<ElementRow>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: '暂无元素' }}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 12 }}>
        添加元素行
      </Button>
    </Modal>
  );
}
