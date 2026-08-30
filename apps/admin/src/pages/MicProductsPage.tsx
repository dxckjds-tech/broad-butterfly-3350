import { Button, Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicOverview, fetchMicProducts } from '../services/api';
import { postData } from '../services/http';
import { DEMO_VO_PAYLOAD } from '../demo-vo';

export function MicProductsPage() {
  const overview = useQuery({ queryKey: ['mic-overview'], queryFn: fetchMicOverview });
  const products = useQuery({ queryKey: ['mic-products'], queryFn: fetchMicProducts });

  return (
    <div>
      <Typography.Title level={4}>MIC 产品中心</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="已同步产品" value={Number(overview.data?.products ?? 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="询盘" value={Number(overview.data?.inquiries ?? 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待回复" value={Number(overview.data?.unreplied ?? 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Button
            type="primary"
            onClick={() =>
              postData('/integrations/mic/sync', DEMO_VO_PAYLOAD).then(() => products.refetch())
            }
          >
            导入演示数据
          </Button>
        </Col>
      </Row>
      <Table
        rowKey="id"
        loading={products.isLoading}
        dataSource={products.data?.items ?? []}
        columns={[
          { title: '产品名称', dataIndex: 'productName' },
          { title: 'MIC 状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
          { title: '主打', dataIndex: 'isFeaturedProduct', render: (v: boolean) => (v ? '是' : '') },
          { title: '来源', dataIndex: 'source' },
          { title: '证据', dataIndex: 'evidenceLevel' },
        ]}
      />
    </div>
  );
}
