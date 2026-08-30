import { Button, Space, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicSourcing } from '../services/api';
import { postData } from '../services/http';

export function MicSourcingPage() {
  const { data, isLoading } = useQuery({ queryKey: ['mic-sourcing'], queryFn: fetchMicSourcing });
  return (
    <div>
      <Typography.Title level={4}>采购需求</Typography.Title>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        columns={[
          { title: '标题', dataIndex: 'title' },
          { title: '国家', dataIndex: 'country' },
          { title: '数量', dataIndex: 'quantity' },
          {
            title: '操作',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Space>
                <Button size="small" onClick={() => postData(`/ai/sourcing/${String(row.id)}/match`).then((r) => alert(JSON.stringify(r)))}>
                  匹配产品
                </Button>
                <Button size="small" onClick={() => postData(`/ai/sourcing/${String(row.id)}/draft-quote`).then((r) => alert(JSON.stringify(r)))}>
                  报价草稿
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
