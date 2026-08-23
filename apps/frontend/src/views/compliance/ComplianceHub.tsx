// =====================================================
// 合规管理 Hub — 6 Tab(按 CNAS 评审优先级排序)+ 摘要卡
// 内审 §8.8 / 管评 §8.9 / 监督 §7.2 / PT §7.7 / 盲样 / 临时授权
// =====================================================

import { Tabs, Card, Space, Tag, Alert } from 'antd';
import {
  AuditOutlined, FundProjectionScreenOutlined, SafetyOutlined, TrophyOutlined, EyeInvisibleOutlined, IdcardOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../data/api';
import InternalAuditList from './InternalAuditList';
import ManagementReviewList from './ManagementReviewList';
import SupervisionList from './SupervisionList';
import BlindSampleList from './BlindSampleList';
import ProficiencyTestList from './ProficiencyTestList';
import TemporaryAuthManager from './TemporaryAuthManager';

interface ComplianceSummary {
  internalAudits: number;
  managementReviews: number;
  supervisions: number;
  blindSamples: number;
  proficiencyTests: number;
  checkedAt: string;
}

export default function ComplianceHub() {
  const { data: summary } = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: async () => (await api.get<ComplianceSummary>('/compliance/summary')).data,
    refetchInterval: 60000,
  });

  return (
    <Card>
      <Alert
        type="info"
        showIcon
        message={
          <Space size={12} wrap>
            <span style={{ fontWeight: 600 }}>CMA/CNAS 合规台账:</span>
            <Tag color="gold" icon={<AuditOutlined />}>内审 {summary?.internalAudits ?? 0}</Tag>
            <Tag color="purple" icon={<FundProjectionScreenOutlined />}>管评 {summary?.managementReviews ?? 0}</Tag>
            <Tag color="cyan" icon={<SafetyOutlined />}>监督 {summary?.supervisions ?? 0}</Tag>
            <Tag color="green" icon={<TrophyOutlined />}>PT {summary?.proficiencyTests ?? 0}</Tag>
            <Tag color="blue" icon={<EyeInvisibleOutlined />}>盲样 {summary?.blindSamples ?? 0}</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      />
      <Tabs
        defaultActiveKey="internal-audit"
        items={[
          { key: 'internal-audit', label: '内部审核 §8.8', children: <InternalAuditList /> },
          { key: 'management-review', label: '管理评审 §8.9', children: <ManagementReviewList /> },
          { key: 'supervision', label: '监督记录', children: <SupervisionList /> },
          { key: 'proficiency-test', label: '能力验证(PT)', children: <ProficiencyTestList /> },
          { key: 'blind-sample', label: '盲样考核', children: <BlindSampleList /> },
          { key: 'temp-auth', label: '临时授权', children: <TemporaryAuthManager /> },
        ]}
      />
    </Card>
  );
}
