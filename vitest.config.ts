import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/autoquote_test"
    },
    include: ["test/**/*.test.ts", "src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir)
    }
  }
});
