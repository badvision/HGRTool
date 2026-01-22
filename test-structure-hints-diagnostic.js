/**
 * Diagnostic test for structure hints generation.
 * Tests if structure hints are being generated correctly.
 */

import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import ImageDither from "./docs/src/lib/image-dither.js";
import { generateStructureHints } from "./docs/src/lib/structure-hints.js";

async function testStructureHints() {
    console.log("Loading test image...");
    const img = await loadImage("test/fixtures/cat-bill.jpg");

    console.log(`Image size: ${img.width}x${img.height}`);

    // Create canvas at HGR resolution
    const pixelWidth = 280;
    const targetHeight = 192;
    const canvas = createCanvas(pixelWidth, targetHeight);
    const ctx = canvas.getContext("2d");

    // Draw image scaled to HGR resolution
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, pixelWidth, targetHeight);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, pixelWidth, targetHeight);
    const pixels = imageData.data;

    console.log(`\nPixel data dimensions:`);
    console.log(`  Width: ${pixelWidth}`);
    console.log(`  Height: ${targetHeight}`);
    console.log(`  Pixels array length: ${pixels.length}`);
    console.log(`  Expected length: ${pixelWidth * targetHeight * 4} (RGBA)`);
    console.log(`  Match: ${pixels.length === pixelWidth * targetHeight * 4 ? "YES" : "NO"}`);

    // Test structure hints generation
    console.log(`\nGenerating structure hints...`);
    const startTime = Date.now();
    const hints = generateStructureHints(pixels, pixelWidth, targetHeight);
    const elapsed = Date.now() - startTime;

    console.log(`Structure hints generated in ${elapsed}ms`);
    console.log(`  Hints dimensions: ${hints.length} rows`);
    console.log(`  First row length: ${hints[0] ? hints[0].length : "N/A"}`);
    console.log(`  Expected: ${targetHeight} rows x ${pixelWidth} columns`);

    // Sample some hints
    console.log(`\nSample structure hints:`);
    for (let y = 0; y < Math.min(5, targetHeight); y += targetHeight > 10 ? Math.floor(targetHeight / 5) : 1) {
        const row = [];
        for (let x = 0; x < Math.min(10, pixelWidth); x += Math.floor(pixelWidth / 10)) {
            row.push(hints[y][x]);
        }
        console.log(`  Row ${y}: [${row.join(", ")}]`);
    }

    // Count hint types
    const counts = { SMOOTH: 0, TEXTURE: 0, EDGE: 0 };
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < pixelWidth; x++) {
            const hint = hints[y][x];
            if (counts.hasOwnProperty(hint)) {
                counts[hint]++;
            }
        }
    }

    console.log(`\nHint distribution:`);
    const total = pixelWidth * targetHeight;
    console.log(`  SMOOTH: ${counts.SMOOTH} (${(counts.SMOOTH / total * 100).toFixed(1)}%)`);
    console.log(`  TEXTURE: ${counts.TEXTURE} (${(counts.TEXTURE / total * 100).toFixed(1)}%)`);
    console.log(`  EDGE: ${counts.EDGE} (${(counts.EDGE / total * 100).toFixed(1)}%)`);

    // Now test with structure-aware algorithm
    console.log(`\n\nTesting structure-aware dithering...`);
    const ditherer = new ImageDither();

    let lastProgress = 0;
    const progressCallback = (completed, total) => {
        const percent = Math.floor((completed / total) * 100);
        if (percent >= lastProgress + 10) {
            console.log(`  Progress: ${percent}%`);
            lastProgress = percent;
        }
    };

    const ditherStart = Date.now();
    const hgrData = await ditherer.ditherToHgrAsync(
        img,
        40,  // targetWidth in bytes
        192, // targetHeight
        "structure-aware",
        progressCallback
    );
    const ditherElapsed = Date.now() - ditherStart;

    console.log(`\nDithering complete in ${ditherElapsed}ms`);
    console.log(`  HGR data length: ${hgrData.length} bytes`);
    console.log(`  Expected: ${40 * 192} bytes`);
    console.log(`  Match: ${hgrData.length === 40 * 192 ? "YES" : "NO"}`);

    // Check for catastrophic patterns
    console.log(`\nChecking for catastrophic patterns...`);
    let allZeros = 0;
    let allOnes = 0;
    let repeatingBytes = 0;

    for (let i = 0; i < hgrData.length; i++) {
        if (hgrData[i] === 0x00) allZeros++;
        if (hgrData[i] === 0xFF) allOnes++;
        if (i > 0 && hgrData[i] === hgrData[i - 1]) repeatingBytes++;
    }

    console.log(`  All-zero bytes: ${allZeros} (${(allZeros / hgrData.length * 100).toFixed(1)}%)`);
    console.log(`  All-one bytes: ${allOnes} (${(allOnes / hgrData.length * 100).toFixed(1)}%)`);
    console.log(`  Repeating bytes: ${repeatingBytes} (${(repeatingBytes / hgrData.length * 100).toFixed(1)}%)`);

    if (allZeros > hgrData.length * 0.3) {
        console.log(`  WARNING: Too many zero bytes! Possible catastrophic failure.`);
    }
    if (repeatingBytes > hgrData.length * 0.7) {
        console.log(`  WARNING: Too many repeating bytes! Possible banding.`);
    }

    console.log(`\nDiagnostic test complete.`);
}

testStructureHints().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
