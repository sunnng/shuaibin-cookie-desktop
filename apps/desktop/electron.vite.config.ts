import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, "src/renderer"),
    server: {
      port: 5174,
      strictPort: true,
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    plugins: [tailwindcss(), react()],
    resolve: {
      tsconfigPaths: true,
    },
  },
});
