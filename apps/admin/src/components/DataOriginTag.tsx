import { Tag } from 'antd';

export function DataOriginTag({
  dataMode,
  evidenceLevel,
  inferred,
}: {
  dataMode?: string;
  evidenceLevel?: string;
  inferred?: boolean;
}) {
  if (inferred || evidenceLevel === 'INFERRED') return <Tag color="purple">AI / INFERRED</Tag>;
  if (dataMode === 'DEMO' || dataMode === 'FIXTURE') return <Tag>DEMO</Tag>;
  if (evidenceLevel === 'VERIFIED') {
    return (
      <>
        <Tag color="green">LIVE</Tag>
        <Tag color="blue">VERIFIED</Tag>
      </>
    );
  }
  return <Tag color="green">LIVE</Tag>;
}
