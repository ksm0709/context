import { describe, it, expect } from 'vitest';
import { onHookEvent } from './index.js';

describe('onHookEvent', () => {
  it('is a no-op and resolves without error', async () => {
    await expect(onHookEvent()).resolves.toBeUndefined();
  });
});
