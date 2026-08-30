import { Alert, Button, Descriptions, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchMicStatus } from '../services/api';
import { deleteData } from '../services/http';

export function SettingsPage() {
  const { data, refetch } = useQuery({ queryKey: ['mic-status'], queryFn: fetchMicStatus });
  return (
    <div>
      <Typography.Title level={4}>平台连接 · Made-in-China</Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Browser Session Required"
        description="MIC 登录由浏览器插件管理。系统不会保存 MIC 密码、Cookie Value 或短信验证码。"
      />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="连接模式">{String(data?.mode ?? 'BROWSER_SESSION')}</Descriptions.Item>
        <Descriptions.Item label="密码存储">{data?.passwordStored ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="Cookie 上传">{data?.cookieUploaded ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="验证码存储">{data?.smsStored ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="账号标签">{String(data?.accountLabel ?? '-')}</Descriptions.Item>
        <Descriptions.Item label="最后同步">{String(data?.lastSyncAt ?? '-')}</Descriptions.Item>
        <Descriptions.Item label="询盘保留天数">{String(data?.inquiryRetentionDays ?? 90)}</Descriptions.Item>
        <Descriptions.Item label="DRY_RUN">{String(data?.dryRun ?? true)}</Descriptions.Item>
        <Descriptions.Item label="MIC_DATA_MODE">{String(data?.micDataMode ?? '-')}</Descriptions.Item>
      </Descriptions>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        删除 MIC 同步数据
      </Typography.Title>
      <Typography.Paragraph type="secondary">不会影响 MIC 官方后台原数据。</Typography.Paragraph>
      <Button onClick={() => deleteData('/integrations/mic/data?target=inquiries').then(() => refetch())}>只删除询盘</Button>{' '}
      <Button onClick={() => deleteData('/integrations/mic/data?target=products').then(() => refetch())}>只删除产品</Button>{' '}
      <Button danger onClick={() => deleteData('/integrations/mic/data?target=all').then(() => refetch())}>
        全部删除
      </Button>
    </div>
  );
}
