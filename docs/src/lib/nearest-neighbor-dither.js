/*
 * Copyright 2025 faddenSoft
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Nearest-neighbor quantization for HGR with NTSC-aware color matching.
 *
 * This is a non-dithered first pass that selects the best-matching byte
 * for each position based purely on minimizing perceptual color error.
 * No error diffusion, no smoothness penalties - just pure color matching.
 *
 * This can be used standalone or as the first pass of a two-pass refinement.
 */

import NTSCRenderer from './ntsc-renderer.js';

/**
 * Calculates perceptual color distance squared.
 */
function perceptualDistanceSquared(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
}

/**
 * Calculates error for a candidate byte using actual NTSC rendering.
 * Uses full scanline context for accurate phase calculation.
 * Tests both hi-bit contexts for unknown future bytes to pick the most robust candidate.
 */
function calculateByteError(candidateByte, targetColors, byteX, renderer, imageData, hgrBytes, scanlineSoFar) {
    // Test with unknown bytes having hi-bit=0 and hi-bit=1
    const candidatePattern = candidateByte & 0x7F; // Lower 7 bits (pattern)
    const fillBytes = [
        candidatePattern,          // Hi-bit = 0
        candidatePattern | 0x80    // Hi-bit = 1
    ];

    let minError = Infinity;

    for (const fillByte of fillBytes) {
        // Restore all committed bytes for correct NTSC context
        for (let i = 0; i < byteX; i++) {
            hgrBytes[i] = scanlineSoFar[i];
        }

        // Place candidate byte
        hgrBytes[byteX] = candidateByte;

        // Fill remaining bytes with pattern + hi-bit variant
        for (let i = byteX + 1; i < hgrBytes.length; i++) {
            hgrBytes[i] = fillByte;
        }

        // Clear imageData
        for (let i = 0; i < imageData.data.length; i++) {
            imageData.data[i] = 0;
        }

        // Render through NTSC
        renderer.renderHgrScanline(imageData, hgrBytes, 0, 0);

        // Calculate error for the 7 pixels in this byte
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

            totalError += perceptualDistanceSquared(rendered, targetColors[bitPos]);
        }

        minError = Math.min(minError, totalError);
    }

    return minError;
}

/**
 * Finds the best byte by testing all 256 values.
 */
function findBestByte(targetColors, byteX, renderer, imageData, hgrBytes, scanlineSoFar) {
    let bestByte = 0;
    let leastError = Infinity;

    // Test all 256 possible byte values
    for (let byte = 0; byte < 256; byte++) {
        const error = calculateByteError(
            byte,
            targetColors,
            byteX,
            renderer,
            imageData,
            hgrBytes,
            scanlineSoFar
        );

        if (error < leastError) {
            leastError = error;
            bestByte = byte;
        }
    }

    return bestByte;
}

/**
 * Dithers a single scanline using nearest-neighbor quantization.
 * No error diffusion - just picks the best-matching byte for each position.
 */
export function nearestNeighborDitherScanline(pixels, y, targetWidth, pixelWidth, renderer, imageData, hgrBytes) {
    const scanline = new Uint8Array(targetWidth);

    for (let byteX = 0; byteX < targetWidth; byteX++) {
        // Get target colors for this byte (7 pixels)
        const targetColors = [];
        for (let bit = 0; bit < 7; bit++) {
            const pixelX = byteX * 7 + bit;
            const pixelIdx = (y * pixelWidth + pixelX) * 4;

            targetColors.push({
                r: pixels[pixelIdx],
                g: pixels[pixelIdx + 1],
                b: pixels[pixelIdx + 2]
            });
        }

        // Find best byte (no error diffusion)
        const bestByte = findBestByte(
            targetColors,
            byteX,
            renderer,
            imageData,
            hgrBytes,
            scanline
        );

        scanline[byteX] = bestByte;
    }

    return scanline;
}
