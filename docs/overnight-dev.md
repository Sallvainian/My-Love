# Overnight Development Setup

This project uses Git hooks to enforce TDD (Test-Driven Development) practices and maintain code quality through overnight autonomous development sessions.

## Quick Start

### 1. Install the Git Hooks

```bash
./scripts/install-git-hooks.sh
```

This installs two hooks:

- **pre-commit**: Runs linting and tests before each commit
- **commit-msg**: Enforces conventional commit message format

### 2. Configuration

The hooks are configured via `.overnight-dev.json`:

```json
{
  "testCommand": "npm run test:unit",
  "lintCommand": "npm run lint",
  "requireCoverage": false,
  "minCoverage": 80,
  "autoFix": true,
  "maxAttempts": 50,
  "stopOnMorning": true,
  "morningHour": 7,
  "allowFailingTests": false
}
```

### 3. How It Works

1. **Write code** → Tests and implementation
2. **Try to commit** → Hooks run automatically
3. **Tests fail?** → Commit blocked, must fix
4. **Tests pass?** → Commit succeeds ✅
5. **Repeat** → Until feature complete

## Commit Message Format

The `commit-msg` hook enforces conventional commit format:

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build
```

**Examples:**

```bash
git commit -m "feat(auth): add JWT authentication"
git commit -m "fix(ui): correct button alignment"
git commit -m "test: add unit tests for user service"
git commit -m "docs: update API documentation"
```

## Pre-Commit Checks

The `pre-commit` hook runs:

1. **Linting** with auto-fix (if enabled)
   - Runs: `npm run lint:fix` or `npm run lint`
   - Blocks commit if linting fails

2. **Unit Tests**
   - Runs: `npm run test:unit`
   - Blocks commit if tests fail

3. **Coverage Check** (if enabled)
   - Runs: `npm run test:unit:coverage`
   - Checks against minimum coverage threshold

## Configuration Options

| Option              | Type    | Default               | Description                                        |
| ------------------- | ------- | --------------------- | -------------------------------------------------- |
| `testCommand`       | string  | `"npm run test:unit"` | Command to run tests                               |
| `lintCommand`       | string  | `"npm run lint"`      | Command to run linter                              |
| `requireCoverage`   | boolean | `false`               | Require coverage checks                            |
| `minCoverage`       | number  | `80`                  | Minimum coverage percentage                        |
| `autoFix`           | boolean | `true`                | Auto-fix linting issues                            |
| `maxAttempts`       | number  | `50`                  | Max commit attempts                                |
| `stopOnMorning`     | boolean | `true`                | Stop work at morning hour                          |
| `morningHour`       | number  | `7`                   | Hour to stop (0-23)                                |
| `allowFailingTests` | boolean | `false`               | Allow commits with failing tests (NOT recommended) |

## Troubleshooting

### "Hooks not executing"

Make sure hooks are executable:

```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg
```

Or reinstall:

```bash
./scripts/install-git-hooks.sh
```

### "Tests failing immediately"

Check that you have at least 1 passing test:

```bash
npm run test:unit
```

### "Linting errors blocking commits"

Enable auto-fix in `.overnight-dev.json`:

```json
{
  "autoFix": true
}
```

Or fix manually:

```bash
npm run lint:fix
```

### "Want to bypass temporarily"

**NOT RECOMMENDED**, but for emergency fixes:

Set in `.overnight-dev.json`:

```json
{
  "allowFailingTests": true
}
```

Remember to set it back to `false` after fixing issues!

## Best Practices

1. **Start with clear goals** - Specific, testable objectives
2. **Have existing tests** - At least 1 passing test before starting
3. **Use TDD** - Write tests first, then implementation
4. **Commit frequently** - Small, passing commits
5. **Trust the process** - Hooks enforce quality automatically

## Overnight Development Sessions

### Starting a Session

1. Define your goal:

   ```
   Task: Implement user profile editing
   Success: All tests pass, coverage > 85%
   ```

2. Follow TDD:
   - Write test first
   - Implement feature
   - Commit (hooks ensure quality)

3. Let hooks enforce quality:
   - Every commit must pass tests
   - Every commit needs good message
   - No compromises!

### Morning Review

Check overnight progress:

```bash
git log --oneline --since="yesterday"
```

Review test coverage:

```bash
npm run test:unit:coverage
```

## Files

- **`.overnight-dev.json`** - Configuration
- **`scripts/git-hooks/`** - Hook source files
- **`scripts/install-git-hooks.sh`** - Installation script
- **`.git/hooks/`** - Active hooks (local, not tracked)
