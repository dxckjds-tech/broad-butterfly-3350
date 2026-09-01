import { Button, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ShopSummary } from '@trade-ai/shared-types';
import { fetchShops } from '../services/api';

export function ShopsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['shops'], queryFn: fetchShops });

  return (
    <div>
      <Typography.Title level={4}>店铺管理</Typography.Title>
      <Table<ShopSummary>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: '公司名称', dataIndex: 'companyName' },
          {
            title: '平台',
            dataIndex: 'platform',
            render: (value: string) => <Tag color="blue">{value}</Tag>,
          },
          { title: '店铺 URL', dataIndex: 'shopUrl', ellipsis: true },
          { title: '综合评分', dataIndex: 'totalScore', render: (v: number | null) => v ?? '-' },
          { title: 'MIC SEO', dataIndex: 'micSeo', render: (v: number | null) => v ?? '-' },
          { title: 'Google SEO', dataIndex: 'googleSeo', render: (v: number | null) => v ?? '-' },
          { title: 'GEO', dataIndex: 'geo', render: (v: number | null) => v ?? '-' },
          {
            title: 'Pilot',
            dataIndex: 'pilot',
            render: (v: boolean | undefined) => (v === false ? '' : <Tag color="orange">PILOT</Tag>),
          },
          {
            title: '最近诊断时间',
            dataIndex: 'lastDiagnosisAt',
            render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/shops/${row.id}`)}>
                  查看
                </Button>
                <Button size="small" disabled>
                  重新诊断
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
