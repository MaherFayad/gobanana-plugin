---
name: gobanana-explore
description: Explore design directions for any page or screen: a landing page, mobile app screen, dashboard, canvas or editor tool, checkout, onboarding, empty state, game screen, slide, email or poster. One short intake (mode, ranked style words, who it is for, the business goal) saved to design/gobanana/CONTEXT.md, then directions that differ in structure (layout skeleton, navigation, spatial model), 4 unless the user names a count, never repeating earlier ideas, on a GoBanana moodboard canvas of references the agent has seen, with 2 to 3 craft references per direction; ends with the canvas link. The intake also offers drafts, Finished (research, spec and build in Claude Code) and just references. Use it before writing any UI concept, even with given data or a count: "8 concepts for", "concepts of this page", "variations", "mockups", "UI ideas", "design options", "explore directions", "help me design", "redesign this page", "what could this screen look like", "go wild", "make it cool", "make it bananas", "this looks like every other app", "صمم", "تصميم", "اتجاهات", "كونسبت", "أفكار للشاشة", or bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, rate_directions, add_to_canvas, place_kept and open_canvas, plus Mobbin when connected. Related skills: gobanana-draft (playbook gobanana-draft/concept-sheet for several concepts at once), gobanana-finish, gobanana-frankenstein, gobanana-handoff.
---

# GoBanana explore

Plugin 0.4.1. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.1, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link. Never download, save or re-host reference images.
2. Never delete a canvas without the user's explicit yes. Relay quota messages once. Never retry in a loop.
3. Run the intake stop (read `design/gobanana/CONTEXT.md`) before `bend_brief`. Unclear what to design? Ask once, or state your reading.
4. Directions: the count the user names, else 4, each a different structure (skeleton, navigation, spatial model), not only ornament.
5. Never reuse an idea in `recentIdeas`. No lens unless asked. Saved taste only after a yes; no dark default.
6. End with the canvas web link. Never hand-write UI concepts outside this flow.

Call get_playbook with name `gobanana-explore` and follow it exactly; batch the playbooks it names in `more`.
