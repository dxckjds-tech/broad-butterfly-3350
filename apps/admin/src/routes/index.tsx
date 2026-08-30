import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { GeoPage } from '../pages/GeoPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { RulesPage } from '../pages/RulesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ShopDetailPage } from '../pages/ShopDetailPage';
import { ShopsPage } from '../pages/ShopsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'shops', element: <ShopsPage /> },
      { path: 'shops/:id', element: <ShopDetailPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'geo', element: <GeoPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
