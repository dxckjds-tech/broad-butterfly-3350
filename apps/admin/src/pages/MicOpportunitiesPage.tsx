import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicOpportunities } from '../services/api';

export function MicOpportunitiesPage() {
  const { data } = useQuery({ queryKey: ['mic-opp'], queryFn: fetchMicOpportunities });
  return (
    <div>
      <Typography.Title level={4}>商机中心</Typography.Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="新询盘" value={Number(data?.newInquiries ?? 0)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="待回复" value={Number(data?.unrepliedInquiries ?? 0)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="高意向（推断）" value={Number(data?.highIntentInquiries ?? 0)} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
