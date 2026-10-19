---
name: gobanana-agents-md
description: Add a scoped GoBanana section to the project's AGENTS.md (and optionally CLAUDE.md) that tells coding agents how to build one wild page or two from a kept direction - which routes it covers, where its DIRECTION.md and DESIGN.md live, ship vs explore colors, and never copying reference images - without touching the project's global rules. Use when the user mentions "AGENTS.md", "rules for coding agents", "tell Codex or Claude Code how to build this page", "agent instructions for the launch page", or "make my agents follow this direction". Runs export_kit (agents_md, claude_md) from the GoBanana MCP server. For every coding tool at once (Cursor rules, Copilot, build prompt) use gobanana-handoff.
---

# GoBanana AGENTS.md

These hold even if the playbook call fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call the GoBanana get_playbook tool with name `gobanana-agents-md` and follow it exactly. When it names another playbook, call get_playbook for it. If the GoBanana tools are missing, ask the user to connect the GoBanana connector (or run `/mcp` in Claude Code).
