---
name: gobanana-rescue
description: Rescue the design of an app that is already live with GoBanana. Audits the key screens with evidence (screenshots, measured accessibility fixes, a style inventory of the colors, sizes and spacings really used, a UX review), scores them in design/gobanana/rescue/AUDIT.md and on the board, then offers a low-risk clean-up (same layout, tidy tokens) or a re-imagine of one screen with GoBanana directions, rolled out one screen at a time on a throwaway branch with before and after side by side. Use only when the user names GoBanana or continues a GoBanana flow, for example "GoBanana, our app looks bad", "fix our app's design with GoBanana", "audit my UI with GoBanana", "glow up our app, GoBanana", "GoBanana، شكل تطبيقنا ضعيف", "راجع تصميم تطبيقنا بـ GoBanana", "أنقذ تصميم تطبيقنا بـ GoBanana". Never for other design work without GoBanana. Runs new_canvas, get_upload_link and add_to_canvas.
---

# GoBanana rescue

Plugin 0.9.8. Use GoBanana tools under any prefix; with none, ask the user to connect the GoBanana connector at claude.ai or run `/mcp`. Call ping once; if its minPlugin is above 0.9.8, tell the user in one line to update (claude.ai: re-sync the org plugin; Claude Code: `/plugin update gobanana`).

These hold even if get_playbook fails:

1. Never screenshot or upload screens with real customer data: demo, staging or seed data only; ask once when unsure.
2. Work on a throwaway git branch. Never change the shared theme without the user's explicit yes.
3. Show each reference's source link. Never upload or re-host reference images; download one only to copy it locally in a draft's step 1.
4. Never delete a canvas without the user's explicit yes. Relay quota once. Never retry in a loop.
5. Run the intake stop (read `design/gobanana/CONTEXT.md`; ask only where the app runs, which 1 to 3 screens matter and a demo login) before `bend_brief` or the first shot.
6. Canvas web link, then the ask.

Call get_playbook with name `gobanana-rescue` and plugin `0.9.8`, and follow it exactly; batch the playbooks it names in `more`.
