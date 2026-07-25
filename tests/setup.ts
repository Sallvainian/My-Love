/**
 * Vitest Test Setup
 *
 * This file runs before each unit test.
 * Configure global mocks and setup here.
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

/**
 * happy-dom compatibility shim: spec-correct `nodeName` on `Node.prototype`.
 *
 * Per WebIDL, `nodeName` is an attribute of the `Node` interface, so
 * `Node.prototype`'s getter must return the correct name for every node type.
 * happy-dom only implements it on `Element.prototype`; the `Node.prototype`
 * getter returns '' for elements. jsdom and real browsers are correct.
 *
 * DOMPurify >= 3.4.8 reads the tag name through the cached `Node.prototype`
 * getter (DOM-clobbering hardening). Under happy-dom every element therefore
 * resolves to tagName '', so the FORBID_CONTENTS lookup misses and the text
 * inside <script>/<style>/<title>/<iframe> is hoisted into the sanitized
 * output instead of being dropped. Production is unaffected — this was verified
 * to be a test-environment artifact only. Remove this shim once happy-dom
 * defines nodeName on Node.prototype.
 *
 * Must live in setupFiles: DOMPurify caches the getter at module-evaluation time.
 */
const nodeNameDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeName');
if (
  nodeNameDescriptor?.get &&
  nodeNameDescriptor.get.call(document.createElement('div')) !== 'DIV'
) {
  const baseGetter = nodeNameDescriptor.get;
  Object.defineProperty(Node.prototype, 'nodeName', {
    configurable: true,
    enumerable: nodeNameDescriptor.enumerable ?? true,
    get(this: Node): string {
      // Delegate to the most-derived implementation (Element, Attr, Document, ...)
      let proto: object | null = Object.getPrototypeOf(this);
      while (proto && proto !== Node.prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'nodeName');
        if (descriptor?.get) return descriptor.get.call(this) as string;
        proto = Object.getPrototypeOf(proto);
      }
      return baseGetter.call(this) as string;
    },
  });
}

// Mock IndexedDB for unit tests
import 'fake-indexeddb/auto';

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (for virtualized lists)
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver (for responsive components)
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Suppress console.error in tests (optional - remove if you want to see errors)
// vi.spyOn(console, 'error').mockImplementation(() => {});
