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
 * Buckels-style HGR dithering, adapted from Bill Buckels' bmp2dhr (b2d.c).
 *
 * The key insight: each HGR byte's high bit (bit 7) is a palette selector that
 * applies to all 7 pixels in the byte. Choosing the wrong palette for a byte
 * produces color artifacts at the byte boundaries that no amount of per-pixel
 * error diffusion can fix — you first need to know WHICH palette to use.
 *
 * Algorithm (3 passes per scanline):
 *
 *   Pass 0 — Green-Violet test:
 *     Dither the entire scanline restricted to hi-bit=0 (0x00-0x7F).
 *     Record the per-byte NTSC error.
 *
 *   Pass 1 — Orange-Blue test:
 *     Dither the entire scanline restricted to hi-bit=1 (0x80-0xFF).
 *     Record the per-byte NTSC error.
 *
 *   Palette selection:
 *     For each byte, pick the palette whose test pass produced lower error.
 *
 *   Pass 2 — Final dither:
 *     Dither the real scanline, restricting each byte to its chosen palette.
 *     Propagate quantization error to future pixels/scanlines normally.
 *
 * The test passes propagate error only rightward within the current row (no
 * downward seeding) so the real error buffer is untouched until the final pass.
 *
 * Reference: bmp2dhr by Bill Buckels — FloydSteinberg() in b2d.c, the
 * "three-run hgr color rigamarole" (runs 0, 1, 2).
 */

/**
 * Performs Buckels-style dithering for a single scanline.
 *
 * @param {Uint8ClampedArray} pixels     - Source pixel data (RGBA, 280×192)
 * @param {Array}             errorBuffer - 2D error buffer [y][x] = [r, g, b]
 * @param {number}            y          - Scanline index (0-191)
 * @param {number}            targetWidth - Bytes per scanline (40)
 * @param {number}            pixelWidth  - Pixels per scanline (280)
 * @param {ImageDither}       imageDither - Shared helper instance
 * @returns {Uint8Array} - 40 HGR bytes for this scanline
 */
export function buckelsDitherScanline(pixels, errorBuffer, y, targetWidth, pixelWidth, imageDither) {

    // -----------------------------------------------------------------------
    // Preliminary pass: quick greedy estimate of each byte (no error diffusion,
    // nextByte=0) so we have approximate nextByte context for all later passes.
    // This lets the NTSC color calculation for the LAST pixel of each byte use
    // a realistic right-side context instead of the zero-byte default, which
    // was the primary cause of byte-boundary (beaded curtain) artifacts.
    // -----------------------------------------------------------------------
    const prelim = new Uint8Array(targetWidth);
    for (let byteX = 0; byteX < targetWidth; byteX++) {
        const prevByte = byteX > 0 ? prelim[byteX - 1] : 0;
        const target = [];
        for (let bit = 0; bit < 7; bit++) {
            const px = byteX * 7 + bit;
            const idx = (y * pixelWidth + px) * 4;
            target.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
        }
        let bestByte = 0, leastError = Infinity;
        for (let b = 0; b < 256; b++) {
            const err = imageDither.calculateNTSCError(prevByte, b, target, byteX);
            if (err < leastError) { leastError = err; bestByte = b; }
        }
        prelim[byteX] = bestByte;
    }

    // Per-byte accumulated NTSC error from each palette test.
    const gvError = new Float32Array(targetWidth);   // green-violet, hi-bit = 0
    const obError = new Float32Array(targetWidth);   // orange-blue,  hi-bit = 1

    // -----------------------------------------------------------------------
    // Test passes 0 (Green-Violet) and 1 (Orange-Blue).
    //
    // Each pass starts from the same error state (what previous scanlines
    // left in errorBuffer[y]), diffuses error only rightward within the row,
    // and records the best-achievable error per byte for that palette.
    // -----------------------------------------------------------------------
    for (let pass = 0; pass < 2; pass++) {
        const hibitStart = pass === 0 ? 0 : 128;   // 0x00–0x7F or 0x80–0xFF
        const hibitEnd   = pass === 0 ? 128 : 256;

        // Copy the current row's accumulated errors from previous scanlines.
        // This is the "starting budget" of error that the test dither must work with.
        const testRow = new Array(pixelWidth);
        const srcRow = errorBuffer[y];
        if (srcRow) {
            for (let px = 0; px < pixelWidth; px++) {
                const e = srcRow[px];
                testRow[px] = e ? [e[0], e[1], e[2]] : [0, 0, 0];
            }
        } else {
            for (let px = 0; px < pixelWidth; px++) {
                testRow[px] = [0, 0, 0];
            }
        }

        const testScanline = new Uint8Array(targetWidth);

        for (let byteX = 0; byteX < targetWidth; byteX++) {
            // Build target colors for this byte, incorporating the test-row error.
            // UNCLAMPED: do not clip to [0,255] here. If accumulated error pushes a
            // target negative (e.g. "we've been too bright"), we carry that debt into
            // the NTSC distance metric rather than erasing it at the clip boundary.
            // This mirrors Buckels' AdjustShortPixel(clip=0) seed behaviour.
            const target = [];
            for (let bit = 0; bit < 7; bit++) {
                const px = byteX * 7 + bit;
                const idx = (y * pixelWidth + px) * 4;
                const e = testRow[px];
                target.push({
                    r: pixels[idx]     + e[0],
                    g: pixels[idx + 1] + e[1],
                    b: pixels[idx + 2] + e[2]
                });
            }

            const prevByte = byteX > 0 ? testScanline[byteX - 1] : 0;
            const nextByte = byteX + 1 < targetWidth ? prelim[byteX + 1] : 0;

            // Find best byte within this palette (128 candidates).
            let bestByte = hibitStart;
            let leastError = Infinity;
            for (let b = hibitStart; b < hibitEnd; b++) {
                const err = imageDither.calculateNTSCError(prevByte, b, target, byteX, nextByte);
                if (err < leastError) {
                    leastError = err;
                    bestByte = b;
                }
            }
            testScanline[byteX] = bestByte;

            // Record this byte's NTSC error for palette selection later.
            if (pass === 0) {
                gvError[byteX] = leastError;
            } else {
                obError[byteX] = leastError;
            }

            // Propagate error rightward only (no downward seeding in test passes).
            // Skip at byte boundaries — NTSC sliding window already handles color
            // bleed between bytes (consistent with propagateErrorToBuffer).
            const rendered = imageDither.renderNTSCColors(prevByte, bestByte, byteX, nextByte);
            for (let bit = 0; bit < 7; bit++) {
                const px = byteX * 7 + bit;
                const isByteEnd = (bit === 6);
                if (isByteEnd || px + 1 >= pixelWidth) continue;

                const eR = target[bit].r - rendered[bit].r;
                const eG = target[bit].g - rendered[bit].g;
                const eB = target[bit].b - rendered[bit].b;
                const next = testRow[px + 1];
                next[0] += eR * (7 / 16);
                next[1] += eG * (7 / 16);
                next[2] += eB * (7 / 16);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Palette selection: for each byte, use whichever palette produced
    // lower total error in the test passes.
    //   0 → Green-Violet (hi-bit = 0, bytes 0x00–0x7F)
    //   1 → Orange-Blue  (hi-bit = 1, bytes 0x80–0xFF)
    // -----------------------------------------------------------------------
    const paletteChoice = new Uint8Array(targetWidth);
    for (let byteX = 0; byteX < targetWidth; byteX++) {
        paletteChoice[byteX] = gvError[byteX] <= obError[byteX] ? 0 : 1;
    }

    // -----------------------------------------------------------------------
    // Final pass: dither for real, restricted to the chosen palette per byte.
    // Error is propagated into the real errorBuffer (right + down).
    // -----------------------------------------------------------------------
    const scanline = new Uint8Array(targetWidth);

    for (let byteX = 0; byteX < targetWidth; byteX++) {
        // Build unclamped target — same as getTargetWithError but without the
        // Math.max/Math.min clip so that out-of-range accumulated debt is preserved.
        const target = [];
        const srcRow = errorBuffer[y];
        for (let bit = 0; bit < 7; bit++) {
            const pixelX = byteX * 7 + bit;
            const idx = (y * pixelWidth + pixelX) * 4;
            const err = srcRow && srcRow[pixelX];
            target.push(err ? {
                r: pixels[idx]     + err[0],
                g: pixels[idx + 1] + err[1],
                b: pixels[idx + 2] + err[2]
            } : {
                r: pixels[idx],
                g: pixels[idx + 1],
                b: pixels[idx + 2]
            });
        }

        const prevByte = byteX > 0 ? scanline[byteX - 1] : 0;
        const nextByte = byteX + 1 < targetWidth ? prelim[byteX + 1] : 0;

        const hibitStart = paletteChoice[byteX] === 0 ? 0   : 128;
        const hibitEnd   = paletteChoice[byteX] === 0 ? 128 : 256;

        let bestByte = hibitStart;
        let leastError = Infinity;
        for (let b = hibitStart; b < hibitEnd; b++) {
            const err = imageDither.calculateNTSCError(prevByte, b, target, byteX, nextByte);
            if (err < leastError) {
                leastError = err;
                bestByte = b;
            }
        }
        scanline[byteX] = bestByte;

        const rendered = imageDither.renderNTSCColors(prevByte, bestByte, byteX, nextByte);
        imageDither.propagateErrorToBuffer(errorBuffer, byteX, y, target, rendered, pixelWidth);
    }

    return scanline;
}
