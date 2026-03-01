import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { printHelp, runCli, COMMANDS } from './index.js';

describe('printHelp', () => {
  it('prints usage and all registered commands', () => {
    const lines: string[] = [];
    printHelp((s) => lines.push(s));
    const output = lines.join('');

    expect(output).toContain('Usage: context <command>');
    expect(output).toContain('Commands:');
    for (const [name, desc] of Object.entries(COMMANDS)) {
      expect(output).toContain(name);
      expect(output).toContain(desc);
    }
  });
});

describe('runCli', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('update: reports up-to-date when scaffold already current', async () => {
    const { scaffoldIfNeeded } = await import('../lib/scaffold.js');
    scaffoldIfNeeded(tmpDir);

    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', tmpDir]);
    expect(out.join('')).toContain('up to date');
  });

  it('update: lists updated files when scaffold is stale', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    // tmpDir has no scaffold yet — update creates all files
    runCli(['update', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)/);
  });

  it('no args: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli([]);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('--help: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['--help']);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('-h: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['-h']);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('unknown command: writes error to stderr and exits 1', () => {
    const errOut: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    runCli(['nonexistent']);
    expect(errOut.join('')).toContain('Unknown command: nonexistent');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
