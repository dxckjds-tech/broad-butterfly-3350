import { Alert, Button, Card, Descriptions, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchProductionCheck, fetchProductionValidations } from '../services/api';

const color: Record<string, string> = { PASS: 'green', WARNING: 'gold', FAIL: 'red' };

export function ProductionCheckPage() {
  const check = useQuery({ queryKey: ['production-check'], queryFn: fetchProductionCheck });
  const validations = useQuery({ queryKey: ['production-validations'], queryFn: fetchProductionValidations });
  const data = check.data;
  const verdict = String(data?.readiness && typeof data.readiness === 'object' ? (data.readiness as { verdict?: string }).verdict : '');

  return (
    <div>
      <Typography.Title level={4}>Production Check</Typography.Title>
      {data?.safety ? (
        <Alert
          style={{ marginBottom: 16 }}
          type={String((data.safety as { dryRun?: boolean }).dryRun) ? 'info' : 'warning'}
          message={`APP_ENV=${String((data.safety as { appEnv?: string }).appEnv)} · MIC_DATA_MODE=${String((data.safety as { micDataMode?: string }).micDataMode)} · DRY_RUN=${String((data.safety as { dryRun?: boolean }).dryRun)}`}
        />
      ) : null}
      <Card style={{ marginBottom: 16 }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {verdict === 'READY FOR PRODUCTION' ? (
            <Tag color="green">READY FOR PRODUCTION</Tag>
          ) : (
            <Tag color="orange">PILOT ONLY</Tag>
          )}
        </Typography.Title>
        <Table
          rowKey="key"
          pagination={false}
          loading={check.isLoading}
          dataSource={(data?.checks as Array<Record<string, string>>) ?? []}
          columns={[
            { title: '项目', dataIndex: 'label' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) => <Tag color={color[v] ?? 'default'}>{v}</Tag>,
            },
            { title: '说明', dataIndex: 'detail' },
          ]}
        />
      </Card>
      <Space>
        <Button onClick={() => check.refetch()}>重新检查</Button>
        <Button onClick={() => validations.refetch()}>抽样校验</Button>
      </Space>
      {validations.data ? (
        <Descriptions bordered column={1} style={{ marginTop: 16 }} title="抽样校验（日志已脱敏）">
          <Descriptions.Item label="产品 Match Rate">
            {JSON.stringify((validations.data as { productMatch?: unknown }).productMatch)}
          </Descriptions.Item>
          <Descriptions.Item label="询盘 Match Rate">
            {JSON.stringify((validations.data as { inquiryMatch?: unknown }).inquiryMatch)}
          </Descriptions.Item>
          <Descriptions.Item label="AI Fact Guard">
            {JSON.stringify((validations.data as { fact?: unknown }).fact)}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </div>
  );
}
