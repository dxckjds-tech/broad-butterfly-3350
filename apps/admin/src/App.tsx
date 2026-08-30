import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

const queryClient = new QueryClient();

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1b4f8a',
          borderRadius: 8,
          fontFamily: 'Inter, "PingFang SC", "Noto Sans SC", sans-serif',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>
  );
}
