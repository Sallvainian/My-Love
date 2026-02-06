# Enable TEA MCP Enhancements

## Overview

This guide explains how to configure Model Context Protocol (MCP) servers to enable live browser verification, exploratory mode, and recording mode in TEA workflows.

## What are MCP Enhancements?

MCP servers enable AI agents to interact with live browsers during test generation. Key capabilities include:

- Interactive UI exploration for discovering actual functionality
- Selector verification by generating accurate locators from real DOM
- Behavior validation against live applications
- Visual debugging using trace viewer and screenshots

## When to Use This

### For UI Testing:
- Exploratory mode in `test-design` for browser-based UI discovery
- Recording mode in `atdd` or `automate` to verify selectors with live browser
- Healing mode in `automate` for fixing tests with visual debugging
- Need for accurate selectors from actual DOM
- Debugging complex UI interactions

### For API Testing:
- Healing mode in `automate` to analyze failures with trace data
- Debugging test failures involving network responses and timing
- Inspecting trace files for network traffic and race conditions

### For Both:
- Visual debugging with trace viewer showing network and UI data
- Test failure analysis with MCP running tests and extracting errors
- Understanding complex failures combining network and DOM information

**Don't use if:** MCP servers aren't configured.

## Prerequisites

- BMad Method installed
- TEA agent available
- IDE with MCP support (Cursor, VS Code with Claude extension)
- Node.js v18 or later
- Playwright installed

## Available MCP Servers

Two actively maintained Playwright MCP servers are available:

### 1. Playwright MCP - Browser Automation

**Command:** `npx @playwright/mcp@latest`

**Capabilities:**
- Navigate to URLs
- Click elements
- Fill forms
- Take screenshots
- Extract DOM information

**Best for:** Exploratory and recording modes

### 2. Playwright Test MCP - Test Runner

**Command:** `npx playwright run-test-mcp-server`

**Capabilities:**
- Run test files
- Analyze failures
- Extract error messages
- Show trace files

**Best for:** Healing mode and debugging

### Recommended: Configure Both

Both servers work together to provide complete TEA MCP functionality.

## Setup

### 1. Configure MCP Servers

Add to your IDE's MCP configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "playwright-test": {
      "command": "npx",
      "args": ["playwright", "run-test-mcp-server"]
    }
  }
}
```

Refer to TEA Overview for IDE-specific configuration file locations.

### 2. Enable in BMAD

Answer "Yes" when prompted during installation, or set in `_bmad/tea/config.yaml`:

```yaml
tea_use_mcp_enhancements: true
```

### 3. Verify MCPs Running

Ensure MCP servers are running in your IDE.

## How MCP Enhances TEA Workflows

### test-design: Exploratory Mode

**Without MCP:**
- TEA infers UI functionality from documentation
- Relies on user descriptions of features
- May miss actual UI behavior

**With MCP:** TEA opens live browser to explore functionality. Example workflow:

- Navigate to target page
- Take screenshots
- Extract accessible elements
- Discover actual UI structure and interactions
- Design tests based on real functionality

**Benefits:**
- Test design based on actual UI
- Discovery of undocumented features
- Validation that test scenarios are possible

### atdd: Recording Mode

**Without MCP:**
- TEA generates selectors from best practices
- Infers API patterns from documentation

**With MCP:**

**For UI Tests:**
- Navigate to form with live browser
- Inspect actual field labels and attributes
- Use exact selectors from real DOM
- Ensure tests work on first run

**For API Tests:**
- Analyze trace files from test runs
- Inspect network requests and responses
- Validate request/response patterns
- Confirm required headers and data structures

**Benefits:**
- UI: Accurate selectors from real DOM
- API: Validated request/response patterns from trace data
- Both: Tests work on first run

### automate: Healing + Recording Modes

**Without MCP:**
- TEA analyzes test code only
- Suggests fixes based on static analysis
- Generates tests from documentation/code

**With MCP:**

**Healing Mode (UI + API):**
- Open trace files
- Analyze screenshots and network tab
- Identify actual changes (selector updates, API response structure changes)
- Verify fixes with trace analysis

**Recording Mode (UI + API):**
- Inspect actual DOM for verified selectors
- Analyze network traffic for request/response patterns
- Generate tests with verified patterns
- Verify tests work on first run

**Benefits:**
- Visual debugging combined with trace analysis
- Verified selectors for UI and network patterns for API
- Tests verified against actual application behavior

## Usage Examples

### Exploratory Mode Example

User initiates test design for checkout flow:

```
User: Run test-design
TEA: What feature are you designing tests for?
User: The checkout flow at https://shop.example.com
TEA: [With MCP] Let me explore the checkout flow
[Opens browser, navigates, takes screenshots, identifies elements]
TEA: I've explored the checkout flow. I found:
- 4-step wizard (Cart -> Shipping -> Payment -> Confirm)
- Shipping options (Standard, Express, Overnight)
- Payment methods (Credit Card, PayPal)
- Promo code field
- Order summary with real-time totals
Test design will cover all these scenarios.
```

### Recording Mode Example

User runs ATDD for user registration:

```
User: Run atdd for user registration feature
TEA: [With MCP] Let me verify the registration form selectors
[Opens browser at /register, inspects form]
TEA: I see the actual form has:
- "Full Name" label (not "Name")
- "Email Address" label (not "Email")
- "Create Password" label (not "Password")
- "I agree to Terms" checkbox
- "Create Account" button (not "Register")
Generating tests with verified selectors...
```

### Healing Mode Example

User runs automate with healing enabled:

```
User: Run automate with healing mode
TEA: [With MCP] Running tests and checking for failures
[Runs test suite, test fails on selector]
TEA: Test failed on selector '.submit-btn'
[Opens trace viewer, sees button class changed to '.submit-button']
Fixing selector and verifying...
[Updates test, re-runs with MCP, test passes]
Updated test with corrected selector.
```

## Troubleshooting

### MCP Servers Not Running

**Problem:** TEA indicates MCP enhancements aren't available.

**Causes:**
1. MCP servers not configured in IDE
2. Config syntax error in JSON
3. IDE not restarted after configuration

**Solution:**
```bash
# Verify MCP config file exists
ls ~/.cursor/config.json

# Validate JSON syntax
cat ~/.cursor/config.json | python -m json.tool

# Restart IDE (Cmd+Q then reopen)
```

### Browser Doesn't Open

**Problem:** MCP enabled but browser never opens.

**Causes:**
1. Playwright browsers not installed
2. Headless mode enabled
3. MCP server crashed

**Solution:**
```bash
# Install browsers
npx playwright install

# Check MCP server logs in IDE for error messages

# Try manual MCP server
npx @playwright/mcp@latest
# Should start without errors
```

### TEA Doesn't Use MCP

**Problem:** Config shows `tea_use_mcp_enhancements: true` but TEA doesn't use browser.

**Causes:**
1. Config not saved
2. Workflow run before config update
3. MCP servers not running

**Solution:**
```bash
# Verify config
grep tea_use_mcp_enhancements _bmad/tea/config.yaml
# Should show: tea_use_mcp_enhancements: true

# Restart IDE to reload MCP servers

# Start fresh chat (TEA loads config at start)
```

### Selector Verification Fails

**Problem:** MCP can't find elements TEA is looking for.

**Causes:**
1. Page not fully loaded
2. Element behind modal or overlay
3. Element requires authentication

**Solution:** TEA handles this automatically with page load waits, modal dismissal, and authentication handling. For persistent issues, provide additional context to TEA about modal locations or authentication requirements.

### MCP Slows Down Workflows

**Problem:** Workflows take much longer with MCP enabled.

**Cause:** Browser automation adds overhead.

**Solution:** Use MCP selectively:

- **Enable for:** Complex UIs, new projects, debugging
- **Disable for:** Simple features, well-known patterns, API-only testing

Toggle in configuration:
```yaml
# For complex UI feature
tea_use_mcp_enhancements: true

# For simple API feature
tea_use_mcp_enhancements: false
```

## Related Guides

**Getting Started:**
- TEA Lite Quickstart Tutorial - Learn TEA basics

**Workflow Guides (MCP-Enhanced):**
- How to Run Test Design - Exploratory mode with browser
- How to Run ATDD - Recording mode for accurate selectors
- How to Run Automate - Healing mode for debugging

**Other Customization:**
- Integrate Playwright Utils - Production-ready utilities

## Understanding the Concepts

- TEA Overview - MCP enhancements in lifecycle
- Engagement Models - When to use MCP enhancements

## Reference

- TEA Configuration - tea_use_mcp_enhancements option
- TEA Command Reference - MCP-enhanced workflows
- Glossary - MCP Enhancements term
