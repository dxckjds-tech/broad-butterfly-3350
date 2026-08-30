import { Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '../services/api';

export function ProductsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  return (
    <div>
      <Typography.Title level={4}>产品诊断</Typography.Title>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={(data as Array<Record<string, unknown>>) ?? []}
        columns={[
          { title: '产品名称', dataIndex: 'name' },
          { title: 'URL', dataIndex: 'url', ellipsis: true },
          { title: '类目', dataIndex: 'category' },
        ]}
      />
    </div>
  );
}
