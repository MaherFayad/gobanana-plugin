---
name: gobanana-critique
description: Build then critique - grade a built page against its GoBanana direction, side by side with the direction's best craft reference first, then the draft checklist. Takes the page as a URL, a local dev server or a screenshot, gets the REVIEW.md checklist from the direction, screenshots the page at the platform's sizes (mobile 390x844, tablet 834x1194, desktop 1440x900) with whatever browser tool is there (Playwright MCP, Chrome tools or npx playwright screenshot), grades each item pass or fix with evidence, lists the top 3 fixes, and offers to apply them inside the page scope only. Use when the user says "critique this page", "review the build", "does this match the direction", "grade my page", "build then critique", "check the launch page against the board", or "how close is this to the concept". Runs get_canvas, get_snapshot (craft references) and export_kit (review) from the GoBanana MCP server.
---

# GoBanana critique

These hold even if the playbook call fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call the GoBanana get_playbook tool with name `gobanana-critique` and follow it exactly. When it names another playbook, call get_playbook for it. If the GoBanana tools are missing, ask the user to connect the GoBanana connector (or run `/mcp` in Claude Code).
