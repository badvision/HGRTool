# E2E Testing Quick Start Guide

## Overview

Comprehensive Playwright end-to-end tests have been created for HGRTool to verify drawing and rendering behavior across all three render modes (RGB, NTSC, Mono).

## Quick Start (3 Steps)

### 1. Install Playwright Browsers
```bash
npm run playwright:install
```

### 2. Run All Tests
```bash
npm run test:e2e
```

### 3. View Results
```bash
# Check screenshots
ls -lh test-output/*.png

# View HTML report
npx playwright show-report
```

That's it! Tests will automatically:
- Start the dev server on port 8080
- Run all test suites
- Generate screenshots
- Create HTML report

## What Gets Tested

### Test 0: Sanity Checks
- Application loads successfully
- Can create new blank image
- Can open color picker
- Can select tools
- Can open settings dialog

### Test 1: Rectangle Drawing Width
- Verifies rectangles are drawn with correct dimensions
- Tests in RGB, NTSC, and Mono modes
- **This catches the original 1/7th width bug**

### Test 2: Color Palette Accuracy
- Verifies all 6 HGR colors (black, white, orange, blue, green, purple)
- Samples pixel data and checks RGB values
- Tests color consistency across modes

### Test 3: Mode Switching
- Draws pattern in RGB mode
- Switches to NTSC and Mono, verifies persistence
- Switches back to RGB, verifies colors restored
- Tests drawing in each mode

### Test 5: Visual Inspection
- Comprehensive drawing tests
- All drawing tools (rectangles, ellipses, lines, scribble, strokes)
- All render modes
- Creates 20+ screenshots for manual verification

## Test Commands

```bash
# Standard headless run (recommended)
npm run test:e2e

# Run with browser visible (good for debugging)
npm run test:e2e:headed

# Interactive debug mode (step through tests)
npm run test:e2e:debug

# Playwright UI mode (visual test runner)
npm run test:e2e:ui

# Run specific test file
npx playwright test test1-rectangle-width.spec.js

# Run specific test by name
npx playwright test --grep "RGB mode"

# Show HTML report after tests
npx playwright show-report
```

## Using the Test Runner Script

```bash
# Standard run with summary
./run-e2e-tests.sh

# Run in headed mode
./run-e2e-tests.sh --headed

# Run in debug mode
./run-e2e-tests.sh --debug

# Run with Playwright UI
./run-e2e-tests.sh --ui
```

## Screenshots Generated

All screenshots are saved to `test-output/` directory:

**Sanity Tests:**
- `sanity-initial-load.png`
- `sanity-blank-canvas.png`
- `sanity-color-picker.png`
- `sanity-tools-selected.png`
- `sanity-settings-dialog.png`

**Rectangle Tests:**
- `rect-rgb-drawing.png`
- `rect-ntsc-drawing.png`
- `rect-mono-drawing.png`

**Color Tests:**
- `color-accuracy.png` (all 6 colors)
- `color-consistency-rgb.png`
- `color-consistency-ntsc.png`
- `color-consistency-mono.png`

**Mode Switching Tests:**
- `mode-rgb.png`
- `mode-ntsc.png`
- `mode-mono.png`
- `mode-rgb-after.png`
- `drawing-rgb-mode.png`
- `drawing-ntsc-mode.png`

**Visual Inspection Tests:**
- `visual-grid-rgb.png`
- `visual-lines-rgb.png`
- `visual-shapes-rgb.png`
- `visual-comprehensive-ntsc.png`
- `visual-comprehensive-mono.png`
- `visual-comprehensive-rgb-final.png`
- `visual-scribble-rgb.png`
- `visual-scribble-ntsc.png`
- `visual-stroke-shapes-rgb.png`
- `visual-stroke-shapes-ntsc.png`

## Understanding Test Results

### Successful Run
```
✓ test0-sanity.spec.js (5 tests, ~5s)
✓ test1-rectangle-width.spec.js (3 tests, ~6s)
✓ test2-color-accuracy.spec.js (2 tests, ~8s)
✓ test3-mode-switching.spec.js (2 tests, ~10s)
✓ test5-visual-inspection.spec.js (3 tests, ~15s)

5 test files, 15 tests passed (44s)
```

### What Tests Verify

**Dimension Verification:**
- Rectangle width: 150 pixels (±2 tolerance)
- Rectangle height: 50 pixels (±2 tolerance)

**Color Verification:**
- Orange: R(200-255), G(100-180), B(0-50)
- Blue: R(0-100), G(0-150), B(200-255)
- Green: R(0-150), G(200-255), B(0-100)
- Purple: R(180-255), G(0-100), B(180-255)
- White: R(200-255), G(200-255), B(200-255)
- Black: R(0-50), G(0-50), B(0-50)

**Persistence Verification:**
- Drawing data preserved through mode switches
- Colors restored when switching back to RGB
- All rectangles remain visible in all modes

## Troubleshooting

### Port Already in Use
```bash
# Kill existing server
pkill -f http-server

# Try again
npm run test:e2e
```

### Browsers Not Installed
```bash
# Install Chromium
npm run playwright:install
```

### Tests Timeout
```bash
# Check if app loads manually
npm start
# Then visit: http://localhost:8080/imgedit.html

# If app works, may need to increase timeout in playwright.config.js
```

### Screenshots Missing
```bash
# Create output directory
mkdir -p test-output
chmod 755 test-output
```

### Cannot Find Canvas
This usually means:
1. App didn't load properly
2. JavaScript error prevented initialization
3. Wrong URL or port

**Solution:** Open browser console and check for errors.

## File Structure

```
hgrtool/
├── playwright.config.js                 # Playwright config
├── E2E_TESTING_QUICKSTART.md           # This file
├── PLAYWRIGHT_TESTS.md                 # Full documentation
├── run-e2e-tests.sh                    # Test runner script
├── package.json                        # Added test:e2e scripts
├── test/
│   └── e2e/
│       ├── README.md                   # Detailed test docs
│       ├── IMPLEMENTATION_SUMMARY.md   # Implementation details
│       ├── helpers.js                  # Test utilities
│       ├── test0-sanity.spec.js        # Sanity checks
│       ├── test1-rectangle-width.spec.js
│       ├── test2-color-accuracy.spec.js
│       ├── test3-mode-switching.spec.js
│       └── test5-visual-inspection.spec.js
├── test-output/                        # Screenshots
├── playwright-report/                  # HTML reports
└── test-results/                       # Test artifacts
```

## Development Workflow

### After Making Changes

1. Run tests:
   ```bash
   npm run test:e2e
   ```

2. Review screenshots:
   ```bash
   open test-output/
   ```

3. Check report:
   ```bash
   npx playwright show-report
   ```

### Before Committing

```bash
# Run full test suite
npm run test:e2e

# If all tests pass, commit
git add .
git commit -m "Your changes"
```

### Debugging Test Failures

1. **Run in headed mode** to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```

2. **Use debug mode** to step through:
   ```bash
   npm run test:e2e:debug
   ```

3. **Check screenshots** for visual evidence:
   ```bash
   ls -lh test-output/
   open test-output/rect-rgb-drawing.png
   ```

4. **Review test code** in `test/e2e/`

## Next Steps

### Manual Review
After running tests, manually review:
1. All screenshots in test-output/
2. Verify colors look correct
3. Check dimensions are accurate
4. Confirm mode switching quality

### Adding More Tests
See `test/e2e/README.md` for:
- How to add new tests
- How to extend helpers
- Best practices

### CI/CD Integration
See `PLAYWRIGHT_TESTS.md` for:
- GitHub Actions setup
- CI configuration
- Artifact uploads

## Performance

Typical execution times:
- Sanity tests: ~5 seconds
- Rectangle tests: ~6 seconds
- Color tests: ~8 seconds
- Mode switching: ~10 seconds
- Visual tests: ~15 seconds

**Total:** ~45 seconds for complete suite

## Key Benefits

✅ **Automated verification** of drawing behavior
✅ **Visual evidence** via screenshots
✅ **Regression detection** for future changes
✅ **Cross-mode testing** (RGB, NTSC, Mono)
✅ **Pixel-level accuracy** verification
✅ **Fast feedback** (~45 seconds)

## Documentation

- **This file:** Quick start guide
- **PLAYWRIGHT_TESTS.md:** Complete test suite documentation
- **test/e2e/README.md:** Detailed test descriptions
- **test/e2e/IMPLEMENTATION_SUMMARY.md:** Implementation details

## Support

If tests fail:
1. Check this guide for troubleshooting
2. Review screenshots in test-output/
3. Run tests in headed mode
4. Check Playwright trace
5. Review test code in test/e2e/

If HGRTool behavior is unexpected:
1. Test manually in browser
2. Check browser console for errors
3. Review application code

## Summary

You now have a comprehensive E2E test suite that:
- Verifies rectangle drawing works correctly
- Checks color accuracy across all modes
- Tests mode switching behavior
- Provides visual verification
- Runs in ~45 seconds
- Generates helpful screenshots and reports

**Get started with:** `npm run test:e2e`

Happy testing! 🎉
