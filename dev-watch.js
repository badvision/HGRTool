#!/usr/bin/env node
/**
 * Development Hot Reload Script
 *
 * Watches docs/src/ for changes, runs publish.sh, and triggers browser reload.
 * Uses browser-sync for live reload and file serving.
 */

import { spawn, exec } from 'child_process';
import { watch } from 'chokidar';
import browserSync from 'browser-sync';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bs = browserSync.create();

let isPublishing = false;
let pendingReload = false;

/**
 * Run publish.sh to sync docs/src/ to docs/
 */
async function runPublish() {
  if (isPublishing) {
    pendingReload = true;
    return;
  }

  isPublishing = true;
  console.log('📦 Publishing changes...');

  try {
    await execAsync('bash publish.sh', { cwd: __dirname });
    console.log('✅ Publish complete');

    // Reload browser
    if (bs.active) {
      console.log('🔄 Reloading browser...');
      bs.reload();
    }
  } catch (error) {
    console.error('❌ Publish failed:', error.message);
  } finally {
    isPublishing = false;

    // If changes occurred during publish, run again
    if (pendingReload) {
      pendingReload = false;
      setTimeout(() => runPublish(), 100);
    }
  }
}

/**
 * Initialize file watcher
 */
function initWatcher() {
  const srcPath = path.join(__dirname, 'docs/src');

  console.log(`👀 Watching ${srcPath} for changes...`);

  const watcher = watch(srcPath, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  watcher
    .on('add', (filepath) => {
      console.log(`📄 File added: ${path.relative(__dirname, filepath)}`);
      runPublish();
    })
    .on('change', (filepath) => {
      console.log(`📝 File changed: ${path.relative(__dirname, filepath)}`);
      runPublish();
    })
    .on('unlink', (filepath) => {
      console.log(`🗑️  File removed: ${path.relative(__dirname, filepath)}`);
      runPublish();
    })
    .on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });

  return watcher;
}

/**
 * Initialize browser-sync server
 */
async function initBrowserSync() {
  return new Promise((resolve) => {
    bs.init({
      server: {
        baseDir: './docs',
        index: 'imgedit.html'
      },
      port: 8080,
      ui: false,
      open: true,
      notify: false,
      ghostMode: false,
      logLevel: 'info',
      logPrefix: 'HGRTool',
      snippetOptions: {
        rule: {
          match: /<\/body>/i,
          fn: function (snippet, match) {
            return snippet + match;
          }
        }
      }
    }, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  🚀 HGRTool Development Server Running                ║');
      console.log('╟────────────────────────────────────────────────────────╢');
      console.log('║  Local:  http://localhost:8080/imgedit.html            ║');
      console.log('║  Hot reload: ENABLED ✓                                 ║');
      console.log('╟────────────────────────────────────────────────────────╢');
      console.log('║  Edit files in docs/src/ - browser auto-refreshes     ║');
      console.log('║  Press Ctrl+C to stop                                  ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');
      resolve();
    });
  });
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔧 Starting HGRTool development environment...\n');

  // Run initial publish
  console.log('📦 Running initial publish...');
  await runPublish();

  // Initialize browser-sync
  await initBrowserSync();

  // Start watching for changes
  const watcher = initWatcher();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    watcher.close();
    bs.exit();
    process.exit(0);
  });
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
