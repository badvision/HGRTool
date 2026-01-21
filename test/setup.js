// Test setup file for vitest
import { vi } from 'vitest';

// Create mock canvas context factory
function createMockCanvasContext(canvasElement) {
  const mockGradient = {
    addColorStop: vi.fn(),
  };
  return {
    canvas: canvasElement,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn((x, y, w, h) => {
      // Return ImageData with proper dimensions
      const data = new Uint8ClampedArray(w * h * 4);
      const imageData = new ImageData(w, h);
      imageData.data.set(data);
      return imageData;
    }),
    putImageData: vi.fn(),
    createImageData: vi.fn((w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      const imageData = new ImageData(w, h);
      imageData.data.set(data);
      return imageData;
    }),
    setTransform: vi.fn(),
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
    createLinearGradient: vi.fn(() => mockGradient),
    imageSmoothingEnabled: true,
    fillStyle: '#000',
  };
}

// Mock document.createElement to return properly mocked canvas elements
if (typeof document !== 'undefined') {
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tagName) => {
    if (tagName === 'canvas') {
      const canvas = originalCreateElement(tagName);
      // Override getContext to return our mock
      canvas.getContext = function(contextType) {
        if (contextType === '2d') {
          return createMockCanvasContext(this);
        }
        return null;
      };
      return canvas;
    }
    return originalCreateElement(tagName);
  };
}

// Mock Image
if (!global.Image) {
  global.Image = class Image {
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  };
}

// Mock localStorage
if (!global.localStorage) {
  global.localStorage = {
    data: {},
    getItem(key) {
      return this.data[key] || null;
    },
    setItem(key, value) {
      this.data[key] = String(value);
    },
    removeItem(key) {
      delete this.data[key];
    },
    clear() {
      this.data = {};
    },
  };
}

// Mock ImageData
if (!global.ImageData) {
  global.ImageData = class ImageData {
    constructor(widthOrData, height) {
      if (typeof widthOrData === 'number') {
        // new ImageData(width, height)
        this.width = widthOrData;
        this.height = height;
        this.data = new Uint8ClampedArray(widthOrData * height * 4);
      } else {
        // new ImageData(data, width, height)
        this.data = widthOrData;
        this.width = height;
        this.height = arguments[2];
      }
    }
  };
}

// Mock OffscreenCanvas
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

console.log('Test setup complete');
