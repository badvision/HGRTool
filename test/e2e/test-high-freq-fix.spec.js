import { test, expect } from '@playwright/test';

test('Verify high-frequency pattern fix', async ({ page }) => {
    // Navigate to test page
    await page.goto('file:///Users/brobert/Documents/code/hgrtool/test-high-freq-fix.html');

    // Wait for tests to run
    await page.waitForTimeout(2000);

    // Check results
    const result1 = await page.textContent('#result1');
    const result2 = await page.textContent('#result2');
    const result3 = await page.textContent('#result3');

    console.log('Pattern 1 result:', result1);
    console.log('Pattern 2 result:', result2);
    console.log('Pattern 3 result:', result3);

    // Take screenshots
    await page.screenshot({ path: 'test-output/high-freq-test-full.png' });

    // Check if results show PASS
    expect(result1).toContain('PASS');
    expect(result2).toContain('PASS');
    expect(result3).toContain('PASS');
});
