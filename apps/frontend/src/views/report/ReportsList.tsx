import { Card, Empty } from 'antd';
export default function ReportsListPage() {
  return (
    <Card title="检测报告(多级审核 + 电子签名)">
      <Empty description="Phase 2 填充(草稿/校核/审核/批准/签发工作流)" />
    </Card>
  );
}