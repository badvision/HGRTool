import { test } from '@playwright/test';

test('Check all button elements', async ({ page }) => {
  await page.goto('/imgedit.html');
  await page.waitForTimeout(2000);

  const elementsToCheck = [
    'btn-new', 'btn-open', 'btn-import', 'btn-save', 'btn-save-as', 'btn-close',
    'btn-cut', 'btn-copy', 'btn-paste', 'btn-undo', 'btn-redo',
    'btn-settings', 'btn-help',
    'render-mode-rgb', 'render-mode-ntsc', 'render-mode-mono',
    'pictureScale', 'pictureScaleSlider'
  ];

  const result = await page.evaluate((ids) => {
    const missing = [];
    const found = [];

    for (const id of ids) {
      const elem = document.getElementById(id);
      if (!elem) {
        missing.push(id);
      } else {
        found.push(id);
      }
    }

    return { missing, found };
  }, elementsToCheck);

  console.log('\n=== Missing Elements ===');
  result.missing.forEach(id => console.log(`  ❌ ${id}`));

  console.log('\n=== Found Elements ===');
  result.found.forEach(id => console.log(`  ✓ ${id}`));
});
