import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { PluginContext } from '@opencode-ai/plugin';
import plugin from './index.js';

describe('context plugin', () => {
  let tmpDir: string;
  let client: any;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `context-plugin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, '.git'), { recursive: true });

    client = {
      app: {
        log: vi.fn(),
      },
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns the config hook', async () => {
    const hooks = (await plugin({
      directory: tmpDir,
      client,
    } as PluginContext)) as any;

    expect(hooks).toBeDefined();
    expect(Object.keys(hooks)).toEqual(['config']);
  });

  it('scaffolds .context/ on first run', async () => {
    await plugin({
      directory: tmpDir,
      client,
    } as PluginContext);

    expect(client.app.log).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          message: expect.stringContaining('Scaffold created at'),
        }),
      })
    );
  });
});
