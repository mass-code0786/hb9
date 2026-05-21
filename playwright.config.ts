import { defineConfig, devices } from "@playwright/test";

const skipWebServer = process.env.BITZENX_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://localhost:3210",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "on-first-retry"
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev -- -p 3210",
        url: "http://localhost:3210",
        reuseExistingServer: true,
        timeout: 120_000
      },
  projects: [
    {
      name: "mobile-390x844",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "mobile-360x740",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } }
    },
    {
      name: "mobile-412x915",
      use: { ...devices["Pixel 5"], viewport: { width: 412, height: 915 } }
    }
  ]
});
