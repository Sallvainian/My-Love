#!/usr/bin/env node

/**
 * Smoke Test Script - Pre-Deploy Build Validation
 *
 * Fast checks against built output in dist/ directory.
 * This script runs BEFORE deployment to catch critical build failures early.
 * Called by predeploy script: npm run build && npm run test:smoke
 *
 * Tests performed:
 * 1. Verify dist/ directory exists
 * 2. Verify index.html exists with proper structure
 * 3. Verify manifest.webmanifest exists and is valid JSON
 * 4. Verify critical assets exist (icons, fonts)
 * 5. Verify JS bundles exist (vendor chunks)
 * 6. Verify service worker exists
 *
 * Exit codes:
 * - 0: All smoke tests passed
 * - 1: Critical build failure (blocks deployment)
 *
 * Usage:
 *   npm run test:smoke
 *   node scripts/smoke-tests.cjs
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let testsFailed = 0;

/**
 * Log test result with formatting
 * @param {string} testName - Name of the test
 * @param {boolean} passed - Whether test passed
 * @param {string} [details] - Optional details to display
 */
function logTest(testName, passed, details = '') {
  if (passed) {
    console.log(`${colors.green}✅ ${testName}${colors.reset}${details ? `: ${details}` : ''}`);
  } else {
    console.log(`${colors.red}❌ ${testName}${colors.reset}${details ? `: ${details}` : ''}`);
    testsFailed++;
  }
}

/**
 * Check if file exists
 * @param {string} filePath - Path relative to project root
 * @returns {boolean}
 */
function fileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

/**
 * Read file content
 * @param {string} filePath - Path relative to project root
 * @returns {string|null}
 */
function readFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * Get files in directory matching pattern
 * @param {string} dirPath - Directory path relative to project root
 * @param {RegExp} pattern - Pattern to match filenames
 * @returns {string[]}
 */
function getFilesMatching(dirPath, pattern) {
  const fullPath = path.join(process.cwd(), dirPath);
  try {
    const files = fs.readdirSync(fullPath);
    return files.filter((file) => pattern.test(file));
  } catch (error) {
    return [];
  }
}

/**
 * Test 1: Verify dist directory exists
 */
function testDistDirectory() {
  console.log(`\n${colors.blue}Test 1: Build Output Directory${colors.reset}\n`);

  const distExists = fileExists('dist');
  logTest('dist/ directory exists', distExists);

  if (!distExists) {
    console.log(`${colors.red}CRITICAL: Build output not found. Run 'npm run build' first.${colors.reset}`);
    return false;
  }

  return true;
}

/**
 * Test 2: Verify index.html structure
 */
function testIndexHtml() {
  console.log(`\n${colors.blue}Test 2: Index HTML Structure${colors.reset}\n`);

  const indexExists = fileExists('dist/index.html');
  logTest('index.html exists', indexExists);

  if (!indexExists) {
    return;
  }

  const html = readFile('dist/index.html');
  if (!html) {
    logTest('index.html is readable', false);
    return;
  }

  // Check for essential HTML elements
  const hasDoctype = html.includes('<!doctype html>') || html.includes('<!DOCTYPE html>');
  logTest('DOCTYPE declaration present', hasDoctype);

  const hasViewport = html.includes('<meta name="viewport"');
  logTest('Viewport meta tag present', hasViewport);

  const hasManifestLink = html.includes('rel="manifest"');
  logTest('Manifest link present', hasManifestLink);

  const hasAppRoot = html.includes('id="root"');
  logTest('App root element present', hasAppRoot);

  // Check for bundled scripts
  const hasScriptTag = html.includes('<script');
  logTest('JavaScript bundle linked', hasScriptTag);
}

/**
 * Test 3: Verify PWA manifest
 */
function testManifest() {
  console.log(`\n${colors.blue}Test 3: PWA Manifest${colors.reset}\n`);

  const manifestExists = fileExists('dist/manifest.webmanifest');
  logTest('manifest.webmanifest exists', manifestExists);

  if (!manifestExists) {
    return;
  }

  const manifestContent = readFile('dist/manifest.webmanifest');
  if (!manifestContent) {
    logTest('manifest.webmanifest is readable', false);
    return;
  }

  // Parse and validate manifest JSON
  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
    logTest('Manifest is valid JSON', true);
  } catch (error) {
    logTest('Manifest is valid JSON', false, error.message);
    return;
  }

  // Check required PWA manifest fields
  const requiredFields = ['name', 'short_name', 'icons', 'display'];
  const presentFields = requiredFields.filter((field) => manifest[field]);
  const allPresent = presentFields.length === requiredFields.length;

  logTest(
    `Manifest required fields (${presentFields.length}/${requiredFields.length})`,
    allPresent,
    allPresent ? '' : `Missing: ${requiredFields.filter((f) => !manifest[f]).join(', ')}`
  );

  // Check icons array
  if (Array.isArray(manifest.icons) && manifest.icons.length > 0) {
    logTest(`Manifest icons configured`, true, `${manifest.icons.length} icon(s)`);
  } else {
    logTest('Manifest icons configured', false, 'No icons defined');
  }

  // Check theme color
  const hasThemeColor = Boolean(manifest.theme_color);
  logTest('Theme color configured', hasThemeColor, manifest.theme_color || '');
}

/**
 * Test 4: Verify critical assets
 */
function testCriticalAssets() {
  console.log(`\n${colors.blue}Test 4: Critical Assets${colors.reset}\n`);

  // Check icons (referenced in manifest)
  const icon192 = fileExists('dist/icons/icon-192.png');
  logTest('Icon 192x192 exists', icon192);

  const icon512 = fileExists('dist/icons/icon-512.png');
  logTest('Icon 512x512 exists', icon512);

  // Check fonts directory (optional)
  const fontsDir = fileExists('dist/fonts');
  if (fontsDir) {
    const fontFiles = getFilesMatching('dist/fonts', /\.woff2$/);
    console.log(`${colors.cyan}ℹ️  Fonts directory exists: ${fontFiles.length} font file(s)${colors.reset}`);
  } else {
    console.log(`${colors.cyan}ℹ️  Fonts directory not found (optional)${colors.reset}`);
  }
}

/**
 * Test 5: Verify JS bundles
 */
function testJavascriptBundles() {
  console.log(`\n${colors.blue}Test 5: JavaScript Bundles${colors.reset}\n`);

  const assetsDir = fileExists('dist/assets');
  logTest('assets/ directory exists', assetsDir);

  if (!assetsDir) {
    return;
  }

  // Check for main entry bundle
  const jsFiles = getFilesMatching('dist/assets', /\.js$/);
  const hasJsBundle = jsFiles.length > 0;
  logTest('JavaScript bundles generated', hasJsBundle, `${jsFiles.length} file(s)`);

  // Check for vendor chunks (code splitting working) - look for common patterns
  const vendorChunks = jsFiles.filter((file) =>
    file.includes('vendor-') || file.match(/vendor\./i) || file.includes('chunk')
  );
  const hasVendorSplit = vendorChunks.length > 0 || jsFiles.length >= 2;
  logTest('Code splitting working', hasVendorSplit, `${jsFiles.length} bundle(s)`);

  // Check for CSS bundles
  const cssFiles = getFilesMatching('dist/assets', /\.css$/);
  const hasCssBundle = cssFiles.length > 0;
  logTest('CSS bundles generated', hasCssBundle, `${cssFiles.length} file(s)`);
}

/**
 * Test 6: Verify service worker
 */
function testServiceWorker() {
  console.log(`\n${colors.blue}Test 6: Service Worker${colors.reset}\n`);

  const swExists = fileExists('dist/sw.js');
  logTest('Service worker (sw.js) exists', swExists);

  if (swExists) {
    const swContent = readFile('dist/sw.js');
    if (swContent) {
      // Basic check that it's not empty
      const hasContent = swContent.length > 100;
      logTest('Service worker has content', hasContent, `${swContent.length} bytes`);

      // Check for precache manifest or workbox patterns (optional validation)
      const hasPrecache = swContent.includes('self.__WB_MANIFEST') || swContent.includes('precache');
      if (hasPrecache) {
        console.log(`${colors.cyan}ℹ️  Precache manifest detected${colors.reset}`);
      }
    }
  }

  // Check for workbox-generated files
  const workboxFiles = getFilesMatching('dist', /^workbox-/);
  if (workboxFiles.length > 0) {
    logTest('Workbox runtime files present', true, `${workboxFiles.length} file(s)`);
  }
}

/**
 * Display smoke test summary
 */
function displaySummary() {
  console.log(
    `\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.blue}Smoke Test Summary${colors.reset}`);
  console.log(
    `${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`
  );

  if (testsFailed === 0) {
    console.log(`${colors.green}✅ All smoke tests passed!${colors.reset}`);
    console.log(`${colors.cyan}Build output is ready for deployment.${colors.reset}\n`);
    return 0;
  } else {
    console.log(`${colors.red}❌ ${testsFailed} test(s) failed${colors.reset}`);
    console.log(`${colors.red}Build output has critical issues. Deployment blocked.${colors.reset}\n`);
    return 1;
  }
}

/**
 * Main test runner
 */
function main() {
  console.log(
    `${colors.blue}╔═══════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.blue}║       Pre-Deploy Smoke Tests for My-Love PWA        ║${colors.reset}`
  );
  console.log(
    `${colors.blue}╚═══════════════════════════════════════════════════════╝${colors.reset}`
  );

  const distExists = testDistDirectory();
  if (!distExists) {
    process.exit(1);
  }

  testIndexHtml();
  testManifest();
  testCriticalAssets();
  testJavascriptBundles();
  testServiceWorker();

  const exitCode = displaySummary();
  process.exit(exitCode);
}

// Run smoke tests
main();
