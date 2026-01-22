import { describe, it, expect, beforeEach } from 'vitest';
import ImageDither from '../docs/src/lib/image-dither.js';

/**
 * Test suite for dithering quality improvements.
 *
 * Goals:
 * - Reduce purple/green artifacts
 * - Improve visual fidelity
 * - Better NTSC color matching
 * - More accurate error diffusion
 */

describe('Dithering Quality Improvements', () => {
  let dither;

  beforeEach(() => {
    dither = new ImageDither();
  });

  describe('Bit-by-bit optimization', () => {
    it('should optimize each bit independently', () => {
      // Create a gradient image to test bit-level optimization
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create horizontal gradient
      const gradient = ctx.createLinearGradient(0, 0, 280, 0);
      gradient.addColorStop(0, 'black');
      gradient.addColorStop(1, 'white');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Result should show smooth gradient transition
      // Check first byte (should be mostly black)
      expect(result[0] & 0x7F).toBeLessThan(0x20);

      // Check middle byte (should be mid-gray pattern)
      const midByte = result[Math.floor(40 * 192 / 2)];
      const bitCount = countBits(midByte & 0x7F);
      expect(bitCount).toBeGreaterThanOrEqual(2);
      expect(bitCount).toBeLessThanOrEqual(5);

      // Check last byte (should be mostly white)
      const lastByte = result[39] & 0x7F;
      expect(countBits(lastByte)).toBeGreaterThan(4);
    });

    it('should use error-window-based evaluation', () => {
      // The implementation should evaluate pixels using a sliding window
      // rather than all 7 pixels at once
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 2;
      const ctx = canvas.getContext('2d');

      // Create a checkerboard pattern
      for (let x = 0; x < 280; x++) {
        ctx.fillStyle = (x % 2 === 0) ? 'black' : 'white';
        ctx.fillRect(x, 0, 1, 2);
      }

      const imageData = ctx.getImageData(0, 0, 280, 2);
      const result = dither.ditherToHgr(imageData, 40, 2, 'hybrid');

      // Checkerboard should produce alternating patterns
      // Most bytes should have alternating bits
      let alternatingCount = 0;
      for (let i = 0; i < 40; i++) {
        if (isAlternating(result[i] & 0x7F)) {
          alternatingCount++;
        }
      }

      // At least 50% should be alternating for a checkerboard
      expect(alternatingCount).toBeGreaterThan(20);
    });
  });

  describe('NTSC color artifact reduction', () => {
    it('should minimize color fringing in grayscale images', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Pure grayscale image should not produce color artifacts
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Count alternating patterns (which produce color artifacts)
      let alternatingCount = 0;
      for (let i = 0; i < result.length; i++) {
        if (isAlternating(result[i] & 0x7F)) {
          alternatingCount++;
        }
      }

      // For pure grayscale, minimize alternating patterns
      // Should be less than 10% of total bytes
      expect(alternatingCount).toBeLessThan(result.length * 0.1);
    });

    it('should use appropriate patterns for different brightness levels', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Test different brightness levels
      const brightnesses = [
        { gray: 0, expectedBits: 0 },
        { gray: 64, expectedBits: 2 },
        { gray: 128, expectedBits: 3.5 },
        { gray: 192, expectedBits: 5 },
        { gray: 255, expectedBits: 7 }
      ];

      for (const { gray, expectedBits } of brightnesses) {
        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        ctx.fillRect(0, 0, 280, 192);

        const imageData = ctx.getImageData(0, 0, 280, 192);
        const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

        // Calculate average bit density
        let totalBits = 0;
        for (let i = 0; i < result.length; i++) {
          totalBits += countBits(result[i] & 0x7F);
        }
        const avgBits = totalBits / result.length;

        // Should be within 1.5 bits of expected
        expect(avgBits).toBeGreaterThan(expectedBits - 1.5);
        expect(avgBits).toBeLessThan(expectedBits + 1.5);
      }
    });
  });

  describe('Error diffusion accuracy', () => {
    it('should propagate error immediately after bit selection', () => {
      // This tests that error propagation happens during byte construction,
      // not after the entire byte is determined
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create an edge (sharp transition)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 140, 192);
      ctx.fillStyle = 'white';
      ctx.fillRect(140, 0, 140, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Check byte at the edge (around x=140 pixels = byte 20)
      const edgeByteIndex = Math.floor(20 + 96 * 40); // Middle row, edge position
      const edgeByte = result[edgeByteIndex];

      // Edge should show transition pattern, not just 0x00 or 0x7F
      expect(edgeByte & 0x7F).toBeGreaterThan(0);
      expect(edgeByte & 0x7F).toBeLessThan(0x7F);
    });

    it('should produce smooth gradients with error diffusion', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Vertical gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 192);
      gradient.addColorStop(0, 'black');
      gradient.addColorStop(1, 'white');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Sample bit density across rows
      const densities = [];
      for (let y = 0; y < 192; y += 16) {
        let rowBits = 0;
        for (let x = 0; x < 40; x++) {
          rowBits += countBits(result[y * 40 + x] & 0x7F);
        }
        densities.push(rowBits / 40);
      }

      // Densities should increase monotonically (or nearly so)
      for (let i = 1; i < densities.length; i++) {
        // Allow some variance but general upward trend
        if (i > 1) {
          expect(densities[i]).toBeGreaterThan(densities[i - 2] - 0.5);
        }
      }
    });
  });

  describe('Pattern selection quality', () => {
    it('should not over-rely on canonical patterns', () => {
      // Test that the algorithm can produce patterns outside
      // the canonical set when needed
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create a complex pattern (random noise)
      const imageData = ctx.createImageData(280, 192);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = Math.random() * 255;
        imageData.data[i] = gray;
        imageData.data[i + 1] = gray;
        imageData.data[i + 2] = gray;
        imageData.data[i + 3] = 255;
      }

      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Count unique byte patterns (excluding hi-bit)
      const uniquePatterns = new Set();
      for (let i = 0; i < result.length; i++) {
        uniquePatterns.add(result[i] & 0x7F);
      }

      // Should have a diverse set of patterns (at least 40 unique)
      expect(uniquePatterns.size).toBeGreaterThan(40);
    });
  });

  describe('Comparison with reference implementation behavior', () => {
    it('should process bytes in pairs like reference', () => {
      // Reference implementation processes 2 bytes at a time
      // This is important for NTSC color continuity
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Just verify it completes without error
      expect(result).toBeDefined();
      expect(result.length).toBe(40 * 192);
    });

    it('should use NTSC-aware color matching', () => {
      // Colors should be matched based on NTSC rendering, not raw bits
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create a purple color (which should NOT appear in grayscale)
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');

      // Should produce non-trivial patterns (not all 0 or all 1)
      let nonTrivialCount = 0;
      for (let i = 0; i < result.length; i++) {
        const pattern = result[i] & 0x7F;
        if (pattern !== 0x00 && pattern !== 0x7F && pattern !== 0x55 && pattern !== 0x2A) {
          nonTrivialCount++;
        }
      }

      expect(nonTrivialCount).toBeGreaterThan(0);
    });
  });

  describe('Performance regression', () => {
    it('should complete in reasonable time for standard HGR image', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create a test pattern
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 280, 192);

      const imageData = ctx.getImageData(0, 0, 280, 192);

      const startTime = Date.now();
      const result = dither.ditherToHgr(imageData, 40, 192, 'hybrid');
      const endTime = Date.now();

      // Should complete in under 5 seconds for 280x192 image
      expect(endTime - startTime).toBeLessThan(5000);
      expect(result).toBeDefined();
    });
  });
});

// Helper functions
function countBits(byte) {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (byte & (1 << i)) count++;
  }
  return count;
}

function isAlternating(byte) {
  // Check if byte has alternating bit pattern
  let alternations = 0;
  for (let i = 0; i < 6; i++) {
    const bit1 = (byte >> i) & 1;
    const bit2 = (byte >> (i + 1)) & 1;
    if (bit1 !== bit2) alternations++;
  }
  return alternations >= 4;
}
