---
title: Context Injection Process
date: 2026-03-22
tags:
  - context-injection
  - agents-md
  - omx
---

# Context Injection Process

The context injection logic in `src/omx/index.ts` uses `injectIntoAgentsMd` from `src/omx/agents-md.ts` to update `AGENTS.md` with `STATIC_KNOWLEDGE_CONTEXT`. This process replaces the content between `<!-- context:start -->` and `<!-- context:end -->` markers in `AGENTS.md`. To manually run this, one can create a temporary script that imports these modules and executes the injection.
