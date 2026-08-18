import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "client/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./shared"),
      "@": resolve(__dirname, "./client/src"),
    },
  },
});
