import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('UI Integration', () => {
  let htmlContent;

  beforeEach(() => {
    // Read the actual HTML file
    htmlContent = readFileSync(
      join(process.cwd(), 'docs/imgedit.html'),
      'utf-8'
    );
    document.body.innerHTML = htmlContent;
  });

  describe('Import Button', () => {
    it('should exist in HTML', () => {
      const btn = document.getElementById('btn-import-image');
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
    });

    it('should have correct class', () => {
      const btn = document.getElementById('btn-import-image');
      expect(btn.classList.contains('icon-button')).toBe(true);
    });

    it('should have icon', () => {
      const btn = document.getElementById('btn-import-image');
      const icon = btn.querySelector('i');
      expect(icon).toBeTruthy();
      expect(icon.classList.contains('fa-image')).toBe(true);
    });

    it('should have text content', () => {
      const btn = document.getElementById('btn-import-image');
      expect(btn.textContent).toContain('Import');
    });
  });

  describe('Import Dialog', () => {
    it('should exist', () => {
      const dialog = document.getElementById('import-image');
      expect(dialog).toBeTruthy();
      expect(dialog.tagName).toBe('DIALOG');
    });

    it('should have file chooser', () => {
      const fileChooser = document.getElementById('import-file-chooser');
      expect(fileChooser).toBeTruthy();
      expect(fileChooser.type).toBe('file');
      expect(fileChooser.accept).toBe('image/*');
    });

    it('should have dither algorithm selector', () => {
      const selector = document.getElementById('import-dither-algorithm');
      expect(selector).toBeTruthy();
      expect(selector.tagName).toBe('SELECT');

      const options = selector.querySelectorAll('option');
      expect(options.length).toBe(3);
      expect(options[0].value).toBe('floyd-steinberg');
      expect(options[1].value).toBe('jarvis-judice-ninke');
      expect(options[2].value).toBe('atkinson');
    });

    it('should have preview canvas', () => {
      const canvas = document.getElementById('import-preview-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('should have convert button', () => {
      const btn = document.getElementById('import-convert');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('Convert and Import');
    });

    it('should have cancel button', () => {
      const btn = document.getElementById('import-cancel');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('Cancel');
    });

    it('should have status area', () => {
      const status = document.getElementById('import-status');
      expect(status).toBeTruthy();
    });
  });

  describe('NTSC Settings', () => {
    it('should have NTSC checkbox', () => {
      const checkbox = document.getElementById('setting-use-ntsc');
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
    });

    it('should have hue slider', () => {
      const slider = document.getElementById('ntsc-hue');
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('-180');
      expect(slider.max).toBe('180');
      expect(slider.step).toBe('5');
    });

    it('should have saturation slider', () => {
      const slider = document.getElementById('ntsc-saturation');
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('2');
      expect(slider.step).toBe('0.1');
    });

    it('should have brightness slider', () => {
      const slider = document.getElementById('ntsc-brightness');
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('2');
    });

    it('should have contrast slider', () => {
      const slider = document.getElementById('ntsc-contrast');
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('2');
    });

    it('should have value displays for each slider', () => {
      expect(document.getElementById('ntsc-hue-value')).toBeTruthy();
      expect(document.getElementById('ntsc-saturation-value')).toBeTruthy();
      expect(document.getElementById('ntsc-brightness-value')).toBeTruthy();
      expect(document.getElementById('ntsc-contrast-value')).toBeTruthy();
    });
  });

  describe('JavaScript Module References', () => {
    it('should reference image-editor.js', () => {
      const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
      const hasImageEditor = scripts.some(script =>
        script.src.includes('image-editor.js')
      );
      expect(hasImageEditor).toBe(true);
    });
  });
});
