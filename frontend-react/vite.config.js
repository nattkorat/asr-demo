import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api":    "http://localhost:7860",
      "/ws":     { target: "ws://localhost:7860", ws: true },
      "/static": "http://localhost:7860",
    },
  },
  build: {
    outDir: "../frontend/dist",
    emptyOutDir: true,
  },
});
