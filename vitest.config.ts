import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    // Fake key so lib/openai.ts's getClient() guard doesn't reject tests —
    // the "openai" package itself is always mocked in tests, so no real
    // request is ever made with it.
    env: { OPENAI_API_KEY: "test-key" },
  },
});
