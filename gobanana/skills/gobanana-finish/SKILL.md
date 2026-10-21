---
name: gobanana-finish
description: Finished - research, spec and build a page, feature or whole app properly, end to end, like a design team, from the problem to shipped code in Claude Code. Opens with one short intake (style words, who it is for, the business goal) saved to design/gobanana/CONTEXT.md. Writes PROBLEM.md and CHALLENGE.md, maps the space (SPACE.md), writes SPEC.md, WIREFRAMES.md and low fi HTML wireframes, asks the user once to approve them (Gate 1), runs the GoBanana explore flow for the bold pages and keeps the task pages calm, asks the user to pick a direction on a Pick page (Gate 2), builds one screen first for a reaction, then the design system, components and pages with subagents, reviews them against the craft references, and hands off with screenshots, DESIGN.md and an AGENTS.md or CLAUDE.md section. Use when the user picked Finished in the explore intake, or says "build it properly", "end to end", "production ready", "full workflow", "research and build", "research, spec and build", "design and build this feature", "build the whole app", "build the whole feature", "from design to code", "design and build it", "ship it", "take it all the way", or "do the full pipeline". Claude Code only, since it needs a repo or an empty folder, a shell and file writes. Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, rate_directions, add_to_canvas, place_kept, open_canvas, reconcile_direction and export_kit from the GoBanana MCP server, through the gobanana-explore flow.
---

# GoBanana finish

Plugin 0.4.0. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.4.0, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. Every state reachable, worst case data, Arabic and English, WCAG 2.2 AA; never show an unchecked draft.
7. Directions differ in structure; taste only as given or confirmed. End with the canvas web link.

Call get_playbook with name `gobanana-finish` and follow it exactly; batch the playbooks it names in `more`.
