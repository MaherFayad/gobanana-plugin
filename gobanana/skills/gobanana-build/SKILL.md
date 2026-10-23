---
name: gobanana-build
description: Build one Frankenstein page into a beautiful, checked screen, craft first. Rows become a region plan (what each region does, one stolen move for the whole screen at most, its source link), never a row by row collage; the look comes from the direction's craft references, seen first-hand, and one grid, type pair and spacing scale from its tokens. Mechanic first, rendered at 390x844 and 1440x900 in every listed language, graded side by side against the craft reference, fixed, shown, then a reaction asked for. Use when the user says "build this Frankenstein page", "build the page from the board", "code this screen from the parts", "turn the stitch into a screen", "build st_...", or "make the Frankenstein page real". Runs get_canvas, reconcile_direction, get_snapshot and add_to_canvas. Use gobanana-frankenstein first when there is no page yet.
---

# GoBanana build

Plugin 0.4.6. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.6, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. Every state reachable, worst case data, every listed language, WCAG 2.2 AA; never show an unchecked draft.
7. Place the build on the board (add_to_canvas type "build" with gb-measure's measure) when you can screenshot. End with the canvas web link.

Call get_playbook with name `gobanana-build` and follow it exactly; batch the playbooks it names in `more`.
