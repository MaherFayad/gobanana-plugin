# GoBanana

**Mobbin shows what works. GoBanana shows what's next.**

GoBanana is a Claude plugin for one crazy idea over a page or two: a launch page, onboarding, an empty state, a 404, a paywall, a year in review, a checkout, a dashboard, a canvas or editor tool, a game screen, a slide, an email or a poster. It is not for your product's main design direction. Your product keeps its design system; the wild page inherits it and overrides only what the idea needs.

Ask your agent to "go wild" on a page. GoBanana bends the brief into unexpected directions, each with a full visual spec, fills a moodboard canvas with two zones of linked references (the wild idea as images, and real UI for your platform), and hands the direction you keep to Claude Code, Cursor, Copilot, Codex, v0 or Lovable as scoped files. Then it can screenshot what you built and grade it against the direction.

The plugin connects your agent to the GoBanana MCP server and adds 12 skills and 5 subagents. Each one is a short stub: it holds the safety rules and calls the GoBanana `get_playbook` tool, and the server sends the full playbook (which tools to call, in which order, and how to present the results) when it is needed. Playbook updates reach you without reinstalling the plugin.

> Status: v0.4.0, beta. The server runs at `https://gobanana.fun`.

## Install

### Claude Code

Add the GoBanana marketplace, then install the plugin:

```text
/plugin marketplace add MaherFayad/gobanana-plugin
/plugin install gobanana@gobanana
```

Then run `/mcp`, pick `plugin:gobanana:gobanana`, and log in. GoBanana uses OAuth, so there is no API key to paste. The skills need the GoBanana tools: without them they only know the safety rules.

### claude.ai and Cowork

Add the plugin from your organization's plugin settings or from Anthropic's directory once it is listed, and connect the GoBanana connector (claude.ai settings, Connectors) and log in.

### Connector or plugin server

The plugin brings its own server entry (`.mcp.json`, `https://gobanana.fun/api/mcp`, OAuth) so Claude Code works out of the box. On claude.ai the GoBanana connector gives the same tools under another name (`mcp__GoBanana__*` instead of `mcp__plugin_gobanana_gobanana__*`).

- If the claude.ai GoBanana connector is connected, use it. Every skill, subagent and hook works with whichever GoBanana tools are there, under any prefix.
- In a claude.ai cloud session the plugin's own server may show "requires authentication": that session can not run the OAuth login. This is expected and harmless while the connector is connected.
- With no GoBanana tools at all, the skills tell you to connect the GoBanana connector at claude.ai or run `/mcp` in Claude Code.

### Keeping the claude.ai copy current

claude.ai serves its own copy of an organization plugin; it does not follow this repo by itself. After each GoBanana release, an org admin must re-sync the GoBanana plugin in the organization's plugin settings on claude.ai, or cloud sessions keep running the old skills. In Claude Code, run `/plugin update gobanana`.

You can tell when a copy is behind: every skill calls the GoBanana `ping` tool once, and when the server's `minPlugin` is newer than the plugin's version, the agent tells you in one line to update.

## The flow

1. **One short intake.** The agent reads `design/gobanana/CONTEXT.md` and asks only what is missing, in one stop: how far to go (Explore, Explore then draft, Finished, Just references), your style words ranked, who it is for and the market, and the business goal with its number. The answers are saved to `design/gobanana/CONTEXT.md` and reused next time. Say "just go" and it fills the gaps itself and tells you what it assumed. If it is unclear what to design, the same stop asks once (or, under "just go", says which reading it took). If you name the whole product, it asks "Where should the weirdness go?" ([Where weirdness pays](https://gobanana.fun/docs/guides/where-weirdness-pays/)).
2. **Sweep and name the rut.** One wide search maps what the category already does, so no direction lands in it.
3. **Bend, structure first.** The agent writes 7 to 10 fresh ideas grounded in real culture, never one used on your recent boards; the server bends the strongest into 4 directions (or the number you ask for, up to 8). They differ in structure: layout skeleton, navigation and spatial model, not only ornament. Each has a working mechanic, and from wildness 3 up the idea can own the page layout. The look comes from the taste you gave or confirmed, never a hidden default. One is the subtract direction: the same job with less.
4. **See every result.** The agent looks at every reference image before it keeps one, keeps 8 to 12 per direction with a "steal:" note, and marks 2 to 3 per direction as the craft target the build must match.
5. **Shipped vs next.** If you have a Mobbin connector, real shipped screens that fit each direction go on the board with a "Shipped today" note. The board shows them straight from Mobbin; nothing is downloaded.
6. **Board.** A Space section (what the category does) and one section per direction, clustered by what to take (layout, components, type, color, motion, art), each tile with its source link.
7. **Draft or build.** Draft a pick into one checked screen (gobanana-draft), placed on the board beside its direction, or have the agent research, spec and build the feature properly in Claude Code (gobanana-finish). Every run ends with the canvas link; the HTML is in addition to the board, not instead of it.
8. **Hand off.** Scoped files for your coding tools, under `design/explorations/<slug>/` ([Hand off](https://gobanana.fun/docs/guides/handoff/)). Frankenstein it, palette and critique are there when you want them.

## Skills

| Skill | Say something like | What happens |
| --- | --- | --- |
| `gobanana-explore` | "go wild on our launch page", "crazy ideas for onboarding", "help me design the checkout" | One intake stop saved to CONTEXT.md, a sweep that names the rut, fresh grounded ideas bent into 4 directions (or your count) that differ in structure, every reference seen before it is kept, 2 to 3 craft targets per direction, Mobbin screens when connected, a clustered board and compact cards |
| `gobanana-finish` | "build it properly", "end to end", "production ready" | The intake, then problem, space, spec and wireframes for your OK, 4 directions to pick, one screen first for your reaction, then the code, reviewed against the craft references |
| `gobanana-draft` | "draft these", "draft my pick" | One checked screen per pick, built to the direction's craft references, rendered and graded before you see it, then placed on the board beside its direction |
| `gobanana-moodboard` | "make a moodboard", "arrange this", "put it in FigJam" | Sections per direction, art row above UI grid, steal notes, clean layout; optionally FigJam or an HTML board |
| `gobanana-palette` | "palette", "colors from the art direction" | Extracts colors with roles and tags each pair `ship` or `explore` by WCAG 2.2 contrast |
| `gobanana-design-md` | "DESIGN.md for this page" | Scoped DESIGN.md under `design/explorations/<slug>/`, linted with `@google/design.md` |
| `gobanana-agents-md` | "AGENTS.md", "rules for coding agents" | A scoped section merged into AGENTS.md or CLAUDE.md, never overwriting |
| `gobanana-asset-kit` | "asset kit", "tokens for this page" | Override tokens, Tailwind theme, safe gradients, one font pairing, one icon set, for the page only |
| `gobanana-handoff` | "hand this off", "Cursor rules for this", "prompt for v0" | Detects your tools, exports the harness pack, writes each file at its path, merges into AGENTS.md or CLAUDE.md |
| `gobanana-frankenstein` | "frankenstein it", "nav from this, hero from that", "make new layouts from my board" | Cuts parts out of the board's UI references (role, crop, light or dark, steal note), stitches 3 or 4 page variants from a recipe, reviews and fixes them, remixes with a lock, exports FRANKENSTEIN.md |
| `gobanana-build` | "build this Frankenstein page", "code this screen from the parts" | Turns the page's rows into a region plan, takes the look from the direction's craft references and tokens, renders in Arabic and English, grades side by side against the craft reference, fixes, then asks for your reaction |
| `gobanana-critique` | "critique the build", "does this match the direction" | Screenshots at platform sizes, grades the REVIEW.md checklist with evidence, top 3 fixes inside page scope |

### Platforms

| Platform | UI references | Export defaults | Critique sizes |
| --- | --- | --- | --- |
| `mobile` | App screens and mobile galleries; web titles dropped | 4 columns, 16px margins, 44pt targets, tab bar and bottom sheet | 390x844 |
| `tablet` | Tablet and app screens | Split views, larger targets | 834x1194 |
| `website` | Landing pages, heroes, sites; website galleries | 12 columns, fluid type with clamp | 1440x900 and 390x844 |
| `webapp` | Web apps; dashboards only for real dashboards; mobile only titles dropped | 12 columns, or a sidebar shell for real dashboards; 8px rhythm, keyboard | 1440x900 |
| canvas pages (any platform) | Canvas, whiteboard, moodboard and editor tools | Full bleed canvas with a slim tool rail, floating inspector, zoom and minimap; keyboard for every drag | The platform's sizes |

### Wildness

| Level | Label | |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour |
| 2 | Bold | One strong move |
| 3 | Weird | Two moves combined (default) |
| 4 | Wild | Two or three moves |
| 5 | Bananas | Three moves, usability ignored on purpose |

From 3 up, a direction can own the whole page layout. Work screens (dashboards, inboxes, checkout) at 1 or 2 keep their known layout and put the idea on one working part.

### MCP tools

`ping`, `get_playbook`, `bend_brief`, `search_references`, `rate_references`, `rate_directions`, `extract_palette`, `new_canvas`, `open_canvas`, `add_to_canvas`, `arrange_canvas`, `get_canvas`, `delete_canvas`, `export_kit`, `cut_parts`, `frankenstein_page`, `remix_frankenstein`, `update_frankenstein`, `get_snapshot`, `place_kept`, `reconcile_direction`.

- `ping` checks the connection and names the oldest plugin version the server supports (`minPlugin`).
- `get_playbook` returns the playbook for a skill, a step or a subagent by name (for example `gobanana-explore` or `gobanana-explore/intake`). Every skill and subagent calls it first.

- `bend_brief` takes `platform` and up to 3 `pages`, and returns `wildSpots` when no pages are given.
- `search_references` returns two zones, `ui` and `art`. Sources: UI galleries by platform, plus Pinterest, Dribbble, Behance and Awwwards. At most 2 results per studio, newer work first, UI kits dropped.
  - Website galleries: Lapa Ninja, Siteinspire, CSS Design Awards, landing.love, Unsection, Supahero, The FWA, Httpster, Dark Design.
  - Web app galleries: Refero, SaaSFrame, Nicelydone. Components: 21st.dev (React and Tailwind components, good parts for Frankenstein pages). Mobile galleries: ScreensDesign, 60fps, Figma Community. Style: Bento Grids.
  - Art direction: Fonts In Use, typographic posters, Swissted, The Brand Identity, BP&O, Cosmos, Are.na, Designspiration.
  - Reached through web image search only, never scraped. Each search picks galleries by platform and style words.
- `add_to_canvas` reference items take a `note` (what to steal, up to 280 characters).
- `cut_parts`, `frankenstein_page`, `remix_frankenstein` and `update_frankenstein` power Frankenstein it. A part is a role plus a crop rectangle over a hotlinked image; the browser applies it. `get_canvas` lists parts by role and each Frankenstein page with its skeleton.
- `delete_canvas` deletes a canvas for good (sections, items, tray, share link) and frees a slot. It needs `confirm: true`, and the skills call it only after you say yes to a named board. You can also delete boards from the web dashboard.

The server does no AI work: bend moves and specs are templates and word lists, and any thinking happens in your own agent. The server returns text; your agent writes the files.

If your client cannot show the canvas inline, every skill gives you the web link to open it full screen.

## Exports and plans

`export_kit` takes `directionId`, `pages` (routes or globs like `app/pricing/**`) and `scope`. The default scope is `page`: every file applies only to the named pages, inherits your design system and does not change it. `scope: "system"` is for when you want the direction to become your product's system.

| Format | File | Plan |
| --- | --- | --- |
| `design_md` | `design/explorations/<slug>/DESIGN.md` | Free |
| `brief` | `BRIEF.md` | Free |
| `direction_md` | `design/explorations/<slug>/DIRECTION.md` | Free |
| `build_prompt` | `design/explorations/<slug>/BUILD-PROMPT.md` | Free |
| `review` | `design/explorations/<slug>/REVIEW.md` | Pro |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc` | Pro |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md` | Pro |
| `agents_md` | Section in `AGENTS.md` | Pro |
| `claude_md` | Section in `CLAUDE.md` | Pro |
| `tokens`, `tailwind` | Override tokens and theme for the pages | Pro |
| `figjam_spec`, `html_board` | Board as FigJam spec or HTML | Pro |
| `stitch_md` | `design/explorations/<slug>/FRANKENSTEIN.md` | Free |
| `wireframe_html` | `design/explorations/<slug>/frankenstein-wireframe.html` | Pro |

Free also covers `bend_brief` (unlimited), 30 searches a month and 3 canvases. When you hit a limit, the skills show the plain upgrade message once and stop; they never retry in a loop. At the canvas limit they offer to add to an existing board or delete an old one, and delete only after you say yes.

## Frankenstein it

Frankenstein pages: the nav from one reference, part of the hero from another, the cards from a third, stacked into a new page. Several at once. Light next to dark is fine. It is for ideas over one page, not a finished design or your product's system.

`gobanana-frankenstein` works the way a designer slices a swipe file:

1. **Pick the board, the platform and one page type** (landing, pricing, dashboard home, a phone home screen).
2. **Look and slice.** The agent looks at each reference when it can see it, picks the strongest parts, and calls `cut_parts` with a role, a tight crop, light or dark, and a `steal:` note. It aims for 2 to 4 candidates per role from at least 4 sources. If it cannot see the images it says so, cuts by role only, and every crop is marked as a guess.
3. **Stack.** `frankenstein_page` with a recipe (for a website: nav, hero, logos, features, cards, testimonial, cta, footer) and 3 or 4 variants, or with the exact rows you dictated ("nav from this, hero from that").
4. **Judge and fix.** Rhythm, hierarchy, contrast jumps, seams, and whether it reads as one page. Fixes go through `update_frankenstein` (swap, move, recrop, widths); `remix_frankenstein` keeps the rows you like and swaps the rest. Modes `even` and `wireframe` help you judge structure.
5. **Present.** A numbered skeleton per variant: role, what it steals, and the source link.
6. **Hand off.** FRANKENSTEIN.md (Free) and frankenstein-wireframe.html (Pro, grey boxes, no reference images). BUILD-PROMPT.md lists the Frankenstein pages. Build, then critique.

Nothing is cut out of an image file. A part is a rectangle the browser shows over the original image at its source, and every part keeps its link.

## Harness pack

`gobanana-handoff` writes the pack for the tools it finds in your repo: `CLAUDE.md` or `.claude/` for Claude Code, `.cursor/` for Cursor, `.github/` instructions for Copilot, `AGENTS.md` for Codex, and a paste-ready BUILD-PROMPT.md for v0 and Lovable. It merges a marked section into AGENTS.md and CLAUDE.md and never overwrites them. See [Hand off](https://gobanana.fun/docs/guides/handoff/) for what each file holds and example AGENTS.md and CLAUDE.md sections.

## Hard rules on images and sources

- **GoBanana never downloads, stores or re-hosts reference images.** It keeps URLs and metadata only. Images load in your browser from their source.
- **Every reference shows its source link**: on the canvas, in share links, in every export, and in every skill reply.
- **Parts are crops in the browser, not files.** Frankenstein it never cuts or saves pieces of a reference; the crop is a rectangle over the hotlinked image.
- **Never copy reference images into your repo.** The skills will not do it, and the files they write tell coding agents not to either.
- **Mobbin through your own connector.** The agent searches with your own Mobbin connector; GoBanana never searches Mobbin. Screens it places are shown straight from Mobbin's image links and linked to their Mobbin pages, never downloaded or stored. Mobbin image links expire after about 30 days; then the tile shows a link to the screen instead.
- **No scraping.** References come from web search results only.
- Palette extraction reads thumbnails in memory on the server to compute colors, then drops them.

## Privacy

- The GoBanana server records which tools are used and whether they work, never what you type. See the [privacy policy](https://gobanana.fun/en/privacy).
- The plugin's hooks run on your machine and send nothing anywhere: they keep a small session flag in your temp folder and never read your conversation history.

## License

MIT. See [LICENSE](LICENSE).
