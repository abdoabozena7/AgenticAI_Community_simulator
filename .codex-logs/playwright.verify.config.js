// Verification-only config for one-off local flow tracing.
module.exports = {
  testDir: '.',
  timeout: 180000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1440, height: 1024 },
  },
};
