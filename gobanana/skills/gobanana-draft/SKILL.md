---
name: gobanana-draft
description: Draft a picked GoBanana direction into one beautiful, checked screen, craft first. Looks at the direction's craft references itself, takes the look from them and the user's taste, keeps the weird idea in one signature element, uses one grid, type pair and spacing scale from the direction's tokens, and real Arabic and English content with room. Builds ONE screen, renders it at 390x844 and 1440x900 in both languages, grades it side by side against the craft reference, fixes, shows it and asks for a reaction before building more. Writes live code - the format the user names, else a route in the user's app, an HTML artifact, or one drafts/<direction>.html. Use when the user says "draft the picks", "draft this direction", "draft 2 and 5", "mock it up", "build this direction", "show me what it looks like", "make a screen from this direction", or answers "Draft any of these?". Also use when the user wants the direction applied to the real product ("apply it to our checkout", "restyle our real page", "make our dashboard look like this") or wants versions of the signature element to flip between ("show me versions", "options for the signature"). Runs get_canvas, reconcile_direction and get_snapshot. Use gobanana-explore when there are no directions yet and gobanana-finish for the whole product.
---

# GoBanana draft

These hold even if get_playbook fails:

1. Show each reference's source link.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.
6. Every state reachable, worst case data, Arabic and English, WCAG 2.2 AA; never show an unchecked draft.
7. The output the user names wins.

Call GoBanana get_playbook with name `gobanana-draft` and follow it exactly; batch the playbooks it names in `more`. GoBanana tools missing: ask the user to connect GoBanana (`/mcp` in Claude Code).
