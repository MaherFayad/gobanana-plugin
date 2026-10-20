---
name: gobanana-explore
description: Explore design directions for any page, screen, flow or feature (booking, checkout, onboarding, dashboard, landing page). Opens with one short intake (mode, ranked style words, who it is for, the business goal), saved to design/gobanana/CONTEXT.md and reused next time, then bends the page into 4 deep, buildable directions (one working mechanic and one signature element each, on the user's own taste) and fills a GoBanana moodboard canvas with references the agent has actually seen, with 2 to 3 craft references per direction as the bar to build to - art direction mapped to UI parts and platform-correct UI, each with a "steal:" note. The intake also offers drafts, Finished (research, spec and build the feature properly in Claude Code) and just references. Use when the user says "explore directions", "help me design", "design ideas for", "redesign this page", "what could this screen look like", "go wild", "push this design", "crazy ideas for", "make it weird", "make it cool", "make it bananas", "unexpected directions", "inspire me", "where can we be weird", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, rate_directions, add_to_canvas, place_kept and open_canvas from the GoBanana MCP server, plus the user's Mobbin connector when connected. Related playbooks: gobanana-finish, gobanana-draft, gobanana-frankenstein, gobanana-handoff.
---

# GoBanana explore

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call GoBanana get_playbook with name `gobanana-explore` and follow it exactly. When it tells you to read another playbook, call get_playbook for it. If GoBanana tools are missing, ask the user to connect GoBanana (`/mcp` in Claude Code).
