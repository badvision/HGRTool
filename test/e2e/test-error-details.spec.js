import { test } from '@playwright/test';

test('Capture detailed error information', async ({ page }) => {
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push({
      message: error.message,
      stack: error.stack,
      toString: error.toString()
    });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console error: ${msg.text()}`);
    }
  });

  await page.goto('/imgedit.html');
  await page.waitForTimeout(2000);

  console.log('\n=== Detailed Error Information ===\n');
  errors.forEach((err, idx) => {
    console.log(`\nError ${idx + 1}:`);
    console.log('Message:', err.message);
    console.log('\nStack trace:');
    console.log(err.stack);
  });

  if (errors.length === 0) {
    console.log('No errors found!');
  }
});
