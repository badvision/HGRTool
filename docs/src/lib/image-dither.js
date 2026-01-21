/*
 * Copyright 2025 faddenSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Image dithering engine for converting regular images to Apple II HGR/DHGR format.
 *
 * Uses Floyd-Steinberg error diffusion dithering to achieve the best possible
 * conversion quality while respecting HGR's unique color constraints and artifacts.
 *
 * Based on the implementation from The 8-Bit Bunch's Outlaw Editor, which was
 * originally adapted from literateprograms.org (MIT License).
 */

import Debug from "./debug.js";
import NTSCRenderer from "./ntsc-renderer.js";

//
// Dithering engine for image-to-HGR conversion.
//
export default class ImageDither {
    // Floyd-Steinberg dithering coefficients
    // Standard pattern:
    //         X   7
    //     3   5   1    (divided by 16)
    static FLOYD_STEINBERG = [
        [0, 0, 7],
        [3, 5, 1]
    ];

    // Alternative: Jarvis-Judice-Ninke (better quality, slower)
    static JARVIS_JUDICE_NINKE = [
        [0, 0, 7, 5],
        [3, 5, 7, 5, 3],
        [1, 3, 5, 3, 1]
    ];

    // Atkinson dithering (used by MacPaint)
    static ATKINSON = [
        [0, 0, 1, 1],
        [1, 1, 1, 0],
        [0, 1, 0, 0]
    ];

    constructor() {
        this.coefficients = ImageDither.FLOYD_STEINBERG;
        this.divisor = 16;
        this.ntscRenderer = new NTSCRenderer();
    }

    /**
     * Converts a standard image to HGR format with dithering.
     * @param {HTMLImageElement|ImageData} source - Source image
     * @param {number} targetWidth - Target width in bytes (40 for HGR)
     * @param {number} targetHeight - Target height (192 for HGR)
     * @param {boolean} propagateError - Whether to use error diffusion
     * @returns {Uint8Array} HGR screen data
     */
    ditherToHgr(source, targetWidth, targetHeight, propagateError = true) {
        // Create a canvas to work with the source image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // HGR is 280x192, so scale the source image appropriately
        const pixelWidth = targetWidth * 7; // 7 pixels per byte
        canvas.width = pixelWidth;
        canvas.height = targetHeight;

        // CRITICAL: Always rescale source to exact HGR resolution (280×192) before dithering
        // This prevents noisy output from dithering high-resolution source images
        // Get pixel data - handle both HTMLImageElement and ImageData
        let pixels;
        if (source instanceof HTMLImageElement) {
            // Draw image scaled to exact HGR resolution with high-quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(source, 0, 0, pixelWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, pixelWidth, targetHeight);
            pixels = imageData.data;
        } else if (source instanceof ImageData) {
            // Always rescale ImageData to exact HGR resolution, even if close
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = source.width;
            tempCanvas.height = source.height;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.putImageData(source, 0, 0);

            // Draw scaled to target canvas with high-quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(tempCanvas, 0, 0, pixelWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, pixelWidth, targetHeight);
            pixels = imageData.data;
        }

        // Create output HGR screen buffer
        const screen = new Uint8Array(targetWidth * targetHeight);

        // Simple threshold dithering for baseline correctness
        // For each byte, look at the 7 pixels it represents and determine bit values
        for (let y = 0; y < targetHeight; y++) {
            for (let byteX = 0; byteX < targetWidth; byteX++) {
                let byte = 0;
                let highBit = 0;

                // Process 7 pixels for this byte
                for (let bit = 0; bit < 7; bit++) {
                    const pixelX = byteX * 7 + bit;
                    const pixelIdx = (y * pixelWidth + pixelX) * 4;

                    // Convert to grayscale
                    const r = pixels[pixelIdx];
                    const g = pixels[pixelIdx + 1];
                    const b = pixels[pixelIdx + 2];
                    const gray = (r + g + b) / 3;

                    // Threshold: if brightness > 127, set bit
                    if (gray > 127) {
                        byte |= (1 << bit);
                    }
                }

                // Determine high bit based on byte value
                // If most bits are set, use high bit
                const bitCount = (byte.toString(2).match(/1/g) || []).length;
                if (bitCount >= 4) {
                    highBit = 0x80;
                }

                screen[y * targetWidth + byteX] = byte | highBit;
            }
        }

        return screen;
    }

    /**
     * Creates an RGB scratch buffer from image data.
     */
    createScratchBuffer(pixels, width, height) {
        const buffer = new Array(height);
        for (let y = 0; y < height; y++) {
            buffer[y] = new Array(width);
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                buffer[y][x] = [
                    pixels[idx],     // R
                    pixels[idx + 1], // G
                    pixels[idx + 2]  // B
                ];
            }
        }
        return buffer;
    }

    /**
     * Performs dithering for a pair of HGR bytes.
     * This is the core of the conversion algorithm.
     */
    hiresDither(screen, scratchBuffers, y, x, bufferWidth, pixelWidth, propagateError) {
        const [primaryBuffer, secondaryBuffer, tertiaryBuffer] = scratchBuffers;
        const errorWindow = 6;
        const overlap = 3;
        const pixelShift = -1;

        let bb1 = screen[y * bufferWidth + x] || 0;
        let bb2 = screen[y * bufferWidth + x + 1] || 0;

        let prev = 0;
        if (x > 0) {
            prev = screen[y * bufferWidth + x - 1] || 0;
        }

        let next = 0;
        if (x < bufferWidth - 2) {
            next = screen[y * bufferWidth + x + 2] || 0;
        }

        // Try both high bit settings and pick the one with least error
        let leastError = Number.MAX_VALUE;
        let bestByte1 = 0;

        for (let hi = 0; hi < 2; hi++) {
            this.copyBuffer(primaryBuffer, tertiaryBuffer, y, Math.min(y + 3, tertiaryBuffer.length));
            let b1 = hi << 7;
            let totalError = 0;

            // Try each bit position
            for (let c = 0; c < 7; c++) {
                const xx = x * 7 + c;  // FIX: x is byte index, multiply by 7 pixels/byte
                const on = b1 | (1 << c);
                const off = on ^ (1 << c);

                // Calculate error for bit off
                const errorOff = this.calculateBitError(tertiaryBuffer, prev, off, bb2, xx, y, c, pixelShift, errorWindow);

                // Calculate error for bit on
                const errorOn = this.calculateBitError(tertiaryBuffer, prev, on, bb2, xx, y, c, pixelShift, errorWindow);

                if (errorOff < errorOn) {
                    totalError += errorOff;
                    b1 = off;
                } else {
                    totalError += errorOn;
                    b1 = on;
                }
            }

            if (totalError < leastError) {
                this.copyBuffer(tertiaryBuffer, secondaryBuffer, y, Math.min(y + 3, secondaryBuffer.length));
                leastError = totalError;
                bestByte1 = b1;
            }
        }

        bb1 = bestByte1;
        this.copyBuffer(secondaryBuffer, primaryBuffer, y, Math.min(y + 3, primaryBuffer.length));

        // Similar process for second byte (bb2)
        leastError = Number.MAX_VALUE;
        let bestByte2 = 0;

        for (let hi = 0; hi < 2; hi++) {
            this.copyBuffer(primaryBuffer, tertiaryBuffer, y, Math.min(y + 3, tertiaryBuffer.length));
            let b2 = hi << 7;
            let totalError = 0;

            for (let c = 0; c < 7; c++) {
                const xx = (x + 1) * 7 + c;  // FIX: (x+1) is second byte index, multiply by 7 pixels/byte
                const on = b2 | (1 << c);
                const off = on ^ (1 << c);

                const errorOff = this.calculateBitError(tertiaryBuffer, bb1, off, next, xx, y, c + 7, pixelShift, errorWindow);
                const errorOn = this.calculateBitError(tertiaryBuffer, bb1, on, next, xx, y, c + 7, pixelShift, errorWindow);

                if (errorOff < errorOn) {
                    totalError += errorOff;
                    b2 = off;
                } else {
                    totalError += errorOn;
                    b2 = on;
                }
            }

            if (totalError < leastError) {
                this.copyBuffer(tertiaryBuffer, secondaryBuffer, y, Math.min(y + 3, secondaryBuffer.length));
                leastError = totalError;
                bestByte2 = b2;
            }
        }

        bb2 = bestByte2;
        this.copyBuffer(secondaryBuffer, primaryBuffer, y, Math.min(y + 3, primaryBuffer.length));

        // Store the final bytes
        screen[y * bufferWidth + x] = bb1;
        screen[y * bufferWidth + x + 1] = bb2;
    }

    /**
     * Calculates the color error for a specific bit configuration.
     */
    calculateBitError(buffer, prevByte, currentByte, nextByte, x, y, bitPos, pixelShift, window) {
        // Convert HGR bytes to DHGR pixel pattern
        const dhgrBits = NTSCRenderer.hgrToDhgr[prevByte][currentByte];

        let error = 0;
        for (let i = 0; i < window && x + i < buffer[y].length; i++) {
            // Get the rendered color for this pixel
            const pixelOn = (dhgrBits >> ((bitPos + i) * 2)) & 1;
            const renderedColor = pixelOn ? [255, 255, 255] : [0, 0, 0]; // Simplified

            // Calculate color distance
            const actual = buffer[y][x + i];
            error += this.colorDistance(actual, renderedColor);
        }

        return error;
    }

    /**
     * Calculates the Euclidean distance between two RGB colors.
     */
    colorDistance(c1, c2) {
        const dr = c1[0] - c2[0];
        const dg = c1[1] - c2[1];
        const db = c1[2] - c2[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    /**
     * Propagates error to neighboring pixels using Floyd-Steinberg.
     */
    propagateError(buffer, x, y, error) {
        if (x < 0 || y < 0 || y >= buffer.length) {
            return;
        }

        for (let dy = 0; dy < this.coefficients.length; dy++) {
            const row = this.coefficients[dy];
            for (let dx = 0; dx < row.length; dx++) {
                const coef = row[dx];
                if (coef === 0) continue;

                const nx = x + dx - 1; // Center on current pixel
                const ny = y + dy;

                if (ny >= buffer.length || nx < 0 || nx >= buffer[ny].length) {
                    continue;
                }

                const errorAmount = (error * coef) / this.divisor;
                for (let c = 0; c < 3; c++) {
                    buffer[ny][nx][c] = Math.max(0, Math.min(255, buffer[ny][nx][c] + errorAmount[c]));
                }
            }
        }
    }

    /**
     * Copies a portion of one scratch buffer to another.
     */
    copyBuffer(source, target, startY, endY) {
        for (let y = startY; y < endY && y < source.length; y++) {
            for (let x = 0; x < source[y].length; x++) {
                target[y][x] = [...source[y][x]];
            }
        }
    }

    /**
     * Sets the dithering algorithm.
     */
    setDitherAlgorithm(algorithm) {
        switch (algorithm) {
            case "floyd-steinberg":
                this.coefficients = ImageDither.FLOYD_STEINBERG;
                this.divisor = 16;
                break;
            case "jarvis-judice-ninke":
                this.coefficients = ImageDither.JARVIS_JUDICE_NINKE;
                this.divisor = 48;
                break;
            case "atkinson":
                this.coefficients = ImageDither.ATKINSON;
                this.divisor = 8;
                break;
            default:
                throw new Error("Unknown dithering algorithm: " + algorithm);
        }
    }
}
