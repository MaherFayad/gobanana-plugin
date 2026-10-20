---
name: gobanana-palette
description: Pull a color palette from references on a GoBanana moodboard canvas (art direction images or UI references), assign roles, and check every pair against WCAG 2.2 contrast so the user knows what can ship and what is concept only. Use when the user says "palette", "colors from these", "pull the colours", "what colors are on this board", "colors from the art direction", "color scheme from the moodboard", "extract colors", or "do these colors pass contrast". Runs get_canvas and extract_palette (with addSwatches) from the GoBanana MCP server.
---

# GoBanana palette

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call GoBanana get_playbook with name `gobanana-palette` and follow it exactly. When it tells you to read another playbook, call get_playbook for it. If GoBanana tools are missing, ask the user to connect GoBanana (`/mcp` in Claude Code).
