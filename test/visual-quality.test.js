/**
 * Visual Quality Test Framework for HGR Image Import
 *
 * This test suite measures the perceptual quality of HGR image conversion
 * by comparing original images with their HGR-converted and NTSC-rendered outputs.
 *
 * Test-Driven Development (TDD) approach:
 * 1. Tests define the expected behavior of the quality framework
 * 2. Implementation follows to make tests pass
 * 3. Framework provides objective metrics to guide dithering algorithm improvements
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Visual Quality Test Framework', () => {
    let VisualQualityTester;
    let ImageDither;
    let NTSCRenderer;

    beforeAll(async () => {
        // Import modules - setup.js already provides mocks
        const imageDitherModule = await import('../docs/src/lib/image-dither.js');
        const ntscRendererModule = await import('../docs/src/lib/ntsc-renderer.js');
        ImageDither = imageDitherModule.default;
        NTSCRenderer = ntscRendererModule.default;

        // Import quality tester
        const qualityModule = await import('./lib/visual-quality-tester.js');
        VisualQualityTester = qualityModule.default;
    });

    describe('VisualQualityTester Class', () => {
        it('should instantiate with default settings', () => {
            const tester = new VisualQualityTester();
            expect(tester).toBeDefined();
            expect(tester.outputDir).toBe('test-output/visual-quality');
        });

        it('should accept custom output directory', () => {
            const tester = new VisualQualityTester({ outputDir: 'custom/path' });
            expect(tester.outputDir).toBe('custom/path');
        });
    });

    describe('PSNR Calculation', () => {
        it('should calculate PSNR for identical images', () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]); // 2 pixels
            const img2 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);

            const psnr = tester.calculatePSNR(img1, img2, 2, 1);
            expect(psnr).toBe(Infinity); // Perfect match
        });

        it('should calculate PSNR for different images', () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 255, 255, 255]); // White pixel
            const img2 = new Uint8ClampedArray([0, 0, 0, 255]);       // Black pixel

            const psnr = tester.calculatePSNR(img1, img2, 1, 1);
            expect(Number.isFinite(psnr)).toBe(true); // Should return a finite value
            expect(psnr).toBeLessThan(20); // Poor quality for opposite colors
        });

        it('should handle images with minor differences', () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 255, 255, 255]);
            const img2 = new Uint8ClampedArray([250, 250, 250, 255]); // Slightly different

            const psnr = tester.calculatePSNR(img1, img2, 1, 1);
            expect(psnr).toBeGreaterThan(30); // Good quality
        });
    });

    describe('SSIM Calculation', () => {
        it('should calculate SSIM for identical images', () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
            const img2 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);

            const ssim = tester.calculateSSIM(img1, img2, 2, 1);
            expect(ssim).toBe(1.0); // Perfect structural similarity
        });

        it('should calculate SSIM for different images', () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 255, 255, 255]);
            const img2 = new Uint8ClampedArray([0, 0, 0, 255]);

            const ssim = tester.calculateSSIM(img1, img2, 1, 1);
            expect(ssim).toBeGreaterThanOrEqual(0);
            expect(ssim).toBeLessThan(0.5); // Poor structural similarity
        });
    });

    describe('Visual Diff Generation', () => {
        it('should generate difference image highlighting problem areas', async () => {
            const tester = new VisualQualityTester();
            const img1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]); // Red, Green
            const img2 = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]); // Red, Red

            const diffImage = tester.generateDiffImage(img1, img2, 2, 1);
            expect(diffImage).toBeDefined();
            expect(diffImage.data).toBeInstanceOf(Uint8ClampedArray);
            expect(diffImage.width).toBe(2);
            expect(diffImage.height).toBe(1);

            // First pixel should be black (no difference)
            expect(diffImage.data[0]).toBe(0);
            expect(diffImage.data[1]).toBe(0);
            expect(diffImage.data[2]).toBe(0);

            // Second pixel should be colored (difference detected)
            const hasDifference = diffImage.data[4] > 0 || diffImage.data[5] > 0 || diffImage.data[6] > 0;
            expect(hasDifference).toBe(true);
        });

        it('should save difference image to disk', async () => {
            const tester = new VisualQualityTester({ outputDir: 'test-output/visual-quality' });
            const img1 = new Uint8ClampedArray([255, 0, 0, 255]);
            const img2 = new Uint8ClampedArray([0, 255, 0, 255]);

            const diffImage = tester.generateDiffImage(img1, img2, 1, 1);
            const outputPath = await tester.savePNG(diffImage, 'test-diff.png');

            expect(fs.existsSync(outputPath)).toBe(true);
        });
    });

    describe('HGR Conversion Quality Assessment', () => {
        it('should assess quality of HGR conversion with NTSC rendering', async () => {
            const tester = new VisualQualityTester();

            // Create a simple test image (solid red)
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < sourceData.length; i += 4) {
                sourceData[i] = 255;     // R
                sourceData[i + 1] = 0;   // G
                sourceData[i + 2] = 0;   // B
                sourceData[i + 3] = 255; // A
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(sourceImage, 'test-solid-red');

            expect(result).toBeDefined();
            expect(result.psnr).toBeGreaterThan(0);
            expect(result.ssim).toBeGreaterThanOrEqual(0);
            expect(result.ssim).toBeLessThanOrEqual(1);
            expect(result.sourcePath).toContain('test-solid-red-source.png');
            expect(result.convertedPath).toContain('test-solid-red-converted.png');
            expect(result.diffPath).toContain('test-solid-red-diff.png');
        });

        it('should generate comparison images at 280x192 resolution', async () => {
            const tester = new VisualQualityTester();
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4).fill(128);
            for (let i = 3; i < sourceData.length; i += 4) {
                sourceData[i] = 255; // Alpha
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(sourceImage, 'test-resolution');

            expect(result.sourceWidth).toBe(280);
            expect(result.sourceHeight).toBe(192);
            expect(result.convertedWidth).toBe(280);
            expect(result.convertedHeight).toBe(192);
        });
    });

    describe('HTML Report Generation', () => {
        it('should generate HTML report with single test result', async () => {
            const tester = new VisualQualityTester();

            const results = [{
                name: 'test-image',
                psnr: 25.5,
                ssim: 0.85,
                sourcePath: 'test-output/source.png',
                convertedPath: 'test-output/converted.png',
                diffPath: 'test-output/diff.png',
                sourceWidth: 280,
                sourceHeight: 192,
                convertedWidth: 280,
                convertedHeight: 192
            }];

            const reportPath = await tester.generateHTMLReport(results, 'test-report.html');

            expect(fs.existsSync(reportPath)).toBe(true);
            const reportContent = fs.readFileSync(reportPath, 'utf-8');
            expect(reportContent).toContain('Visual Quality Report');
            expect(reportContent).toContain('test-image');
            expect(reportContent).toContain('25.5');
            expect(reportContent).toContain('0.85');
        });

        it('should include visual comparison images in report', async () => {
            const tester = new VisualQualityTester();

            const results = [{
                name: 'comparison-test',
                psnr: 30.0,
                ssim: 0.90,
                sourcePath: 'test-output/source.png',
                convertedPath: 'test-output/converted.png',
                diffPath: 'test-output/diff.png',
                sourceWidth: 280,
                sourceHeight: 192,
                convertedWidth: 280,
                convertedHeight: 192
            }];

            const reportPath = await tester.generateHTMLReport(results, 'test-comparison-report.html');
            const reportContent = fs.readFileSync(reportPath, 'utf-8');

            expect(reportContent).toContain('<img');
            expect(reportContent).toContain('source.png');
            expect(reportContent).toContain('converted.png');
            expect(reportContent).toContain('diff.png');
        });
    });

    describe('Multiple Image Type Testing', () => {
        it('should test photo-style images', async () => {
            const tester = new VisualQualityTester();

            // Create a gradient image to simulate photo
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const value = Math.floor((x / width) * 255);
                    sourceData[i] = value;
                    sourceData[i + 1] = value;
                    sourceData[i + 2] = value;
                    sourceData[i + 3] = 255;
                }
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(sourceImage, 'photo-gradient');

            expect(result.psnr).toBeGreaterThan(0);
            expect(result.category).toBe('photo-gradient');
        });

        it('should test high-contrast images', async () => {
            const tester = new VisualQualityTester();

            // Create checkerboard pattern (high contrast)
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const isBlack = (Math.floor(x / 10) + Math.floor(y / 10)) % 2;
                    const value = isBlack ? 0 : 255;
                    sourceData[i] = value;
                    sourceData[i + 1] = value;
                    sourceData[i + 2] = value;
                    sourceData[i + 3] = 255;
                }
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(sourceImage, 'high-contrast-checkerboard');

            expect(result.psnr).toBeGreaterThan(0);
            expect(result.category).toBe('high-contrast-checkerboard');
        });
    });

    describe('Batch Testing', () => {
        it('should run batch tests on multiple images', async () => {
            const tester = new VisualQualityTester();

            const testImages = [
                { name: 'gradient', type: 'photo' },
                { name: 'solid', type: 'simple' },
                { name: 'checkerboard', type: 'high-contrast' }
            ];

            // Create test images
            const images = testImages.map(({ name, type }) => {
                const width = 280, height = 192;
                const sourceData = new Uint8ClampedArray(width * height * 4);

                if (type === 'photo') {
                    // Gradient
                    for (let i = 0; i < sourceData.length; i += 4) {
                        const value = (i / sourceData.length) * 255;
                        sourceData[i] = value;
                        sourceData[i + 1] = value;
                        sourceData[i + 2] = value;
                        sourceData[i + 3] = 255;
                    }
                } else if (type === 'simple') {
                    // Solid color
                    sourceData.fill(128);
                    for (let i = 3; i < sourceData.length; i += 4) {
                        sourceData[i] = 255;
                    }
                } else {
                    // Checkerboard
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const i = (y * width + x) * 4;
                            const value = ((x + y) % 2) ? 255 : 0;
                            sourceData[i] = value;
                            sourceData[i + 1] = value;
                            sourceData[i + 2] = value;
                            sourceData[i + 3] = 255;
                        }
                    }
                }

                return {
                    name,
                    image: new ImageData(sourceData, width, height)
                };
            });

            const results = await tester.runBatchTests(images);

            expect(results).toHaveLength(3);
            expect(results[0].name).toBe('gradient');
            expect(results[1].name).toBe('solid');
            expect(results[2].name).toBe('checkerboard');

            for (const result of results) {
                expect(result.psnr).toBeGreaterThan(0);
                expect(result.ssim).toBeGreaterThanOrEqual(0);
                expect(result.ssim).toBeLessThanOrEqual(1);
            }
        });

        it('should generate comprehensive batch report', async () => {
            const tester = new VisualQualityTester();

            const images = [{
                name: 'test1',
                image: new ImageData(new Uint8ClampedArray(280 * 192 * 4).fill(128), 280, 192)
            }];

            // Set alpha channel
            for (let i = 3; i < images[0].image.data.length; i += 4) {
                images[0].image.data[i] = 255;
            }

            const results = await tester.runBatchTests(images);
            const reportPath = await tester.generateHTMLReport(results, 'batch-report.html');

            expect(fs.existsSync(reportPath)).toBe(true);
            const reportContent = fs.readFileSync(reportPath, 'utf-8');
            expect(reportContent).toContain('Summary Statistics');
            expect(reportContent).toContain('Average PSNR');
            expect(reportContent).toContain('Average SSIM');
        });
    });
});
