---
description: Reset quality gate — delete .work-complete and all smoke check signal files
---

Reset the quality gate for this project by deleting stale signal files.

Run these steps:
1. Delete `.context/.work-complete` if it exists: `rm -f .context/.work-complete`
2. Delete all smoke check signal files: `find .context -name '.check-*-passed' -delete 2>/dev/null; true`
3. Report what was deleted with a brief summary

This is useful when you want to force re-running quality checks in the current session.
