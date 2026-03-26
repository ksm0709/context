import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import {
  detectPackageManager,
  isGloballyInstalled,
  isOmxInstalled,
  isOmcInstalled,
  runUpdate,
  runUpdatePlugin,
} from './update.js';

vi.mock('../../lib/scaffold.js', () => ({
  updateScaffold: vi.fn().mockReturnValue([]),
}));

vi.mock('./install.js', () => ({
  installOmc: vi.fn(),
  installOmx: vi.fn(),
  resolveOmxSource: vi.fn().mockReturnValue('/mock/dist/omx/index.mjs'),
}));
import { readClaudeSettings } from '../../shared/claude-settings.js';
import { updateScaffold } from '../../lib/scaffold.js';
import { installOmc, installOmx } from './install.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('../../shared/claude-settings.js', () => ({
  hasContextMcpServer: vi.fn((settings) => {
    const mcpServers = settings?.mcpServers ?? {};
    return 'context-mcp' in mcpServers || 'context_mcp' in mcpServers;
  }),
  readClaudeSettings: vi.fn().mockReturnValue({}),
}));

describe('detectPackageManager', () => {
  it('returns bun when bun.lock exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'bun.lock');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns bun when bun.lockb exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'bun.lockb');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns pnpm when pnpm-lock.yaml exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'pnpm-lock.yaml');
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('returns yarn when yarn.lock exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'yarn.lock');
    expect(detectPackageManager()).toBe('yarn');
  });

  it('returns npm when package-lock.json exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'package-lock.json');
    expect(detectPackageManager()).toBe('npm');
  });

  it('defaults to bun when no lock file found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(detectPackageManager()).toBe('bun');
  });
});

describe('isGloballyInstalled', () => {
  it('returns true when ~/.bun/bin/context exists', () => {
    const home = process.env.HOME ?? '/home/user';
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => String(path) === `${home}/.bun/bin/context`
    );
    expect(isGloballyInstalled()).toBe(true);
  });

  it('returns false when ~/.bun/bin/context does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(isGloballyInstalled()).toBe(false);
  });
});

describe('isOmxInstalled', () => {
  it('returns true when projectDir/.omx/hooks/context.mjs exists', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => String(path) === '/my/project/.omx/hooks/context.mjs'
    );
    expect(isOmxInstalled('/my/project')).toBe(true);
  });

  it('returns false when projectDir/.omx/hooks/context.mjs does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(isOmxInstalled('/my/project')).toBe(false);
  });
});

describe('isOmcInstalled', () => {
  it('returns true when settings has context-mcp server', () => {
    vi.mocked(readClaudeSettings).mockReturnValue({
      mcpServers: { 'context-mcp': { command: 'bun', args: ['mcp.js'] } },
    });
    expect(isOmcInstalled()).toBe(true);
  });

  it('returns false when settings has no mcpServers', () => {
    vi.mocked(readClaudeSettings).mockReturnValue({});
    expect(isOmcInstalled()).toBe(false);
  });

  it('returns true when settings has legacy context_mcp server', () => {
    vi.mocked(readClaudeSettings).mockReturnValue({
      mcpServers: { context_mcp: { command: 'bun', args: ['mcp.js'] } },
    });
    expect(isOmcInstalled()).toBe(true);
  });

  it('returns false when settings has other MCP servers but not context-mcp', () => {
    vi.mocked(readClaudeSettings).mockReturnValue({
      mcpServers: { 'other-mcp': { command: 'node', args: ['other.js'] } },
    });
    expect(isOmcInstalled()).toBe(false);
  });

  it('returns false when readClaudeSettings throws', () => {
    vi.mocked(readClaudeSettings).mockImplementation(() => {
      throw new Error('file not found');
    });
    expect(isOmcInstalled()).toBe(false);
  });
});

describe('runUpdate', () => {
  beforeEach(() => {
    vi.mocked(updateScaffold).mockReturnValue([]);
    vi.mocked(installOmc).mockClear();
    vi.mocked(installOmx).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats omx as an explicit subcommand and skips omc reinstall', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => String(path) === '/my/project/.omx/hooks/context.mjs'
    );
    vi.mocked(readClaudeSettings).mockReturnValue({
      mcpServers: { context_mcp: { command: 'bun', args: ['mcp.js'] } },
    });

    runUpdate(['omx', '/my/project']);

    expect(updateScaffold).toHaveBeenCalledWith('/my/project');
    expect(installOmx).toHaveBeenCalledWith('/my/project', '/mock/dist/omx/index.mjs');
    expect(installOmc).not.toHaveBeenCalled();
  });
});

describe('runUpdatePlugin', () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  beforeEach(() => {
    (globalThis as any).Bun = {
      spawnSync: vi.fn().mockImplementation((args) => {
        if (args[0] === 'which') {
          return { exitCode: 1, stdout: Buffer.from('') };
        }
        return { exitCode: 0, stdout: Buffer.from('') };
      }),
    };
    stdout.length = 0;
    stderr.length = 0;
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdout.push(String(s));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderr.push(String(s));
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls spawnSync with correct arguments', () => {
    runUpdatePlugin('latest');
    expect((globalThis as any).Bun.spawnSync).toHaveBeenCalled();
  });
});
