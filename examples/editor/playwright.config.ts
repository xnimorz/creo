import { defineConfig, devices } from "@playwright/test";

/**
 * Spawns `vite` on a free-ish port, waits for it, then runs the suite.
 *
 * Projects:
 *  - chromium-desktop  — full feature coverage on Chromium
 *  - webkit-desktop    — Safari (catches WebKit-specific clipboard / focus oddities)
 *  - mobile-iphone     — iPhone 13 emulation (touch UX, soft keyboard heuristics)
 *  - mobile-pixel      — Pixel 7 emulation (Android Chrome / coarse pointer)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  webServer: {
    command: "bun run dev",
    port: 5183,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  use: {
    baseURL: "http://localhost:5183",
    trace: "on-first-retry",
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "mobile-pixel",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
