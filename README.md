# GoBanana plugin

The GoBanana plugin for Claude Code and claude.ai (version 0.9.7), and a starter project to build a page in. This repo is written by a release script; changes made here are replaced on the next release.

## Install the plugin

In Claude Code:

```bash
/plugin marketplace add MaherFayad/gobanana-plugin
/plugin install gobanana@gobanana
```

On claude.ai, add `MaherFayad/gobanana-plugin` as a marketplace under Customize, Plugins.

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
