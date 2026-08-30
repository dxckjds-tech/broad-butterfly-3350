import { Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchRules } from '../services/api';

export function RulesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['rules'], queryFn: fetchRules });
  return (
    <div>
      <Typography.Title level={4}>规则中心</Typography.Title>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={(data as Array<Record<string, string>>) ?? []}
        columns={[
          { title: '规则 ID', dataIndex: 'id' },
          { title: '名称', dataIndex: 'name' },
          { title: '维度', dataIndex: 'category' },
          {
            title: '等级',
            dataIndex: 'severity',
            render: (v: string) => <Tag>{v}</Tag>,
          },
          { title: '标题', dataIndex: 'title' },
        ]}
      />
    </div>
  );
}
