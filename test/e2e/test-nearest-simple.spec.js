/**
 * Simple test for nearest-neighbor algorithm
 */

import { test, expect } from '@playwright/test';

test('nearest-neighbor algorithm basic test', async ({ page }) => {
    // Navigate to simple test page
    await page.goto('http://localhost:8080/test-nearest-neighbor-simple.html');

    // Wait for test to complete
    await page.waitForTimeout(5000);

    // Check status
    const statusText = await page.textContent('#status');

    // Verify test passed
    expect(statusText).toContain('Test PASSED');
    expect(statusText).toContain('Algorithm executed successfully');

    console.log('Test result:', statusText);
});
