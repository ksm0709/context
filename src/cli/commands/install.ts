import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { scaffoldIfNeeded } from '../../lib/scaffold.js';
import { injectIntoAgentsMd } from '../../shared/agents-md.js';
import { registerCodexHook } from '../../shared/codex-hooks.js';
import { injectIntoGlobalInstructions } from '../../shared/global-instructions.js';
import { STATIC_WORKFLOW_CONTEXT } from '../../shared/workflow-context.js';
import { resolveMcpPath } from '../../shared/mcp-path.js';
import {
  registerOpenCodeMcp,
  removeOpenCodePlugin,
} from '../../shared/opencode-global-settings.js';
import { resolveWorkspacePackageRoot } from '../../shared/package-root.js';
import {
  ensureContextMcpRegistered,
  pruneStaleMockMcpServer,
} from '../../shared/codex-settings.js';
import {
  normalizeContextMcpServer,
  registerHook,
  removeMcpServer,
} from '../../shared/claude-settings.js';

function resolveCommandsDistDir(): string | null {
  const workspaceRoot = resolveWorkspacePackageRoot();
  if (workspaceRoot) {
    const dir = join(workspaceRoot, 'dist', 'commands');
    if (existsSync(dir)) return dir;
  }

  try {
    const cliDir = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(cliDir, '..', '..');
    const dir = join(pkgRoot, 'dist', 'commands');
    if (existsSync(dir)) return dir;
  } catch {
    /* dirname resolution unavailable */
  }

  try {
    const req = createRequire(import.meta.url);
    const packageRoot = dirname(req.resolve('@ksm0709/context/package.json'));
    const dir = join(packageRoot, 'dist', 'commands');
    return existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

function installSlashCommands(): void {
  const sourceDir = resolveCommandsDistDir();
  if (!sourceDir) {
    process.stderr.write(
      'Warning: Could not find dist/commands/ — skipping slash command install.\n'
    );
    return;
  }

  const commandFiles = ['cleanup.md', 'manual-gating.md'];
  const targetDirs = [
    join(homedir(), '.claude', 'commands', 'context'),
    join(homedir(), '.agents', 'commands', 'context'),
  ];

  for (const targetDir of targetDirs) {
    mkdirSync(targetDir, { recursive: true });
    let copiedCount = 0;
    for (const file of commandFiles) {
      const src = join(sourceDir, file);
      if (!existsSync(src)) continue;
      copyFileSync(src, join(targetDir, file));
      copiedCount++;
    }
    if (copiedCount > 0) {
      process.stdout.write(`Installed slash commands to ${targetDir}\n`);
    }
  }
}

export function resolveHookSource(fileName: string): string | null {
  const workspaceRoot = resolveWorkspacePackageRoot();
  if (workspaceRoot) {
    const workspaceSource = join(workspaceRoot, 'dist', 'hooks', fileName);
    if (existsSync(workspaceSource)) return workspaceSource;
  }

  try {
    const cliDir = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(cliDir, '..', '..');
    const source = join(pkgRoot, 'dist', 'hooks', fileName);
    if (existsSync(source)) return source;
  } catch {
    /* dirname resolution unavailable */
  }

  try {
    const req = createRequire(import.meta.url);
    const packageRoot = dirname(req.resolve('@ksm0709/context/package.json'));
    const source = join(packageRoot, 'dist', 'hooks', fileName);
    return existsSync(source) ? source : null;
  } catch {
    return null;
  }
}

function resolveBunPath(): string {
  try {
    return execSync('which bun', { encoding: 'utf-8' }).trim();
  } catch {
    return 'bun';
  }
}

export function installCodex(
  projectDir: string,
  sessionStartSource: string,
  stopSource: string
): void {
  scaffoldIfNeeded(projectDir);

  const bunPath = resolveBunPath();
  registerCodexHook('SessionStart', {
    matcher: 'startup|resume',
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${sessionStartSource}`,
        statusMessage: 'Initializing context plugin...',
      },
    ],
  });
  registerCodexHook('Stop', {
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${stopSource}`,
        timeout: 30,
      },
    ],
  });

  process.stdout.write('Installed context hooks to ~/.codex/hooks.json\n');

  if (ensureContextMcpRegistered(bunPath, resolveMcpPath())) {
    process.stdout.write('Successfully registered context-mcp in ~/.codex/config.toml\n');
  }

  if (pruneStaleMockMcpServer()) {
    process.stdout.write(
      'Removed stale mock-mcp from ~/.codex/config.toml because its target file is missing\n'
    );
  }

  // Inject into Codex's global instructions for non-git directory support
  injectIntoGlobalInstructions('codex', STATIC_WORKFLOW_CONTEXT);
  process.stdout.write('Injected workflow context into ~/.codex/instructions.md\n');
}

export function installClaude(
  projectDir: string,
  sessionStartSource: string,
  stopSource: string
): void {
  // 1. Scaffold project context directory
  scaffoldIfNeeded(projectDir);

  // 2. Inject workflow context into AGENTS.md
  injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), STATIC_WORKFLOW_CONTEXT);

  // 3. Resolve bun path
  const bunPath = resolveBunPath();

  // 4. Resolve MCP path
  const mcpPath = resolveMcpPath();

  // 5. Clean up legacy entries from settings.json and register via Claude CLI
  removeMcpServer('context_mcp');
  removeMcpServer('context-mcp');
  try {
    // Remove existing entry first (ignore errors if not found)
    try {
      execSync('claude mcp remove -s user context-mcp', { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      /* entry may not exist yet */
    }
    execSync(`claude mcp add -s user context-mcp -- ${bunPath} ${mcpPath}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (e) {
    process.stderr.write(
      `Warning: Failed to register MCP via Claude CLI: ${e instanceof Error ? e.message : String(e)}\n` +
        `You can manually run: claude mcp add -s user context-mcp -- ${bunPath} ${mcpPath}\n`
    );
  }

  normalizeContextMcpServer();

  registerHook('SessionStart', {
    matcher: 'startup',
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${sessionStartSource}`,
        timeout: 15,
        statusMessage: 'Initializing context plugin...',
      },
    ],
  });

  registerHook('Stop', {
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${stopSource}`,
        timeout: 30,
        statusMessage: 'Checking turn completion...',
      },
    ],
  });

  installSlashCommands();

  // Inject into Claude Code's global CLAUDE.md for non-git directory support
  injectIntoGlobalInstructions('claude', STATIC_WORKFLOW_CONTEXT);
  process.stdout.write('Injected workflow context into ~/.claude/CLAUDE.md\n');

  process.stdout.write('Successfully installed context (claude) plugin.\n');
}

export function installOpenCode(projectDir: string): void {
  scaffoldIfNeeded(projectDir);

  let bunPath = 'bun';
  try {
    bunPath = execSync('which bun', { encoding: 'utf-8' }).trim();
  } catch {
    /* fallback to 'bun' */
  }

  const mcpPath = resolveMcpPath();
  registerOpenCodeMcp([bunPath, mcpPath]);
  process.stdout.write('Registered context-mcp in ~/.config/opencode/opencode.json\n');

  removeOpenCodePlugin('@ksm0709/context');
  process.stdout.write('Removed @ksm0709/context plugin from ~/.config/opencode/opencode.json\n');
}

export function runInstall(args: string[]): void {
  const [subcommand] = args;

  switch (subcommand) {
    case 'codex': {
      const sessionStartSource = resolveHookSource('session-start-hook.js');
      const stopSource = resolveHookSource('stop-hook.js');
      if (!sessionStartSource || !stopSource) {
        process.stderr.write('Could not find hook source files (dist/hooks/*).\n');
        process.exit(1);
        return;
      }
      installCodex(process.cwd(), sessionStartSource, stopSource);
      break;
    }
    case 'claude': {
      const sessionStartSource = resolveHookSource('session-start-hook.js');
      const stopSource = resolveHookSource('stop-hook.js');
      if (!sessionStartSource || !stopSource) {
        process.stderr.write('Could not find hook source files (dist/hooks/*).\n');
        process.exit(1);
        return;
      }
      installClaude(process.cwd(), sessionStartSource, stopSource);
      break;
    }
    case undefined:
      process.stderr.write('Missing install target. Usage: context install <codex|claude>\n');
      process.exit(1);
      break;
    default:
      process.stderr.write(`Unknown install target: ${subcommand}\n`);
      process.exit(1);
  }
}
