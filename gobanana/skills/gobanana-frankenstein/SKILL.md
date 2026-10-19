---
name: gobanana-frankenstein
description: Frankenstein it - cut the best parts out of the references on a GoBanana board (a nav here, a hero there, cards from a third) and stack them into several Frankenstein page variants, each part a crop rectangle with a role, theme, "steal:" note and source link. A structure sketch for ideas; the look comes later from the direction's craft target. Use when the user says "frankenstein it", "frankenstein page", "stitch a page", "mix parts", "nav from this, hero from that", "combine these references into a page", "make new layouts from my board", "remix this one", "keep the nav, change the rest", or "wireframe from my references". Runs get_canvas, cut_parts, frankenstein_page, update_frankenstein, remix_frankenstein, open_canvas, reconcile_direction and export_kit (stitch_md, wireframe_html). Use gobanana-explore when the board is empty and gobanana-build to turn a page into a checked screen.
---

# GoBanana frankenstein

These hold even if the playbook call fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call the GoBanana get_playbook tool with name `gobanana-frankenstein` and follow it exactly. When it names another playbook, call get_playbook for it. If the GoBanana tools are missing, ask the user to connect the GoBanana connector (or run `/mcp` in Claude Code).
