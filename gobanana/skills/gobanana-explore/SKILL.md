---
name: gobanana-explore
description: Explore design directions for a page or screen (landing page, app screen, dashboard, canvas tool, checkout, onboarding, slide or email) with GoBanana. One short intake (incl. must-keeps and the one language, English by default) saved to design/gobanana/CONTEXT.md, then directions that are product strategies keeping every must-keep, 4 unless the user names a count, each with its own hero reference, on a GoBanana canvas of references the agent has seen, ending with a rough first screen of every direction in its hero's look, side by side, and the canvas link. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "GoBanana this page", "use GoBanana for our checkout", "GoBanana, 8 concepts for the project page", "go wild on the landing page" or "make it bananas". Never for other design work without GoBanana. Runs bend_brief, search_references, get_snapshot, rate_references, place_kept, reconcile_direction and add_to_canvas.
---

# GoBanana explore

Plugin 0.6.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.6.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota messages once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`; in a subagent, ask nothing (`context.assumed`). Unclear what to design? Ask once. New board unless named.
4. Directions: the count the user names, else 4, each a different structure and strategy keeping every must-keep, with its own hero.
5. Never reuse an idea in `recentIdeas`. No lens unless asked. Saved taste only after a yes; no dark default.
6. End with a rough screen of every direction (one check, no fixes) and the canvas web link.

Call get_playbook with name `gobanana-explore` and plugin `0.6.1`, and follow it exactly; batch the playbooks it names in `more`.
