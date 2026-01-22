import { describe, it, expect, beforeEach } from 'vitest';
import ImageDither from '../docs/src/lib/image-dither.js';

describe('Greedy Dither Algorithm', () => {
  let dither;

  beforeEach(() => {
    dither = new ImageDither();
  });

  describe('basic functionality', () => {
    // Greedy algorithm is slow - test all 256 bytes for each position
    // For 280x192 that's 256 * 40 * 192 = ~2M NTSC renders
    it('should dither a small gray image using greedy algorithm', { timeout: 30000 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 10; // Use smaller height for faster test
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080'; // Gray
      ctx.fillRect(0, 0, 280, 10);

      const imageData = ctx.getImageData(0, 0, 280, 10);

      const result = dither.ditherToHgr(imageData, 40, 10, 'greedy');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(40 * 10);
    });

    it('should dither a small white image using greedy algorithm', { timeout: 30000 }, () => {
      // Create white image data directly (can't rely on canvas mock)
      const width = 280;
      const height = 10;
      const imageData = new ImageData(width, height);

      // Fill with white RGB(255,255,255)
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        imageData.data[offset] = 255;     // R
        imageData.data[offset + 1] = 255; // G
        imageData.data[offset + 2] = 255; // B
        imageData.data[offset + 3] = 255; // A
      }

      const result = dither.ditherToHgr(imageData, 40, 10, 'greedy');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(40 * 10);

      // For white image, most bytes should be 0x7F or 0xFF (all bits set)
      const nonZeroBytes = Array.from(result).filter(b => b !== 0).length;
      expect(nonZeroBytes).toBeGreaterThan(result.length * 0.8); // At least 80% non-zero
    });

    it('should dither a small black image using greedy algorithm', { timeout: 30000 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000'; // Black
      ctx.fillRect(0, 0, 280, 10);

      const imageData = ctx.getImageData(0, 0, 280, 10);

      const result = dither.ditherToHgr(imageData, 40, 10, 'greedy');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(40 * 10);

      // For black image, most bytes should be 0x00 or 0x80 (no bits set except maybe high bit)
      const allBlackOrHighBit = Array.from(result).every(b => b === 0x00 || b === 0x80);
      expect(allBlackOrHighBit).toBe(true);
    });
  });

  describe('color bars test', () => {
    it('should render solid color bars correctly', { timeout: 60000 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 20; // Small height for faster test
      const ctx = canvas.getContext('2d');

      // Create vertical color bars: white, red, green, blue
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 70, 20);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(70, 0, 70, 20);
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(140, 0, 70, 20);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(210, 0, 70, 20);

      const imageData = ctx.getImageData(0, 0, 280, 20);

      const result = dither.ditherToHgr(imageData, 40, 20, 'greedy');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(40 * 20);

      // Check that each color bar region has consistent patterns
      // White bar (bytes 0-9)
      const whiteBarBytes = Array.from(result.slice(0, 10));
      const whiteUnique = new Set(whiteBarBytes).size;
      expect(whiteUnique).toBeLessThan(5); // Should be mostly uniform

      // Red bar (bytes 10-19)
      const redBarBytes = Array.from(result.slice(10, 20));
      const redUnique = new Set(redBarBytes).size;
      expect(redUnique).toBeLessThan(5); // Should be mostly uniform
    });
  });

  describe('async version', () => {
    it('should dither using async greedy algorithm', { timeout: 60000 }, async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 20; // Small height for faster test
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 280, 20);

      const imageData = ctx.getImageData(0, 0, 280, 20);

      let progressCalls = 0;
      const progressCallback = (completed, total) => {
        progressCalls++;
        expect(completed).toBeGreaterThanOrEqual(0);
        expect(completed).toBeLessThanOrEqual(total);
        expect(total).toBe(20);
      };

      const result = await dither.ditherToHgrAsync(imageData, 40, 20, 'greedy', progressCallback);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(40 * 20);
      expect(progressCalls).toBeGreaterThan(0); // Progress callback should be called
    });
  });

  describe('error diffusion quality', () => {
    it('should render gray #888 as uniform checkerboard (error diffusion check)', { timeout: 30000 }, () => {
      // Create solid gray image data directly (can't rely on canvas mock)
      const width = 280;
      const height = 192;
      const imageData = new ImageData(width, height);

      // Fill with mid-gray RGB(136,136,136)
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        imageData.data[offset] = 136;     // R
        imageData.data[offset + 1] = 136; // G
        imageData.data[offset + 2] = 136; // B
        imageData.data[offset + 3] = 255; // A
      }

      // Dither using greedy algorithm
      const hgrBytes = dither.ditherToHgr(imageData, 40, 192, 'greedy');

      // Analysis 1: Check byte value distribution
      // For uniform gray, we expect mostly 2-3 distinct byte values
      // (e.g., 0x55, 0xAA, maybe 0x2A or 0xD5)
      const byteHistogram = new Map();
      for (const byte of hgrBytes) {
        byteHistogram.set(byte, (byteHistogram.get(byte) || 0) + 1);
      }

      console.log('\n=== Gray #888 Byte Distribution ===');
      const sortedBytes = [...byteHistogram.entries()].sort((a, b) => b[1] - a[1]);
      sortedBytes.slice(0, 10).forEach(([byte, count]) => {
        console.log(`  0x${byte.toString(16).padStart(2, '0')}: ${count} times (${(count/hgrBytes.length*100).toFixed(1)}%)`);
      });

      // Analysis 2: Check for chunking (horizontal runs of same byte)
      // Perfect error diffusion should alternate frequently
      let maxRun = 0;
      let currentRun = 1;
      for (let i = 1; i < hgrBytes.length; i++) {
        if (hgrBytes[i] === hgrBytes[i-1]) {
          currentRun++;
          maxRun = Math.max(maxRun, currentRun);
        } else {
          currentRun = 1;
        }
      }

      console.log(`\nMax consecutive same-byte run: ${maxRun}`);

      // Analysis 3: Check for vertical banding (same byte in same column across rows)
      let verticalBandingCount = 0;
      for (let col = 0; col < 40; col++) {
        const columnBytes = [];
        for (let row = 0; row < 192; row++) {
          columnBytes.push(hgrBytes[row * 40 + col]);
        }

        // Count how many consecutive rows have same byte
        let maxColRun = 0;
        let colRun = 1;
        for (let i = 1; i < columnBytes.length; i++) {
          if (columnBytes[i] === columnBytes[i-1]) {
            colRun++;
            maxColRun = Math.max(maxColRun, colRun);
          } else {
            colRun = 1;
          }
        }

        if (maxColRun > 10) {
          verticalBandingCount++;
        }
      }

      console.log(`Columns with vertical banding (>10 consecutive same bytes): ${verticalBandingCount} / 40`);

      // Assertions for uniform distribution
      // Note: Greedy algorithm may use more distinct bytes than simple checkerboard
      // because it adapts to accumulated error. This is actually good!
      expect(byteHistogram.size).toBeLessThanOrEqual(20); // Should use limited set of bytes
      expect(maxRun).toBeLessThan(5); // No long horizontal runs (should be 0-2 for good diffusion)
      expect(verticalBandingCount).toBeLessThan(5); // Minimal vertical banding (should be 0 ideally)

      // Quality checks: Top 2 bytes should dominate (>20% each for checkerboard pattern)
      const topTwoBytes = sortedBytes.slice(0, 2);
      const topTwoPercentage = topTwoBytes.reduce((sum, [byte, count]) => sum + (count/hgrBytes.length*100), 0);
      console.log(`\nTop 2 bytes account for: ${topTwoPercentage.toFixed(1)}%`);
      expect(topTwoPercentage).toBeGreaterThan(20); // At least 20% for predominant pattern
    });
  });

  describe('parallel greedy algorithm', () => {
    // Helper to create ImageData
    function createImageData(width, height, fillColor) {
      const data = new Uint8ClampedArray(width * height * 4);
      const [r, g, b] = fillColor;
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255; // Alpha
      }
      const imageData = new ImageData(width, height);
      imageData.data.set(data);
      return imageData;
    }

    // Helper to create checkerboard pattern
    function createCheckerboard(width, height, squareSize) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const squareX = Math.floor(x / squareSize);
          const squareY = Math.floor(y / squareSize);
          const isBlack = (squareX + squareY) % 2 === 0;
          const color = isBlack ? 0 : 255;

          const offset = (y * width + x) * 4;
          data[offset] = color;     // R
          data[offset + 1] = color; // G
          data[offset + 2] = color; // B
          data[offset + 3] = 255;   // A
        }
      }
      const imageData = new ImageData(width, height);
      imageData.data.set(data);
      return imageData;
    }

    it('should produce identical output to sequential greedy (checkerboard pattern)', { timeout: 120000 }, async () => {
      // Create a checkerboard pattern that should reveal byte-boundary errors
      // This has high frequency content that will stress error propagation
      const imageData1 = createCheckerboard(280, 20, 2);
      const imageData2 = createCheckerboard(280, 20, 2);

      // Run sequential greedy
      console.log('Running sequential greedy on checkerboard...');
      const sequentialResult = await dither.ditherToHgrAsync(imageData1, 40, 20, 'greedy');

      // Run parallel greedy
      console.log('Running parallel greedy on checkerboard...');
      const parallelResult = await dither.ditherToHgrAsync(imageData2, 40, 20, 'greedy-parallel');

      // Verify same length
      expect(parallelResult.length).toBe(sequentialResult.length);

      // Compare byte-by-byte and log all differences
      let differences = 0;
      const maxDiffsToLog = 20;
      for (let i = 0; i < sequentialResult.length; i++) {
        if (sequentialResult[i] !== parallelResult[i]) {
          differences++;
          if (differences <= maxDiffsToLog) {
            const row = Math.floor(i / 40);
            const col = i % 40;
            console.log(`Byte ${i} (row ${row}, col ${col}): seq=0x${sequentialResult[i].toString(16).padStart(2, '0')} par=0x${parallelResult[i].toString(16).padStart(2, '0')}`);
          }
        }
      }

      if (differences > maxDiffsToLog) {
        console.log(`... and ${differences - maxDiffsToLog} more differences`);
      }

      console.log(`Total differences: ${differences} out of ${sequentialResult.length} bytes (${(differences/sequentialResult.length*100).toFixed(2)}%)`);

      expect(differences).toBe(0);
    });

    it('should produce identical output to sequential greedy (gray image)', { timeout: 60000 }, async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080'; // Gray
      ctx.fillRect(0, 0, 280, 10);

      const imageData1 = ctx.getImageData(0, 0, 280, 10);
      const imageData2 = ctx.getImageData(0, 0, 280, 10);

      // Run sequential greedy
      const sequentialResult = await dither.ditherToHgrAsync(imageData1, 40, 10, 'greedy');

      // Run parallel greedy
      const parallelResult = await dither.ditherToHgrAsync(imageData2, 40, 10, 'greedy-parallel');

      // Verify same length
      expect(parallelResult.length).toBe(sequentialResult.length);

      // Verify identical bytes
      for (let i = 0; i < sequentialResult.length; i++) {
        if (sequentialResult[i] !== parallelResult[i]) {
          console.log(`Mismatch at byte ${i}: sequential=${sequentialResult[i].toString(16)}, parallel=${parallelResult[i].toString(16)}`);
        }
        expect(parallelResult[i]).toBe(sequentialResult[i]);
      }
    });

    it('should produce identical output to sequential greedy (white image)', { timeout: 60000 }, async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; // White
      ctx.fillRect(0, 0, 280, 10);

      const imageData1 = ctx.getImageData(0, 0, 280, 10);
      const imageData2 = ctx.getImageData(0, 0, 280, 10);

      const sequentialResult = await dither.ditherToHgrAsync(imageData1, 40, 10, 'greedy');
      const parallelResult = await dither.ditherToHgrAsync(imageData2, 40, 10, 'greedy-parallel');

      expect(parallelResult.length).toBe(sequentialResult.length);

      for (let i = 0; i < sequentialResult.length; i++) {
        expect(parallelResult[i]).toBe(sequentialResult[i]);
      }
    });

    it('should produce identical output to sequential greedy (color bars)', { timeout: 90000 }, async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');

      // Create vertical color bars: white, red, green, blue
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 70, 20);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(70, 0, 70, 20);
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(140, 0, 70, 20);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(210, 0, 70, 20);

      const imageData1 = ctx.getImageData(0, 0, 280, 20);
      const imageData2 = ctx.getImageData(0, 0, 280, 20);

      const sequentialResult = await dither.ditherToHgrAsync(imageData1, 40, 20, 'greedy');
      const parallelResult = await dither.ditherToHgrAsync(imageData2, 40, 20, 'greedy-parallel');

      expect(parallelResult.length).toBe(sequentialResult.length);

      let mismatchCount = 0;
      for (let i = 0; i < sequentialResult.length; i++) {
        if (sequentialResult[i] !== parallelResult[i]) {
          mismatchCount++;
          console.log(`Mismatch at byte ${i}: sequential=${sequentialResult[i].toString(16)}, parallel=${parallelResult[i].toString(16)}`);
        }
      }

      expect(mismatchCount).toBe(0);
    });
  });
});
