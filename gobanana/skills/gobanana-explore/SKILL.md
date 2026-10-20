---
name: gobanana-explore
description: Explore design directions or concepts for any page, screen, flow or feature (checkout, onboarding, dashboard, project page, landing page). Opens with one short intake (mode, ranked style words, who it is for, the business goal) saved to design/gobanana/CONTEXT.md, then bends the page into 4 deep, buildable directions (one working mechanic and one signature element each, on the user's own taste) and fills a GoBanana moodboard canvas with references the agent has seen, with 2 to 3 craft references per direction as the bar to build to. The intake also offers drafts, Finished (research, spec and build the feature in Claude Code) and just references. Use it before writing any UI concept, even when the user gives the data or a count: "8 concepts for", "concepts of this page", "variations", "mockups", "UI ideas", "design options", "explore directions", "help me design", "redesign this page", "what could this screen look like", "go wild", "make it cool", "make it bananas", "this looks like every other app", "صمم", "تصميم", "اتجاهات", "كونسبت", "أفكار للشاشة", or asks for bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, rate_directions, add_to_canvas, place_kept and open_canvas from the GoBanana MCP server, plus Mobbin when connected. Related: gobanana-finish, gobanana-draft (gobanana-draft/concept-sheet for several concepts at once), gobanana-frankenstein, gobanana-handoff.
---

# GoBanana explore

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. Never hand-write UI concepts: they come from this board's directions, drafted with gobanana-draft.

Call GoBanana get_playbook with name `gobanana-explore` and follow it exactly. When it tells you to read another playbook, call get_playbook for it. If GoBanana tools are missing, ask the user to connect GoBanana (`/mcp` in Claude Code).
