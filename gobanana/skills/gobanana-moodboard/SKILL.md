---
name: gobanana-moodboard
description: Build and arrange a GoBanana moodboard from references in the canvas tray (place_kept for references already marked keep) - one section per direction, an "Art direction" row above the "UI references" grid, a "steal:" note on each placed reference, and an optional "Shipped today" note - and optionally rebuild it as a FigJam board through the Figma MCP or an HTML board. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "GoBanana moodboard", "tidy the canvas", "group by direction", "add steal notes", "send the GoBanana board to FigJam" or "make an HTML board" of it. Never for a moodboard without GoBanana. Runs get_canvas, get_snapshot, rate_references, place_kept, add_to_canvas, arrange_canvas and export_kit (figjam_spec, html_board) from the GoBanana MCP server. Every tile keeps its source link. To find new references first, use gobanana-explore; to stitch parts into new pages, use gobanana-frankenstein.
---

# GoBanana moodboard

Plugin 0.5.4. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.5.4, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. End with the canvas web link.

Call get_playbook with name `gobanana-moodboard` and plugin `0.5.4`, and follow it exactly; batch the playbooks it names in `more`.
