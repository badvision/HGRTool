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
 * Hybrid Viterbi-per-byte dithering with byte-level error diffusion.
 *
 * This algorithm addresses the sliding window artifact issue where the last two bits
 * of every byte affect the rendering of the next byte through HGR's NTSC color system.
 *
 * Key insight: "It's the last two bits of every byte. When we turn a bit on, it
 * actually affects the bit to the left (sliding window) and we're not factoring that in."
 *
 * Algorithm combines:
 * - Viterbi algorithm for optimal byte selection (handles NTSC sliding window naturally)
 * - Byte-level error diffusion for global quality (distributes aggregate error)
 *
 * Unlike full-scanline Viterbi (which tests byte sequences) or greedy byte-by-byte
 * (which doesn't account for bidirectional bit effects), this approach:
 * 1. For each byte position (left-to-right, top-to-bottom)
 * 2. Use Viterbi to find best byte considering previous byte context
 * 3. Calculate aggregate error for all 7 pixels in byte
 * 4. Distribute error to 3 neighbors: right, down, down-right
 *
 * This naturally handles the sliding window because Viterbi tests all 256 byte values
 * with the previous byte's context, automatically accounting for how the last bits
 * of the previous byte affect the current byte's rendering.
 */

import NTSCRenderer from './ntsc-renderer.js';

/**
 * Calculates perceptual color distance squared.
 * Uses weighted RGB based on human color perception (ITU-R BT.601).
 * @param {{r: number, g: number, b: number}} c1 - First color
 * @param {{r: number, g: number, b: number}} c2 - Second color
 * @returns {number} - Perceptual distance squared
 */
function perceptualDistanceSquared(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
}

/**
 * Extracts target colors with accumulated error for a byte position.
 * @param {Uint8ClampedArray} pixels - Source pixel data
 * @param {Array} errorBuffer - Error accumulation buffer (flat array indexed by y*width+x)
 * @param {number} byteX - Byte X position (0-39)
 * @param {number} y - Y position (0-191)
 * @param {number} pixelWidth - Width in pixels (280)
 * @returns {Array<{r: number, g: number, b: number}>} - Target colors for 7 pixels
 */
function getTargetWithError(pixels, errorBuffer, byteX, y, pixelWidth) {
    const targetColors = [];

    for (let bit = 0; bit < 7; bit++) {
        const pixelX = byteX * 7 + bit;
        const pixelIdx = (y * pixelWidth + pixelX) * 4;

        // Get base color from source
        let r = pixels[pixelIdx];
        let g = pixels[pixelIdx + 1];
        let b = pixels[pixelIdx + 2];

        // Add accumulated error if buffer exists
        const errorIdx = y * pixelWidth + pixelX;
        if (errorBuffer && errorBuffer[errorIdx]) {
            const err = errorBuffer[errorIdx];
            r = Math.max(0, Math.min(255, r + err.r));
            g = Math.max(0, Math.min(255, g + err.g));
            b = Math.max(0, Math.min(255, b + err.b));
        }

        targetColors.push({ r, g, b });
    }

    return targetColors;
}

/**
 * Calculates error for a candidate byte using realistic self-repeating fill.
 *
 * CRITICAL INSIGHT: When testing a candidate byte at position X, we render it with
 * context from bytes 0 to X-1. But NTSC sliding window means this byte affects
 * byte X+1's rendering AND byte X+1 affects this byte's rendering (bidirectional
 * dependency). We don't know what byte X+1 will be yet, so we use a REALISTIC
 * assumption: fill unknown bytes with the candidate byte itself (self-repeating).
 *
 * This is more realistic than 0x00/0xFF extremes because:
 * - Solid color regions tend to have similar/repeated byte patterns
 * - Self-repeating fill gives us a reasonable error estimate
 * - Avoids the overly optimistic bias of min(0x00, 0xFF) scenarios
 *
 * @param {number} prevByte - Previous byte in scanline (or 0 if first)
 * @param {number} candidateByte - Byte value to test (0-255)
 * @param {Array<{r: number, g: number, b: number}>} targetColors - Target colors for 7 pixels
 * @param {number} byteX - Byte X position (0-39)
 * @param {NTSCRenderer} renderer - NTSC renderer instance
 * @param {ImageData} imageData - Reusable ImageData buffer (560x1)
 * @param {Uint8Array} hgrBytes - Reusable HGR byte buffer (40 bytes)
 * @param {Uint8Array} scanlineSoFar - Scanline being built with committed bytes
 * @returns {{totalError: number, renderedColors: Array<{r,g,b}>}} - Total error and rendered colors
 */
function calculateByteErrorWithColors(prevByte, candidateByte, targetColors, byteX, renderer, imageData, hgrBytes, scanlineSoFar) {
    // Restore committed bytes (0 to byteX-1) for correct NTSC context
    for (let i = 0; i < byteX; i++) {
        hgrBytes[i] = scanlineSoFar[i];
    }

    // Place candidate byte
    hgrBytes[byteX] = candidateByte;

    // Fill unknown bytes (byteX+1 to 39) with CANDIDATE BYTE (realistic assumption)
    // This is more realistic than 0x00/0xFF extremes because solid regions tend
    // to have similar bytes, and this gives us a reasonable error estimate.
    for (let i = byteX + 1; i < hgrBytes.length; i++) {
        hgrBytes[i] = candidateByte;
    }

    // Clear imageData
    for (let i = 0; i < imageData.data.length; i++) {
        imageData.data[i] = 0;
    }

    // Render through NTSC
    renderer.renderHgrScanline(imageData, hgrBytes, 0, 0);

    // Calculate error for pixels in this byte
    const renderedColors = [];
    let totalError = 0;

    for (let bitPos = 0; bitPos < 7; bitPos++) {
        const pixelX = byteX * 7 + bitPos;
        const ntscX = pixelX * 2;
        const idx = ntscX * 4;

        const rendered = {
            r: imageData.data[idx],
            g: imageData.data[idx + 1],
            b: imageData.data[idx + 2]
        };

        renderedColors.push(rendered);
        totalError += perceptualDistanceSquared(rendered, targetColors[bitPos]);
    }

    return { totalError, renderedColors };
}

/**
 * Finds the best byte using Viterbi-style exhaustive search with smoothness penalty.
 * Tests all 256 possible byte values considering the full scanline context.
 * Returns both the best byte and its rendered colors for error diffusion.
 *
 * SMOOTHNESS PENALTY: To prevent vertical stripes in solid color areas, we add a
 * penalty for changing the byte pattern (lower 7 bits). This encourages pattern
 * consistency while still allowing changes when needed for detail or color accuracy.
 * The penalty is adaptive: stronger for uniform areas, weaker for detailed areas.
 *
 * @param {number} prevByte - Previous byte in scanline (or 0 if first)
 * @param {Array<{r: number, g: number, b: number}>} targetColors - Target colors for 7 pixels
 * @param {number} byteX - Byte X position (0-39)
 * @param {NTSCRenderer} renderer - NTSC renderer instance
 * @param {ImageData} imageData - Reusable ImageData buffer (560x1)
 * @param {Uint8Array} hgrBytes - Reusable HGR byte buffer (40 bytes)
 * @param {Uint8Array} scanlineSoFar - Scanline being built with committed bytes
 * @returns {{byte: number, renderedColors: Array<{r,g,b}>}} - Best byte and its rendered colors
 */
function findBestByteViterbi(prevByte, targetColors, byteX, renderer, imageData, hgrBytes, scanlineSoFar) {
    let bestByte = 0;
    let leastError = Infinity;
    let bestRenderedColors = null;

    // Calculate target uniformity to adapt smoothness penalty
    // High uniformity (low variance) means solid color area → strong smoothness penalty
    // Low uniformity (high variance) means detailed area → weak smoothness penalty
    let maxDiff = 0;
    for (let i = 0; i < targetColors.length - 1; i++) {
        const diff = Math.abs(targetColors[i].r - targetColors[i + 1].r) +
                     Math.abs(targetColors[i].g - targetColors[i + 1].g) +
                     Math.abs(targetColors[i].b - targetColors[i + 1].b);
        maxDiff = Math.max(maxDiff, diff);
    }
    // Normalize to 0-1 range (0 = solid color, 1 = max contrast)
    const detailLevel = Math.min(maxDiff / (3 * 255), 1.0);

    // Smoothness penalty weight: strong for solid areas, weak for detailed areas
    // Typical perceptual color error is 0-65025 (255^2 * 3 channels with weights)
    // Base penalty of 20,000 is ~16% of typical byte error (enough to encourage
    // consistency without forcing catastrophically wrong choices)
    // For solid colors: We want pattern change to be moderately expensive (~20000)
    // For detailed areas: We want pattern change to be cheap (~1000)
    const smoothnessWeight = 20000 * (1.0 - detailLevel * 0.95);

    // Exhaustive search: test all 256 possible bytes
    // This is the key to handling the sliding window correctly - by testing
    // all bytes with the full scanline context, we naturally account for
    // how all previous bytes affect the rendering of this byte through NTSC phase.
    for (let byte = 0; byte < 256; byte++) {
        const { totalError, renderedColors } = calculateByteErrorWithColors(
            prevByte,
            byte,
            targetColors,
            byteX,
            renderer,
            imageData,
            hgrBytes,
            scanlineSoFar
        );

        // Apply smoothness penalty if byte pattern changes (only after first byte)
        let finalError = totalError;
        if (byteX > 0) {
            const prevPattern = prevByte & 0x7F;
            const currPattern = byte & 0x7F;
            if (prevPattern !== currPattern) {
                finalError += smoothnessWeight;
            }
        }

        if (finalError < leastError) {
            leastError = finalError;
            bestByte = byte;
            bestRenderedColors = renderedColors;
        }
    }

    return { byte: bestByte, renderedColors: bestRenderedColors };
}

/**
 * Distributes aggregate byte error to neighboring bytes using byte-level error diffusion.
 *
 * Unlike pixel-level Floyd-Steinberg which distributes error from each pixel to its
 * 4 neighbors, this distributes the TOTAL ERROR from all 7 pixels in a byte to
 * 3 strategic locations:
 *
 * - Right (7/16): First pixel of next byte in same scanline
 *   (handles horizontal color continuity at byte boundaries)
 *
 * - Down (7/16): Same byte column in next scanline, distributed across all 7 pixels
 *   (handles vertical color continuity)
 *
 * - Down-right (2/16): First pixel of next byte in next scanline
 *   (handles diagonal continuity)
 *
 * This approach is critical because:
 * 1. NTSC rendering already handles color bleed within a byte (sliding window)
 * 2. We only need to diffuse error at byte boundaries where the sliding window breaks
 * 3. Byte-level diffusion prevents double-counting NTSC artifacts
 *
 * @param {Array} errorBuffer - Error buffer (flat array indexed by y*width+x)
 * @param {number} byteX - Byte X position (0-39)
 * @param {number} y - Y position (0-191)
 * @param {Array<{r: number, g: number, b: number}>} targetColors - Target colors for 7 pixels
 * @param {Array<{r: number, g: number, b: number}>} renderedColors - Rendered colors for 7 pixels
 * @param {number} pixelWidth - Width in pixels (280)
 * @param {number} height - Height in pixels (192)
 */
function distributeByteError(errorBuffer, byteX, y, targetColors, renderedColors, pixelWidth, height) {
    // Calculate aggregate error for this entire byte (sum of all 7 pixel errors)
    const totalError = { r: 0, g: 0, b: 0 };

    for (let bit = 0; bit < 7; bit++) {
        totalError.r += targetColors[bit].r - renderedColors[bit].r;
        totalError.g += targetColors[bit].g - renderedColors[bit].g;
        totalError.b += targetColors[bit].b - renderedColors[bit].b;
    }

    // Distribute to 3 neighbors (weights sum to 1.0, similar to Floyd-Steinberg):
    // - Right: 7/16 to first pixel of next byte
    // - Down: 7/16 spread across same byte column, next scanline
    // - Down-right: 2/16 to first pixel of next byte, next scanline
    const distributions = [
        { dx: 7, dy: 0, weight: 7/16, spread: false },     // Right (next byte first pixel)
        { dx: 0, dy: 1, weight: 7/16, spread: true },      // Down (spread across byte)
        { dx: 7, dy: 1, weight: 2/16, spread: false }      // Down-right (next byte first pixel)
    ];

    for (const { dx, dy, weight, spread } of distributions) {
        if (spread) {
            // Spread error across all 7 pixels of the target byte
            for (let bit = 0; bit < 7; bit++) {
                const targetPixelX = byteX * 7 + bit;
                const targetY = y + dy;

                if (targetY >= 0 && targetY < height && targetPixelX >= 0 && targetPixelX < pixelWidth) {
                    const idx = targetY * pixelWidth + targetPixelX;
                    if (!errorBuffer[idx]) {
                        errorBuffer[idx] = { r: 0, g: 0, b: 0 };
                    }

                    // Divide weight by 7 since we're spreading across 7 pixels
                    const spreadWeight = weight / 7;

                    // Clamp on write to prevent overflow
                    errorBuffer[idx].r = Math.max(-255, Math.min(255, errorBuffer[idx].r + totalError.r * spreadWeight));
                    errorBuffer[idx].g = Math.max(-255, Math.min(255, errorBuffer[idx].g + totalError.g * spreadWeight));
                    errorBuffer[idx].b = Math.max(-255, Math.min(255, errorBuffer[idx].b + totalError.b * spreadWeight));
                }
            }
        } else {
            // Concentrate error on a single pixel
            const targetPixelX = byteX * 7 + dx;
            const targetY = y + dy;

            if (targetY >= 0 && targetY < height && targetPixelX >= 0 && targetPixelX < pixelWidth) {
                const idx = targetY * pixelWidth + targetPixelX;
                if (!errorBuffer[idx]) {
                    errorBuffer[idx] = { r: 0, g: 0, b: 0 };
                }

                // Clamp on write
                errorBuffer[idx].r = Math.max(-255, Math.min(255, errorBuffer[idx].r + totalError.r * weight));
                errorBuffer[idx].g = Math.max(-255, Math.min(255, errorBuffer[idx].g + totalError.g * weight));
                errorBuffer[idx].b = Math.max(-255, Math.min(255, errorBuffer[idx].b + totalError.b * weight));
            }
        }
    }
}

/**
 * Dithers a single scanline using hybrid Viterbi-per-byte with byte-level error diffusion.
 *
 * This is the main entry point for the hybrid algorithm. For each byte position:
 * 1. Extract target colors with accumulated error
 * 2. Use Viterbi to find best byte (exhaustive search with NTSC rendering)
 * 3. Calculate aggregate error for the byte
 * 4. Distribute error to 3 neighbors (right, down, down-right)
 *
 * @param {Uint8ClampedArray} pixels - Source pixel data
 * @param {Array} errorBuffer - Error buffer (flat array)
 * @param {number} y - Y position (0-191)
 * @param {number} targetWidth - Width in bytes (40)
 * @param {number} pixelWidth - Width in pixels (280)
 * @param {number} height - Height in pixels (192)
 * @param {NTSCRenderer} renderer - Reusable NTSC renderer
 * @param {ImageData} imageData - Reusable ImageData buffer (560x1)
 * @param {Uint8Array} hgrBytes - Reusable HGR byte buffer (40 bytes)
 * @returns {Uint8Array} - Scanline data (40 bytes)
 */
export function viterbiByteDither(pixels, errorBuffer, y, targetWidth, pixelWidth, height, renderer, imageData, hgrBytes) {
    const scanline = new Uint8Array(targetWidth);

    for (let byteX = 0; byteX < targetWidth; byteX++) {
        // Get target colors with accumulated error
        const targetColors = getTargetWithError(pixels, errorBuffer, byteX, y, pixelWidth);

        // Find best byte using Viterbi (exhaustive search with full scanline context)
        const prevByte = byteX > 0 ? scanline[byteX - 1] : 0;
        const { byte: bestByte, renderedColors } = findBestByteViterbi(
            prevByte,
            targetColors,
            byteX,
            renderer,
            imageData,
            hgrBytes,
            scanline
        );

        // Commit best byte
        scanline[byteX] = bestByte;

        // Distribute aggregate byte error to neighbors
        distributeByteError(
            errorBuffer,
            byteX,
            y,
            targetColors,
            renderedColors,
            pixelWidth,
            height
        );
    }

    return scanline;
}
