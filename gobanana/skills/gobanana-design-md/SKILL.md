---
name: gobanana-design-md
description: Turn one kept GoBanana direction into a scoped DESIGN.md for the page or two it is for (design/explorations/{slug}/DESIGN.md), write it to disk and lint it until it passes. It inherits the project's own design system and never replaces the project's DESIGN.md unless the user asks for scope "system". Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "DESIGN.md from the GoBanana board", "write this direction down", "turn this board into a design spec" or "lint my GoBanana DESIGN.md". Never for a DESIGN.md that has nothing to do with GoBanana. Runs get_canvas (summary first), reconcile_direction and export_kit (design_md, optionally direction_md) from the GoBanana MCP server, then npx @google/design.md lint. For the full hand-off pack use gobanana-handoff; for tokens use gobanana-asset-kit.
---

# GoBanana DESIGN.md

Plugin 0.8.2. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.8.2, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never upload or re-host reference images; download one only to copy it locally in a draft's step 1.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call get_playbook with name `gobanana-design-md` and plugin `0.8.2`, and follow it exactly; batch the playbooks it names in `more`.
