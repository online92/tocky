import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Giúp code hiện tại (dùng process.env.API_KEY) hoạt động được trên trình duyệt
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});