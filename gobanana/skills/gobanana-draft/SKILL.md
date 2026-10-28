---
name: gobanana-draft
description: Finish a picked GoBanana direction into one checked page or screen of any type (landing, app, dashboard, canvas tool, checkout, email or slide). The look is the whole visual language of the direction's hero reference, its principles and never its props; the whole page is crafted from the rough screen, real content and pictures, one language (English unless asked), measured at the brief's viewport, two critique passes beside the hero, placed on the board and shown before more. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "finish the pick", "draft 2 and 5" after GoBanana directions, "draft this GoBanana direction", an answer to "Which one should I finish?", "apply this direction to our checkout" or "show me versions" of a GoBanana draft. Never for a plain mockup or design ask without GoBanana. Runs get_canvas, reconcile_direction, get_snapshot and add_to_canvas. Use gobanana-explore when there are no directions yet.
---

# GoBanana draft

Plugin 0.6.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.6.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`. Unclear which screen? Ask once, or state your reading.
4. The hero's look, never its props; one signature; the finish check. Floor: WCAG 2.2 AA, body 16px+; show nothing unchecked.
5. One language, English unless asked; nothing invented; product words, never logs.
6. Must-keeps stay; the mechanic works. Taste only as given or confirmed. The output the user names wins.
7. Place each draft (add_to_canvas type "build" with gb-measure's measure); end with the canvas web link.

Call get_playbook with name `gobanana-draft` and plugin `0.6.1`, and follow it exactly; batch the playbooks it names in `more`.
