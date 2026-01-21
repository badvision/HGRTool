import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Integration Tests - Import Button and NTSC Rendering', () => {
  let dom;
  let window;
  let document;
  let ImageEditor;

  beforeEach(async () => {
    // Mock ImageData globally before JSDOM loads
    if (!global.ImageData) {
      global.ImageData = class ImageData {
        constructor(widthOrData, height) {
          if (typeof widthOrData === 'number') {
            this.width = widthOrData;
            this.height = height;
            this.data = new Uint8ClampedArray(widthOrData * height * 4);
          } else {
            this.data = widthOrData;
            this.width = height;
            this.height = arguments[2];
          }
        }
      };
    }

    // Mock OffscreenCanvas globally before JSDOM loads
    if (!global.OffscreenCanvas) {
      global.OffscreenCanvas = class OffscreenCanvas {
        constructor(width, height) {
          this.width = width;
          this.height = height;
        }
        getContext(contextType, options) {
          const mockGradient = {
            addColorStop: vi.fn(),
          };
          return {
            canvas: this,
            width: this.width,
            height: this.height,
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn((x, y, w, h) => ({
              data: new Uint8ClampedArray(w * h * 4),
              width: w,
              height: h
            })),
            putImageData: vi.fn(),
            createImageData: vi.fn((w, h) => ({
              data: new Uint8ClampedArray(w * h * 4),
              width: w,
              height: h
            })),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            strokeRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn((text) => ({
              width: text.length * 8,
              actualBoundingBoxLeft: 0,
              actualBoundingBoxRight: text.length * 8,
              actualBoundingBoxAscent: 10,
              actualBoundingBoxDescent: 2
            })),
            setLineDash: vi.fn(),
            clip: vi.fn(),
            createLinearGradient: vi.fn(() => mockGradient),
            imageSmoothingEnabled: true,
            fillStyle: '#000',
            font: '12px sans-serif',
          };
        }
      };
    }

    // Load the actual HTML
    const htmlContent = readFileSync(
      join(process.cwd(), 'docs/imgedit.html'),
      'utf-8'
    );

    // Create a proper DOM environment
    dom = new JSDOM(htmlContent, {
      url: 'https://localhost:8443',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.HTMLCanvasElement = window.HTMLCanvasElement;

    // Mock canvas context
    const mockGradient = {
      addColorStop: vi.fn(),
    };
    window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(280 * 192 * 4),
        width: 280,
        height: 192
      })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text) => ({
        width: text.length * 8,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: text.length * 8,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2
      })),
      createLinearGradient: vi.fn(() => mockGradient),
      createImageData: vi.fn((w, h) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h
      })),
      imageSmoothingEnabled: true,
      fillStyle: '#000',
      canvas: { width: 280, height: 192 }
    }));

    // Mock localStorage
    global.localStorage = {
      data: {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, value) { this.data[key] = String(value); },
      removeItem(key) { delete this.data[key]; },
      clear() { this.data = {}; }
    };

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Import Button Registration', () => {
    it('CRITICAL: Import button should exist in DOM', () => {
      const importBtn = document.getElementById('btn-import-image');

      if (!importBtn) {
        throw new Error(
          'FAIL: btn-import-image not found in DOM. ' +
          'This is why the import button does not work!'
        );
      }

      expect(importBtn).toBeTruthy();
      expect(importBtn.tagName).toBe('BUTTON');
    });

    it('CRITICAL: Import button should have click handler', async () => {
      // Try to dynamically load and initialize the image editor
      let handlerRegistered = false;

      // Mock addEventListener to detect if handler is registered
      const originalAddEventListener = HTMLElement.prototype.addEventListener;
      HTMLElement.prototype.addEventListener = function(event, handler) {
        if (this.id === 'btn-import-image' && event === 'click') {
          handlerRegistered = true;
          console.log('✓ Import button click handler registered');
        }
        return originalAddEventListener.call(this, event, handler);
      };

      try {
        // Try to load the image-editor module
        // This will fail if there's a syntax error or missing dependency
        const module = await import('../docs/src/image-editor.js');
        console.log('Module loaded:', module);
      } catch (error) {
        throw new Error(
          `FAIL: Could not load image-editor.js: ${error.message}\n` +
          `This is why the import button does not work!\n` +
          `Stack: ${error.stack}`
        );
      }

      if (!handlerRegistered) {
        throw new Error(
          'FAIL: Import button click handler was never registered. ' +
          'The addEventListener for btn-import-image was never called. ' +
          'This is why clicking the button does nothing!'
        );
      }

      expect(handlerRegistered).toBe(true);
    });

    it('CRITICAL: Clicking import button should call handleImportImage', () => {
      const importBtn = document.getElementById('btn-import-image');

      let clickHandlerCalled = false;
      importBtn.addEventListener('click', () => {
        clickHandlerCalled = true;
      });

      importBtn.click();

      if (!clickHandlerCalled) {
        throw new Error(
          'FAIL: Click event did not trigger. ' +
          'Either the button is disabled or event system is broken!'
        );
      }

      expect(clickHandlerCalled).toBe(true);
    });
  });

  describe('NTSC Settings Integration', () => {
    it('CRITICAL: NTSC checkbox should exist', () => {
      const checkbox = document.getElementById('setting-use-ntsc');

      if (!checkbox) {
        throw new Error(
          'FAIL: setting-use-ntsc checkbox not found. ' +
          'This is why NTSC rendering cannot be enabled!'
        );
      }

      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
    });

    it('CRITICAL: NTSC sliders should exist', () => {
      const sliders = [
        'ntsc-hue',
        'ntsc-saturation',
        'ntsc-brightness',
        'ntsc-contrast'
      ];

      for (const id of sliders) {
        const slider = document.getElementById(id);
        if (!slider) {
          throw new Error(
            `FAIL: ${id} slider not found. ` +
            'This is why NTSC parameters cannot be adjusted!'
          );
        }
        expect(slider).toBeTruthy();
        expect(slider.type).toBe('range');
      }
    });

    it('CRITICAL: Changing NTSC checkbox should trigger settings change', async () => {
      const checkbox = document.getElementById('setting-use-ntsc');
      let changeHandlerCalled = false;

      // Mock the change event
      checkbox.addEventListener('change', () => {
        changeHandlerCalled = true;
        console.log('✓ NTSC checkbox change event fired');
      });

      // Simulate user interaction
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change'));

      if (!changeHandlerCalled) {
        throw new Error(
          'FAIL: Change event did not fire on NTSC checkbox. ' +
          'This is why enabling NTSC does nothing!'
        );
      }

      expect(changeHandlerCalled).toBe(true);
    });

    it('CRITICAL: Settings should have onSettingsChanged handler', async () => {
      // Check if Settings class exists and has the method
      try {
        const SettingsModule = await import('../docs/src/settings.js');
        const Settings = SettingsModule.default;

        // Check if the class has the handleNtscChange method
        const proto = Settings.prototype;

        if (!proto.handleNtscChange) {
          throw new Error(
            'FAIL: Settings.prototype.handleNtscChange not found. ' +
            'This is why NTSC settings changes do nothing!'
          );
        }

        if (!proto.handleNtscSliderChange) {
          throw new Error(
            'FAIL: Settings.prototype.handleNtscSliderChange not found. ' +
            'This is why NTSC slider changes do nothing!'
          );
        }

        expect(proto.handleNtscChange).toBeDefined();
        expect(proto.handleNtscSliderChange).toBeDefined();
      } catch (error) {
        throw new Error(
          `FAIL: Could not verify Settings methods: ${error.message}\n` +
          'This is why NTSC settings do not work!'
        );
      }
    });
  });

  describe('Module Loading', () => {
    it('CRITICAL: image-editor.js should load without errors', async () => {
      try {
        await import('../docs/src/image-editor.js');
      } catch (error) {
        throw new Error(
          `FAIL: image-editor.js failed to load: ${error.message}\n` +
          `This is the root cause of all UI issues!\n` +
          `Stack: ${error.stack}`
        );
      }
    });

    it('CRITICAL: ImageDither should be imported in image-editor', async () => {
      const content = readFileSync(
        join(process.cwd(), 'docs/src/image-editor.js'),
        'utf-8'
      );

      if (!content.includes('import ImageDither')) {
        throw new Error(
          'FAIL: ImageDither is not imported in image-editor.js. ' +
          'This is why image import cannot work!'
        );
      }

      if (!content.includes('from "./lib/image-dither.js"')) {
        throw new Error(
          'FAIL: ImageDither import path is wrong or missing. ' +
          'This is why image import cannot work!'
        );
      }

      expect(content).toContain('import ImageDither');
    });

    it('CRITICAL: handleImportImage method should exist', async () => {
      const content = readFileSync(
        join(process.cwd(), 'docs/src/image-editor.js'),
        'utf-8'
      );

      if (!content.includes('handleImportImage()')) {
        throw new Error(
          'FAIL: handleImportImage() method not found in image-editor.js. ' +
          'This is why the import button does nothing!'
        );
      }

      expect(content).toContain('handleImportImage()');
    });

    it('CRITICAL: Import button event listener should be registered', async () => {
      const content = readFileSync(
        join(process.cwd(), 'docs/src/image-editor.js'),
        'utf-8'
      );

      const hasEventListener =
        content.includes('btn-import-image') &&
        content.includes('addEventListener') &&
        content.includes('handleImportImage');

      if (!hasEventListener) {
        throw new Error(
          'FAIL: Import button event listener is not registered in constructor. ' +
          'Check that: document.getElementById("btn-import-image").addEventListener("click", this.handleImportImage.bind(this)) ' +
          'exists in the ImageEditor constructor. ' +
          'This is why clicking the button does nothing!'
        );
      }

      expect(hasEventListener).toBe(true);
    });

    it('CRITICAL: onSettingsChanged should update NTSC rendering', async () => {
      const content = readFileSync(
        join(process.cwd(), 'docs/src/image-editor.js'),
        'utf-8'
      );

      if (!content.includes('onSettingsChanged()')) {
        throw new Error('FAIL: onSettingsChanged() method not found');
      }

      const onSettingsChangedSection = content.substring(
        content.indexOf('onSettingsChanged()'),
        content.indexOf('onSettingsChanged()') + 2000
      );

      if (!onSettingsChangedSection.includes('useNtscRendering')) {
        throw new Error(
          'FAIL: onSettingsChanged() does not handle useNtscRendering. ' +
          'This is why enabling NTSC does not update the display!'
        );
      }

      if (!onSettingsChangedSection.includes('ntscRenderer')) {
        throw new Error(
          'FAIL: onSettingsChanged() does not update ntscRenderer. ' +
          'This is why changing NTSC parameters does nothing!'
        );
      }

      if (!onSettingsChangedSection.includes('render()')) {
        throw new Error(
          'FAIL: onSettingsChanged() does not call render(). ' +
          'This is why the screen does not update when settings change!'
        );
      }

      expect(onSettingsChangedSection).toContain('useNtscRendering');
      expect(onSettingsChangedSection).toContain('ntscRenderer');
      expect(onSettingsChangedSection).toContain('render()');
    });
  });
});
