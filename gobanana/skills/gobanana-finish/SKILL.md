---
name: gobanana-finish
description: Finished - research, spec and build a page, feature or whole app properly, end to end, like a design team, from the problem to shipped code in Claude Code. Opens with one short intake (style words, who it is for, the business goal) saved to design/gobanana/CONTEXT.md. Writes PROBLEM.md and CHALLENGE.md, maps the space (SPACE.md), writes SPEC.md, WIREFRAMES.md and low fi HTML wireframes, asks the user once to approve them (Gate 1), runs the GoBanana explore flow for the bold pages and keeps the task pages calm, asks the user to pick a direction on a Pick page (Gate 2), builds one screen first for a reaction, then the design system, components and pages with subagents, reviews them against the craft references, and hands off with screenshots, DESIGN.md and an AGENTS.md or CLAUDE.md section. Use when the user picked Finished in the explore intake, or says "build it properly", "end to end", "production ready", "full workflow", "research and build", "research, spec and build", "design and build this feature", "build the whole app", "build the whole feature", "from design to code", "design and build it", "ship it", "take it all the way", or "do the full pipeline". Claude Code only, since it needs a repo or an empty folder, a shell and file writes. Runs get_canvas, new_canvas, bend_brief, search_references, get_snapshot, rate_references, rate_directions, add_to_canvas, place_kept, open_canvas, reconcile_direction and export_kit from the GoBanana MCP server, through the gobanana-explore flow.
---

# GoBanana finish

These hold even if the playbook call fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call the GoBanana get_playbook tool with name `gobanana-finish` and follow it exactly. When it names another playbook, call get_playbook for it. If the GoBanana tools are missing, ask the user to connect the GoBanana connector (or run `/mcp` in Claude Code).
