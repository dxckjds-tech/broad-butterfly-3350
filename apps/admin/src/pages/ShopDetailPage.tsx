import { Descriptions, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getData } from '../services/http';

export function ShopDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => getData<Record<string, unknown>>(`/shops/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading || !data) {
    return <Typography.Text>加载中...</Typography.Text>;
  }

  return (
    <div>
      <Typography.Title level={4}>店铺详情</Typography.Title>
      <Descriptions bordered column={1}>
        <Descriptions.Item label="公司">{String(data.companyName ?? '')}</Descriptions.Item>
        <Descriptions.Item label="平台">{String(data.platform ?? '')}</Descriptions.Item>
        <Descriptions.Item label="URL">{String(data.shopUrl ?? '')}</Descriptions.Item>
      </Descriptions>
    </div>
  );
}
