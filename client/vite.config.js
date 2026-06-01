import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For local dev: proxy API + auth calls to the server so cookies stay
// same-origin (mirrors the nginx setup used in production).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/auth": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
