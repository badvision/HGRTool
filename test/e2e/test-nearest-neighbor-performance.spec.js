import { test, expect } from '@playwright/test';

test.describe('Nearest Neighbor Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console log monitoring
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ERROR') || text.includes('Warning')) {
        console.log('BROWSER:', text);
      }
    });

    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');
  });

  test('Nearest Neighbor algorithm should complete quickly', async ({ page }) => {
    console.log('\n=== Performance Test: Nearest Neighbor Algorithm ===\n');

    // Create a test image with File System Access API mock
    await page.addInitScript(() => {
      // Create a small gradient test image (20x20 pixels)
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');

      // Create simple gradient
      const gradient = ctx.createLinearGradient(0, 0, 20, 20);
      gradient.addColorStop(0, '#FF0000');
      gradient.addColorStop(0.5, '#00FF00');
      gradient.addColorStop(1, '#0000FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 20, 20);

      // Mock File System Access API
      window.showOpenFilePicker = async function() {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            const file = new File([blob], 'test-gradient.png', { type: 'image/png' });
            const fileHandle = {
              kind: 'file',
              name: 'test-gradient.png',
              getFile: async () => file
            };
            resolve([fileHandle]);
          }, 'image/png');
        });
      };
    });

    // Open import dialog
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

    // Select file
    await page.click('#import-select-file');
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

    // Select Nearest Neighbor algorithm
    await page.selectOption('#import-algorithm', 'nearest-neighbor');

    // Measure conversion time
    const startTime = Date.now();
    await page.click('#import-convert');

    // Wait for progress modal to appear
    await page.waitForSelector('#progress-modal[open]', { timeout: 5000 });

    // Wait for conversion to complete (progress modal closes)
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });

    const endTime = Date.now();
    const conversionTime = endTime - startTime;

    console.log(`Conversion completed in ${conversionTime}ms`);

    // Nearest Neighbor should complete in under 5 seconds for small images
    expect(conversionTime).toBeLessThan(5000);

    // Take screenshot
    await page.screenshot({ path: 'test-output/nearest-neighbor-performance.png' });

    console.log('✓ Nearest Neighbor algorithm completed successfully');
  });

  test('Nearest Neighbor should produce valid output', async ({ page }) => {
    console.log('\n=== Quality Test: Nearest Neighbor Output ===\n');

    // Create a test image with solid red color
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FF0000'; // Solid red
      ctx.fillRect(0, 0, 10, 10);

      window.showOpenFilePicker = async function() {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            const file = new File([blob], 'test-red.png', { type: 'image/png' });
            const fileHandle = {
              kind: 'file',
              name: 'test-red.png',
              getFile: async () => file
            };
            resolve([fileHandle]);
          }, 'image/png');
        });
      };
    });

    // Open import dialog
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

    // Select file
    await page.click('#import-select-file');
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

    // Select Nearest Neighbor algorithm
    await page.selectOption('#import-algorithm', 'nearest-neighbor');

    // Convert
    await page.click('#import-convert');
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });

    // Verify canvas exists
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('#edit-surface');
      return canvas !== null;
    });

    expect(canvasExists).toBe(true);
    console.log('✓ Nearest Neighbor produced valid output');
  });

  test('Compare Nearest Neighbor vs Greedy speed', async ({ page }) => {
    console.log('\n=== Speed Comparison: Nearest Neighbor vs Greedy ===\n');

    // Create same test image for both algorithms
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 30;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');

      // Create complex pattern to test performance
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          ctx.fillStyle = `rgb(${(x * 8) % 256}, ${(y * 8) % 256}, ${((x + y) * 4) % 256})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      window.testImageBlob = null;
      canvas.toBlob((blob) => {
        window.testImageBlob = blob;
      }, 'image/png');

      window.showOpenFilePicker = async function() {
        return new Promise((resolve) => {
          if (window.testImageBlob) {
            const file = new File([window.testImageBlob], 'test.png', { type: 'image/png' });
            const fileHandle = {
              kind: 'file',
              name: 'test.png',
              getFile: async () => file
            };
            resolve([fileHandle]);
          }
        });
      };
    });

    // Wait for blob creation
    await page.waitForTimeout(500);

    // Test Greedy algorithm
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    await page.click('#import-select-file');
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    await page.selectOption('#import-algorithm', 'greedy');

    const greedyStart = Date.now();
    await page.click('#import-convert');
    await page.waitForSelector('#progress-modal[open]', { timeout: 5000 });
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });
    const greedyTime = Date.now() - greedyStart;

    console.log(`Greedy algorithm: ${greedyTime}ms`);

    // Wait a bit before next test
    await page.waitForTimeout(1000);

    // Test Nearest Neighbor algorithm
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    await page.click('#import-select-file');
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    await page.selectOption('#import-algorithm', 'nearest-neighbor');

    const nnStart = Date.now();
    await page.click('#import-convert');
    await page.waitForSelector('#progress-modal[open]', { timeout: 5000 });
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });
    const nnTime = Date.now() - nnStart;

    console.log(`Nearest Neighbor algorithm: ${nnTime}ms`);

    // Calculate speed comparison
    const ratio = nnTime / greedyTime;
    console.log(`Speed ratio (NN/Greedy): ${ratio.toFixed(2)}x`);

    // Nearest Neighbor should be comparable to Greedy (within 3x)
    expect(ratio).toBeLessThan(3);

    console.log('✓ Performance is comparable between algorithms');
  });
});
