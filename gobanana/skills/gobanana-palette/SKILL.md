---
name: gobanana-palette
description: Pull a color palette from references on a GoBanana moodboard canvas (art direction images or UI references), assign roles, and check every pair against WCAG 2.2 contrast so the user knows what can ship and what is concept only. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "palette from the GoBanana board", "colors from the art direction" on the board or "do these board colors pass contrast". Never for color work without GoBanana. Runs get_canvas and extract_palette (with addSwatches) from the GoBanana MCP server.
---

# GoBanana palette

Plugin 0.8.2. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.8.2, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never upload or re-host reference images; download one only to copy it locally in a draft's step 1.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call get_playbook with name `gobanana-palette` and plugin `0.8.2`, and follow it exactly; batch the playbooks it names in `more`.
