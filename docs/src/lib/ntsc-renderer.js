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
 * NTSC color rendering for Apple II graphics.
 *
 * This module provides authentic NTSC composite video simulation, converting
 * Apple II HGR/DHGR graphics to RGB using the YIQ color space as it would have
 * appeared on a real CRT monitor.
 *
 * Based on the implementation from The 8-Bit Bunch's Outlaw Editor.
 */

import Debug from "./debug.js";

//
// NTSC color renderer for Apple II graphics.
//
export default class NTSCRenderer {
    // YIQ color space constants
    static MAX_I = 0.5957;
    static MAX_Q = 0.5226;
    static MAX_Y = 1.0;
    static MIN_Y = 0.0;

    // YIQ values for HGR colors (6 colors + black/white)
    // Based on Apple II NTSC composite video output
    // [Y, I, Q] for each color index [0-7]
    // Indices: 0=black0, 1=purple, 2=green, 3=white0, 4=black1, 5=blue, 6=orange, 7=white1
    static YIQ_VALUES = [
        [0.0, 0.0, 0.0],      // 0: Black (hi-bit 0)
        [0.5, 0.25, 0.5],     // 1: Purple (hi-bit 0, phase 0)
        [0.5, -0.25, -0.5],   // 2: Green (hi-bit 0, phase 180)
        [1.0, 0.0, 0.0],      // 3: White (hi-bit 0)
        [0.0, 0.0, 0.0],      // 4: Black (hi-bit 1)
        [0.5, -0.5, 0.25],    // 5: Blue (hi-bit 1, phase 270)
        [0.5, 0.5, -0.25],    // 6: Orange (hi-bit 1, phase 90)
        [1.0, 0.0, 0.0]       // 7: White (hi-bit 1)
    ];

    // HGR to DHGR bit expansion lookup tables
    static hgrToDhgr = [];
    static hgrToDhgrBW = [];

    // Adjustable NTSC parameters
    hue = 0.0;          // [-180, 180] degrees
    saturation = 1.0;   // [0, 2] multiplier
    brightness = 1.0;   // [0, 2] multiplier
    contrast = 1.0;     // [0, 2] multiplier

    constructor() {
        // Initialize lookup tables if not already done
        if (NTSCRenderer.hgrToDhgr.length === 0) {
            NTSCRenderer.initPalettes();
        }
    }

    /**
     * Doubles a 7-bit byte value by duplicating each bit.
     * Example: 0b1010101 becomes 0b11001100110011
     */
    static byteDoubler(b) {
        const num = ((b & 64) << 6) | ((b & 32) << 5) | ((b & 16) << 4) |
                    ((b & 8) << 3) | ((b & 4) << 2) | ((b & 2) << 1) | (b & 1);
        return num | (num << 1);
    }

    /**
     * Initializes the HGR to DHGR bit expansion lookup tables.
     *
     * CRITICAL FIX: Remove the left-shift that was causing the 2-bit offset bug.
     *
     * Apple II HGR format:
     * - Each byte has 7 data bits + 1 high bit
     * - High bit selects color palette (0=purple/green, 1=blue/orange)
     * - In DHGR, each HGR bit becomes 2 DHGR bits: 0->00, 1->11
     * - High bit should NOT shift the bit pattern, only affect color interpretation
     *
     * The BUG: Original code did `b1 <<= 1` when high bit set, causing a
     * 2-bit shift in the alternating pattern (since each bit is doubled).
     * This created 8 different phase/pattern combinations instead of solid fills.
     *
     * The FIX: Don't shift the doubled bits. Let the color interpretation
     * logic (getColorFromPattern) handle the high bit's effect on color phase.
     */
    static initPalettes() {
        // Initialize HGR to DHGR bit expansion tables
        NTSCRenderer.hgrToDhgr = new Array(512);
        NTSCRenderer.hgrToDhgrBW = new Array(256);

        for (let bb1 = 0; bb1 < 512; bb1++) {
            NTSCRenderer.hgrToDhgr[bb1] = new Array(256);
            if (bb1 < 256) {
                NTSCRenderer.hgrToDhgrBW[bb1] = new Array(256);
            }
        }

        for (let bb1 = 0; bb1 < 512; bb1++) {
            for (let bb2 = 0; bb2 < 256; bb2++) {
                // Extract the 7-bit data and high bit from each byte
                const prevData = bb1 & 0x7F;
                const prevHighBit = (bb1 & 0x80) !== 0;
                const curData = bb2 & 0x7F;
                const curHighBit = (bb2 & 0x80) !== 0;

                // Double each bit: 0b1010101 -> 0b11001100110011 (14 bits)
                const b1 = NTSCRenderer.byteDoubler(prevData);
                const b2 = NTSCRenderer.byteDoubler(curData);

                // Build 28-bit value: [flags][prev bits][cur bits]
                // Bits 0-13: previous byte doubled bits (NO SHIFT - this is the fix!)
                // Bits 14-27: current byte doubled bits (NO SHIFT - this is the fix!)
                // Bit 28: current byte bit 6 (for next byte continuation)
                let value = b1 | (b2 << 14);

                // Handle bit continuation from previous byte to current byte
                // If prev byte's bit 6 is set AND cur byte's bit 0 is set, merge them
                if ((prevData & 0x40) !== 0 && (curData & 0x01) !== 0) {
                    value |= (1 << 14);  // Set bit 14 (start of current byte)
                }

                // Set bit 28 if current byte has bit 6 set (for next byte's use)
                if ((curData & 0x40) !== 0) {
                    value |= 0x10000000;
                }

                NTSCRenderer.hgrToDhgr[bb1][bb2] = value;

                // Black and white table (identical - no high bit handling needed)
                if (bb1 < 256) {
                    NTSCRenderer.hgrToDhgrBW[bb1][bb2] =
                        NTSCRenderer.byteDoubler(bb1) | (NTSCRenderer.byteDoubler(bb2) << 14);
                }
            }
        }
    }

    /**
     * Clamps a value to the specified range.
     */
    static normalize(x, minX, maxX) {
        if (x < minX) return minX;
        if (x > maxX) return maxX;
        return x;
    }

    /**
     * Converts YIQ color space to RGB.
     * @param {number} y - Luminance [0, 1]
     * @param {number} i - In-phase [-0.5957, 0.5957]
     * @param {number} q - Quadrature [-0.5226, 0.5226]
     * @returns {number} RGB color as 0xRRGGBB
     */
    static yiqToRgb(y, i, q) {
        const r = Math.round(NTSCRenderer.normalize(y + 0.956 * i + 0.621 * q, 0, 1) * 255);
        const g = Math.round(NTSCRenderer.normalize(y - 0.272 * i - 0.647 * q, 0, 1) * 255);
        const b = Math.round(NTSCRenderer.normalize(y - 1.105 * i + 1.702 * q, 0, 1) * 255);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Converts YIQ to RGBA8888 format.
     */
    static yiqToRgba(y, i, q) {
        return (NTSCRenderer.yiqToRgb(y, i, q) << 8) | 0xff;
    }

    // Note: Old DHGR palette initialization code removed.
    // HGR rendering now uses direct bit-pattern interpretation
    // with YIQ color values, similar to RGB rendering logic.

    /**
     * Renders an HGR scanline with NTSC color artifacts using DHGR conversion.
     *
     * REVISED ARCHITECTURE (fixes color bars bug):
     * 1. Work directly with HGR bit patterns (280 bits)
     * 2. Each HGR bit produces 2 DHGR output pixels
     * 3. Use 2-bit HGR window (not 4-bit DHGR window) to determine color
     * 4. Output 560 pixels (each HGR bit -> 2 identical DHGR pixels)
     *
     * The KEY INSIGHT: NTSC color comes from alternating HGR bits (01 or 10),
     * not from the DHGR representation. When HGR bits are doubled, a 4-bit
     * DHGR window like "0011" doesn't look alternating, but it represents
     * HGR bits "01" which IS alternating.
     *
     * @param {ImageData} imageData - Target image data (must be 560×192)
     * @param {Uint8Array} rawBytes - HGR screen data
     * @param {number} row - Row number [0, 191]
     * @param {number} rowOffset - Offset into rawBytes for this row
     */
    renderHgrScanline(imageData, rawBytes, row, rowOffset) {
        const rgbaData = imageData.data;
        const width = imageData.width;  // Should be 560 for DHGR NTSC

        // Step 1: Extract HGR bits (280 bits from 40 bytes)
        const hgrBits = new Array(280);
        const hgrHighBits = new Array(280);
        let bitPos = 0;

        for (let byteIdx = 0; byteIdx < 40; byteIdx++) {
            const curByte = rawBytes[rowOffset + byteIdx];
            const highBit = (curByte & 0x80) !== 0;
            const dataBits = curByte & 0x7F;

            // Extract 7 bits from this byte
            for (let bit = 0; bit < 7 && bitPos < 280; bit++) {
                hgrBits[bitPos] = (dataBits >> bit) & 1;
                hgrHighBits[bitPos] = highBit;
                bitPos++;
            }
        }

        // Step 2: Render each DHGR pixel (560 pixels = 280 HGR bits × 2)
        // NTSC blurs color over 4 HGR pixels (~4 color cycles), so we determine
        // color for pairs of HGR pixels and output 4 DHGR pixels with that color
        for (let hgrX = 0; hgrX < 280; hgrX += 2) {
            // Get 4-bit HGR window (2 pairs for better color determination)
            const bit0 = hgrX > 0 ? hgrBits[hgrX - 1] : 0;
            const bit1 = hgrBits[hgrX];
            const bit2 = hgrX + 1 < 280 ? hgrBits[hgrX + 1] : 0;
            const bit3 = hgrX + 2 < 280 ? hgrBits[hgrX + 2] : 0;
            // Use high bit from center of window (bit1 or bit2)
            const highBit = hgrHighBits[hgrX + 1 < 280 ? hgrX + 1 : hgrX];

            // Determine color from 4-bit HGR pattern
            const [y, i, q] = this.getColorFromHgr4BitWindow(bit0, bit1, bit2, bit3, highBit, hgrX);

            // Apply adjustable NTSC parameters
            const [adjY, adjI, adjQ] = this.adjustYiq(y, i, q);

            // Convert YIQ to RGB
            const rgb = NTSCRenderer.yiqToRgb(adjY, adjI, adjQ);

            // Output 4 DHGR pixels for this 2-HGR-pixel pair
            for (let pixelOffset = 0; pixelOffset < 4; pixelOffset++) {
                const dhgrX = hgrX * 2 + pixelOffset;
                if (dhgrX < width) {
                    const pixelIndex = (row * width + dhgrX) * 4;
                    rgbaData[pixelIndex] = (rgb >> 16) & 0xff;      // R
                    rgbaData[pixelIndex + 1] = (rgb >> 8) & 0xff;   // G
                    rgbaData[pixelIndex + 2] = rgb & 0xff;          // B
                    rgbaData[pixelIndex + 3] = 0xff;                // A (fully opaque)
                }
            }
        }
    }

    /**
     * Determines YIQ color from a 4-bit HGR window.
     *
     * This is the KEY FIX for the color bars bug. Instead of looking at individual
     * HGR pixels, we analyze a 4-bit window to detect alternating patterns.
     *
     * NTSC color averaging:
     * - A 4-bit window like "0101" represents 2 complete color cycles
     * - NTSC blurs this into a single perceived color
     * - The high bit selects the color palette
     *
     * @param {number} bit0 - HGR bit at position x-1
     * @param {number} bit1 - HGR bit at position x
     * @param {number} bit2 - HGR bit at position x+1
     * @param {number} bit3 - HGR bit at position x+2
     * @param {boolean} highBit - High bit for this byte
     * @param {number} hgrX - Horizontal position (for phase)
     * @returns {Array<number>} [Y, I, Q] color values
     */
    getColorFromHgr4BitWindow(bit0, bit1, bit2, bit3, highBit, hgrX) {
        // Luminance: average of all 4 bits
        const bitSum = bit0 + bit1 + bit2 + bit3;
        const y = bitSum / 4.0;

        // Detect alternating patterns
        // Perfect alternation: 0101 or 1010
        const pattern = (bit0 << 3) | (bit1 << 2) | (bit2 << 1) | bit3;
        const isAlternating = (pattern === 0b0101 || pattern === 0b1010);

        if (isAlternating) {
            // Pure alternating = full color saturation
            // High bit determines color: 0=purple/green, 1=blue/orange
            // Pattern determines phase: 0101 vs 1010 differ by 180°
            const patternPhase = (pattern === 0b1010) ? 2 : 0;  // 0 or 2
            const highBitPhase = highBit ? 1 : 0;                // 0 or 1
            const totalPhase = (patternPhase + highBitPhase) % 4;

            // Apple II NTSC color phases (empirically determined):
            // totalPhase 0 = purple (hue ~300°)
            // totalPhase 1 = blue (hue ~240°)
            // totalPhase 2 = green (hue ~120°)
            // totalPhase 3 = orange (hue ~30°)
            //
            // Phase offset calculation:
            // For totalPhase=3 to produce orange at 30°:
            // 3 * 90° + offset = 30° → offset = 30° - 270° = -240°
            const hueRadians = (totalPhase * Math.PI / 2) - (4 * Math.PI / 3);  // -240°

            const saturation = 0.5;
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);

            return [y, i, q];
        }

        // Count bit transitions for partial color
        const transitions = ((bit0 !== bit1) ? 1 : 0) +
                          ((bit1 !== bit2) ? 1 : 0) +
                          ((bit2 !== bit3) ? 1 : 0);

        if (transitions >= 2) {
            // Some alternation = some color
            // Use position-based phase for mixed patterns
            const positionPhase = (hgrX % 2) * 2;
            const highBitPhase = highBit ? 1 : 0;
            const totalPhase = (positionPhase + highBitPhase) % 4;
            const hueRadians = totalPhase * Math.PI / 2;

            const saturation = 0.3 * (transitions / 3.0);  // Weaker saturation
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);

            return [y, i, q];
        }

        // No alternation = grayscale
        return [y, 0, 0];
    }

    /**
     * Determines YIQ color from HGR bit pattern (LEGACY METHOD).
     * @deprecated Replaced by getColorFromHgr4BitWindow for color bars fix.
     */
    getColorFromHgrBits(prevBit, curBit, nextBit, highBit, hgrX) {
        // Luminance: average of the 3-bit window
        const y = (prevBit + curBit + nextBit) / 3.0;

        // Check for alternating pattern (color)
        const isPrevDifferent = (prevBit !== curBit);
        const isNextDifferent = (nextBit !== curBit);

        // Strong alternation = strong color
        if (isPrevDifferent && isNextDifferent) {
            // Pure alternating pattern: determine color from high bit and position
            // Position determines base phase: even positions and odd positions differ by 180°
            const positionPhase = (hgrX % 2) * 2;  // 0 or 2 (0° or 180°)
            // High bit adds another 90° shift
            const highBitPhase = highBit ? 1 : 0;  // 0 or 1 (0° or 90°)
            const totalPhase = (positionPhase + highBitPhase) % 4;

            // Apple II NTSC color phases (empirically determined):
            // totalPhase 0 = purple (hue ~300°)
            // totalPhase 1 = blue (hue ~240°)
            // totalPhase 2 = green (hue ~120°)
            // totalPhase 3 = orange (hue ~30°)
            //
            // Phase offset calculation:
            // For totalPhase=3 to produce orange at 30°:
            // 3 * 90° + offset = 30° → offset = 30° - 270° = -240°
            const hueRadians = (totalPhase * Math.PI / 2) - (4 * Math.PI / 3);  // -240°

            // Use strong saturation for pure alternating patterns
            const saturation = 0.5;
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);

            return [y, i, q];
        } else if (isPrevDifferent || isNextDifferent) {
            // Weak alternation = weak color
            const positionPhase = (hgrX % 2) * 2;
            const highBitPhase = highBit ? 1 : 0;
            const totalPhase = (positionPhase + highBitPhase) % 4;
            const hueRadians = totalPhase * Math.PI / 2;

            const saturation = 0.25;  // Weaker saturation
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);

            return [y, i, q];
        }

        // No alternation = grayscale
        return [y, 0, 0];
    }

    /**
     * Extracts a 4-bit window from the DHGR bit stream at the specified position.
     * @param {Array<number>} dhgrBits - DHGR bit stream (560 bits)
     * @param {number} position - Position in bit stream [0, 559]
     * @returns {number} 4-bit pattern [0, 15]
     * @deprecated This method is no longer used after the color bars bug fix.
     */
    get4BitWindow(dhgrBits, position) {
        // Get 4 consecutive bits starting at position
        // Handle edge cases where we go past the end
        const bit0 = position < dhgrBits.length ? dhgrBits[position] : 0;
        const bit1 = position + 1 < dhgrBits.length ? dhgrBits[position + 1] : 0;
        const bit2 = position + 2 < dhgrBits.length ? dhgrBits[position + 2] : 0;
        const bit3 = position + 3 < dhgrBits.length ? dhgrBits[position + 3] : 0;

        return (bit0 << 3) | (bit1 << 2) | (bit2 << 1) | bit3;
    }

    /**
     * Determines YIQ color from 4-bit DHGR pattern and phase.
     * This simulates NTSC color fringing based on the bit pattern.
     *
     * For Apple II NTSC rendering:
     * - All-black (0000) = black
     * - All-white (1111) = white
     * - Alternating patterns create color based on phase:
     *   - Phase 0,2: 0101 = purple, 1010 = green
     *   - Phase 1,3: 0101 = blue, 1010 = orange
     *
     * @param {number} pattern - 4-bit pattern [0, 15]
     * @param {number} phase - Color phase [0, 3] based on horizontal position
     * @returns {Array<number>} [Y, I, Q] color values
     */
    getColorFromPattern(pattern, phase) {
        // Handle solid black and white first
        if (pattern === 0b0000) {
            return [0.0, 0.0, 0.0];  // Black
        }
        if (pattern === 0b1111) {
            return [1.0, 0.0, 0.0];  // White
        }

        // Count set bits for luminance calculation
        const bitCount = (pattern & 0b1000 ? 1 : 0) +
                        (pattern & 0b0100 ? 1 : 0) +
                        (pattern & 0b0010 ? 1 : 0) +
                        (pattern & 0b0001 ? 1 : 0);

        // Base luminance from bit density
        const y = bitCount / 4.0;

        // Detect alternating patterns for color generation
        // 0101 = alternating starting with 0
        // 1010 = alternating starting with 1
        const isAlternating0101 = (pattern === 0b0101);
        const isAlternating1010 = (pattern === 0b1010);

        if (isAlternating0101 || isAlternating1010) {
            // Strong color saturation for pure alternating patterns
            // Color phase depends on both pattern and pixel position
            const patternPhase = isAlternating1010 ? 2 : 0;  // 1010 shifts by 180 degrees
            const totalPhase = (phase + patternPhase) % 4;

            // Apple II NTSC color phases (empirically determined):
            // totalPhase 0 = purple (hue ~300°)
            // totalPhase 1 = blue (hue ~240°)
            // totalPhase 2 = green (hue ~120°)
            // totalPhase 3 = orange (hue ~30°)
            //
            // Phase offset calculation:
            // For totalPhase=3 to produce orange at 30°:
            // 3 * 90° + offset = 30° → offset = 30° - 270° = -240°
            const hueRadians = (totalPhase * Math.PI / 2) - (4 * Math.PI / 3);  // -240°  // 0, 90, 180, 270 degrees

            // Use Apple II color saturation (moderate, not full intensity)
            const saturation = 0.5;
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);

            return [y, i, q];
        }

        // For mixed patterns (not pure alternating), calculate based on bit transitions
        const transitions = ((pattern & 0b1000) !== (pattern & 0b0100) ? 1 : 0) +
                          ((pattern & 0b0100) !== (pattern & 0b0010) ? 1 : 0) +
                          ((pattern & 0b0010) !== (pattern & 0b0001) ? 1 : 0);

        if (transitions >= 2) {
            // Some alternation = some color
            const hueRadians = phase * Math.PI / 2;
            const saturation = 0.3 * (transitions / 3.0);  // Weaker saturation for mixed patterns
            const i = saturation * Math.cos(hueRadians);
            const q = saturation * Math.sin(hueRadians);
            return [y, i, q];
        }

        // Solid runs of bits = grayscale
        return [y, 0, 0];
    }

    /**
     * Applies adjustable NTSC parameters to a YIQ color.
     */
    adjustYiq(y, i, q) {
        // Apply brightness and contrast
        y = (y - 0.5) * this.contrast + 0.5 + (this.brightness - 1.0) * 0.5;

        // Apply saturation
        i *= this.saturation;
        q *= this.saturation;

        // Apply hue rotation (convert hue to radians)
        if (this.hue !== 0) {
            const hueRad = this.hue * Math.PI / 180;
            const cosHue = Math.cos(hueRad);
            const sinHue = Math.sin(hueRad);
            const iNew = i * cosHue - q * sinHue;
            const qNew = i * sinHue + q * cosHue;
            i = iNew;
            q = qNew;
        }

        return [y, i, q];
    }
}
