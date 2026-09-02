import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * frontend/client —— 公共前台。
 *
 * Tailwind 4 走 **CSS-first**：没有 tailwind.config.js，也没有 postcss.config.js。
 * 主题定义在 `@baonly/shared/tokens.css` 的 `@theme` 块里，由 `@tailwindcss/vite`
 * 插件在构建时读取。入口 CSS 只需：
 *
 *     @import "@baonly/shared/tokens.css";
 *
 * ⚠ 不要在入口再写 `@import "tailwindcss"` —— tokens.css 内部已经导入过了，
 *   重复导入会让 utility 层被生成两遍。
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // 后端 API 进程（backend/src/main.ts），端口见 backend/.env 的 PORT
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // WebSocket（在线人数 / 变更推送）
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
    // 体量兜底：超了说明有大依赖被打进主 chunk，去查而不是抬高阈值
    chunkSizeWarningLimit: 700,
  },
});
