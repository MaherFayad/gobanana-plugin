@AGENTS.md

# GoBanana starter

A Next.js app with Tailwind CSS v4 and shadcn/ui on Base UI (`components.json`, style `base-nova`).
It exists to build pages from a GoBanana direction.

## Before you build

- Read every file in `design/explorations/<slug>/` first: `DIRECTION.md` (what the page is and why),
  `BUILD-PROMPT.md` (the build steps), `DESIGN.md` (the look). If there are several folders, ask which
  direction to build, or use the one the user names.
- The theme lives in `app/globals.css` as shadcn CSS variables (`--background`, `--primary`, `--radius`
  and the rest) for light and `.dark`. `npx shadcn@latest add <install link>` writes it. Use these
  variables and the Tailwind classes built on them (`bg-background`, `text-primary`); never hardcode
  colors, radii or fonts.
- The kept draft is a direction, not the product: build the real page cleaner, with real content,
  every state (empty, loading, error) and the flows around it.

## GoBanana plugin

`.claude/settings.json` asks Claude Code to add the GoBanana marketplace
(`MaherFayad/gobanana-plugin`) and enable the `gobanana` plugin when this folder is trusted. If it
is not active, run `/plugin marketplace add MaherFayad/gobanana-plugin` and then
`/plugin install gobanana@gobanana`.

When the page is built, check it: "GoBanana, check my page against the kept draft."

## Rules

- WCAG 2.2 AA: text contrast 4.5:1, field borders and focus rings 3:1, body text 16px, targets 44px,
  visible focus, alt text, no sideways scroll at 390px.
- Reference images belong to their owners: never copy them into this project. Link to the source.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`.
