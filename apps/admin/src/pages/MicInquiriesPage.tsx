import { Button, Space, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicInquiries } from '../services/api';
import { postData } from '../services/http';
import { DataOriginTag } from '../components/DataOriginTag';

export function MicInquiriesPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['mic-inquiries'], queryFn: fetchMicInquiries });
  return (
    <div>
      <Typography.Title level={4}>询盘中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        仅保存摘要字段。AI 可生成回复草稿，不会自动发送。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        columns={[
          { title: '主题', dataIndex: 'subject' },
          { title: '国家', dataIndex: 'buyerCountry' },
          { title: '产品', dataIndex: 'productName' },
          { title: '状态', dataIndex: 'status' },
          {
            title: '来源',
            render: (_: unknown, row: Record<string, unknown>) => (
              <DataOriginTag dataMode={String(row.dataMode ?? 'LIVE')} evidenceLevel={String(row.evidenceLevel ?? 'VERIFIED')} />
            ),
          },
          {
            title: '操作',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Space>
                <Button
                  size="small"
                  onClick={() =>
                    postData(`/ai/inquiries/${String(row.id)}/analyze`).then((r) => alert(JSON.stringify(r, null, 2)))
                  }
                >
                  AI 分析
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    postData(`/ai/inquiries/${String(row.id)}/draft-reply`).then((r) => alert(JSON.stringify(r, null, 2)))
                  }
                >
                  回复草稿
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Button onClick={() => refetch()}>刷新</Button>
    </div>
  );
}
