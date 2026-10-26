---
name: gobanana-critique
description: Build then critique - grade a built page against its GoBanana direction, side by side with the direction's best craft reference first, then the draft checklist. Takes the page as a URL, a local dev server or a screenshot, gets the REVIEW.md checklist from the direction, screenshots the page at mobile 390x844, tablet 834x1194 and desktop 1440x900 with whatever browser tool is there (Playwright MCP, Chrome tools or npx playwright screenshot), grades each item pass or fix with evidence, lists the top 3 fixes, and offers to apply them inside the page scope only. Use only when the user names GoBanana, says "go wild", or continues a GoBanana board or flow (a gobanana.fun link), for example "critique this against the GoBanana direction", "GoBanana, grade my page", "does this match the direction" or "check the launch page against the board" after a GoBanana flow. Never for a plain design review without GoBanana. Runs get_canvas, get_snapshot (craft references) and export_kit (review).
---

# GoBanana critique

Plugin 0.5.5. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.5.5, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Show each reference's source link, every time.
2. Never download, save or re-host reference images.
3. Never delete a canvas without the user's explicit yes.
4. Relay quota and plan messages once, as they are. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`, ask only what is missing) before `bend_brief`.

Call get_playbook with name `gobanana-critique` and plugin `0.5.5`, and follow it exactly; batch the playbooks it names in `more`.
