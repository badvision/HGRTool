/**
 * Helper utilities for HGRTool Playwright tests
 */

/**
 * Wait for the application to be fully loaded
 * @param {import('@playwright/test').Page} page
 */
export async function waitForAppReady(page) {
  // Wait for the canvas to be visible
  await page.waitForSelector('#edit-surface', { state: 'visible' });

  // Wait for color picker button to be visible (indicates UI is ready)
  await page.waitForSelector('#btn-choose-color', { state: 'visible' });

  // Small delay to ensure all JavaScript has initialized
  await page.waitForTimeout(500);
}

/**
 * Select a drawing tool
 * @param {import('@playwright/test').Page} page
 * @param {string} toolId - Button ID like 'btn-fill-rect'
 */
export async function selectTool(page, toolId) {
  console.log(`Selecting tool: ${toolId}`);
  await page.click(`#${toolId}`);
  await page.waitForTimeout(200);
}

/**
 * Select a solid color from the color picker
 * @param {import('@playwright/test').Page} page
 * @param {string} colorName - One of: 'black', 'white', 'orange', 'blue', 'green', 'purple', 'magenta'
 */
export async function selectColor(page, colorName) {
  console.log(`Selecting color: ${colorName}`);

  // Open color picker
  await page.click('#btn-choose-color');
  await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

  // Map color names to button indices (0-based)
  // Based on getSolidPatterns() in std-hi-res.js:
  // 0: 0x00 (black), 1: 0x2a (green), 2: 0x55 (purple/magenta), 3: 0x7f (orange),
  // 4: 0x1000 (HI_BIT_CLEAR gradient), 5: 0x80 (blue), 6: 0xaa (white),
  // 7: 0xd5 (white), 8: 0xff (white), 9: 0x1001 (HI_BIT_SET gradient)
  const colorMap = {
    'black': 0,
    'green': 1,
    'purple': 2,
    'magenta': 2,
    'orange': 3,
    'blue': 5,
    'white': 6,
  };

  const buttonIndex = colorMap[colorName];
  if (buttonIndex === undefined) {
    throw new Error(`Unknown color: ${colorName}`);
  }

  // Debug: Count total buttons and log selection
  const buttonCount = await page.locator('#hgr-color-body .swatch-button').count();
  console.log(`Total solid color buttons: ${buttonCount}, selecting index ${buttonIndex} (nth-child ${buttonIndex + 1})`);

  // Click the color button using nth-child selector (1-based)
  const selector = `#hgr-color-body .swatch-button:nth-child(${buttonIndex + 1})`;
  await page.click(selector);

  // Close dialog if it's still open (depends on settings)
  const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
  if (dialogOpen) {
    await page.click('#hgr-picker-close');
  }

  await page.waitForTimeout(200);
}

/**
 * Select rendering mode
 * @param {import('@playwright/test').Page} page
 * @param {'rgb'|'ntsc'|'mono'} mode
 */
export async function selectRenderMode(page, mode) {
  console.log(`Selecting render mode: ${mode}`);

  // Render mode radio buttons are in the bottom bar, not in settings
  // Just click the radio button directly
  await page.check(`#render-mode-${mode}`);
  await page.waitForTimeout(300);
}

/**
 * Draw a rectangle on the canvas using Playwright's CDP-level mouse control
 * @param {import('@playwright/test').Page} page
 * @param {number} x1 - X coordinate in HGR image coordinates (0-279)
 * @param {number} y1 - Y coordinate in HGR image coordinates (0-191)
 * @param {number} x2 - X coordinate in HGR image coordinates (0-279)
 * @param {number} y2 - Y coordinate in HGR image coordinates (0-191)
 */
export async function drawRectangle(page, x1, y1, x2, y2) {
  console.log(`Drawing rectangle from image coords (${x1}, ${y1}) to (${x2}, ${y2})`);

  const canvas = await page.locator('#edit-surface');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Canvas not found');
  }

  console.log(`Canvas bounding box: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

  // Get the canvas offset (where the image is positioned within the canvas)
  // This must match the calculation in Picture.drawPicture() and getCanvasPixels()
  const { canvasOffX, canvasOffY, scale } = await page.evaluate(() => {
    const picture = window.imageEditor?.currentPicture;
    if (!picture) {
      throw new Error('imageEditor.currentPicture not found');
    }
    const canvas = document.getElementById('edit-surface');
    const canvasOffX = Math.trunc((canvas.width / 2) - picture.scaledCenterX);
    const canvasOffY = Math.trunc((canvas.height / 2) - picture.scaledCenterY);
    return { canvasOffX, canvasOffY, scale: picture.scale };
  });

  console.log(`Canvas offset: (${canvasOffX}, ${canvasOffY}), scale: ${scale}`);

  // Convert image coordinates to canvas coordinates, then to viewport coordinates
  const startCanvasX = x1 * scale + canvasOffX;
  const startCanvasY = y1 * scale + canvasOffY;
  const endCanvasX = x2 * scale + canvasOffX;
  const endCanvasY = y2 * scale + canvasOffY;

  // Add canvas bounding box to get viewport coordinates
  const startX = box.x + startCanvasX;
  const startY = box.y + startCanvasY;
  const endX = box.x + endCanvasX;
  const endY = box.y + endCanvasY;

  console.log(`Canvas coords: (${startCanvasX}, ${startCanvasY}) to (${endCanvasX}, ${endCanvasY})`);
  console.log(`Viewport coords: (${startX}, ${startY}) to (${endX}, ${endY})`);

  // Use Playwright's mouse API which properly generates pointer events
  // Move to start position first
  await page.mouse.move(startX, startY);
  await page.waitForTimeout(100);

  // Press mouse button
  await page.mouse.down();
  await page.waitForTimeout(100);

  // Move to end position in several steps
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }

  // Release mouse button
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * Take a screenshot and save to test-output directory
 * @param {import('@playwright/test').Page} page
 * @param {string} filename
 */
export async function takeScreenshot(page, filename) {
  const path = `test-output/${filename}`;
  console.log(`Taking screenshot: ${path}`);
  await page.screenshot({ path, fullPage: false });
}

/**
 * Get the canvas pixel data for analysis
 * @param {import('@playwright/test').Page} page
 * @param {number} x - X coordinate in HGR image coordinates (0-279)
 * @param {number} y - Y coordinate in HGR image coordinates (0-191)
 * @param {number} width - Width in image pixels
 * @param {number} height - Height in image pixels
 * @returns {Promise<{data: number[], width: number, height: number}>}
 */
export async function getCanvasPixels(page, x, y, width, height) {
  return await page.evaluate(({ x, y, width, height }) => {
    const canvas = document.getElementById('edit-surface');
    const ctx = canvas.getContext('2d');

    // CRITICAL FIX: The image is centered on the canvas with an offset and may be scaled
    // We need to convert HGR image coordinates to canvas coordinates
    // The Picture class centers the image using:
    //   canvasOffX = (canvas.width / 2) - scaledCenterX
    //   canvasOffY = (canvas.height / 2) - scaledCenterY
    // And scales the image by picture.scale

    // Get the offset and scale from the Picture instance
    const picture = window.imageEditor?.currentPicture;
    if (!picture) {
      console.error('[getCanvasPixels] imageEditor.currentPicture not found!');
      return { data: [], width: 0, height: 0 };
    }

    // Calculate the canvas offset the same way Picture.drawPicture() does
    const canvasOffX = Math.trunc((canvas.width / 2) - picture.scaledCenterX);
    const canvasOffY = Math.trunc((canvas.height / 2) - picture.scaledCenterY);
    const scale = picture.scale;

    console.log(`[getCanvasPixels] Image coords: (${x}, ${y}), scale: ${scale}, offset: (${canvasOffX}, ${canvasOffY})`);

    // Convert image coordinates to canvas coordinates
    // canvasX = imageX * scale + offset
    const adjustedX = Math.trunc(x * scale + canvasOffX);
    const adjustedY = Math.trunc(y * scale + canvasOffY);
    const adjustedWidth = Math.trunc(width * scale);
    const adjustedHeight = Math.trunc(height * scale);

    console.log(`[getCanvasPixels] Canvas coords: (${adjustedX}, ${adjustedY}) ${adjustedWidth}x${adjustedHeight}`);

    const imageData = ctx.getImageData(adjustedX, adjustedY, adjustedWidth, adjustedHeight);

    // Debug: Show what we got
    const firstPixel = imageData.data;
    console.log(`[getCanvasPixels] First pixel RGB: (${firstPixel[0]}, ${firstPixel[1]}, ${firstPixel[2]})`);

    return {
      data: Array.from(imageData.data),
      width: imageData.width,
      height: imageData.height
    };
  }, { x, y, width, height });
}

/**
 * Select a dither pattern from the color picker
 * @param {import('@playwright/test').Page} page
 * @param {number} patternIndex - 0-based index of dither pattern (0-107)
 */
export async function selectDitherPattern(page, patternIndex) {
  console.log(`Selecting dither pattern: ${patternIndex}`);

  // Open color picker
  await page.click('#btn-choose-color');
  await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

  // Dither patterns are in the right panel (#hgr-dither-body)
  // Click the pattern button using nth-child selector (1-based)
  const selector = `#hgr-dither-body .swatch-button:nth-child(${patternIndex + 1})`;

  // Debug: Count total buttons
  const buttonCount = await page.locator('#hgr-dither-body .swatch-button').count();
  console.log(`Total dither pattern buttons: ${buttonCount}, selecting index ${patternIndex} (nth-child ${patternIndex + 1})`);

  await page.click(selector);

  // Close dialog if it's still open (depends on settings)
  const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
  if (dialogOpen) {
    await page.click('#hgr-picker-close');
  }

  await page.waitForTimeout(200);
}

/**
 * Create a new blank image
 * @param {import('@playwright/test').Page} page
 */
export async function createNewImage(page) {
  console.log('Creating new blank image');
  await page.click('#btn-new');
  await page.waitForTimeout(300);
}
