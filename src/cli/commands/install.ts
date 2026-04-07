import { join, resolve, dirname } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { ensureMcpRegistered } from '../../omx/registry.js';
import { scaffoldIfNeeded } from '../../lib/scaffold.js';
import { injectIntoAgentsMd } from '../../shared/agents-md.js';
import { injectIntoGlobalInstructions } from '../../shared/global-instructions.js';
import { STATIC_WORKFLOW_CONTEXT } from '../../shared/workflow-context.js';
import { resolveMcpPath } from '../../shared/mcp-path.js';
import { pruneStaleMockMcpServer } from '../../shared/codex-settings.js';
import {
  normalizeContextMcpServer,
  removeMcpServer,
  registerHook,
} from '../../shared/claude-settings.js';

export function resolveOmxSource(): string | null {
  try {
    const cliDir = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(cliDir, '..', '..');
    const source = join(pkgRoot, 'dist', 'omx', 'index.mjs');
    if (existsSync(source)) return source;
  } catch {
    /* dirname resolution unavailable */
  }

  try {
    const req = createRequire(import.meta.url);
    return req.resolve('@ksm0709/context/omx');
  } catch {
    return null;
  }
}

export function installOmx(projectDir: string, sourcePath: string): void {
  if (!existsSync(sourcePath)) {
    process.stderr.write(`Could not find OMX plugin source file: ${sourcePath}\n`);
    process.exit(1);
    return;
  }

  const targetDir = join(projectDir, '.omx', 'hooks');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourcePath, join(targetDir, 'context.mjs'));

  process.stdout.write('Installed context plugin to .omx/hooks/context.mjs\n');

  if (ensureMcpRegistered()) {
    process.stdout.write('Successfully registered context-mcp in ~/.omx/mcp-registry.json\n');
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

export function installOmc(projectDir: string): void {
  // 1. Scaffold project context directory
  scaffoldIfNeeded(projectDir);

  // 2. Inject workflow context into AGENTS.md
  injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), STATIC_WORKFLOW_CONTEXT);

  // 3. Resolve bun path
  let bunPath = 'bun';
  try {
    bunPath = execSync('which bun', { encoding: 'utf-8' }).trim();
  } catch {
    /* fallback to 'bun' */
  }

  // 4. Resolve MCP and hook paths
  const mcpPath = resolveMcpPath();
  const hookBasePath = join(dirname(mcpPath), 'omc') + '/';

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

  // 6. Register SessionStart hook
  registerHook('SessionStart', {
    matcher: 'startup',
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${hookBasePath}session-start-hook.js`,
        timeout: 15,
        statusMessage: 'Initializing context plugin...',
      },
    ],
  });

  // 7. Register Stop hook
  registerHook('Stop', {
    hooks: [
      {
        type: 'command',
        command: `${bunPath} ${hookBasePath}stop-hook.js`,
        timeout: 10,
        statusMessage: 'Checking turn completion...',
      },
    ],
  });

  // Inject into Claude Code's global CLAUDE.md for non-git directory support
  injectIntoGlobalInstructions('claude', STATIC_WORKFLOW_CONTEXT);
  process.stdout.write('Injected workflow context into ~/.claude/CLAUDE.md\n');

  process.stdout.write('Successfully installed context (omc) plugin.\n');
}

export function runInstall(args: string[]): void {
  const [subcommand] = args;

  switch (subcommand) {
    case 'omx': {
      const source = resolveOmxSource();
      if (!source) {
        process.stderr.write('Could not find OMX plugin source file (dist/omx/index.mjs).\n');
        process.exit(1);
        return;
      }
      installOmx(process.cwd(), source);
      break;
    }
    case 'omc':
    case 'claude':
      installOmc(process.cwd());
      break;
    case undefined:
      process.stderr.write('Missing install target. Usage: context install <omx|omc>\n');
      process.exit(1);
      break;
    default:
      process.stderr.write(`Unknown install target: ${subcommand}\n`);
      process.exit(1);
  }
}
