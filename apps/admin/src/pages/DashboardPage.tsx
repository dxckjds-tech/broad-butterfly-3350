import { Card, Col, Row, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../services/api';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

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
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="严重问题数量" value={stats.criticalIssueCount} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="平均 MIC SEO" value={stats.averageMicSeo} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Card loading={isLoading}>
          <Statistic title="平均 GEO" value={stats.averageGeo} />
        </Card>
      </Col>
    </Row>
  );
}
