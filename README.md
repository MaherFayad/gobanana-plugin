# GoBanana plugin

The GoBanana plugin for Claude Code and claude.ai (version 0.9.9), and a starter project to build a page in. This repo is written by a release script; changes made here are replaced on the next release.

## Install the plugin

In Claude Code, from your shell (version 2.1.292 or later):

```bash
claude plugin install gobanana --marketplace MaherFayad/gobanana-plugin
```

On any version, inside Claude Code:

```bash
/plugin marketplace add MaherFayad/gobanana-plugin
/plugin install gobanana@gobanana
```

On claude.ai (Pro, Max, Team or Enterprise): Customize, Plugins, Add, Add marketplace, paste `MaherFayad/gobanana-plugin`, then Add on GoBanana and Connect in its Connectors tab.

## Other coding agents: the skills

Cursor, Codex, VS Code, Windsurf and other agents the skills CLI supports (Node.js 22.20 or later), from your project:

```bash
npx skills add MaherFayad/gobanana-plugin
```

This adds the skills only, not the agents, hooks or connector. Connect the GoBanana server in your agent too: https://gobanana.fun/docs/setup/overview/

## Start a project

```bash
npx degit MaherFayad/gobanana-plugin/starter my-app
cd my-app
npm install
```

A Next.js app with Tailwind CSS v4 and shadcn/ui, with the GoBanana plugin turned on in `.claude/settings.json`. See `starter/README.md`.

## What is here

- `.claude-plugin/marketplace.json`: the marketplace, with one plugin.
- `gobanana/`: the plugin.
- `starter/`: the starter project.

Docs: https://gobanana.fun/docs
