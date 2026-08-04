// 状态时间线(展示多级审核流转)
import { Timeline } from 'antd';

interface Props {
  stages: Array<{
    stage: string;
    createdAt: string;
    userName?: string;
    comments?: string;
  }>;
}

const stageColors: Record<string, string> = {
  DRAFT: 'gray',
  INTERNAL_REVIEW: 'blue',
  FINAL_REVIEW: 'cyan',
  APPROVED: 'green',
  ISSUED: 'gold',
  REJECTED: 'red',
};

export function StatusTimeline({ stages }: Props) {
  return (
    <Timeline>
      {stages.map((stage, idx) => (
        <Timeline.Item
          key={idx}
          color={stageColors[stage.stage] ?? 'gray'}
        >
          <div>
            <strong>{stage.stage}</strong>
            {stage.userName && <span style={{ marginLeft: 8, color: '#666' }}>by {stage.userName}</span>}
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {new Date(stage.createdAt).toLocaleString('zh-CN')}
          </div>
          {stage.comments && (
            <div style={{ fontSize: 13, marginTop: 4 }}>{stage.comments}</div>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}