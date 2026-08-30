import { Result } from 'antd';

export function ComingSoon({ title }: { title: string }) {
  return (
    <Result
      status="info"
      title={title}
      subTitle="Coming Soon — 该模块已预留，将在后续 Phase 实现。"
    />
  );
}
