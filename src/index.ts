import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '@opencode-ai/plugin';
import { resolveContextDir } from './lib/context-dir.js';
import { resolveProjectPaths } from './lib/project-root.js';
import { scaffoldIfNeeded, autoUpdateTemplates } from './lib/scaffold.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const plugin: Plugin = async ({ directory, client }) => {
  // 1. Resolve to git repo root (or home dir if not in a git repo)
  const { contextParent: projectRoot } = resolveProjectPaths(directory);

  // 2. Scaffold on first run, or auto-update templates on version change
  const scaffolded = scaffoldIfNeeded(projectRoot);
  const contextDir = resolveContextDir(projectRoot);

  if (scaffolded) {
    await client.app.log({
      body: {
        service: 'context',
        level: 'info',
        message: `Scaffold created at ${contextDir}/`,
      },
    });
  } else {
    // Auto-update templates when plugin version changes
    const autoUpdated = autoUpdateTemplates(projectRoot);
    if (autoUpdated.length > 0) {
      await client.app.log({
        body: {
          service: 'context',
          level: 'info',
          message: `Auto-updated ${autoUpdated.length} template(s): ${autoUpdated.join(', ')}`,
        },
      });
    }
  }

  return {
    config: async (config) => {
      config.mcp = config.mcp || {};
      config.mcp['context-mcp'] = {
        type: 'local',
        command: ['bun', join(__dirname, 'mcp.js')],
      };
    },
  };
};

export default plugin;
