---
name: gobanana-finish
description: Finished mode. Research, spec and build a page, feature or whole app end to end in Claude Code, like a design team. One short intake saved to design/gobanana/CONTEXT.md, then PROBLEM.md, CHALLENGE.md, SPACE.md, SPEC.md and low fi wireframes for one approval (Gate 1), the GoBanana explore flow for the bold pages with calm task pages, a direction pick (Gate 2), one screen first for a reaction, then the design system, components and pages with subagents, reviewed against the craft references, and a hand-off with screenshots, DESIGN.md and an AGENTS.md or CLAUDE.md section. Use when the user picked Finished in the explore intake, or says "build it properly", "end to end", "production ready", "research and build", "design and build this feature", "build the whole app", "from design to code", "ship it" or "take it all the way". Claude Code only (needs a repo or an empty folder, a shell and file writes). Runs the gobanana-explore flow plus reconcile_direction and export_kit.
---

# GoBanana finish

Plugin 0.5.3. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.5.3, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. Every state reachable, worst case data, every listed language, WCAG 2.2 AA; never show an unchecked draft.
7. Directions differ in structure; taste only as given or confirmed. End with the canvas web link.

Call get_playbook with name `gobanana-finish` and plugin `0.5.3`, and follow it exactly; batch the playbooks it names in `more`.
