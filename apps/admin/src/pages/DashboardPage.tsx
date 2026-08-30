import { Card, Col, Row, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicOverview, fetchStats } from '../services/api';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });
  const mic = useQuery({ queryKey: ['mic-overview'], queryFn: fetchMicOverview });

  const stats = data ?? {
    shopCount: 0,
    productCount: 0,
    averageHealth: 0,
    criticalIssueCount: 0,
    averageMicSeo: 0,
    averageGeo: 0,
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="诊断店铺数" value={stats.shopCount} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="诊断产品数" value={stats.productCount} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="平均健康度" value={stats.averageHealth} suffix="/ 100" />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={mic.isLoading}>
          <Statistic title="MIC 产品" value={Number(mic.data?.products ?? 0)} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={mic.isLoading}>
          <Statistic title="MIC 询盘" value={Number(mic.data?.inquiries ?? 0)} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={mic.isLoading}>
          <Statistic title="待回复" value={Number(mic.data?.unreplied ?? 0)} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={mic.isLoading}>
          <Statistic title="RFQ" value={Number(mic.data?.sourcing ?? 0)} />
        </Card>
      </Col>
    </Row>
  );
}
