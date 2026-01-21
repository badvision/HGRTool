// Test to see what solid patterns actually contain
import StdHiRes from './docs/src/lib/std-hi-res.js';

console.log('=== Solid Pattern Debug ===\n');

const solidPatterns = StdHiRes.getSolidPatterns();

console.log(`Total solid patterns: ${solidPatterns.length}\n`);

// Check patterns 1, 2, 5, 6 (purple, green, blue, orange used by test)
for (const idx of [1, 2, 5, 6]) {
    const pattern = solidPatterns[idx];
    console.log(`Pattern ${idx} (length ${pattern.length}):`);
    console.log(`  First 8 bytes: ${Array.from(pattern.slice(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);

    // Check if any bytes are non-zero
    const nonZeroCount = Array.from(pattern).filter(b => b !== 0).length;
    console.log(`  Non-zero bytes: ${nonZeroCount}/${pattern.length}\n`);
}
