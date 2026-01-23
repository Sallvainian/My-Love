# TypeScript Patterns Guide

> Extended TypeScript 5.x patterns for the My-Love project

*Last Updated: January 2026*

---

## Strict Mode Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

---

## Type Guards

### Discriminated Unions for API Responses

```typescript
type Success<T> = { status: 'success'; data: T };
type Failure = { status: 'error'; error: string };
type Result<T> = Success<T> | Failure;

function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.status === 'success';
}

// Usage
const result = await fetchData();
if (isSuccess(result)) {
  console.log(result.data); // TypeScript knows data exists
} else {
  console.error(result.error); // TypeScript knows error exists
}
```

### Custom Type Guards

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
```

---

## Null Handling Patterns

### Optional Chaining and Nullish Coalescing

```typescript
// Always use optional chaining for nested access
const email = user?.profile?.email ?? 'default@example.com';

// Type-safe null checks
function processUser(user: User | null): void {
  if (user === null) {
    throw new Error('User is required');
  }
  console.log(user.name); // TypeScript knows user is not null
}
```

### Array Access with noUncheckedIndexedAccess

```typescript
const items = ['a', 'b', 'c'];

// With noUncheckedIndexedAccess, this returns string | undefined
const first = items[0];

// Safe access patterns
const safeFirst = items.at(0); // string | undefined (explicit)

// With bounds checking
if (items.length > 0) {
  const definitelyFirst = items[0]!; // Use assertion only after check
}
```

---

## Template Literal Types

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiRoute = `/api/${string}`;
type TypedRoute = `${HttpMethod} ${ApiRoute}`;

// Usage
const route: TypedRoute = 'GET /api/users'; // Valid
// const invalid: TypedRoute = 'PATCH /api/users'; // Error!
```

---

## Utility Type Patterns

### Conditional Types

```typescript
type ExtractArrayType<T> = T extends (infer U)[] ? U : never;
type StringArray = ExtractArrayType<string[]>; // string

type Awaited<T> = T extends Promise<infer U> ? U : T;
type ResolvedData = Awaited<Promise<User>>; // User
```

### Mapped Types

```typescript
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Optional<T> = { [K in keyof T]?: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] };

// Make specific keys optional
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
```

---

## Generic Patterns

### Constrained Generics

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

### Default Type Parameters

```typescript
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  timestamp: Date;
}

// Can use without specifying type
const response: ApiResponse = { data: {}, status: 200, timestamp: new Date() };
```

---

## Best Practices Checklist

- [ ] Enable all strict mode flags in tsconfig.json
- [ ] Use `unknown` instead of `any` for truly unknown types
- [ ] Create type guards for runtime type checking
- [ ] Use discriminated unions for API responses
- [ ] Handle `null` and `undefined` explicitly
- [ ] Use template literal types for string patterns
- [ ] Prefer `readonly` arrays and objects when mutation isn't needed
- [ ] Use `as const` for literal type inference

---

*See also: [CLAUDE.md](../CLAUDE.md) for quick reference*
