---
description: Manually run all smoke checks and submit turn complete
---

Run the complete quality gate workflow manually:

1. Read `.context/config.jsonc` to find all configured `smokeChecks`
2. For each enabled smoke check, call the `run_smoke_check` MCP tool with its name
3. After all checks pass, call the `submit_turn_complete` MCP tool
4. Report the final status

Use this when you want to manually trigger the quality gate without waiting for the stop hook.
