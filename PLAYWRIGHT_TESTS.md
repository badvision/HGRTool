# Playwright E2E Test Suite for HGRTool

## Overview

This document describes the comprehensive end-to-end test suite for HGRTool, built with Playwright. The tests verify drawing and rendering behavior across all three render modes (RGB, NTSC, Mono).

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install

# Run all tests
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run interactively
npm run test:e2e:ui
```

## Test Coverage

### Critical Tests Implemented

#### 1. Rectangle Drawing Width Verification
**Purpose:** Verify that rectangles are drawn with correct dimensions in all modes

Tests:
- RGB mode: Draw 150×50 rectangle, verify dimensions match drag area
- NTSC mode: Draw 150×50 rectangle, verify dimensions preserved
- Mono mode: Draw 150×50 rectangle, verify dimensions preserved

**Why this matters:** This test catches the original bug where rectangles were 1/7th actual width.

#### 2. Color Palette Accuracy
**Purpose:** Verify all HGR colors render with correct RGB values

Tests:
- Draw swatches of all 6 HGR colors (black, white, orange, blue, green, purple)
- Sample pixel data and verify RGB values fall within expected ranges
- Test color consistency when switching between render modes

**Expected RGB Ranges:**
- Black: R(0-50), G(0-50), B(0-50)
- White: R(200-255), G(200-255), B(200-255)
- Orange: R(200-255), G(100-180), B(0-50)
- Blue: R(0-100), G(0-150), B(200-255)
- Green: R(0-150), G(200-255), B(0-100)
- Purple: R(180-255), G(0-100), B(180-255)

#### 3. Mode Switching Persistence
**Purpose:** Verify that drawn patterns persist correctly through mode changes

Tests:
- Draw multi-colored pattern in RGB mode
- Switch to NTSC mode, verify all rectangles still visible
- Switch to Mono mode, verify pattern preserved
- Switch back to RGB, verify original colors restored
- Verify drawing tools work correctly in each mode

**Why this matters:** Ensures NTSC rendering doesn't corrupt underlying HGR data.

#### 4. Visual Inspection Suite
**Purpose:** Create comprehensive screenshots for manual quality verification

Tests:
- Grid of all colors in all modes
- Line drawing test
- Ellipse (filled) test
- Scribble tool test
- Stroke (outline) shapes test

**Why this matters:** Provides human-verifiable visual evidence of correct rendering.

## Test Architecture

### Files Structure

```
test/e2e/
├── README.md                          # Detailed test documentation
├── helpers.js                         # Reusable test utilities
├── test1-rectangle-width.spec.js      # Rectangle dimension tests
├── test2-color-accuracy.spec.js       # Color palette tests
├── test3-mode-switching.spec.js       # Mode switching tests
└── test5-visual-inspection.spec.js    # Visual verification tests
```

### Helper Functions

The `helpers.js` module provides:

```javascript
// Application readiness
waitForAppReady(page)         // Wait for app to fully load

// Tool selection
selectTool(page, toolId)      // Select drawing tool by button ID
selectColor(page, colorName)  // Open picker and select color
selectRenderMode(page, mode)  // Open settings and change mode

// Drawing actions
drawRectangle(page, x1, y1, x2, y2)  // Draw rectangle by dragging
createNewImage(page)                  // Create blank canvas

// Verification
takeScreenshot(page, filename)        // Save screenshot to test-output/
getCanvasPixels(page, x, y, w, h)     // Extract pixel data for analysis
```

### Pixel Verification Strategy

Tests verify drawing correctness by:

1. **Color Range Checking:** RGB values fall within expected ranges
2. **Non-Black Verification:** Drawn areas contain colored pixels
3. **Mode Consistency:** Pixels remain visible after mode switches
4. **Visual Comparison:** Screenshots provide manual verification fallback

Example verification:
```javascript
const pixels = await getCanvasPixels(page, 100, 75, 10, 10);
const r = pixels.data[0];
const g = pixels.data[1];
const b = pixels.data[2];

// Verify orange color
expect(r).toBeGreaterThan(200);  // High red
expect(g).toBeGreaterThan(100);  // Medium green
expect(b).toBeLessThan(50);      // Low blue
```

## Screenshots Generated

All screenshots are saved to `test-output/` directory:

### Rectangle Tests
- `rect-rgb-drawing.png` - Orange rectangle in RGB mode
- `rect-ntsc-drawing.png` - Orange rectangle in NTSC mode
- `rect-mono-drawing.png` - White rectangle in Mono mode

### Color Tests
- `color-accuracy.png` - All 6 HGR colors as swatches
- `color-consistency-rgb.png` - Color consistency test in RGB
- `color-consistency-ntsc.png` - Color consistency test in NTSC
- `color-consistency-mono.png` - Color consistency test in Mono

### Mode Switching Tests
- `mode-rgb.png` - Multi-colored pattern in RGB
- `mode-ntsc.png` - Same pattern in NTSC
- `mode-mono.png` - Same pattern in Mono
- `mode-rgb-after.png` - Pattern after switching back to RGB
- `drawing-rgb-mode.png` - Drawing purple in RGB
- `drawing-ntsc-mode.png` - Drawing orange in NTSC

### Visual Inspection Tests
- `visual-grid-rgb.png` - Color grid
- `visual-lines-rgb.png` - Line drawing test
- `visual-shapes-rgb.png` - Shapes test
- `visual-comprehensive-ntsc.png` - All shapes in NTSC
- `visual-comprehensive-mono.png` - All shapes in Mono
- `visual-comprehensive-rgb-final.png` - Final RGB comparison
- `visual-scribble-rgb.png` - Scribble tool in RGB
- `visual-scribble-ntsc.png` - Scribble tool in NTSC
- `visual-stroke-shapes-rgb.png` - Outline shapes in RGB
- `visual-stroke-shapes-ntsc.png` - Outline shapes in NTSC

## Running Tests

### Command Reference

```bash
# Standard test run (headless, recommended for CI)
npm run test:e2e

# Run with browser visible (good for development)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# Interactive UI mode (best for exploration)
npm run test:e2e:ui

# Run specific test file
npx playwright test test1-rectangle-width.spec.js

# Run specific test by name
npx playwright test --grep "RGB mode"

# Show test report
npx playwright show-report
```

### Using the Test Runner Script

```bash
# Run tests and get summary
./run-e2e-tests.sh

# Run in headed mode
./run-e2e-tests.sh --headed

# Run in debug mode
./run-e2e-tests.sh --debug

# Run with UI
./run-e2e-tests.sh --ui
```

## Test Configuration

### Playwright Config (`playwright.config.js`)

```javascript
{
  testDir: './test/e2e',
  workers: 1,                    // Serial execution
  webServer: {
    command: 'npm run start',    // Auto-start dev server
    url: 'http://localhost:8080',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  }
}
```

### Key Configuration Choices

- **Serial Execution (`workers: 1`):** Prevents port conflicts
- **Auto Server (`webServer`):** Starts dev server automatically
- **Screenshots on Failure:** Captures state when tests fail
- **Trace on Retry:** Full debugging info on retry attempts

## Interpreting Test Results

### Successful Test Output

```
✓ test1-rectangle-width.spec.js:RGB mode (2.3s)
✓ test1-rectangle-width.spec.js:NTSC mode (2.1s)
✓ test1-rectangle-width.spec.js:Mono mode (2.2s)
```

### Understanding Failures

**Dimension Mismatch:**
```
Expected width to be between 148-152, got 21
```
→ Rectangle drawing bug (original 1/7th width issue)

**Color Verification Failed:**
```
Expected red channel > 200, got 45
```
→ Color palette or rendering issue

**Pixel Not Found:**
```
Expected hasOrange to be truthy
```
→ Drawing may not have occurred, or coordinates wrong

## Debugging Failed Tests

### Step 1: Check Screenshots

Look at `test-output/*.png` files to see actual rendering.

### Step 2: Review Console Output

Tests log helpful information:
```
Drawing rectangle from (50, 50) to (200, 100)
Rectangle dimensions: 150x50
RGB Orange: [255, 128, 0]
```

### Step 3: Run in Headed Mode

See the browser in action:
```bash
npm run test:e2e:headed
```

### Step 4: Use Debug Mode

Step through test actions:
```bash
npm run test:e2e:debug
```

### Step 5: Check Playwright Trace

View detailed execution timeline:
```bash
npx playwright show-trace test-results/.../trace.zip
```

## Continuous Integration

### CI Configuration

Tests are ready for CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### CI Best Practices

- Use `npm ci` instead of `npm install`
- Cache Playwright browsers
- Upload test reports as artifacts
- Run tests on multiple OS/browsers if needed

## Extending the Tests

### Adding a New Test

1. Create new spec file: `testN-description.spec.js`
2. Import helpers:
   ```javascript
   import { waitForAppReady, selectTool, ... } from './helpers.js';
   ```
3. Structure test:
   ```javascript
   test.describe('Test N: Description', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('/imgedit.html');
       await waitForAppReady(page);
       await createNewImage(page);
     });

     test('specific behavior', async ({ page }) => {
       // Test implementation
     });
   });
   ```

### Adding New Helper Functions

Add to `helpers.js`:
```javascript
export async function newHelper(page, param) {
  console.log(`Performing action: ${param}`);
  // Implementation
  await page.waitForTimeout(200);
}
```

## Known Limitations

### Pixel Value Variations

RGB values may vary by ±5 pixels due to:
- Anti-aliasing
- Browser rendering differences
- Canvas scaling

**Solution:** Use ranges instead of exact values.

### Timing Issues

Some operations need explicit waits:
```javascript
await page.waitForTimeout(200);  // Allow UI to settle
```

**Solution:** Tests include appropriate delays.

### Color Picker Behavior

Dialog closure depends on settings (single vs double-click).

**Solution:** Tests check if dialog is still open and close it.

## Performance

Typical test execution times:
- Rectangle tests: ~2 seconds each
- Color tests: ~3 seconds each
- Mode switching: ~5 seconds
- Visual inspection: ~8 seconds

**Total suite:** ~30-40 seconds

## Troubleshooting

### Server Won't Start

```
Error: Port 8080 already in use
```

**Solution:**
```bash
pkill -f http-server
npm run test:e2e
```

### Canvas Not Found

```
Error: Selector '#edit-surface' not found
```

**Solution:**
- Check HTML structure hasn't changed
- Verify app loads at http://localhost:8080/imgedit.html
- Check JavaScript console for errors

### Screenshots Not Generated

**Solution:**
```bash
mkdir -p test-output
chmod 755 test-output
```

### Tests Timeout

**Solution:** Increase timeout in `playwright.config.js`:
```javascript
timeout: 60000,  // 60 seconds
```

## Maintenance

### Updating Tests After UI Changes

If HTML changes:
1. Update selectors in `helpers.js`
2. Run tests to verify
3. Update screenshots if rendering changes

### Updating Color Ranges

If palette changes:
1. Update expected RGB ranges in `test2-color-accuracy.spec.js`
2. Regenerate reference screenshots

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Support

For issues with tests:
1. Check this documentation
2. Review test output and screenshots
3. Run tests in debug mode
4. Check Playwright trace

For issues with HGRTool functionality:
1. Verify manually in browser
2. Check browser console for errors
3. Review application code
