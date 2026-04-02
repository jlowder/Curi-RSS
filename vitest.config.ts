import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["server/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./shared"),
    },
  },
});
