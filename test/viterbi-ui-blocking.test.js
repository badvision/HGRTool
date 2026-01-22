/*
 * Copyright 2025 faddenSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * UI BLOCKING TEST - Critical User Experience Bug
 *
 * USER REPORT: "excruciating long time" for image import
 * ROOT CAUSE: Synchronous ditherToHgr() call blocks UI thread for 19+ seconds
 *
 * FIX REQUIREMENTS:
 * 1. Async version of ditherToHgr() that yields to event loop
 * 2. Progress callback that updates UI during processing
 * 3. Ability to cancel long-running operation
 *
 * SUCCESS CRITERIA:
 * - Full 280×192 import completes in <20 seconds with progress updates
 * - Event loop yields every 100ms so UI remains responsive
 * - Progress callback reports percent complete (0-100%)
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Viterbi UI Blocking - CRITICAL UX BUG', () => {
    let ImageDither;

    beforeAll(async () => {
        const imageDitherModule = await import('../docs/src/lib/image-dither.js');
        ImageDither = imageDitherModule.default;
    });

    describe('Async Import with Progress', () => {
        it('should provide async ditherToHgr with progress callback', async () => {
            const dither = new ImageDither();

            // Create test image (full size)
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128); // Mid-gray
            for (let i = 3; i < sourceData.length; i += 4) {
                sourceData[i] = 255; // Alpha
            }
            const sourceImage = new ImageData(sourceData, width, height);

            // Track progress updates
            const progressUpdates = [];
            const progressCallback = (completed, total) => {
                const percent = Math.round((completed / total) * 100);
                progressUpdates.push(percent);
                console.log(`Progress: ${completed}/${total} scanlines (${percent}%)`);
            };

            // TIME IT
            const startTime = Date.now();

            // Should have an async version of ditherToHgr
            const hgrData = await dither.ditherToHgrAsync(
                sourceImage,
                40,
                192,
                'viterbi',
                progressCallback
            );

            const elapsedMs = Date.now() - startTime;
            const elapsedSec = elapsedMs / 1000;

            console.log(`\nAsync import completed in ${elapsedSec.toFixed(2)} seconds`);
            console.log(`Progress updates received: ${progressUpdates.length}`);
            console.log(`Progress values: ${progressUpdates.join(', ')}`);

            // ACCEPTANCE CRITERIA
            expect(hgrData.length).toBe(40 * 192); // Correct output
            expect(elapsedSec).toBeLessThan(25); // Still fast (allowing 5s overhead for async)
            expect(progressUpdates.length).toBeGreaterThan(10); // At least 10 progress updates
            expect(progressUpdates[0]).toBeGreaterThanOrEqual(0); // Starts near 0%
            expect(progressUpdates[progressUpdates.length - 1]).toBeGreaterThanOrEqual(95); // Ends near 100%
        }, 60000); // 60 second timeout

        it('should remain responsive during async processing', async () => {
            // This test verifies that the event loop can process other tasks
            // during the long-running Viterbi operation

            const dither = new ImageDither();

            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128);
            for (let i = 3; i < sourceData.length; i += 4) {
                sourceData[i] = 255;
            }
            const sourceImage = new ImageData(sourceData, width, height);

            // Start the async operation
            let taskCounter = 0;
            const checkResponsiveness = () => {
                taskCounter++;
                if (taskCounter < 20) {
                    setTimeout(checkResponsiveness, 100); // Check every 100ms
                }
            };
            setTimeout(checkResponsiveness, 100);

            // Run the Viterbi operation
            const hgrData = await dither.ditherToHgrAsync(sourceImage, 40, 192, 'viterbi');

            console.log(`\nEvent loop responsiveness check: ${taskCounter} ticks during processing`);
            console.log(`With BATCH_SIZE=10, we yield ~${Math.floor(192 / 10)} times`);
            console.log(`Each yield allows event loop to process pending tasks`);

            // If the operation blocks the UI thread, taskCounter will be 0 or very low
            // If it yields properly, taskCounter should be > 10 (proving it's yielding)
            // With BATCH_SIZE=10 and 192 scanlines, we expect ~19 yields
            expect(hgrData.length).toBe(40 * 192);
            expect(taskCounter).toBeGreaterThan(10); // Should have multiple ticks proving async behavior
        }, 60000);
    });

    describe('Fast Synchronous Path Still Available', () => {
        it('should keep original synchronous ditherToHgr for batch processing', () => {
            // For non-UI contexts (testing, batch processing), keep the fast sync version
            const dither = new ImageDither();

            const width = 7, height = 1;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128);
            const sourceImage = new ImageData(sourceData, width, height);

            // Original synchronous version should still work
            const hgrData = dither.ditherToHgr(sourceImage, 1, 1, 'viterbi');

            expect(hgrData.length).toBe(1);
        });
    });
});
