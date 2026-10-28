---
name: gobanana-agents-md
description: Add a scoped GoBanana section to the project's AGENTS.md (and optionally CLAUDE.md) that tells coding agents how to build one wild page or two from a kept direction - which routes it covers, where its DIRECTION.md and DESIGN.md live, ship vs explore colors, and never copying reference images - without touching the project's global rules. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "GoBanana section in AGENTS.md", "tell Codex or Claude Code how to build this GoBanana page" or "make my agents follow this direction" after a GoBanana flow. Never for other AGENTS.md or CLAUDE.md work. Runs export_kit (agents_md, claude_md) from the GoBanana MCP server. For every coding tool at once (Cursor rules, Copilot, build prompt) use gobanana-handoff.
---

# GoBanana AGENTS.md

Plugin 0.7.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.7.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call get_playbook with name `gobanana-agents-md` and plugin `0.7.1`, and follow it exactly; batch the playbooks it names in `more`.
