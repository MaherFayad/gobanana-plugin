---
name: gobanana-frankenstein
description: Frankenstein it - cut the best parts out of the references on a GoBanana board (a nav here, a hero there, cards from a third) and stack them into several Frankenstein page variants, each part a crop rectangle with a role, theme, "steal:" note and source link. A structure sketch for ideas; the look comes later from the direction's craft target. Use when the user says "frankenstein it", "frankenstein page", "stitch a page", "mix parts", "nav from this, hero from that", "combine these references into a page", "make new layouts from my board", "remix this one", "keep the nav, change the rest", or "wireframe from my references". Runs get_canvas, cut_parts, frankenstein_page, update_frankenstein, remix_frankenstein, open_canvas, reconcile_direction and export_kit (stitch_md, wireframe_html). Use gobanana-explore when the board is empty and gobanana-build to turn a page into a checked screen.
---

# GoBanana frankenstein

Plugin 0.4.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. End with the canvas web link.

Call get_playbook with name `gobanana-frankenstein` and follow it exactly; batch the playbooks it names in `more`.
