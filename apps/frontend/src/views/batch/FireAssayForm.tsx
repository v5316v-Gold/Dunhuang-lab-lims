// =====================================================
// 火试金称重录入弹窗 — Phase 2 Day 4
// WEIGHING 状态:5 份平行样各自称重 → 自动算纯度 → 推 CALCULATING
// =====================================================

import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Button,
  Space,
  Alert,
  Descriptions,
  Tag,
  Typography,
  Statistic,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import { FireOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../data/api';
import type { AssayMethod } from '@dunhuang/lims-shared-types';

const { Title, Text, Paragraph } = Typography;

interface Sample {
  id: string;
  sampleNo: string;
  customerName: string;
  weightG: string;
  testId?: string;
  tests?: Array<{ id: string }>;
}

interface FireAssayFormProps {
  open: boolean;
  batchNo: string;
  method: AssayMethod;
  samples: Sample[];
  replicateCount: number;
  onCancel: () => void;
  onSuccess: () => void;
}

interface ParallelSample {
  sampleId: string;
  sampleNo: string;
  testId?: string;
  prillWeightG?: number;
  qcRecoveryPct?: number;
  status: 'pending' | 'saving' | 'saved' | 'error';
  result?: {
    purityPct: string;
    uncertainty: string;
    qcPassed: boolean;
    grade: string;
  };
  errorMsg?: string;
}

export default function FireAssayForm({
  open,
  batchNo,
  method,
  samples,
  replicateCount,
  onCancel,
  onSuccess,
}: FireAssayFormProps) {
  const [form] = Form.useForm();
  const [parallels, setParallels] = useState<ParallelSample[]>([]);

  // 初始化平行样 — 每个样品 replicateCount 份
  useEffect(() => {
    if (open && samples.length > 0) {
      const list: ParallelSample[] = [];
      for (const s of samples) {
        for (let i = 0; i < replicateCount; i++) {
          list.push({
            sampleId: s.id,
            sampleNo: `${s.sampleNo} #${i + 1}`,
            status: 'pending',
          });
        }
      }
      setParallels(list);
    }
  }, [open, samples, replicateCount]);

  // 单个平行样提交称重
  const recordWeightMut = useMutation({
    mutationFn: async ({
      testId,
      prillWeightG,
      qcRecoveryPct,
    }: {
      testId: string;
      prillWeightG: string;
      qcRecoveryPct?: string;
    }) =>
      (
        await api.post(`/tests/fire-assay/${testId}/weights`, {
          prillWeightG,
          qcRecoveryPct,
        })
      ).data,
    onSuccess: (data, vars) => {
      // 后端返回 { purityPct, uncertainty, qcPassed, testId }(无 id 字段)
      const purityPct = data?.purityPct?.toString?.() ?? data?.purityPct ?? '?';
      const uncertainty = data?.uncertainty?.toString?.() ?? data?.uncertainty ?? '?';
      const qcPassed = data?.qcPassed ?? true;
      // 计算纯度等级
      const purityNum = parseFloat(purityPct);
      let grade = '?';
      if (purityNum >= 99.999) grade = 'Au99999 (5N)';
      else if (purityNum >= 99.99) grade = 'Au9999 (4N)';
      else if (purityNum >= 99.9) grade = 'Au999 (3N)';
      else if (purityNum >= 99.0) grade = 'Au990';
      else if (purityNum >= 95.0) grade = 'Au950';

      setParallels((prev) =>
        prev.map((p) =>
          p.testId === vars.testId
            ? { ...p, status: 'saved' as const, result: { purityPct, uncertainty, qcPassed, grade } }
            : p,
        ),
      );
    },
    onError: (err: any, vars) => {
      const msg = err.response?.data?.message ?? '称重失败';
      setParallels((prev) =>
        prev.map((p) =>
          p.testId === vars.testId || p.sampleId === vars.testId
            ? { ...p, status: 'error' as const, errorMsg: typeof msg === 'string' ? msg : JSON.stringify(msg) }
            : p
        ),
      );
    },
  });

  // 自动同步 testId 映射(样品关联检测的后端结构是 tests[] 数组)
  useEffect(() => {
    if (parallels.length > 0 && samples.length > 0) {
      setParallels((prev) =>
        prev.map((p) => {
          if (p.testId) return p;
          const s = samples.find((s) => p.sampleNo.startsWith(s.sampleNo));
          if (!s) return p;
          return { ...p, testId: s.testId ?? s.tests?.[0]?.id };
        }),
      );
    }
  }, [samples, parallels.length]);

  if (method !== 'FIRE_ASSAY') {
    return (
      <Modal title="称重录入" open={open} onCancel={onCancel} footer={null}>
        <Alert
          type="info"
          showIcon
          message="火试金专用称重表单"
          description="非火试金方法请使用对应方法的录入界面(Day 5+ ICP 方法)"
        />
      </Modal>
    );
  }

  // 当前批次统计
  const savedCount = parallels.filter((p) => p.status === 'saved').length;
  const totalCount = parallels.length;
  const passedCount = parallels.filter(
    (p) => p.status === 'saved' && p.result?.qcPassed,
  ).length;
  const failedCount = parallels.filter(
    (p) => p.status === 'saved' && !p.result?.qcPassed,
  ).length;

  // 平均纯度
  const avgPurity = (() => {
    const results = parallels.filter((p) => p.status === 'saved' && p.result);
    if (results.length === 0) return null;
    const sum = results.reduce(
      (acc, p) => acc + parseFloat(p.result!.purityPct),
      0,
    );
    return sum / results.length;
  })();

  return (
    <Modal
      title={
        <Space>
          <FireOutlined style={{ color: '#fa8c16' }} />
          <span>火试金称重录入 — 批次 {batchNo}</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={900}
      footer={
        <Space>
          <Text type="secondary">
            已录入 {savedCount}/{totalCount} 份平行样
          </Text>
          <Button onClick={onCancel}>关闭</Button>
          <Button
            type="primary"
            disabled={savedCount !== totalCount || totalCount === 0}
            onClick={() => {
              message.success(
                `✅ 所有 ${totalCount} 份平行样称重完成!` +
                  (avgPurity ? `平均纯度 ${avgPurity.toFixed(4)}%` : ''),
              );
              onSuccess();
            }}
          >
            完成称重(推进批次)
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="火试金法 — 火试金称重与计算"
        description={
          <span>
            公式: <Text code>Au% = (prillWeightG / sampleWeightG) × 100 × (100 / qcRecoveryPct)</Text>{' '}
            (GB/T 9288)
            <br />
            QC 回收率合格范围: <Text strong>99.5% - 100.5%</Text>
          </span>
        }
      />

      {/* 进度统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="总份数" value={totalCount} suffix="份" />
        </Col>
        <Col span={6}>
          <Statistic
            title="已录入"
            value={savedCount}
            suffix={`/ ${totalCount}`}
            valueStyle={{ color: 'var(--gold)' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="QC 通过"
            value={passedCount}
            suffix="份"
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="QC 失败"
            value={failedCount}
            suffix="份"
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
      </Row>

      {avgPurity !== null && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              平均纯度: <Text strong style={{ fontSize: 18 }}>
                {avgPurity.toFixed(4)}%
              </Text>
            </span>
          }
        />
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* 平行样称重表 */}
      <Form form={form} layout="vertical">
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {parallels.map((p, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 12,
                padding: 12,
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                background: p.status === 'saved' ? 'var(--success-light)' : 'var(--bg-card)',
              }}
            >
              <Row gutter={16} align="middle">
                <Col span={5}>
                  <Text strong>{p.sampleNo}</Text>
                  <br />
                  <Tag
                    color={
                      p.status === 'saved'
                        ? p.result?.qcPassed
                          ? 'green'
                          : 'red'
                        : p.status === 'error'
                        ? 'red'
                        : 'default'
                    }
                  >
                    {p.status === 'saved'
                      ? p.result?.qcPassed
                        ? '✓ 已录入'
                        : '✗ QC 失败'
                      : p.status === 'error'
                      ? '✗ 错误'
                      : p.status === 'saving'
                      ? '录入中...'
                      : '待录入'}
                  </Tag>
                </Col>
                <Col span={5}>
                  <Text type="secondary">金粒重 (g)</Text>
                  <br />
                  <InputNumber
                    min={0}
                    max={1000}
                    step={0.0001}
                    precision={6}
                    placeholder="如:511.8300"
                    style={{ width: '100%' }}
                    value={p.prillWeightG}
                    disabled={p.status === 'saved' || p.status === 'saving'}
                    onChange={(v) => {
                      setParallels((prev) =>
                        prev.map((q, i) => (i === idx ? { ...q, prillWeightG: v ?? undefined } : q)),
                      );
                    }}
                  />
                </Col>
                <Col span={4}>
                  <Text type="secondary">QC 回收率 %</Text>
                  <br />
                  <InputNumber
                    min={0}
                    max={200}
                    step={0.01}
                    precision={4}
                    placeholder="99.85"
                    style={{ width: '100%' }}
                    value={p.qcRecoveryPct}
                    disabled={p.status === 'saved' || p.status === 'saving'}
                    onChange={(v) => {
                      setParallels((prev) =>
                        prev.map((q, i) => (i === idx ? { ...q, qcRecoveryPct: v ?? undefined } : q)),
                      );
                    }}
                  />
                </Col>
                <Col span={3}>
                  {p.status === 'saved' && p.result ? (
                    <div>
                      <Text strong style={{ color: '#fa8c16' }}>
                        {p.result.purityPct}%
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ±{p.result.uncertainty}
                      </Text>
                      <br />
                      <Tag color="orange">{p.result.grade}</Tag>
                    </div>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      loading={p.status === 'saving'}
                      disabled={!p.prillWeightG || !p.testId}
                      onClick={() => {
                        // 单个保存
                        if (!p.testId) {
                          message.error('该平行样未关联 testId');
                          return;
                        }
                        setParallels((prev) =>
                          prev.map((q, i) => (i === idx ? { ...q, status: 'saving' as const } : q)),
                        );
                        recordWeightMut.mutate({
                          testId: p.testId,
                          prillWeightG: String(p.prillWeightG),
                          qcRecoveryPct: p.qcRecoveryPct ? String(p.qcRecoveryPct) : undefined,
                        });
                      }}
                    >
                      提交
                    </Button>
                  )}
                </Col>
                <Col span={7} style={{ textAlign: 'right' }}>
                  {p.errorMsg && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {p.errorMsg}
                    </Text>
                  )}
                </Col>
              </Row>
            </div>
          ))}
        </div>
      </Form>
    </Modal>
  );
}