import { Alert, Button, Card, Col, Modal, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicOverview, fetchMicProducts, fetchProductionRuntime } from '../services/api';
import { postData } from '../services/http';
import { DEMO_VO_PAYLOAD } from '../demo-vo';
import { DataOriginTag } from '../components/DataOriginTag';
import { useState } from 'react';

export function MicProductsPage() {
  const overview = useQuery({ queryKey: ['mic-overview'], queryFn: fetchMicOverview });
  const products = useQuery({ queryKey: ['mic-products'], queryFn: fetchMicProducts });
  const runtime = useQuery({ queryKey: ['production-runtime'], queryFn: fetchProductionRuntime });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const liveOnly = runtime.data?.appEnv === 'production' && runtime.data?.micDataMode === 'live';

  async function previewDemo() {
    const data = await postData<Record<string, unknown>>('/integrations/mic/sync/preview', DEMO_VO_PAYLOAD);
    setPreview(data);
  }

  async function confirmDemo() {
    await postData('/integrations/mic/sync', { ...DEMO_VO_PAYLOAD, confirmed: true, actor: 'admin' });
    setPreview(null);
    await products.refetch();
  }

  return (
    <div>
      <Typography.Title level={4}>MIC 产品中心</Typography.Title>
      {liveOnly ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="生产 LIVE 模式禁止 Fixture/演示数据。" />
      ) : (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="同步会先预览数量，确认后才写入本地库。DRY_RUN 下不会对 MIC 执行写操作。" />
      )}
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
          {liveOnly ? null : (
            <Button type="primary" onClick={() => void previewDemo()}>
              导入演示数据（先预览）
            </Button>
          )}
        </Col>
      </Row>
      <Modal
        open={Boolean(preview)}
        title="同步预览"
        onCancel={() => setPreview(null)}
        onOk={() => void confirmDemo()}
        okText="确认同步"
      >
        <p>预计读取：{String((preview?.estimated as { products?: number } | undefined)?.products ?? 0)} 个产品</p>
        <p>最近 {(preview?.estimated as { inquiries?: number } | undefined)?.inquiries ?? 0} 条询盘</p>
        <p>RFQ {(preview?.estimated as { rfq?: number } | undefined)?.rfq ?? 0} 条</p>
        {preview?.parser ? <pre>{JSON.stringify(preview.parser, null, 2)}</pre> : null}
      </Modal>
      <Table
        rowKey="id"
        loading={products.isLoading}
        dataSource={products.data?.items ?? []}
        columns={[
          { title: '产品名称', dataIndex: 'productName' },
          { title: 'MIC 状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
          { title: '主打', dataIndex: 'isFeaturedProduct', render: (v: boolean) => (v ? '是' : '') },
          {
            title: '来源',
            render: (_: unknown, row: Record<string, unknown>) => (
              <DataOriginTag dataMode={String(row.dataMode ?? 'LIVE')} evidenceLevel={String(row.evidenceLevel ?? 'VERIFIED')} />
            ),
          },
        ]}
      />
    </div>
  );
}
