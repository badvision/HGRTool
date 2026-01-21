# HGRTool E2E Tests with Playwright

This directory contains comprehensive end-to-end tests for HGRTool using Playwright. These tests verify drawing behavior, color accuracy, and rendering across different modes (RGB, NTSC, Mono).

## Test Suite Overview

### Test 1: Rectangle Drawing Width Verification
**File:** `test1-rectangle-width.spec.js`

Tests that rectangle drawing produces the correct width in all render modes:
- RGB mode: Draws orange rectangle, verifies dimensions and color
- NTSC mode: Draws orange rectangle, verifies dimensions
- Mono mode: Draws white rectangle, verifies dimensions

**Screenshots produced:**
- `rect-rgb-drawing.png`
- `rect-ntsc-drawing.png`
- `rect-mono-drawing.png`

### Test 2: Color Palette Accuracy
**File:** `test2-color-accuracy.spec.js`

Tests that all HGR colors render correctly:
- Draws swatches of all 6 standard HGR colors (black, white, orange, blue, green, purple)
- Verifies each color falls within expected RGB ranges
- Tests color consistency across render modes

**Screenshots produced:**
- `color-accuracy.png`
- `color-consistency-rgb.png`
- `color-consistency-ntsc.png`
- `color-consistency-mono.png`

### Test 3: Mode Switching
**File:** `test3-mode-switching.spec.js`

Tests that patterns persist correctly when switching between render modes:
- Draws multi-colored pattern in RGB mode
- Switches to NTSC, verifies pattern still visible
- Switches to Mono, verifies pattern still visible
- Switches back to RGB, verifies colors restored
- Tests that drawing tools work correctly in each mode

**Screenshots produced:**
- `mode-rgb.png`
- `mode-ntsc.png`
- `mode-mono.png`
- `mode-rgb-after.png`
- `drawing-rgb-mode.png`
- `drawing-ntsc-mode.png`

### Test 5: Visual Inspection Suite
**File:** `test5-visual-inspection.spec.js`

Comprehensive visual tests for manual inspection:
- Draws grid of all colors
- Tests line drawing
- Tests ellipse drawing
- Tests scribble tool
- Tests stroke (outline) shapes
- Captures all drawing in all three render modes

**Screenshots produced:**
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

## Running the Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npm run playwright:install
   ```

### Running Tests

**Run all tests (headless):**
```bash
npm run test:e2e
```

**Run tests with browser visible (headed mode):**
```bash
npm run test:e2e:headed
```

**Debug tests interactively:**
```bash
npm run test:e2e:debug
```

**Use Playwright UI mode:**
```bash
npm run test:e2e:ui
```

**Run specific test file:**
```bash
npx playwright test test1-rectangle-width.spec.js
```

### Output

- **Screenshots:** All screenshots are saved to `test-output/` directory
- **Test Reports:** HTML reports are generated in `playwright-report/`
- **Test Results:** Console output shows pass/fail status and pixel verification

## Test Architecture

### Helper Functions (`helpers.js`)

The test suite includes reusable helper functions:
- `waitForAppReady()` - Ensures app is fully loaded
- `selectTool()` - Selects a drawing tool
- `selectColor()` - Opens color picker and selects a color
- `selectRenderMode()` - Opens settings and changes render mode
- `drawRectangle()` - Draws a rectangle by simulating mouse drag
- `takeScreenshot()` - Captures and saves screenshot
- `getCanvasPixels()` - Extracts pixel data for verification
- `createNewImage()` - Creates a new blank canvas

### Pixel Verification

Tests verify drawing correctness by:
1. Sampling canvas pixel data at specific coordinates
2. Checking RGB values fall within expected ranges
3. Ensuring non-black pixels exist where drawing occurred
4. Comparing pixel data across mode switches

## Understanding the Tests

### Why These Tests Matter

1. **Rectangle Width Verification:** Ensures the original bug (rectangles being 1/7th actual width) is fixed
2. **Color Accuracy:** Verifies that the color palette matches Apple II HGR specifications
3. **Mode Switching:** Ensures NTSC rendering doesn't corrupt underlying HGR data
4. **Visual Inspection:** Provides human-verifiable screenshots for quality assurance

### Test Reliability

Tests are designed to be:
- **Deterministic:** Same input produces same output
- **Repeatable:** Can run multiple times with consistent results
- **Resilient:** Allow small pixel variations due to rendering differences
- **Visual:** Produce screenshots for manual verification

### Debugging Failed Tests

If a test fails:

1. **Check screenshots:** Look at `test-output/*.png` files
2. **Check console output:** Look for logged pixel values
3. **Run in headed mode:** See what's happening visually
4. **Use debug mode:** Step through test actions
5. **Check Playwright trace:** View detailed test execution

## Continuous Integration

Tests are configured to run in CI environments:
- Automatic server startup via `webServer` config
- Retry on failure (2 retries in CI)
- Full trace capture on first retry
- HTML reports for debugging

## Extending the Tests

To add new tests:

1. Create a new spec file: `testN-description.spec.js`
2. Import helpers: `import { ... } from './helpers.js'`
3. Use `test.describe()` to group related tests
4. Use `test.beforeEach()` to set up fresh canvas
5. Follow naming convention for screenshots: `description-mode.png`

## Known Issues

1. **Pixel variations:** RGB values may vary by ±5 due to rendering differences
2. **Timing:** Some operations need `waitForTimeout()` for stability
3. **Color picker dialog:** Behavior depends on user settings (single vs double-click)

## Troubleshooting

**Server won't start:**
- Check if port 8080 is already in use
- Try `pkill -f http-server` to kill existing servers

**Tests timeout:**
- Increase timeout in `playwright.config.js`
- Check if application loads correctly at `http://localhost:8080/imgedit.html`

**Screenshots not generated:**
- Check `test-output/` directory exists
- Verify write permissions

**Canvas not found:**
- Ensure `#edit-surface` element exists in HTML
- Check JavaScript console for errors
