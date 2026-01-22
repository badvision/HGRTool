import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot } from './helpers.js';
import fs from 'fs';
import path from 'path';

test.describe('Image Import - Verify No Missing Lines', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    consoleMessages = [];
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(text);
    });

    // Capture page errors
    pageErrors = [];
    page.on('pageerror', err => {
      const text = `PAGE ERROR: ${err.toString()}`;
      pageErrors.push(text);
      console.log(text);
    });
  });

  test('Imported image should have data in all 192 rows', async ({ page }) => {
    console.log('=== Test: Verify No Missing Lines After Import ===');

    // Create a test image with distinct pattern for each row
    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create test image: 280x192 with different grayscale value per row
    const testImageDataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;  // HGR width
      canvas.height = 192; // HGR height
      const ctx = canvas.getContext('2d');

      // Draw each row with a different grayscale value
      // This ensures every row should have distinct non-zero data
      for (let row = 0; row < 192; row++) {
        // Use grayscale values from 32-255 to avoid pure black
        const grayValue = 32 + Math.floor((row / 192) * 223);
        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        ctx.fillRect(0, row, 280, 1);
      }

      return canvas.toDataURL('image/png');
    });

    // Convert data URL to buffer and save
    const base64Data = testImageDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const testImagePath = path.join('/tmp', 'test-gradient-192.png');
    fs.writeFileSync(testImagePath, buffer);
    console.log(`Test gradient image created at: ${testImagePath}`);

    // Set up file chooser handler
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click import button
    console.log('Clicking Import button...');
    await page.click('#btn-import');

    // Wait for file chooser
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
      console.log('File chooser appeared!');

      // Select the test image
      await fileChooser.setFiles(testImagePath);
      console.log('File selected');

      // Wait for import to complete
      await page.waitForTimeout(2000);

      // Take screenshot of imported image
      await takeScreenshot(page, 'import-gradient-complete.png');

      // Now verify the imported HGR data
      const verification = await page.evaluate(() => {
        // Get the current picture
        const editor = window.imageEditor;
        if (!editor || !editor.picture) {
          return { error: 'No picture loaded' };
        }

        const picture = editor.picture;
        const hgrData = new Uint8Array(picture.binaryData);

        // HGR file format: 7680 bytes screen data at start
        // We need to check the interleaved format

        // Helper: convert row number to HGR offset
        function rowToHgrOffset(row) {
          const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
          const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
          return (high << 8) | low;
        }

        // Check each row to see if it has any non-zero data
        const emptyRows = [];
        const rowStats = [];

        for (let row = 0; row < 192; row++) {
          const offset = rowToHgrOffset(row);
          let hasData = false;
          let byteSum = 0;

          // Check all 40 bytes in this row
          for (let col = 0; col < 40; col++) {
            const byte = hgrData[offset + col];
            byteSum += byte;
            if (byte !== 0) {
              hasData = true;
            }
          }

          if (!hasData) {
            emptyRows.push(row);
          }

          rowStats.push({
            row: row,
            offset: offset,
            byteSum: byteSum,
            isEmpty: !hasData
          });
        }

        return {
          totalRows: 192,
          emptyRows: emptyRows,
          emptyRowCount: emptyRows.length,
          sampleRows: rowStats.filter((_, i) => i % 20 === 0), // Sample every 20th row
          firstEmptyRows: emptyRows.slice(0, 20)
        };
      });

      console.log('\nVerification results:');
      console.log(JSON.stringify(verification, null, 2));

      if (verification.error) {
        throw new Error(verification.error);
      }

      // Log details about empty rows
      if (verification.emptyRowCount > 0) {
        console.log(`\nFound ${verification.emptyRowCount} empty rows:`);
        console.log(verification.firstEmptyRows);

        console.log('\nSample of row statistics:');
        verification.sampleRows.forEach(stat => {
          console.log(`  Row ${stat.row}: offset=0x${stat.offset.toString(16)}, sum=${stat.byteSum}, empty=${stat.isEmpty}`);
        });
      }

      // The test fails if there are any empty rows
      expect(verification.emptyRowCount).toBe(0);
      expect(verification.emptyRows.length).toBe(0);

    } catch (e) {
      console.log(`Error during test: ${e.toString()}`);

      // Log all console messages
      console.log('\nAll console messages:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));

      // Log all errors
      console.log('\nAll errors:');
      pageErrors.forEach(err => console.log(`  ${err}`));

      await takeScreenshot(page, 'import-verification-failed.png');
      throw e;
    } finally {
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });
});
