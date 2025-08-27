import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('should be defined', () => {
    expect(App).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof App).toBe('function');
  });
});
