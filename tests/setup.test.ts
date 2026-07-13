import { describe, it, expect } from 'vitest';

describe('test setup', () => {
  it('vitest runs with jsdom environment', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });
});
