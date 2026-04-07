# Codex Setup Instructions

## Overview

This package now supports Codex through native Codex hooks and Codex MCP configuration.

## Setup

1. Run `context update` to install all integrations, including Codex.
2. If you only want the Codex target, run `context update codex`.

**Note**: Codex native hooks require the `codex_hooks` feature flag in `~/.codex/config.toml`. The installer enables this automatically.

## Maintenance

- Run `context update codex` to refresh the project scaffold and reinstall only the Codex integration files.
- `context update codex` does not reinstall Claude integration settings; use `context update claude` for the Claude-side integration.
