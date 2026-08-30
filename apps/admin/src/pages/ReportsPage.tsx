import { Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchReports } from '../services/api';

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['reports'], queryFn: fetchReports });
  return (
    <div>
      <Typography.Title level={4}>诊断报告</Typography.Title>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={(data as Array<Record<string, unknown>>) ?? []}
        columns={[
          { title: '页面', dataIndex: 'pageUrl', ellipsis: true },
          { title: '类型', dataIndex: 'pageType' },
          { title: '综合评分', dataIndex: 'totalScore' },
          {
            title: '时间',
            dataIndex: 'createdAt',
            render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
          },
        ]}
      />
    </div>
  );
}
