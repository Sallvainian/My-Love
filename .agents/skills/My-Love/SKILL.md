```markdown
# My-Love Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the **My-Love** repository, a React project written in TypeScript. You'll learn the project's file organization, code style, commit message habits, and how to write and locate tests. This guide ensures consistency and clarity for contributors.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `userProfile.tsx`, `loveCalculator.ts`

### Import Style
- Use **relative imports** for internal modules.
  ```typescript
  import { LoveCalculator } from './loveCalculator';
  import { UserProfile } from '../components/userProfile';
  ```

### Export Style
- Use **named exports** only.
  ```typescript
  // loveCalculator.ts
  export function LoveCalculator() { /* ... */ }

  // userProfile.tsx
  export const UserProfile = () => { /* ... */ }
  ```

### Commit Messages
- Commit messages are mostly freeform, with some using the `deps` prefix for dependency updates.
  - Example: `deps: update react to 18.2.0`
  - Example: `Fix love calculation bug`

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- **Test files** follow the `*.test.*` naming convention.
  - Example: `loveCalculator.test.ts`
- **Testing framework** is unknown; check existing test files for framework clues.
- To write a test:
  1. Create a file named after the module, with `.test.ts` or `.test.tsx` suffix.
  2. Use the same relative import and export conventions as production code.
  3. Place test files alongside the code or in a dedicated `__tests__` directory (check repo structure).

  ```typescript
  // loveCalculator.test.ts
  import { LoveCalculator } from './loveCalculator';

  describe('LoveCalculator', () => {
    it('returns 100 for perfect match', () => {
      expect(LoveCalculator('Romeo', 'Juliet')).toBe(100);
    });
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /test   | Run all test files matching `*.test.*` |
| /deps   | Update dependencies (use when making dependency changes) |
```