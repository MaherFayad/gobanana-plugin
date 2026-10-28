---
name: gobanana-draft
description: Draft a picked GoBanana direction into one checked screen of any type (landing, app, dashboard, canvas tool, checkout, email or slide). Three page sketches built on the references, a critic who did not make them picks one, the hero shot is crafted through a pin test, then the screen is built with real content in every listed language, rendered at 390x844 and 1440x900, given a final crit, placed on the GoBanana board and shown before building more. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "draft the picks" or "draft 2 and 5" after GoBanana directions, "draft this GoBanana direction", an answer to "Draft any of these?", "GoBanana, 8 concepts with the same data", "apply this direction to our checkout" or "show me versions" of a GoBanana draft. Never for a plain mockup or design ask without GoBanana. Runs get_canvas, reconcile_direction, get_snapshot and add_to_canvas. Use gobanana-explore when there are no directions yet.
---

# GoBanana draft

Plugin 0.5.6. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.5.6, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota messages once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`. Unclear which screen? Ask once, or state your reading.
4. Body 16px+, one dominant block, every listed language, WCAG 2.2 AA; never show an unchecked draft.
5. Gulf MSA Arabic, no dialect; data as product words, never logs.
6. Concepts differ in skeleton and mechanic. Taste only as given or confirmed. The output the user names wins.
7. Place each draft (add_to_canvas type "build" with gb-measure's measure) when you can; end with the canvas web link.

Call get_playbook with name `gobanana-draft` and plugin `0.5.6`, and follow it exactly; batch the playbooks it names in `more`.
