import { Layout, Menu, Typography } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  SettingOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Header, Content } = Layout;

const items = [
  { key: '/', icon: <BarChartOutlined />, label: '仪表盘' },
  { key: '/shops', icon: <ShopOutlined />, label: '店铺管理' },
  { key: '/products', icon: <AppstoreOutlined />, label: '产品诊断' },
  { key: '/mic/products', icon: <AppstoreOutlined />, label: 'MIC 产品中心' },
  { key: '/mic/inquiries', icon: <FileSearchOutlined />, label: '询盘中心' },
  { key: '/mic/opportunities', icon: <ThunderboltOutlined />, label: '商机中心' },
  { key: '/mic/sourcing', icon: <GlobalOutlined />, label: '采购需求' },
  { key: '/reports', icon: <FileSearchOutlined />, label: '诊断报告' },
  { key: '/rules', icon: <ThunderboltOutlined />, label: '规则中心' },
  { key: '/geo', icon: <GlobalOutlined />, label: 'GEO 分析' },
  { key: '/production-check', icon: <SafetyCertificateOutlined />, label: '试运行检查' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ background: '#0b2a4a' }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            AI 店铺医生
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
            Trade AI Store Doctor
          </Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(info) => navigate(info.key)}
          style={{ background: '#0b2a4a', borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #eef0f3',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography.Text style={{ color: '#4a5b6c' }}>Made-in-China.com · Production Pilot · DRY_RUN</Typography.Text>
        </Header>
        <Content style={{ padding: 24, background: '#f4f6f9' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
