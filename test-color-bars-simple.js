/*
 * Simple color bar test script for visual inspection
 * Generates a single color bar image to test-output/color-bars-viterbi.png
 */

import { PNG } from 'pngjs';
import fs from 'fs';
import { Window } from 'happy-dom';

// Setup DOM environment using happy-dom
const window = new Window();
const document = window.document;

global.window = window;
global.document = document;
global.HTMLImageElement = window.HTMLImageElement;

// Define ImageData class
global.ImageData = class ImageData {
    constructor(widthOrData, height) {
        if (typeof widthOrData === 'number') {
            // new ImageData(width, height)
            this.width = widthOrData;
            this.height = height;
            this.data = new Uint8ClampedArray(widthOrData * height * 4);
        } else {
            // new ImageData(data, width, height)
            this.data = widthOrData;
            this.width = height;
            this.height = arguments[2];
        }
    }
};

// Mock canvas context for image-dither.js
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tagName) => {
    if (tagName === 'canvas') {
        const canvas = originalCreateElement(tagName);
        canvas.getContext = function(contextType) {
            if (contextType === '2d') {
                return {
                    canvas: this,
                    getImageData: (x, y, w, h) => new global.ImageData(w, h),
                    createImageData: (w, h) => new global.ImageData(w, h),
                    putImageData: () => {},
                    drawImage: () => {},
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                };
            }
            return null;
        };
        return canvas;
    }
    return originalCreateElement(tagName);
};

// Dynamic imports for ES modules
const ImageDither = (await import('./docs/src/lib/image-dither.js')).default;
const NTSCRenderer = (await import('./docs/src/lib/ntsc-renderer.js')).default;

// Initialize NTSC palettes
const renderer = new NTSCRenderer();

/**
 * Creates a color bar test pattern.
 * Standard 8-bar pattern: White, Yellow, Cyan, Green, Magenta, Red, Blue, Black
 *
 * @param {number} width - Image width in pixels (280 for HGR)
 * @param {number} height - Image height in pixels (192 for HGR)
 * @returns {ImageData} - Color bar test pattern
 */
function createColorBars(width, height) {
    // Use ImageData constructor from jsdom window
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    // Standard SMPTE color bar colors (RGB)
    const colors = [
        { r: 255, g: 255, b: 255 }, // White
        { r: 255, g: 255, b: 0   }, // Yellow
        { r: 0,   g: 255, b: 255 }, // Cyan
        { r: 0,   g: 255, b: 0   }, // Green
        { r: 255, g: 0,   b: 255 }, // Magenta
        { r: 255, g: 0,   b: 0   }, // Red
        { r: 0,   g: 0,   b: 255 }, // Blue
        { r: 0,   g: 0,   b: 0   }  // Black
    ];

    const barWidth = Math.floor(width / colors.length); // 35 pixels per bar for 280px

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const barIndex = Math.min(Math.floor(x / barWidth), colors.length - 1);
            const color = colors[barIndex];

            const idx = (y * width + x) * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = 255; // Alpha
        }
    }

    return imageData;
}

console.log('Creating color bar test pattern (280x192)...');
const testImage = createColorBars(280, 192);

console.log('Converting to HGR using Viterbi algorithm...');
console.log('This may take 30-60 seconds...');
const dither = new ImageDither();
const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'viterbi');

console.log('Rendering HGR to NTSC output...');
// Render the HGR buffer back to RGB for visualization using proper ImageData
const outputImage = new ImageData(560, 192);

for (let y = 0; y < 192; y++) {
    const rowOffset = y * 40;
    const hgrRow = hgrBuffer.slice(rowOffset, rowOffset + 40);
    renderer.renderHgrScanline(outputImage, hgrRow, 0, y);
}

console.log('Saving output image...');
const png = new PNG({ width: 560, height: 192 });
png.data = Buffer.from(outputImage.data);

const outputPath = '/Users/brobert/Documents/code/hgrtool/test-output/color-bars-viterbi.png';
fs.mkdirSync('/Users/brobert/Documents/code/hgrtool/test-output', { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(png));

console.log(`\nDone! Output saved to: ${outputPath}`);
console.log('Open the file to inspect for:');
console.log('  - Vertical black bars (catastrophic failures)');
console.log('  - Vertical banding within color bars');
console.log('  - Error drift (colors bleeding right)');
console.log('  - Color accuracy (recognizable colors)');
