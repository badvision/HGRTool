# Viterbi-Byte Algorithm Catastrophic Failure - Root Cause Analysis

## Executive Summary

The viterbi-byte dithering algorithm produces catastrophically broken output (extreme vertical striping, colored noise, near-black rendering of gray input) despite all tests passing. This indicates both algorithmic bugs and inadequate test coverage.

## Bug Severity

**CRITICAL** - Algorithm is completely unusable. Visual output is worse than random noise.

## Root Causes Identified

### 1. Flawed Optimistic Look-Ahead (PRIMARY BUG)

**Location:** `docs/src/lib/viterbi-byte-dither.js`, lines 120-176, function `calculateByteErrorWithColors()`

**The Bug:**
- When testing candidate byte X, the algorithm fills unknown bytes (X+1 to 39) with 0x00 and 0xFF
- It calculates error for both scenarios and picks the minimum (optimistic assumption)
- **This makes certain bytes look artificially good in unrealistic contexts**

**Example:**
- Byte 0xE6 with fill 0x00 gets error=30,245 (looks great!)
- But this assumes ALL remaining bytes will be 0x00 (black)
- When byte X+1 is evaluated, it sees byte X=0xE6 but doesn't see fill=0x00
- The cascading error causes complete algorithm collapse

**Evidence from test output:**
```
Testing byte 0xE6 with optimistic look-ahead:
  With fill 0x00: error=30245  ← Artificially low!
  With fill 0xff: error=43243

Testing FULL scanline with 0xE6 repeated:
  Avg rendered: (140.9, 145.7, 136.6)  ← Actually good gray!
  Total error per pixel: 7153.9        ← But 5x worse than optimistic estimate
```

**Why the optimistic assumption is wrong:**
1. Real next byte is rarely 0x00 or 0xFF
2. Testing only extremes doesn't capture realistic NTSC interactions
3. Byte X picks based on false assumption, byte X+1 sees different reality
4. Error accumulates catastrophically across scanline

### 2. Excessive Smoothness Penalty (SECONDARY BUG)

**Location:** `docs/src/lib/viterbi-byte-dither.js`, line 219

**The Bug:**
```javascript
const smoothnessWeight = 200000 * (1.0 - detailLevel * 0.95);
```

For solid colors (detailLevel=0), this gives a smoothness penalty of 200,000.

**Comparison:**
- Perceptual error for entire byte (7 pixels, black vs gray): ~115,000
- Smoothness penalty for pattern change: 200,000
- **Ratio: 1.7x - penalty dominates color accuracy!**

**Effect:**
- Algorithm strongly prefers keeping same byte pattern even if color is catastrophically wrong
- Combined with flawed look-ahead, this locks in the first bad choice
- Results in alternating 0xE6/0xCC pattern that renders as near-black

**Test evidence:**
```
First scanline bytes: b3 b3 e6 cc e6 cc e6 cc e6 cc e6 cc e6 cc e6 cc e6 cc e6 cc

Rendered output:
  Average RGB: (4.5, 6.5, 5.8)  ← Nearly black!
  Target:      (128, 128, 128)  ← Should be mid-gray
  Error:       (-123.5, -121.5, -122.2)  ← 97% error!
```

### 3. Inadequate Test Coverage

**Location:** All existing viterbi tests

**The Problem:**
- Tests use tiny synthetic patches (solid colors, 7x7 pixels)
- Tests check buffer statistics, not actual visual output
- Tests pass while real images fail catastrophically

**Example of passing test that misses bug:**
```javascript
// This passes but doesn't catch catastrophic failure!
expect(dataBits).toBe(0x7F);  // Checks one byte, not rendering quality
```

**What's missing:**
- Visual quality tests with real images (cat, gradients, textures)
- PSNR/SSIM metrics comparing rendered output to source
- Tests that actually render to pixels and check visual appearance

## Diagnostic Test Results

### Test 1: Solid Gray (128,128,128)

**Input:** 280x10 solid mid-gray image
**Expected:** Grayish rendering with minimal noise
**Actual:** Near-black (4.5, 6.5, 5.8) with bright colored stripes
**Failure mode:** 97% brightness error, extreme vertical striping every 14 pixels

### Test 2: Byte Pattern Analysis

**Expected:** Random or varied byte patterns for solid gray
**Actual:** Highly repetitive 0xE6/0xCC alternating pattern (95% repeat rate at offset 2)
**Conclusion:** Smoothness penalty + flawed look-ahead locked algorithm into bad local minimum

### Test 3: Comparison to Greedy

**Result:** 90.5% byte differences between viterbi and greedy algorithms
**Observation:** Greedy produces better visual results despite being "simpler"
**Conclusion:** Viterbi's optimizations are making it worse, not better

## Recommended Fixes

### Fix 1: Remove or Redesign Optimistic Look-Ahead (PRIORITY 1)

**Option A: Remove look-ahead entirely**
- Fill unknown bytes with repeated pattern of current byte
- Or use previous byte pattern as fill
- This gives realistic NTSC context without false optimism

**Option B: Use wider range of fill scenarios**
- Instead of just 0x00 and 0xFF, test with:
  - Repeated current byte
  - Repeated previous byte
  - Common patterns (0x55, 0xAA)
- Take average or worst-case error instead of minimum

**Option C: Revert to simpler greedy approach**
- Test each byte with just committed bytes (no look-ahead)
- Fill remaining with previous byte
- Rely on error diffusion for global quality

### Fix 2: Reduce Smoothness Penalty (PRIORITY 2)

**Current:**
```javascript
const smoothnessWeight = 200000 * (1.0 - detailLevel * 0.95);
```

**Proposed:**
```javascript
// Reduce penalty by 10x-20x
const smoothnessWeight = 10000 * (1.0 - detailLevel * 0.95);

// Or make it adaptive based on accumulated error
const smoothnessWeight = Math.min(perceptualError * 0.5, 10000);
```

**Rationale:**
- Smoothness should influence choice but not dominate
- Color accuracy must take priority
- Penalty should scale with actual perceptual error

### Fix 3: Add Visual Quality Tests (PRIORITY 1)

**Required tests:**
1. Render actual images (cat, gradients) and measure PSNR/SSIM
2. Test on solid colors with full-size images (280x192)
3. Visual banding measurement (column-to-column variance)
4. Comparison tests: viterbi vs greedy vs reference

**Example test structure:**
```javascript
it('should render solid gray with PSNR > 20 dB', async () => {
    const result = await renderAndMeasure(solidGrayImage, 'viterbi');
    expect(result.psnr).toBeGreaterThan(20);
    expect(result.avgBrightness).toBeCloseTo(128, 30); // Within 30 levels
});
```

## Implementation Priority

1. **IMMEDIATE:** Add visual quality diagnostic tests to prove/disprove fixes
2. **HIGH:** Remove or fix optimistic look-ahead (Fix 1)
3. **HIGH:** Reduce smoothness penalty to sane levels (Fix 2)
4. **MEDIUM:** Add comprehensive visual quality test suite (Fix 3)
5. **LOW:** Consider reverting to greedy if fixes don't help

## Test Commands

Run diagnostic tests:
```bash
npx vitest run test/viterbi-byte-diagnostic.test.js
npx vitest run test/viterbi-byte-lookahead-test.test.js
npx vitest run test/viterbi-byte-no-smoothness.test.js
```

Visual inspection:
```bash
open test-output/viterbi-byte-diagnostic-gray.png
open test-output/viterbi-byte-diagnostic-cat.png
```

## Conclusion

The viterbi-byte algorithm has fundamental design flaws:
1. Optimistic look-ahead creates unrealistic error estimates
2. Excessive smoothness penalty locks in bad choices
3. Tests don't catch visual quality failures

**Recommendation:** Fix look-ahead and penalty, add visual tests. If that doesn't work, consider reverting to greedy algorithm which produces better results.

---

**Created:** 2025-01-21
**Author:** Claude Code (diagnostic analysis)
**Status:** Root cause identified, fixes proposed, awaiting implementation
