// =====================================================
// W+6-1: CMA 合规管理 Hub
// 5 个 CMA 必查 tab:内审/管评/监督/盲样/PT/临时授权
// =====================================================

import { Tabs, Card } from 'antd';
import InternalAuditList from './InternalAuditList';
import ManagementReviewList from './ManagementReviewList';
import SupervisionList from './SupervisionList';
import BlindSampleList from './BlindSampleList';
import ProficiencyTestList from './ProficiencyTestList';
import TemporaryAuthManager from './TemporaryAuthManager';

export default function ComplianceHub() {
  return (
    <Card>
      <Tabs
        defaultActiveKey="temp-auth"
        items={[
          { key: 'temp-auth', label: '临时授权', children: <TemporaryAuthManager /> },
          { key: 'internal-audit', label: '内部审核', children: <InternalAuditList /> },
          { key: 'management-review', label: '管理评审', children: <ManagementReviewList /> },
          { key: 'supervision', label: '监督记录', children: <SupervisionList /> },
          { key: 'blind-sample', label: '盲样考核', children: <BlindSampleList /> },
          { key: 'proficiency-test', label: '能力验证(PT)', children: <ProficiencyTestList /> },
        ]}
      />
    </Card>
  );
}