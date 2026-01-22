import { test } from '@playwright/test';
import { waitForAppReady } from './helpers.js';

test('Direct call to handleImportImage', async ({ page }) => {
  const errors = [];

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => {
    errors.push(err.toString());
    console.log(`ERROR: ${err.toString()}`);
  });

  await page.goto('/imgedit.html');
  await waitForAppReady(page);

  const result = await page.evaluate(async () => {
    try {
      // Check if method exists
      if (!window.imageEditor) {
        return { error: 'No imageEditor' };
      }

      if (typeof window.imageEditor.handleImportImage !== 'function') {
        // List what DOES exist
        const methods = [];
        for (const key in window.imageEditor) {
          if (typeof window.imageEditor[key] === 'function') {
            methods.push(key);
          }
        }

        // Check prototype
        const proto = Object.getPrototypeOf(window.imageEditor);
        const protoMethods = Object.getOwnPropertyNames(proto)
          .filter(k => typeof proto[k] === 'function' && k !== 'constructor')
          .slice(0, 10);

        return {
          error: 'handleImportImage not a function',
          type: typeof window.imageEditor.handleImportImage,
          instanceMethods: methods.slice(0, 5),
          protoMethods
        };
      }

      // Try to call it
      const promise = window.imageEditor.handleImportImage();

      return {
        called: true,
        isPromise: promise instanceof Promise
      };
    } catch (e) {
      return {
        error: e.toString(),
        message: e.message,
        stack: e.stack
      };
    }
  });

  console.log('\nResult:', JSON.stringify(result, null, 2));
  console.log('\nPage errors:', errors);
});
