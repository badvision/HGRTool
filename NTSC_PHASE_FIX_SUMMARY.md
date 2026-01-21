# NTSC Phase Fix Summary

## Problem
The NTSC renderer was only showing purple and blue colors (phases 0-1) but never green or orange (phases 2-3). This was causing solid green to render as purple and solid orange to render as blue.

## Root Cause
The phase calculation was using HGR coordinate space (280 pixels) instead of DHGR coordinate space (560 pixels). Additionally, the rendering loop was processing every 2 HGR pixels, which meant the loop variable `hgrX` was always even (0, 2, 4, 6...), resulting in `dhgrX = hgrX * 2` being always divisible by 4, so the phase `(dhgrX + highBit) % 4` could only ever be 0 or 1.

## The Fix

### 1. Fixed Phase Calculation (3 locations)
Changed from HGR-based phase calculation:
```javascript
const positionPhase = (hgrX % 2) * 2;  // Always 0 or 2
const highBitPhase = highBit ? 1 : 0;
const totalPhase = (positionPhase + highBitPhase) % 4;
```

To DHGR-based phase calculation:
```javascript
const dhgrX = hgrX * 2;
const phase = (dhgrX + (highBit ? 1 : 0)) % 4;
```

Applied in:
- `getColorFromHgr4BitWindow()` - alternating pattern case (line ~334)
- `getColorFromHgr4BitWindow()` - partial alternation case (line ~350)
- `getColorFromHgrBits()` - legacy method (lines ~378, ~386)

### 2. Fixed Rendering Loop
Changed from processing every 2 HGR pixels:
```javascript
for (let hgrX = 0; hgrX < 280; hgrX += 2) {  // Only even positions
    // ... process 4 DHGR pixels
}
```

To processing EVERY HGR pixel:
```javascript
for (let hgrX = 0; hgrX < 280; hgrX++) {  // All positions 0-279
    // ... process 2 DHGR pixels
}
```

## Key Insights

1. **Apple II NTSC phase is determined by actual horizontal pixel position on screen**
   - HGR 280 pixels are displayed as 560 DHGR "sub-pixels"
   - Phase cycles every 4 DHGR pixels, NOT 4 HGR pixels

2. **High bit causes a 1-pixel shift in DHGR space**
   - Not a 1-pixel shift in HGR space
   - This is half the amount we were previously calculating

3. **The phase mapping is:**
   - Phase 0: Purple
   - Phase 1: Blue
   - Phase 2: Green
   - Phase 3: Orange

## Verification

Created comprehensive tests that verify:
1. All four colors (purple, blue, green, orange) now render correctly
2. Phase calculation is accurate for all DHGR positions (0-559)
3. Solid color fills show the expected color at the expected phase positions

## Files Modified

- `/Users/brobert/Documents/code/hgrtool/docs/src/lib/ntsc-renderer.js`
  - Lines 250-281: Fixed rendering loop (process each HGR pixel)
  - Lines 330-340: Fixed phase calculation in alternating pattern case
  - Lines 347-357: Fixed phase calculation in partial alternation case
  - Lines 375-392: Fixed phase calculation in legacy method

## Test Files Created

- `/Users/brobert/Documents/code/hgrtool/test/ntsc-phase-fix.test.js` - Comprehensive test for all four colors
- `/Users/brobert/Documents/code/hgrtool/test/ntsc-phase-debug.test.js` - Detailed debug trace showing phase calculations

## Result

✅ All four NTSC colors (purple, blue, green, orange) now render correctly
✅ Phase cycles properly through all 4 values (0, 1, 2, 3)
✅ Solid green (0x55) now shows green instead of purple
✅ Solid orange (0xd5) now shows orange instead of blue
