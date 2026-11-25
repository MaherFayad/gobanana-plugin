# GoBanana

Real design references, design directions, a checked draft and build files for your coding agent.

Describe a page or screen in one line. GoBanana searches real, linked design references, shows them on a board you can open in the browser, and proposes directions that differ in layout and navigation, not only in color. Pick one and it drafts the screen, checks it against a WCAG 2.2 AA floor (contrast, text size, target size) and exports the files a coding tool builds from.

## What is in the plugin

- The GoBanana connector (https://gobanana.fun/api/mcp). You sign in with a free GoBanana account the first time a skill uses it.
- 13 skills: gobanana-agents-md, gobanana-asset-kit, gobanana-build, gobanana-critique, gobanana-design-md, gobanana-draft, gobanana-explore, gobanana-finish, gobanana-frankenstein, gobanana-handoff, gobanana-moodboard, gobanana-palette, gobanana-rescue.
- Subagents for scouting references, building drafts and reviewing them.

The skills are short: each one asks the connector for its current steps, so the plugin stays up to date without a new version.

## How to use it

Name GoBanana in your request, for example:

- Use GoBanana for our pricing page. Show me 3 directions.
- GoBanana, go wild on the landing page for a habit tracker.
- Finish direction 2 and give me the build files.

## Privacy and sources

GoBanana stores links and tags, never third-party images, and every reference shows its source. There are no AI calls on the server. Privacy notice: https://gobanana.fun/en/privacy. Terms: https://gobanana.fun/en/terms.

Docs: https://gobanana.fun/docs. Contact: contact@gobanana.fun.
