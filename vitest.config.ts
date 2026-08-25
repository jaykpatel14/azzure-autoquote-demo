import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://autoquote:autoquote@127.0.0.1:5432/autoquote?schema=public"
    },
    include: ["test/**/*.test.ts", "src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir)
    }
  }
});
