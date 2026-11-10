# GoBanana starter

A small Next.js project for building a page from a GoBanana direction: Next.js, Tailwind CSS v4 and
shadcn/ui on Base UI, with a `CLAUDE.md` that points Claude Code at your direction files and turns on
the GoBanana plugin.

## Open in Claude Code

1. Get the project and install it (it lives in `starter/` of the public GoBanana plugin repo):

   ```bash
   npx degit MaherFayad/gobanana-plugin/starter my-app
   cd my-app
   npm install
   ```

2. Add your design system with the install command from your board's next steps page:

   ```bash
   npx shadcn@latest add https://gobanana.fun/r/<token>/system.json
   ```

   It writes your theme into `app/globals.css`, adds the fonts, and puts `DIRECTION.md`,
   `BUILD-PROMPT.md` and `DESIGN.md` in `design/explorations/<slug>/`.

3. Open Claude Code in the folder:

   ```bash
   claude
   ```

   Trust the folder when asked, so the GoBanana plugin from `.claude/settings.json` turns on. Then
   paste the prompt from your next steps page, for example:

   > GoBanana, build the page from design/explorations/&lt;slug&gt;/. Read DIRECTION.md and
   > BUILD-PROMPT.md first and use the installed theme.

4. When it is built, ask: "GoBanana, check my page against the kept draft."

## Commands

```bash
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

## What is in it

- `app/`: the layout, the theme (`globals.css`, shadcn CSS variables for light and dark) and a start page.
- `components/ui/`: shadcn components; add more with `npx shadcn@latest add <name>`.
- `design/explorations/`: where the install command puts your direction files.
- `.claude/settings.json`: the GoBanana plugin marketplace and plugin.
- `CLAUDE.md` and `AGENTS.md`: what Claude Code reads before it builds.
