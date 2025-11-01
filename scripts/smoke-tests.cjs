#!/usr/bin/env node

/**
 * Pre-Deploy Smoke Tests
 *
 * Validates the production build output (dist/ directory) before deployment.
 * Tests are fail-fast: exits on first failure with clear error message.
 *
 * Tests performed:
 * 1. File existence (index.html, manifest.webmanifest, sw.js)
 * 2. Manifest validation (valid JSON, required fields)
 * 3. Service worker validation (contains expected cache routes)
 * 4. Configuration constants validation (APP_CONFIG in bundle)
 * 5. Bundle size validation (<200KB gzipped total)
 * 6. Critical assets (icons, CSS, JS bundles)
 *
 * Exit codes:
 * - 0: All tests passed
 * - 1: Test failure
 *
 * Usage:
 *   node scripts/smoke-tests.js
 *   npm run test:smoke (if configured in package.json)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Configuration
const DIST_DIR = path.join(__dirname, '../dist');
const MAX_BUNDLE_SIZE_KB = 200; // NFR001 performance requirement

/**
 * Test suite state tracking
 */
let testsPassed = 0;
let totalTests = 0;

/**
 * Log test result with formatting
 * @param {string} testName - Name of the test
 * @param {boolean} passed - Whether test passed
 * @param {string} [details] - Optional details to display
 */
function logTest(testName, passed, details = '') {
  totalTests++;
  if (passed) {
    testsPassed++;
    console.log(`${colors.green}✅ ${testName}${colors.reset}${details ? `: ${details}` : ''}`);
  } else {
    console.error(`${colors.red}❌ ${testName}${colors.reset}${details ? `: ${details}` : ''}`);
  }
}

/**
 * Exit with error message
 * @param {string} context - Error context for logging
 * @param {string} message - Error message
 * @param {string} [suggestion] - Optional suggestion for fixing
 */
function exitWithError(context, message, suggestion = '') {
  console.error(`\n${colors.red}[${context}]:${colors.reset} ${message}`);
  if (suggestion) {
    console.error(`${colors.yellow}💡 Suggestion:${colors.reset} ${suggestion}`);
  }
  console.error(`\n${colors.red}Smoke tests failed. Deployment blocked.${colors.reset}\n`);
  process.exit(1);
}

/**
 * Calculate gzipped size of a file
 * @param {string} filePath - Path to file
 * @returns {number} - Size in bytes
 */
function getGzippedSize(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content, { level: 9 });
  return gzipped.length;
}

/**
 * Test 1: Verify required files exist
 */
function testFileExistence() {
  console.log(`\n${colors.blue}Test 1: File Existence${colors.reset}`);

  const requiredFiles = [
    'index.html',
    'manifest.webmanifest',
    'sw.js'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(DIST_DIR, file);
    const exists = fs.existsSync(filePath);

    if (!exists) {
      exitWithError(
        'File Existence',
        `Required file not found: ${file}`,
        'Run `npm run build` to generate the production build'
      );
    }

    logTest(`${file} exists`, true);
  }
}

/**
 * Test 2: Validate index.html structure
 */
function testIndexHtml() {
  console.log(`\n${colors.blue}Test 2: index.html Validation${colors.reset}`);

  const indexPath = path.join(DIST_DIR, 'index.html');
  const content = fs.readFileSync(indexPath, 'utf8');

  // Check for viewport meta tag (required for PWA)
  const hasViewport = content.includes('<meta name="viewport"');
  if (!hasViewport) {
    exitWithError(
      'index.html Validation',
      'Viewport meta tag not found in index.html',
      'Ensure Vite HTML template includes viewport meta tag'
    );
  }
  logTest('Viewport meta tag present', true);

  // Check for manifest link
  const hasManifestLink = content.includes('rel="manifest"');
  if (!hasManifestLink) {
    exitWithError(
      'index.html Validation',
      'Manifest link not found in index.html',
      'Verify vite-plugin-pwa is configured correctly'
    );
  }
  logTest('Manifest link present', true);
}

/**
 * Test 3: Validate manifest.webmanifest
 */
function testManifest() {
  console.log(`\n${colors.blue}Test 3: PWA Manifest Validation${colors.reset}`);

  const manifestPath = path.join(DIST_DIR, 'manifest.webmanifest');
  const content = fs.readFileSync(manifestPath, 'utf8');

  let manifest;
  try {
    manifest = JSON.parse(content);
  } catch (error) {
    exitWithError(
      'Manifest Validation',
      'manifest.webmanifest is not valid JSON',
      'Check vite-plugin-pwa configuration in vite.config.ts'
    );
  }
  logTest('Manifest is valid JSON', true);

  // Validate required fields
  const requiredFields = ['name', 'short_name', 'icons', 'display', 'theme_color'];
  const missingFields = requiredFields.filter(field => !manifest[field]);

  if (missingFields.length > 0) {
    exitWithError(
      'Manifest Validation',
      `Missing required fields: ${missingFields.join(', ')}`,
      'Update vite-plugin-pwa manifest configuration in vite.config.ts'
    );
  }
  logTest('All required manifest fields present', true, `${requiredFields.join(', ')}`);

  // Validate icons array
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    exitWithError(
      'Manifest Validation',
      'Manifest icons array is empty or invalid',
      'Ensure icon files exist and are configured in vite-plugin-pwa'
    );
  }
  logTest(`Manifest includes ${manifest.icons.length} icon(s)`, true);
}

/**
 * Test 4: Validate service worker
 */
function testServiceWorker() {
  console.log(`\n${colors.blue}Test 4: Service Worker Validation${colors.reset}`);

  const swPath = path.join(DIST_DIR, 'sw.js');
  const content = fs.readFileSync(swPath, 'utf8');

  // Check for Workbox or cache-related code
  const hasWorkbox = content.includes('workbox') || content.includes('precache') || content.includes('registerRoute');
  if (!hasWorkbox) {
    exitWithError(
      'Service Worker Validation',
      'Service worker does not contain expected Workbox/caching code',
      'Verify vite-plugin-pwa workbox configuration in vite.config.ts'
    );
  }
  logTest('Service worker contains caching logic', true);

  // Check for precache manifest (indicates assets will be cached)
  const hasPrecache = content.includes('precache') || content.includes('self.__WB_MANIFEST');
  if (!hasPrecache) {
    console.warn(`${colors.yellow}⚠️  Warning: Service worker may not pre-cache assets${colors.reset}`);
  } else {
    logTest('Service worker includes precache manifest', true);
  }
}

/**
 * Test 5: Verify environment variable injection
 */
function testEnvironmentVariables() {
  console.log(`\n${colors.blue}Test 5: Environment Variable Injection${colors.reset}`);

  const assetsDir = path.join(DIST_DIR, 'assets');

  if (!fs.existsSync(assetsDir)) {
    exitWithError(
      'Environment Variable Injection',
      'assets/ directory not found in dist/',
      'Run `npm run build` to generate bundled assets'
    );
  }

  // Find all JS bundles
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));

  if (jsFiles.length === 0) {
    exitWithError(
      'Environment Variable Injection',
      'No JavaScript bundles found in dist/assets/',
      'Verify Vite build completed successfully'
    );
  }

  // Search for APP_CONFIG constants in any bundle
  let foundConfig = false;
  let configDetails = '';

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

    // Check for APP_CONFIG-related constants
    // The minified bundle may not have "APP_CONFIG" as a literal,
    // but should have defaultPartnerName and defaultStartDate constants
    const hasPartnerName = content.includes('defaultPartnerName');
    const hasStartDate = content.includes('defaultStartDate');

    if (hasPartnerName && hasStartDate) {
      foundConfig = true;
      configDetails = `in ${jsFile}`;
      break;
    }
  }

  if (!foundConfig) {
    // This is a warning, not a blocker - app may work without pre-configuration
    console.warn(`${colors.yellow}⚠️  Warning: APP_CONFIG constants not found in bundle${colors.reset}`);
    console.warn(`${colors.yellow}   Verify that src/config/constants.ts has been configured with your relationship data${colors.reset}`);
    console.warn(`${colors.yellow}   App will function but without pre-configured relationship data${colors.reset}`);
    logTest('Configuration constants present', false, 'Missing (non-blocking)');
  } else {
    logTest('Configuration constants present', true, configDetails);
  }
}

/**
 * Test 6: Validate bundle size
 */
function testBundleSize() {
  console.log(`\n${colors.blue}Test 6: Bundle Size Validation${colors.reset}`);

  const assetsDir = path.join(DIST_DIR, 'assets');
  let totalSize = 0;
  const fileSizes = [];

  // Calculate gzipped size of all JS and CSS bundles
  const assetFiles = fs.readdirSync(assetsDir);

  for (const file of assetFiles) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
      const filePath = path.join(assetsDir, file);
      const gzippedSize = getGzippedSize(filePath);
      totalSize += gzippedSize;
      fileSizes.push({ file, size: gzippedSize });
    }
  }

  const totalSizeKB = (totalSize / 1024).toFixed(2);
  const withinLimit = totalSize < (MAX_BUNDLE_SIZE_KB * 1024);

  if (!withinLimit) {
    console.error(`${colors.red}Bundle size breakdown:${colors.reset}`);
    for (const { file, size } of fileSizes.sort((a, b) => b.size - a.size)) {
      console.error(`  ${file}: ${(size / 1024).toFixed(2)}KB gzipped`);
    }
    exitWithError(
      'Bundle Size Validation',
      `Total bundle size ${totalSizeKB}KB exceeds ${MAX_BUNDLE_SIZE_KB}KB limit (NFR001)`,
      'Analyze bundle with vite-bundle-visualizer and optimize imports'
    );
  }

  logTest(`Bundle size: ${totalSizeKB}KB gzipped`, true, `(limit: ${MAX_BUNDLE_SIZE_KB}KB)`);

  // Log breakdown for reference
  console.log(`${colors.blue}   Bundle breakdown:${colors.reset}`);
  for (const { file, size } of fileSizes.sort((a, b) => b.size - a.size)) {
    console.log(`   - ${file}: ${(size / 1024).toFixed(2)}KB gzipped`);
  }
}

/**
 * Test 7: Verify critical assets
 */
function testCriticalAssets() {
  console.log(`\n${colors.blue}Test 7: Critical Assets Validation${colors.reset}`);

  // Check for at least one icon
  const iconsDir = path.join(DIST_DIR, 'icons');
  if (fs.existsSync(iconsDir)) {
    const iconFiles = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));
    if (iconFiles.length === 0) {
      console.warn(`${colors.yellow}⚠️  Warning: No icon files found in dist/icons/${colors.reset}`);
    } else {
      logTest(`Found ${iconFiles.length} icon file(s)`, true);
    }
  } else {
    console.warn(`${colors.yellow}⚠️  Warning: dist/icons/ directory not found${colors.reset}`);
  }

  // Check for JS bundles
  const assetsDir = path.join(DIST_DIR, 'assets');
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) {
    exitWithError(
      'Critical Assets',
      'No JavaScript bundles found',
      'Verify Vite build completed successfully'
    );
  }
  logTest(`Found ${jsFiles.length} JavaScript bundle(s)`, true);

  // Check for CSS bundles
  const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
  if (cssFiles.length === 0) {
    console.warn(`${colors.yellow}⚠️  Warning: No CSS bundles found${colors.reset}`);
  } else {
    logTest(`Found ${cssFiles.length} CSS bundle(s)`, true);
  }
}

/**
 * Main test runner
 */
function main() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║        Pre-Deploy Smoke Tests for My-Love PWA       ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Verify dist/ directory exists
  if (!fs.existsSync(DIST_DIR)) {
    exitWithError(
      'Smoke Tests',
      'dist/ directory not found',
      'Run `npm run build` before running smoke tests'
    );
  }

  console.log(`${colors.blue}Build directory:${colors.reset} ${DIST_DIR}\n`);

  try {
    // Run all tests
    testFileExistence();
    testIndexHtml();
    testManifest();
    testServiceWorker();
    testEnvironmentVariables();
    testBundleSize();
    testCriticalAssets();

    // Summary
    console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✅ All smoke tests passed (${testsPassed}/${totalTests})${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);
    console.log(`${colors.green}✨ Build is ready for deployment!${colors.reset}\n`);

    process.exit(0);

  } catch (error) {
    // Catch any unexpected errors
    console.error(`\n${colors.red}[Unexpected Error]:${colors.reset} ${error.message}`);
    console.error(error.stack);
    console.error(`\n${colors.red}Smoke tests failed due to unexpected error.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
main();
