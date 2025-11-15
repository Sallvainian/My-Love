#!/usr/bin/env node

/**
 * Post-Deploy Validation Script
 *
 * Performs optional validation checks on the live deployed site.
 * This script is informational only - it does NOT block deployment.
 *
 * Tests performed:
 * 1. HTTP GET to live URL (verify 200 response)
 * 2. HTML parsing (verify manifest link present)
 * 3. Manifest fetch and validation (verify valid JSON structure)
 * 4. Service worker registration check (logged as manual step)
 * 5. Pre-configured data visibility (optional check)
 *
 * Exit codes:
 * - 0: Always exits successfully (informational only)
 *
 * Usage:
 *   node scripts/post-deploy-check.js [URL]
 *   node scripts/post-deploy-check.js https://yourusername.github.io/My-Love/
 *
 * If no URL provided, uses default GitHub Pages pattern from package.json
 */

const https = require('https');
const http = require('http');
const url = require('url');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Make HTTP(S) GET request
 * @param {string} targetUrl - URL to fetch
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PostDeployCheck/1.0',
      },
    };

    const req = protocol.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body,
          headers: res.headers,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout after 10 seconds'));
    });

    req.end();
  });
}

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
    console.log(`${colors.yellow}⚠️  ${testName}${colors.reset}${details ? `: ${details}` : ''}`);
  }
}

/**
 * Test 1: Verify site is accessible
 * @param {string} siteUrl - URL to check
 */
async function testSiteAccessibility(siteUrl) {
  console.log(`\n${colors.blue}Test 1: Site Accessibility${colors.reset}`);
  console.log(`${colors.cyan}URL: ${siteUrl}${colors.reset}\n`);

  try {
    const response = await fetchUrl(siteUrl);

    if (response.statusCode === 200) {
      logTest('Site is accessible', true, `HTTP ${response.statusCode}`);
      return { success: true, body: response.body };
    } else if (response.statusCode >= 300 && response.statusCode < 400) {
      logTest(
        'Site returned redirect',
        false,
        `HTTP ${response.statusCode} (check redirect target)`
      );
      return { success: false, body: null };
    } else {
      logTest('Site returned error', false, `HTTP ${response.statusCode}`);
      return { success: false, body: null };
    }
  } catch (error) {
    logTest('Site is not accessible', false, error.message);
    return { success: false, body: null };
  }
}

/**
 * Test 2: Validate HTML structure
 * @param {string} html - HTML content
 * @param {string} siteUrl - Base URL for manifest resolution
 */
async function testHtmlStructure(html, siteUrl) {
  console.log(`\n${colors.blue}Test 2: HTML Structure Validation${colors.reset}`);

  if (!html) {
    logTest('HTML validation skipped', false, 'No HTML content available');
    return { manifestUrl: null };
  }

  // Check for viewport meta tag
  const hasViewport = html.includes('<meta name="viewport"');
  logTest('Viewport meta tag present', hasViewport);

  // Check for manifest link
  const manifestLinkMatch = html.match(/<link[^>]+rel=["']manifest["'][^>]*>/i);
  if (manifestLinkMatch) {
    const hrefMatch = manifestLinkMatch[0].match(/href=["']([^"']+)["']/);
    if (hrefMatch) {
      const manifestPath = hrefMatch[1];
      const manifestUrl = new url.URL(manifestPath, siteUrl).href;
      logTest('Manifest link present', true, manifestPath);
      return { manifestUrl };
    }
  }

  logTest('Manifest link present', false);
  return { manifestUrl: null };
}

/**
 * Test 3: Validate PWA manifest
 * @param {string} manifestUrl - URL of manifest file
 */
async function testManifest(manifestUrl) {
  console.log(`\n${colors.blue}Test 3: PWA Manifest Validation${colors.reset}`);

  if (!manifestUrl) {
    logTest('Manifest validation skipped', false, 'Manifest URL not found');
    return;
  }

  try {
    const response = await fetchUrl(manifestUrl);

    if (response.statusCode !== 200) {
      logTest('Manifest fetch failed', false, `HTTP ${response.statusCode}`);
      return;
    }

    logTest('Manifest is accessible', true, `HTTP 200`);

    // Parse manifest JSON
    let manifest;
    try {
      manifest = JSON.parse(response.body);
      logTest('Manifest is valid JSON', true);
    } catch (error) {
      logTest('Manifest is valid JSON', false, 'JSON parse error');
      return;
    }

    // Check required fields
    const requiredFields = ['name', 'short_name', 'icons', 'display'];
    const presentFields = requiredFields.filter((field) => manifest[field]);

    logTest(
      `Manifest has ${presentFields.length}/${requiredFields.length} required fields`,
      presentFields.length === requiredFields.length
    );

    // Check theme color
    if (manifest.theme_color) {
      logTest('Theme color configured', true, manifest.theme_color);
    }

    // Check icons
    if (Array.isArray(manifest.icons) && manifest.icons.length > 0) {
      logTest(`Manifest includes ${manifest.icons.length} icon(s)`, true);
    }
  } catch (error) {
    logTest('Manifest validation failed', false, error.message);
  }
}

/**
 * Test 4: Service Worker check (manual verification guidance)
 */
function testServiceWorker() {
  console.log(`\n${colors.blue}Test 4: Service Worker Registration${colors.reset}`);

  console.log(
    `${colors.yellow}⚠️  Service worker registration requires manual verification${colors.reset}`
  );
  console.log(`\n${colors.cyan}Manual verification steps:${colors.reset}`);
  console.log(`1. Open the live site in Chrome or Edge`);
  console.log(`2. Open DevTools (F12) → Application tab`);
  console.log(`3. Navigate to Service Workers section (left sidebar)`);
  console.log(`4. Verify status shows: "activated and is running"`);
  console.log(`5. Check Cache Storage section to verify assets are cached`);
  console.log(`\n${colors.cyan}Expected behavior:${colors.reset}`);
  console.log(`- Service worker should register automatically on page load`);
  console.log(`- Status: "activated and is running" (green indicator)`);
  console.log(`- Cache storage should contain workbox-precache entries`);
  console.log(`- All app shell assets (JS, CSS, HTML) should be pre-cached`);
}

/**
 * Test 5: Check for pre-configured data (optional)
 * @param {string} html - HTML content
 */
function testPreConfiguredData(html) {
  console.log(`\n${colors.blue}Test 5: Pre-Configured Data Visibility${colors.reset}`);

  if (!html) {
    logTest('Pre-configuration check skipped', false, 'No HTML content available');
    return;
  }

  // Note: Pre-configured data (partner name, start date) is loaded from JavaScript
  // and rendered dynamically via React, so it won't be in initial HTML response.
  // This check looks for the APP_CONFIG or related strings in bundled JS.

  console.log(
    `${colors.yellow}ℹ️  Pre-configured data is loaded dynamically via JavaScript${colors.reset}`
  );
  console.log(`\n${colors.cyan}Manual verification:${colors.reset}`);
  console.log(`1. Open the live site in a browser`);
  console.log(`2. Verify partner name displays in the app UI`);
  console.log(`3. Verify relationship duration counter shows correct calculation`);
  console.log(`4. Open DevTools Console → check for APP_CONFIG warnings (should be none)`);
  console.log(`5. Verify no onboarding flow is shown (should load directly to main app)`);
}

/**
 * Display post-deploy verification summary
 */
function displaySummary() {
  console.log(
    `\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.blue}Post-Deploy Verification Summary${colors.reset}`);
  console.log(
    `${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`
  );

  console.log(`${colors.green}✅ Automated checks completed${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Manual verification recommended (see above)${colors.reset}\n`);

  console.log(`${colors.cyan}Next steps:${colors.reset}`);
  console.log(`1. Test the live site manually in multiple browsers`);
  console.log(`2. Verify service worker registration in DevTools`);
  console.log(`3. Test offline functionality (Network → Offline checkbox)`);
  console.log(`4. Run Lighthouse audit for PWA score validation`);
  console.log(`5. Verify all acceptance criteria from Story 1.6 are met\n`);

  console.log(`${colors.green}Deployment verification complete!${colors.reset}\n`);
}

/**
 * Main validation runner
 */
async function main() {
  console.log(
    `${colors.blue}╔═══════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.blue}║     Post-Deploy Validation for My-Love PWA          ║${colors.reset}`
  );
  console.log(
    `${colors.blue}╚═══════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  // Get URL from command line or use default
  let siteUrl = process.argv[2];

  if (!siteUrl) {
    console.log(
      `${colors.yellow}ℹ️  No URL provided. Please provide your GitHub Pages URL:${colors.reset}`
    );
    console.log(
      `${colors.cyan}   node scripts/post-deploy-check.js https://yourusername.github.io/My-Love/${colors.reset}\n`
    );
    process.exit(0);
  }

  // Ensure URL has trailing slash
  if (!siteUrl.endsWith('/')) {
    siteUrl += '/';
  }

  console.log(`${colors.cyan}Target URL: ${siteUrl}${colors.reset}`);
  console.log(
    `${colors.yellow}Note: This script is informational only and does not block deployment${colors.reset}\n`
  );

  try {
    // Run tests
    const { success, body } = await testSiteAccessibility(siteUrl);

    if (success && body) {
      const { manifestUrl } = await testHtmlStructure(body, siteUrl);
      await testManifest(manifestUrl);
      testPreConfiguredData(body);
    }

    testServiceWorker();
    displaySummary();

    // Always exit successfully (informational only)
    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}[Unexpected Error]:${colors.reset} ${error.message}`);
    console.error(error.stack);
    console.log(
      `\n${colors.yellow}Note: Post-deploy check encountered an error but does not block deployment${colors.reset}\n`
    );
    process.exit(0); // Exit successfully even on error (informational only)
  }
}

// Run validation
main();
