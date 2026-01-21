/**
 * Analyze the actual RGB values from reference vs test images
 */

import fs from 'fs';
import { PNG } from 'pngjs';

function loadImage(filename) {
    const pngData = fs.readFileSync(filename);
    const png = PNG.sync.read(pngData);
    return png;
}

function samplePixels(imageData, count = 20) {
    const samples = [];
    const step = Math.floor(imageData.data.length / (4 * count));

    for (let i = 0; i < imageData.data.length; i += step * 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        samples.push(`RGB(${r}, ${g}, ${b})`);
    }

    return samples;
}

console.log('=== GREEN (0x2A) Analysis ===');
const refGreen = loadImage('/Users/brobert/Documents/code/hgrtool/test/reference-images/reference-green-0x2A.png');
const testGreen = loadImage('/Users/brobert/Documents/code/hgrtool/test/test-output/test-green-0x2A.png');

console.log('\nReference (OutlawEditor) samples:');
const refGreenSamples = samplePixels(refGreen);
refGreenSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\nTest (JS) samples:');
const testGreenSamples = samplePixels(testGreen);
testGreenSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\n=== PURPLE (0x55) Analysis ===');
const refPurple = loadImage('/Users/brobert/Documents/code/hgrtool/test/reference-images/reference-purple-0x55.png');
const testPurple = loadImage('/Users/brobert/Documents/code/hgrtool/test/test-output/test-purple-0x55.png');

console.log('\nReference (OutlawEditor) samples:');
const refPurpleSamples = samplePixels(refPurple);
refPurpleSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\nTest (JS) samples:');
const testPurpleSamples = samplePixels(testPurple);
testPurpleSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\n=== BLUE (0xAA) Analysis ===');
const refBlue = loadImage('/Users/brobert/Documents/code/hgrtool/test/reference-images/reference-blue-0xAA.png');
const testBlue = loadImage('/Users/brobert/Documents/code/hgrtool/test/test-output/test-blue-0xAA.png');

console.log('\nReference (OutlawEditor) samples:');
const refBlueSamples = samplePixels(refBlue);
refBlueSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\nTest (JS) samples:');
const testBlueSamples = samplePixels(testBlue);
testBlueSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\n=== ORANGE (0x7F) Analysis (PASSING) ===');
const refOrange = loadImage('/Users/brobert/Documents/code/hgrtool/test/reference-images/reference-orange-0x7F.png');
const testOrange = loadImage('/Users/brobert/Documents/code/hgrtool/test/test-output/test-orange-0x7F.png');

console.log('\nReference (OutlawEditor) samples:');
const refOrangeSamples = samplePixels(refOrange);
refOrangeSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));

console.log('\nTest (JS) samples:');
const testOrangeSamples = samplePixels(testOrange);
testOrangeSamples.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s}`));
