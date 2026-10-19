---
name: gobanana-draft
description: Draft a picked GoBanana direction into one beautiful, checked screen, craft first. Looks at the direction's craft references itself, takes the look from them and the user's taste, keeps the weird idea in one signature element, uses one grid, type pair and spacing scale from the direction's tokens, and real Arabic and English content with room. Builds ONE screen, renders it at 390x844 and 1440x900 in both languages, grades it side by side against the craft reference, fixes, shows it and asks for a reaction before building more. Writes live code - a route in the user's app, one drafts/<direction>.html with no project, or an HTML artifact in chat. Use when the user says "draft the picks", "draft this direction", "draft 2 and 5", "mock it up", "build this direction", "show me what it looks like", "make a screen from this direction", or answers "Draft any of these?". Runs get_canvas, reconcile_direction and get_snapshot. Use gobanana-explore when there are no directions yet and gobanana-finish for the whole product.
---

# GoBanana draft

These hold even if the playbook call fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call the GoBanana get_playbook tool with name `gobanana-draft` and follow it exactly. When it names another playbook, call get_playbook for it. If the GoBanana tools are missing, ask the user to connect the GoBanana connector (or run `/mcp` in Claude Code).
