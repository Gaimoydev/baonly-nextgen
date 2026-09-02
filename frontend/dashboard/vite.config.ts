import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * frontend/dashboard —— 管理后台。
 *
 * 这里 **没有** Tailwind：后台全部走 Ant Design 6 的组件与 token。
 * 主题从 `@baonly/shared/design-tokens` 取 `antdToken(mode)`，喂给
 * `<ConfigProvider theme={{ token: antdToken(mode) }}>` —— 与前台共用同一套设计 token。
 *
 * 端口 5174，避开 client 的 5173，两个前台可以同时开着对照。
 */
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
