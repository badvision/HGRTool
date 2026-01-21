import { describe, it, expect, beforeEach } from 'vitest';
import ImageDither from '../docs/src/lib/image-dither.js';

describe('ImageDither', () => {
  let dither;

  beforeEach(() => {
    dither = new ImageDither();
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(dither).toBeInstanceOf(ImageDither);
    });

    it('should use Floyd-Steinberg by default', () => {
      expect(dither.coefficients).toBe(ImageDither.FLOYD_STEINBERG);
      expect(dither.divisor).toBe(16);
    });
  });

  describe('algorithm selection', () => {
    it('should switch to Floyd-Steinberg', () => {
      dither.setDitherAlgorithm('floyd-steinberg');
      expect(dither.coefficients).toBe(ImageDither.FLOYD_STEINBERG);
      expect(dither.divisor).toBe(16);
    });

    it('should switch to Jarvis-Judice-Ninke', () => {
      dither.setDitherAlgorithm('jarvis-judice-ninke');
      expect(dither.coefficients).toBe(ImageDither.JARVIS_JUDICE_NINKE);
      expect(dither.divisor).toBe(48);
    });

    it('should switch to Atkinson', () => {
      dither.setDitherAlgorithm('atkinson');
      expect(dither.coefficients).toBe(ImageDither.ATKINSON);
      expect(dither.divisor).toBe(8);
    });

    it('should throw on unknown algorithm', () => {
      expect(() => {
        dither.setDitherAlgorithm('unknown');
      }).toThrow();
    });
  });

  describe('dithering coefficients', () => {
    it('should have Floyd-Steinberg coefficients', () => {
      expect(ImageDither.FLOYD_STEINBERG).toEqual([
        [0, 0, 7],
        [3, 5, 1]
      ]);
    });

    it('should have Jarvis-Judice-Ninke coefficients', () => {
      expect(ImageDither.JARVIS_JUDICE_NINKE).toEqual([
        [0, 0, 7, 5],
        [3, 5, 7, 5, 3],
        [1, 3, 5, 3, 1]
      ]);
    });

    it('should have Atkinson coefficients', () => {
      expect(ImageDither.ATKINSON).toEqual([
        [0, 0, 1, 1],
        [1, 1, 1, 0],
        [0, 1, 0, 0]
      ]);
    });
  });

  describe('color distance', () => {
    it('should calculate distance between identical colors as 0', () => {
      const distance = dither.colorDistance([128, 128, 128], [128, 128, 128]);
      expect(distance).toBe(0);
    });

    it('should calculate distance between black and white', () => {
      const distance = dither.colorDistance([0, 0, 0], [255, 255, 255]);
      expect(distance).toBeCloseTo(Math.sqrt(3 * 255 * 255));
    });

    it('should be symmetric', () => {
      const d1 = dither.colorDistance([100, 50, 200], [150, 100, 50]);
      const d2 = dither.colorDistance([150, 100, 50], [100, 50, 200]);
      expect(d1).toBe(d2);
    });
  });

  describe('buffer operations', () => {
    it('should copy buffer correctly', () => {
      const source = [
        [[255, 0, 0], [0, 255, 0]],
        [[0, 0, 255], [128, 128, 128]]
      ];
      const target = [
        [[0, 0, 0], [0, 0, 0]],
        [[0, 0, 0], [0, 0, 0]]
      ];

      dither.copyBuffer(source, target, 0, 2);

      expect(target[0][0]).toEqual([255, 0, 0]);
      expect(target[0][1]).toEqual([0, 255, 0]);
      expect(target[1][0]).toEqual([0, 0, 255]);
      expect(target[1][1]).toEqual([128, 128, 128]);
    });

    it('should handle partial buffer copy', () => {
      const source = [
        [[255, 0, 0], [0, 255, 0]],
        [[0, 0, 255], [128, 128, 128]]
      ];
      const target = [
        [[0, 0, 0], [0, 0, 0]],
        [[0, 0, 0], [0, 0, 0]]
      ];

      dither.copyBuffer(source, target, 0, 1);

      expect(target[0][0]).toEqual([255, 0, 0]);
      expect(target[1][0]).toEqual([0, 0, 0]); // Not copied
    });
  });

  describe('scratch buffer creation', () => {
    it('should create buffer from pixel data', () => {
      const pixels = new Uint8ClampedArray([
        255, 0, 0, 255,    // Red pixel
        0, 255, 0, 255,    // Green pixel
        0, 0, 255, 255     // Blue pixel
      ]);

      const buffer = dither.createScratchBuffer(pixels, 3, 1);

      expect(buffer.length).toBe(1);
      expect(buffer[0].length).toBe(3);
      expect(buffer[0][0]).toEqual([255, 0, 0]);
      expect(buffer[0][1]).toEqual([0, 255, 0]);
      expect(buffer[0][2]).toEqual([0, 0, 255]);
    });
  });
});
