---
name: testing
description: |
  Unit testing guidelines for passport project.
  Use when: writing tests, creating test files, testing new code, modifying tests, understanding test patterns, ensuring test coverage.
---

# Testing

Unit testing configuration and patterns for passport.

## Stack

- **Framework**: Vitest
- **Environment**: Node

## Commands

```bash
pnpm test:unit      # Run tests in watch mode
pnpm test:unit:ci   # Run tests once (CI mode)
```

## Test Coverage Requirements

- When adding new code, write corresponding unit tests.
- When modifying existing code, update related tests to reflect the changes.

## File Structure

Test files are located in `__tests__` directories alongside the code they test.

Naming convention: `*.test.ts`

Example:
```
src/lib/
├── crypto.ts
├── twitch.ts
└── __tests__/
    ├── crypto.test.ts
    └── twitch.test.ts
```

## Test Patterns

- Use `describe` to group tests by function/module
- Use `it` for individual test cases
- Import from `vitest`: `describe`, `it`, `expect`

### Common Assertions

- `toHaveLength(n)` - Check string/array length
- `toBe(value)` / `not.toBe(value)` - Strict equality
- `toMatch(/regex/)` - Match regex pattern
- `toBeInstanceOf(Type)` - Check instance type
- `toBeGreaterThan(n)` / `toBeLessThan(n)` - Numeric comparison

## References

- [references/examples.md](references/examples.md) - Test code examples
