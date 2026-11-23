# Roblox RPG: project rules for Claude Code

A multiplayer RPG map for Roblox (islands, dungeons, bosses). Solo play and co-op both run on the same server model.
Written in TypeScript with roblox-ts, synced to Studio with Rojo.

## Division of work
- The developer owns all code. A friend owns models, map and design (Blender, then Roblox Studio).
- Scripts live in Git and sync through Rojo. Map and models are NOT edited through this repo's code.
- Never edit binary place files (.rbxl / .rbxm). Models are consumed through documented paths only.
- Roblox Studio MCP (`roblox-studio` server, registered locally per developer) is READ-ONLY for Claude: inspect the
  game tree, scripts and Output. Tools that change the place or the account (`execute_luau`, `multi_edit`, asset
  generation/upload, Open Cloud, input simulation) are denied in `.claude/settings.json`. `start_stop_play` asks first.
  Save or publish a place version before any playtest.

## Commands
(Keep this list current.)
- `rokit install`: install pinned CLI tools from `rokit.toml` (rojo, lune). Once per machine / after changes.
- `npm ci`: install npm dependencies exactly as locked.
- `npm run build`: `rbxtsc` (TypeScript → Luau in `out/`)
- `npm run watch`: `rbxtsc -w`
- `npm run lint`: `eslint . && prettier --check .`
- `npm run format`: Prettier write + ESLint autofix
- `npm test`: build, then run unit tests headless under Lune (see Testing)
- `npm run audit`: `npm audit --audit-level=moderate`
- `rojo serve`: live sync to Studio (run together with `npm run watch`)
- Before finishing any task: build, lint and tests must all pass.

## Architecture: feature slices, adapted to Roblox
Roblox has three runtimes (server, client, shared), so the top level is split by runtime and each
runtime is split by feature. This replaces classic Feature-Sliced Design, which assumes one runtime.

```
src/
  shared/              # runs on both sides: NO secrets, NO trust decisions
    features/<feature>/   # types, definitions (data), pure formulas, network contracts
    lib/                  # tiny generic helpers
  server/              # authoritative game logic, data, validation
    app/                  # bootstrap: starts services in order
    features/<feature>/   # services, handlers, persistence
    lib/
  client/              # input, camera, UI, effects only
    app/
    features/<feature>/   # controllers, UI components
    lib/
```

Features (initial): `profile` (data), `stats`, `combat`, `abilities`, `inventory`, `enemies`, later `dungeons`, `world`.

Rules:
1. A feature exposes only its `index.ts`. Never import another feature's internals.
2. Dependency direction: `app` → `features` → `lib`. Features talk to each other through their public API or events.
3. Pure game logic (damage formulas, stat math, loot tables, cooldown checks) lives in `shared/features/*`
   with NO Roblox API calls, so it can be unit tested without Studio.
4. Game content is DATA (items, abilities, enemies, loot tables) in definition files, not hard-coded in logic.
5. Small files, clear names, no clever tricks. Readability beats brevity. Comments explain WHY.
6. No `any`, no non-null assertions without a comment, strict TypeScript.

## Security rules (highest priority)
Data security and anti-exploit are the top requirement of this project.

### Authority
- The SERVER decides everything: damage, hit validation, loot, XP, currency, inventory changes, progression.
- The client sends intent only ("use ability X on target Y") and renders results. Never send computed
  results from the client and never trust client-supplied values (damage, position, cooldowns, item IDs).

### Every RemoteEvent / RemoteFunction handler MUST
- Validate argument count and types at runtime (do not rely on TypeScript types, they do not exist at runtime).
- Validate ranges, enums, and that referenced instances/IDs exist and belong to the player.
- Check game-state legality (alive, not stunned, cooldown ready, in range, owns the item).
- Be rate limited per player; reject and log abuse. Never throw on bad input from a client, just drop it.
- Never return data the player must not see (other players' data, server internals).

### Player data
- Use ProfileStore (or ProfileService) with SESSION LOCKING. One live session per player, no manual raw DataStore writes for profiles.
- Data schema is versioned. Every schema change ships with a migration and a test. Never break old saves.
- Profile writes happen only on the server. Release the profile correctly on leave and on server shutdown (BindToClose).
- Operations that move value (trade, drop, pickup, craft, buy) must be atomic, to prevent duplication exploits.
- Keep a bounded backup/rollback path (DataStore versioning) and document how to restore a player.
- Store the minimum data needed. No personal information beyond the Roblox user ID. Do not log personal data.

### Secrets and supply chain
- No API keys, Open Cloud keys, cookies or tokens in the repo, ever. Use environment variables locally
  (`.env` is git-ignored) and GitHub Actions secrets in CI.
- Do not read, print or commit `.env` or any secrets file.
- Pin dependencies with the lockfile. Add a new package only with a stated reason; prefer well-known, maintained ones.
- Run `npm audit` in CI. Enable Dependabot and GitHub secret scanning.

## Testing
- Pure logic in `shared/features/*` must have unit tests: formulas, cooldowns, loot rolls, inventory rules, migrations.
- Security-critical code needs tests for BAD input too (wrong types, out-of-range values, spam, duplicates).
- Every bug fix gets a regression test.
- Test runner: **@rbxts/lunit** (decorator-based: `@Test`, `Assert.*`), run headless under **Lune** by
  `scripts/run-tests.luau`. Chosen because pure logic can be tested in CI on Linux in milliseconds,
  with no Roblox Studio and no secrets. (@rbxts/jest needs a real Roblox runtime via Open Cloud; TestEZ is abandoned.)
- Test files: `*.test.ts` next to the code they test (e.g. `shared/features/stats/formulas.test.ts`),
  one class per file, `export = ClassName`. Rojo ignores `*.test.luau`, so tests never ship in the game.
- `scripts/run-tests.luau` fakes only the DataModel paths that compiled code uses. A test that needs a real
  Roblox service fails with a clear error: that logic does not belong in pure `shared/features/*` code.
- CI (GitHub Actions) runs build, lint, tests and audit on every pull request.

## Git workflow
- Branches: `main` = stable releases, `develop` = integration branch for day-to-day work.
- Work happens on short-lived branches from `develop` (`feat/...`, `fix/...`, `chore/...`), merged into `develop` by PR.
  `develop` is merged into `main` by PR only when it is stable.
- `main` and `develop` are protected: changes go through pull requests, CI must pass.
- Small commits, clear messages (`feat(combat): add auto-attack tick`).
- Do not commit generated output (`out/`, `node_modules/`).

## Token efficiency
- To understand code structure (definitions, callers, change impact, linked tests) use the Graphify tools
  (`graphify_find`, `graphify_callers`, `graphify_impact`, `graphify_tests_for`) before reading many files.
  Use text search only for literal strings and config. If the graph's commit differs from HEAD, read the file.
- Never read `node_modules/`, `out/`, `include/` or `package-lock.json` (blocked in `.claude/settings.json`).
- Show only failing lines of build/lint/test output. `/pre-pr` does this for the four gates.
- Project skills: `/pre-pr` (all gates), `/new-feature <name>` (scaffold a feature slice).
- A hook formats edited files with Prettier automatically; do not spend turns on formatting.

## How to work with me
- Before big changes, state a short plan and wait for approval.
- Explain non-obvious decisions briefly so the developer learns the Roblox ecosystem (new to it).
- If a requirement conflicts with a security rule, stop and ask instead of choosing the insecure option.
