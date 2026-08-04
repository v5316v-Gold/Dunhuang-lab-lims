// 哈希显示组件(截断 + 复制)
import { Tooltip, Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

interface Props {
  hash: string;
  length?: number;
  copyable?: boolean;
}

export function HashDisplay({ hash, length = 16, copyable = true }: Props) {
  const display = hash.length > length ? `${hash.slice(0, length)}…` : hash;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
      <Tooltip title={hash}>
        <code>{display}</code>
      </Tooltip>
      {copyable && (
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={copy}
          style={{ marginLeft: 4 }}
        />
      )}
    </span>
  );
}