---
name: gobanana-handoff
description: Hand one kept GoBanana direction to the user's coding tools as a scoped harness pack - DIRECTION.md, BUILD-PROMPT.md, REVIEW.md and DESIGN.md under design/explorations/<slug>/, plus Cursor rules, Copilot instructions and AGENTS.md or CLAUDE.md sections that apply only to the target pages. Detects Claude Code, Cursor, Copilot, Codex, v0 and Lovable from the repo, writes every file at its suggested path, and merges into existing AGENTS.md or CLAUDE.md instead of overwriting. Use when the user says "hand this off", "harness pack", "set up my agents for this page", "build prompt", "Cursor rules for this", "Copilot instructions", "prompt for v0", "prompt for Lovable", "get this ready to build", or "export the direction". Runs get_canvas (summary first), reconcile_direction and export_kit (direction_md, build_prompt, review, design_md, cursor_rules, copilot, agents_md, claude_md) from the GoBanana MCP server.
---

# GoBanana handoff

Plugin 0.4.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call get_playbook with name `gobanana-handoff` and follow it exactly; batch the playbooks it names in `more`.
