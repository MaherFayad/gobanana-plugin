---
name: gobanana-draft
description: Draft a picked GoBanana direction into one checked screen, craft first, for any screen type (landing, app, dashboard, canvas tool, checkout, email or slide). Takes the look from the direction's craft references and the user's confirmed taste, builds ONE screen with real content in every listed language, renders it at 390x844 and 1440x900, grades it against the craft reference, places it on the GoBanana board and asks for a reaction before building more. Use when the user says "draft the picks", "draft this direction", "draft 2 and 5", "mock it up", "build this direction", "show me what it looks like", or answers "Draft any of these?". Also for several concepts of one screen at once ("8 concepts with the same data", "a concept sheet"), for putting a direction on the real product ("apply it to our checkout"), or for versions to flip between ("show me versions"). Runs get_canvas, reconcile_direction, get_snapshot and add_to_canvas. Use gobanana-explore when there are no directions yet.
---

# GoBanana draft

Plugin 0.4.4. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.4, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota messages once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`. Unclear which screen? Ask once, or state your reading.
4. Body 16px+, one dominant block, every listed language, WCAG 2.2 AA; never show an unchecked draft.
5. Gulf MSA Arabic, no dialect; data as product words, never logs.
6. Concepts differ in skeleton and mechanic. Taste only as given or confirmed. The output the user names wins.
7. Place each draft on the board (add_to_canvas type "build" with gb-measure's measure) when you can; end with the canvas web link.

Call get_playbook with name `gobanana-draft` and follow it exactly; batch the playbooks it names in `more`.
