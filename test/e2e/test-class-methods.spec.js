import { test } from '@playwright/test';

test.describe('Class Methods Check', () => {
  test('List all methods on imageEditor', async ({ page }) => {
    await page.goto('/imgedit.html');
    await page.waitForTimeout(2000);

    const methodList = await page.evaluate(() => {
      if (!window.imageEditor) {
        return { error: 'imageEditor not found' };
      }

      const methods = [];
      const props = [];

      // Get all properties
      for (const key in window.imageEditor) {
        const type = typeof window.imageEditor[key];
        if (type === 'function') {
          methods.push(key);
        } else {
          props.push(`${key}: ${type}`);
        }
      }

      // Also check prototype
      const protoMethods = [];
      const proto = Object.getPrototypeOf(window.imageEditor);
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (typeof proto[key] === 'function' && key !== 'constructor') {
          protoMethods.push(key);
        }
      }

      return {
        methods: methods.sort(),
        methodCount: methods.length,
        props: props.slice(0, 10),
        protoMethods: protoMethods.sort(),
        protoMethodCount: protoMethods.length
      };
    });

    console.log('\n=== Instance Methods ===');
    console.log(`Count: ${methodList.methodCount}`);
    console.log(methodList.methods);

    console.log('\n=== Prototype Methods ===');
    console.log(`Count: ${methodList.protoMethodCount}`);
    console.log(methodList.protoMethods.slice(0, 20).join(', '));

    console.log('\n=== Sample Props ===');
    console.log(methodList.props);
  });
});
