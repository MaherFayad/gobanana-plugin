---
name: gobanana-design-md
description: Turn one kept GoBanana direction into a scoped DESIGN.md for the page or two it is for (design/explorations/<slug>/DESIGN.md), write it to disk and lint it until it passes. It inherits the project's own design system and never replaces the project's DESIGN.md unless the user asks for scope "system". Use when the user mentions "DESIGN.md", "design spec for this page", "design file for my agent", "write the direction down", "turn this board into a design spec", or "lint my DESIGN.md". Runs get_canvas (summary first), reconcile_direction and export_kit (design_md, optionally direction_md) from the GoBanana MCP server, then npx @google/design.md lint. For the full hand-off pack (build prompt, Cursor rules, Copilot, AGENTS.md section) use gobanana-handoff; for tokens use gobanana-asset-kit.
---

# GoBanana DESIGN.md

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call GoBanana get_playbook with name `gobanana-design-md` and follow it exactly. When it tells you to read another playbook, call get_playbook for it. If GoBanana tools are missing, ask the user to connect GoBanana (`/mcp` in Claude Code).
