import * as matchers from '@testing-library/jest-dom/matchers';

import { afterEach, beforeEach, expect, vi } from 'vitest';

import { cleanup } from '@testing-library/react';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock localStorage globally for all tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Make localStorage mock available globally
(globalThis as unknown as { localStorageMock: typeof localStorageMock }).localStorageMock = localStorageMock;

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Reset localStorage mock before each test
beforeEach(() => {
  vi.clearAllMocks();
});
