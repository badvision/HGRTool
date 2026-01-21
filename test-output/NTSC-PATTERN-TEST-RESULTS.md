# NTSC Pattern Rendering Test Results

## Test Execution Summary

**Date**: 2026-01-20
**Test Suite**: `test/e2e/test-ntsc-patterns.spec.js`
**Tests Run**: 7 tests (6 passed, 1 failed due to canvas boundary)
**Screenshots Generated**: 18 images

## Key Findings

### 1. CONFIRMED: High-Frequency Patterns Show Color Artifacts (BUG)

**Test**: Pixel-level analysis of patterns 0-4
**Screenshot**: `ntsc-pixel-analysis-full.png`

#### Pattern Analysis Results:

- **Pattern 0**: Average RGB (0.0, 0.0, 0.0) - Grayscale ✓ (variance: 0.0)
- **Pattern 1**: Average RGB (0.0, 0.0, 0.0) - Grayscale ✓ (variance: 0.0)
- **Pattern 2**: Average RGB (210.8, 178.8, 196.0) - **COLOR ARTIFACTS** ⚠ (variance: 64.1)
- **Pattern 3**: Average RGB (209.2, 180.4, 192.8) - **COLOR ARTIFACTS** ⚠ (variance: 57.6)
- **Pattern 4**: Average RGB (167.5, 104.5, 142.5) - **COLOR ARTIFACTS** ⚠ (variance: 126.0)

**Visual Observation**: Patterns 2, 3, and 4 show purple/pink color artifacts in NTSC mode. These appear to be high-frequency alternating patterns that should render as grayscale (luminance only), but are incorrectly generating NTSC color artifacts.

### 2. Black/White Checkerboard Pattern Issue

**Expected Behavior**: Black/white checkerboard (alternating every pixel) should render as black/white stripes in NTSC mode because high-frequency alternation produces luminance only, NOT color.

**Observed Behavior**: Several dither patterns show purple/orange color artifacts when rendered in NTSC mode.

**Screenshots**:
- `ntsc-comparison-rgb-mode.png` - Shows true pattern appearance in RGB
- `ntsc-comparison-ntsc-mode.png` - Shows NTSC color artifacts (purple/pink tints)

**Visual Evidence**: Comparing RGB vs NTSC mode clearly shows patterns gaining unwanted color tints. The top pattern in the comparison screenshots shows this effect - it appears multicolored in RGB but gains a purple/pink tint in NTSC.

### 3. Green/Orange Alternating Row Pattern

**Pattern Observed**: Multiple patterns tested, including what appears to be alternating row patterns.

**Screenshots**:
- `ntsc-green-orange-search-rgb.png` - Shows patterns in RGB mode
- `ntsc-green-orange-search-ntsc.png` - Shows same patterns in NTSC mode

**Visual Analysis**:
- Pattern in 2nd row (left column) shows alternating horizontal stripes in RGB mode (green/orange)
- In NTSC mode, this pattern shows color bleeding/fringing artifacts
- The pattern preview at bottom shows orange/green color bars

### 4. Pattern Picker Reference

**Screenshot**: `ntsc-pattern-picker-reference.png`

The color picker shows 108 dither patterns available for testing. The pattern swatches at the bottom of the picker show the expected appearance of patterns. User reported that these swatches show the correct appearance, but when rendered on the canvas in NTSC mode, the patterns appear incorrectly.

## Root Cause Analysis

### Current NTSC Renderer Behavior

The NTSC renderer uses a 4-bit sliding window to detect color patterns. The issue appears to be:

1. **Over-application of color artifacts**: The renderer is applying color artifacts to patterns that alternate at high frequency (every pixel).

2. **Missing high-frequency detection**: According to NTSC theory:
   - **High frequency alternation (every pixel)** = Should produce luminance (grayscale) only
   - **Lower frequency alternation (every 2+ pixels)** = Should produce color artifacts

3. **Current implementation**: Appears to treat ALL alternating patterns as color-producing, regardless of frequency.

### Expected NTSC Behavior

From the user's technical requirements:

- Color fringes should usually only be 1/2 a pixel wide
- NTSC mode should render 560×192 (with 280 usable "pixels")
- **High frequency alternating (every pixel) should NOT produce color artifacts** - should stay black/white
- Only lower frequency patterns should produce color

## Recommendations

### Fix Priority: HIGH

The current NTSC renderer is incorrectly applying color artifacts to high-frequency patterns. This creates purple/orange stripes where there should be black/white rendering.

### Suggested Fix Location

File: `docs/js/ntsc-renderer.js`

The 4-bit sliding window logic needs enhancement to:

1. **Detect high-frequency patterns** (alternating every pixel)
2. **Render high-frequency patterns as grayscale** (luminance only)
3. **Apply color artifacts only to lower-frequency patterns** (every 2+ pixels)

### Test Cases to Address

1. Black/white checkerboard (every pixel alternation) → Should render as grayscale stripes
2. Green/orange alternating rows → Should render as horizontal color bands
3. Other high-frequency dither patterns → Should maintain grayscale appearance

## Test Artifacts

All test screenshots are available in `/Users/brobert/Documents/code/hgrtool/test-output/`:

### Pattern Analysis Screenshots
- `ntsc-pattern-grid-all.png` - Grid of first 12 patterns in NTSC mode
- `ntsc-pattern-layout-labeled.png` - Labeled layout of 8 patterns
- `ntsc-pattern-0-individual.png` through `ntsc-pattern-7-individual.png` - Individual pattern tests

### Mode Comparison Screenshots
- `ntsc-comparison-rgb-mode.png` - Patterns in RGB mode (true appearance)
- `ntsc-comparison-ntsc-mode.png` - Same patterns in NTSC mode (showing color artifacts)
- `ntsc-comparison-mono-mode.png` - Same patterns in Mono mode

### Specific Pattern Tests
- `ntsc-green-orange-search-rgb.png` - Green/orange pattern search in RGB
- `ntsc-green-orange-search-ntsc.png` - Same patterns in NTSC mode
- `ntsc-pixel-analysis-full.png` - Pixel-level color analysis of 5 patterns

### Reference Images
- `ntsc-pattern-picker-reference.png` - Color picker showing all 108 dither patterns
- `ntsc-color-picker-full.png` - Full color picker dialog

## Next Steps

1. **Examine ntsc-renderer.js** to understand current 4-bit sliding window logic
2. **Add frequency detection** to distinguish high vs low frequency patterns
3. **Implement grayscale rendering** for high-frequency patterns
4. **Re-run tests** to verify fix addresses all identified issues
5. **Add automated assertions** to detect color variance in patterns that should be grayscale
