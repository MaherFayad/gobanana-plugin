---
name: gobanana-explore
description: Explore design directions for any page or screen (landing page, app screen, dashboard, canvas tool, checkout, onboarding, slide or email). One short intake saved to design/gobanana/CONTEXT.md, then directions that differ in structure (layout, navigation, spatial model), 4 unless the user names a count, on a GoBanana moodboard canvas of references the agent has seen, ending with the canvas link. The intake also offers drafts, Finished and just references. Use it before writing any UI concept, even with given data or a count, for example "8 concepts for", "variations", "mockups", "design options", "redesign this page", "go wild", "make it bananas", "this looks like every other app", "صمم", "تصميم", "اتجاهات", "كونسبت". Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, place_kept and open_canvas, plus Mobbin when connected. Related skills are gobanana-draft, gobanana-finish, gobanana-frankenstein and gobanana-handoff.
---

# GoBanana explore

Plugin 0.5.0. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.5.0, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota messages once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`. Unclear what to design? Ask once, or state your reading.
4. Directions: the count the user names, else 4, each a different structure (skeleton, navigation, spatial model), not only ornament.
5. Never reuse an idea in `recentIdeas`. No lens unless asked. Saved taste only after a yes; no dark default.
6. End with the canvas web link. Never hand-write UI concepts outside this flow.

Call get_playbook with name `gobanana-explore` and follow it exactly; batch the playbooks it names in `more`.
