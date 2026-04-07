# OMX Setup Instructions

## Overview

This plugin supports OMX (OpenCode Managed eXtension) to provide enhanced functionality.

## Setup

1. Run `context update` to install all integrations, including Codex/OMX.
2. If you only want the Codex/OMX target, run `context install omx`.
3. Run `omx setup` to apply the changes in Claude Code.

**Note**: You MUST run `omx setup` after installing for the changes to take effect.

## Maintenance

- Run `context update omx` to refresh the project scaffold and reinstall only the OMX hook/plugin files.
- `context update omx` does not reinstall Claude/OMC MCP settings; use `context install omc` for the Claude-side integration.
