# Nearest-Neighbor Dithering Algorithm Implementation

## Overview

Implemented a new "nearest-neighbor" quantization algorithm for HGR image conversion. This algorithm serves as a non-dithered first pass for potential two-pass refinement approaches.

## Algorithm Characteristics

**Key Features:**
- **Non-dithered**: No error diffusion, pure color matching
- **Error-per-pixel basis**: Calculates error for each of the 7 pixels in a byte
- **Exhaustive search**: Tests all 256 byte values per position
- **Full scanline context**: Renders with all previous committed bytes for accurate NTSC phase
- **Hi-bit selection**: Automatically handled by testing all 256 values (includes both hi-bit states)
- **No smoothness penalty**: Pure perceptual color matching

## Implementation Details

### Core Algorithm (`docs/src/lib/nearest-neighbor-dither.js`)

1. **Perceptual Distance Calculation**
   - Uses ITU-R BT.601 luma coefficients: `0.299*R² + 0.587*G² + 0.114*B²`
   - Matches human color perception weighting

2. **NTSC-Aware Error Calculation**
   - Restores all committed bytes for correct phase context
   - Places candidate byte at current position
   - Fills remaining bytes with candidate (realistic assumption)
   - Renders through NTSC simulation
   - Calculates error for 7 pixels in the byte

3. **Exhaustive Byte Search**
   - Tests all 256 possible byte values
   - Selects byte with minimum total error
   - Guarantees finding global optimum for each byte position

4. **Scanline Processing**
   - Processes left-to-right
   - Each byte uses full context of previous bytes
   - No error propagation to neighboring pixels

## Integration

### Modified Files

**`docs/src/lib/image-dither.js`:**
- Added import for `nearestNeighborDitherScanline`
- Added "nearest-neighbor" case in `ditherToHgr()`
- Added "nearest-neighbor" case in `ditherToHgrAsync()`

**Usage:**
```javascript
const dither = new ImageDither();
const hgrData = dither.ditherToHgr(imageData, 40, 192, 'nearest-neighbor');
```

## Performance

**Test Results (280×192 gradient):**
- Duration: ~6.8 seconds
- Operations: 256 tests × 40 bytes × 192 lines = ~1.96M error calculations
- Output: 7,680 bytes (40 × 192)
- Unique bytes: 13 (for gradient test, showing good quantization)

**Expected Behavior:**
- ✓ No vertical stripes (full context evaluation)
- ✓ No dithering patterns (no error diffusion)
- ✓ Pure color matching (best byte for target colors)
- ✓ Deterministic (consistent output for same input)

## Test Coverage

### Unit Tests
**`test/e2e/test-nearest-simple.spec.js`:**
- Basic functionality test
- Validates algorithm execution
- Checks output dimensions
- Verifies deterministic behavior

### Visual Tests
**`docs/test-nearest-neighbor-visual.html`:**
- Horizontal gradient
- Vertical gradient (RGB)
- Solid colors (orange, white)
- Color blocks
- Checkerboard pattern

### Comprehensive Tests
**`test/e2e/test-nearest-neighbor.spec.js`:**
- Algorithm availability check
- Solid color rendering
- Consistency verification (no randomness)
- Vertical stripe detection
- Performance benchmarking

## Use Cases

**Primary Use:**
- Baseline for quality comparison
- First pass for two-pass refinement
- Fast preview rendering

**When to Use:**
- Need deterministic output
- Want pure color matching without artifacts
- Comparing against error-diffusion methods
- First stage of iterative refinement

**When NOT to Use:**
- Need dithering for smooth gradients
- Want perceptual smoothing
- Performance is critical (slower than greedy)

## Comparison with Other Algorithms

| Algorithm | Speed | Quality | Dithering | Context |
|-----------|-------|---------|-----------|---------|
| threshold | Fastest | Lowest | No | None |
| greedy | Fast | Medium | Yes | Limited |
| nearest-neighbor | Medium | Medium | No | Full |
| viterbi | Slowest | Highest | Yes | Global |

## Future Enhancements

**Potential Improvements:**
1. Two-pass refinement (nearest-neighbor + local optimization)
2. Parallel processing per scanline
3. Caching of NTSC render results
4. Adaptive beam width based on image complexity

## Technical Notes

**Why 256 Tests Per Byte?**
- NTSC color generation depends on bit patterns, not individual bits
- Hi-bit affects interpretation of all 7 bits
- Greedy bit-flipping can get stuck in local minima
- Exhaustive search guarantees finding the best match

**Why No Error Diffusion?**
- Intended as pure quantization baseline
- Allows evaluation without dithering artifacts
- Simplifies comparison with other methods
- Can be added as second pass if needed

**Full Context Importance:**
- NTSC phase depends on horizontal position
- Previous bytes affect color interpretation of current byte
- Without full context, produces vertical striping artifacts
- Matches how actual Apple II hardware renders
