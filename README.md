# Roblox-RPG

A multiplayer RPG for Roblox (islands, dungeons, bosses), written in TypeScript with [roblox-ts](https://roblox-ts.com) and synced to Roblox Studio with [Rojo](https://rojo.space).

Project rules and architecture: [CLAUDE.md](CLAUDE.md).

## Requirements

- Node.js 24+
- [Rokit](https://github.com/rojo-rbx/rokit) (installs the pinned `rojo` and `lune` from `rokit.toml`)
- Roblox Studio with the Rojo plugin

## Quick start

```sh
rokit install      # rojo + lune, versions from rokit.toml
npm ci             # npm dependencies, exactly as locked
npm run build      # TypeScript -> Luau in out/
npm test           # unit tests (headless, under Lune)
```

Live development, in two terminals:

```sh
npm run watch      # recompile on save
rojo serve         # then click "Connect" in the Rojo plugin in Studio
```

## Layout

```
src/shared/   code for both server and client: data, pure formulas, network contracts (no secrets)
src/server/   authoritative game logic and player data
src/client/   input, camera, UI, effects
scripts/      tooling (headless test runner)
```

Each runtime is split into `app/` (bootstrap), `features/<feature>/` (public API in `index.ts`) and `lib/`.

## Contributing

`main` is protected: open a pull request; CI (build, lint, test, audit) must pass.
Never commit `.env` or place files (`.rbxl` / `.rbxm`).
