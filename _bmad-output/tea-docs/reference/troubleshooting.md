# TEA Troubleshooting Guide

## Overview
This comprehensive troubleshooting guide addresses common issues when using TEA (Test Engineering Architect), organized into nine major categories with step-by-step solutions.

## Installation Issues

### TEA Module Not Found After Installation
**Problem**: TEA agent unavailable after running `npx bmad-method install`

**Root causes**:
- TEA wasn't selected during setup
- Installation process encountered silent failures
- `_bmad/tea/` directory creation failed

**Resolution steps**:
1. Verify installation by checking directory structure: `ls -la _bmad/tea/` (should contain agents/, workflows/, testarch/, module.yaml)
2. Reinstall if missing: `npx bmad-method install` and explicitly select Test Architect
3. Run verbose installation mode to capture error details: `npx bmad-method install --verbose`

### Installing TEA Behind Corporate Firewall
For environments with network restrictions, configure the installer to use a local Git repository or internal mirror:

1. Clone TEA locally (or access internal mirror)
2. Edit `BMAD-METHOD/tools/cli/external-official-modules.yaml`
3. Update TEA entry URL to local path: `url: /path/to/local/bmad-method-test-architecture-enterprise`
4. Run installer normally

**Key point**: The `url:` field accepts both filesystem paths and internal Git mirror URLs.

### Module Installation Hangs
**Symptoms**: Installation process stalls or times out

**Diagnostic checks**:
- Network connectivity: `ping registry.npmjs.org`
- Available disk space: `df -h`
- NPM cache status

**Fixes**:
- Clear cache: `npm cache clean --force` then retry
- Switch registry: `npm config set registry https://registry.npmjs.org/`

## Agent Loading Issues

### "Agent Not Found" Error
Error message: "Agent '_bmad/tea' not found" or "Agent 'tea' could not be loaded"

**Troubleshooting path**:
1. Confirm agent file: `ls -la _bmad/tea/agents/tea.agent.yaml`
2. Validate YAML syntax using schema validation tools
3. Perform clean reinstall if corruption suspected

### TEA Loads But Commands Don't Work
Workflows fail to execute despite successful agent loading

**Investigation**:
1. Verify workflow directories exist: `ls -la _bmad/tea/workflows/testarch/`
2. Check YAML validity in each workflow file
3. Test workflow trigger with full command syntax: `/bmad:tea:test-design`

## Workflow Execution Issues

### Workflow Produces No Output
Executes without generating expected artifacts (test designs, reports, generated code)

**Causes and solutions**:
- Output directory missing or lacks write permissions -> Create with `mkdir -p test-results`
- `test_artifacts` variable not configured -> Check `cat _bmad/tea/module.yaml | grep test_artifacts`
- Workflow didn't complete all steps -> Review Claude's response for completion indicators

### Subprocess Fails to Execute
Workflow reports subprocess failure during execution

**Key checks**:
- Subprocess step files present: `ls -la _bmad/tea/workflows/testarch/automate/steps-c/step-03*.md`
- Temp file directory writable: Check permissions in `/tmp/`
- Error messages in subprocess output -> Review Claude's detailed response

### Knowledge Fragments Not Loading
Workflow executes but doesn't reference knowledge patterns

**Validation steps**:
1. Verify index file: `cat _bmad/tea/testarch/tea-index.csv | wc -l` (should show 35 lines)
2. Check fragment files: `ls -la _bmad/tea/testarch/knowledge/` (expect 34+ files)
3. Validate CSV format includes: fragment_id, title, description, tags, file_path columns
4. Confirm workflow manifest specifies knowledge_fragments

## Configuration Issues

### Variables Not Prompting During Installation
Installation completes without requesting TEA configuration parameters

**Remedies**:
- Check prompt settings: `cat _bmad/tea/module.yaml | grep -A 3 "test_artifacts"`
- Run interactive mode explicitly: `npx bmad-method install --interactive`
- Manually edit module.yaml if automated prompts fail

### Playwright Utils Integration Not Working
Workflows omit Playwright Utils references despite enabled variable

**Diagnostic approach**:
1. Verify setting: `cat _bmad/tea/module.yaml | grep tea_use_playwright_utils`
2. Check fragment availability: `grep -i "playwright-utils" _bmad/tea/testarch/tea-index.csv`
3. **Note**: Only these workflows support integration: Framework (TF), Test Design (TD), ATDD (AT), Automate (TA), Test Review (RV); CI, Trace, and NFR-Assess do not

## Output and File Issues

### Test Files Generated in Wrong Location
Files appear in unexpected directories

**Correction path**:
- Verify configuration: `cat _bmad/tea/module.yaml | grep test_artifacts`
- Use absolute paths rather than relative paths
- Confirm working directory: `pwd` (should be project root)

### Generated Tests Have Syntax Errors
Tests contain JavaScript/TypeScript syntax problems

**Solutions**:
- Specify framework explicitly in prompt: "Generate Playwright tests using TypeScript"
- Validate with linting: `npx eslint tests/**/*.spec.ts`
- Audit knowledge fragments for syntax issues

### File Permission Errors
"EACCES: permission denied" when writing files

**Fixes**:
- Examine permissions: `ls -la test-results/`
- Correct ownership: `chmod -R u+w test-results/`
- Verify disk availability: `df -h`

## Integration Issues

### Playwright Utils Not Found
Tests reference utilities but imports fail

**Resolution**:
1. Install package: `npm install @seontechnologies/playwright-utils`
2. Verify installation: `npm ls @seontechnologies/playwright-utils`
3. Validate import statements: Should use `import { expect, test } from '@seontechnologies/playwright-utils'`

### MCP Enhancements Not Applying
MCP variable enabled but features absent from outputs

**Configuration checks**:
- Verify Claude Desktop configuration includes MCP server definitions
- Check variable setting in module.yaml
- Restart Claude Desktop after configuration changes

## Performance Issues

### Workflows Taking Too Long
Processes run for multiple minutes without completion

**Optimization strategies**:
- Scope workflows to specific directories instead of entire codebase
- Use targeted workflows (automate for specific generation, test-review on selected files)
- Monitor system resources: `top` (check CPU and memory usage)

### Large Knowledge Base Loading Slowly
Initial workflow load exceeds 30 seconds

**Context**: This is expected behavior as knowledge base loads comprehensively on first execution per workflow. Performance improves on subsequent runs due to caching.

## Getting Help

### Debug Mode
Enable detailed logging: `export DEBUG=bmad:tea:*`

### Diagnostic Information to Collect
When reporting issues, gather:
- TEA version: `cat _bmad/tea/module.yaml | grep version`
- BMAD Method version: `bmad --version`
- Node version: `node --version` (should be >=20.0.0)
- Operating system: `uname -a`
- Directory structure: `tree -L 2 _bmad/tea/`
- Complete error messages and stack traces
- Exact reproduction steps

### Support Resources
1. Documentation: test-architect.bmad-method.org
2. Bug reports: GitHub Issues
3. Questions: GitHub Discussions
4. Migration issues: MIGRATION.md documentation

### Pre-Report Checklist
Verify before opening issues:
- TEA installation exists: `ls -la _bmad/tea/`
- Correct command namespace used: `/bmad:tea:*`
- module.yaml present and valid
- Knowledge base complete (34 fragments)
- Output directory writable
- Sufficient disk space
- Node version requirements met
- Existing issue search performed

## Common Error Messages and Fixes

| Error | Solution |
|-------|----------|
| "Module 'tea' not found" | Reinstall via `npx bmad-method install` |
| "Knowledge fragment 'test-quality' not found" | Verify `_bmad/tea/testarch/tea-index.csv` exists and contains fragment |
| "Cannot write to test-results/" | Create directory and fix permissions: `mkdir -p test-results && chmod u+w test-results` |
| "Workflow 'test-design' failed at step 3" | Confirm step file exists: `_bmad/tea/workflows/testarch/test-design/steps-c/step-03-*` |
| "Agent YAML validation failed" | Validate syntax with schema validation tools |
| "Subprocess execution timeout" | Large codebases may exceed limits; scope workflow to smaller target |

## Advanced Troubleshooting

### Manual Validation Script
Comprehensive bash script checks all installation components:
```bash
#!/bin/bash
echo "Validating TEA Installation..."

# Agent file check
if [ -f "_bmad/tea/agents/tea.agent.yaml" ]; then
  echo "Agent file exists"
else
  echo "Agent file missing"
fi

# Workflow validation
for workflow in atdd automate ci framework nfr-assess test-design test-review trace; do
  if [ -f "_bmad/tea/workflows/testarch/$workflow/workflow.yaml" ]; then
    echo "Workflow: $workflow"
  else
    echo "Workflow missing: $workflow"
  fi
done

# Knowledge base count
fragment_count=$(ls _bmad/tea/testarch/knowledge/*.md 2>/dev/null | wc -l)
echo "Knowledge fragments: $fragment_count (expected: 34)"

# Index file validation
csv_lines=$(wc -l < _bmad/tea/testarch/tea-index.csv 2>/dev/null || echo "0")
echo "TEA index lines: $csv_lines (expected: 35)"

echo "Validation complete!"
```

### Complete Reset to Fresh State
```bash
# Backup current configuration
cp _bmad/tea/module.yaml /tmp/tea-module-backup.yaml

# Remove existing installation
rm -rf _bmad/tea/

# Reinstall completely
npx bmad-method install
# Select: Test Architect (TEA)

# Restore configuration if needed
cp /tmp/tea-module-backup.yaml _bmad/tea/module.yaml
```
