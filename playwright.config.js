// Settings for the automated checks in the tests/ folder.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  // Fail the checks if someone accidentally leaves test.only in a test
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8000',
  },
  // Run every check on an iPhone-sized screen and on a laptop-sized screen
  projects: [
    { name: 'iPhone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'Laptop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start a simple local web server so the tests can open the page like a visitor would
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
});
