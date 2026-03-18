import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installOmx } from './install.js';

describe('installOmx', () => {
  let tmpDir: string;
  let sourceFile: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    tmpDir = join(tmpdir(), `install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });

    const sourceDir = join(tmpDir, 'source');
    mkdirSync(sourceDir, { recursive: true });
    sourceFile = join(sourceDir, 'index.mjs');
    writeFileSync(sourceFile, 'export default function hook() {}');

    stdout = [];
    stderr = [];
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
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('copies source to .omx/hooks/context.mjs', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installOmx(projectDir, sourceFile);

    const target = join(projectDir, '.omx', 'hooks', 'context.mjs');
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('export default function hook() {}');
    expect(stdout.join('')).toContain('Installed context plugin to .omx/hooks/context.mjs');
  });

  it('auto-creates .omx/hooks/ when directory does not exist', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    expect(existsSync(join(projectDir, '.omx', 'hooks'))).toBe(false);

    installOmx(projectDir, sourceFile);

    expect(existsSync(join(projectDir, '.omx', 'hooks'))).toBe(true);
    expect(existsSync(join(projectDir, '.omx', 'hooks', 'context.mjs'))).toBe(true);
  });

  it('overwrites existing file when already installed', () => {
    const projectDir = join(tmpDir, 'project');
    const hooksDir = join(projectDir, '.omx', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'context.mjs'), 'old version');

    installOmx(projectDir, sourceFile);

    expect(readFileSync(join(hooksDir, 'context.mjs'), 'utf-8')).toBe(
      'export default function hook() {}'
    );
    expect(stdout.join('')).toContain('Installed context plugin to .omx/hooks/context.mjs');
  });

  it('exits with error when source file not found', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installOmx(projectDir, '/nonexistent/path/source.mjs');

    expect(stderr.join('')).toContain('Could not find OMX plugin source');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(existsSync(join(projectDir, '.omx', 'hooks', 'context.mjs'))).toBe(false);
  });
});
