# scoregrove

A pnpm monorepo with three packages:

- **`packages/domain`** (`@scoregrove/domain`) — shared types and pure logic, no runtime dependencies
- **`packages/server`** — an Express API that consumes `domain`
- **`packages/web-client`** — a Vue 3 + Vite app that consumes `domain` and talks to `server`

## Prerequisites

- **Node.js 20+**
- **pnpm** — this repo pins `pnpm@10.33.0` via the `packageManager` field in `package.json`. The easiest way to get a matching pnpm without a manual global install is [Corepack](https://nodejs.org/api/corepack.html), which ships with Node:

  ```sh
  corepack enable
  ```

  Once enabled, running any `pnpm` command in this repo will automatically use the pinned version.

## Getting started

```sh
pnpm install   # installs dependencies for every package in the workspace at once
pnpm build     # builds domain, then server and web-client (in dependency order)
```

Then, in two separate terminals:

```sh
pnpm dev:server   # Express API on http://localhost:3001
pnpm dev:web      # Vue app on http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173 — you should see a counter UI that reads/writes through the Express API.

## Using pnpm in this repo

This is a **pnpm workspace**: one `pnpm install` at the repo root installs dependencies for all three packages and links `@scoregrove/domain` into `server` and `web-client` automatically (no publishing needed — it's a live symlink to `packages/domain`).

A few commands you'll use often:

- **Run a script in one package**, using its `name` field from `package.json` (`server`, `web-client`, or `@scoregrove/domain`):

  ```sh
  pnpm --filter server dev
  pnpm --filter web-client build
  pnpm --filter @scoregrove/domain build
  ```

- **Run a script in every package** (pnpm figures out build order automatically, so `domain` always builds before `server`/`web-client`):

  ```sh
  pnpm -r build
  ```

- **Add a dependency to a specific package** — run this from anywhere in the repo, `--filter` picks the package:

  ```sh
  pnpm --filter server add lodash
  pnpm --filter web-client add -D @types/some-package
  ```

- **Add domain as a dependency of a new package** — reference it by workspace protocol so it always resolves to the local copy, not npm:

  ```json
  "dependencies": { "@scoregrove/domain": "workspace:*" }
  ```

  then run `pnpm install` to link it.

### Root-level shortcuts

These are defined in the root `package.json` and cover the common cases:

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm build`        | Builds every package (`pnpm -r build`)    |
| `pnpm test`         | Runs tests in every package that has them |
| `pnpm dev:server`   | Runs the Express server in watch mode     |
| `pnpm dev:web`      | Runs the Vite dev server                  |
| `pnpm storybook`    | Runs Storybook on http://localhost:6006   |
| `pnpm lint`         | Lints the whole repo with ESLint          |
| `pnpm lint:fix`     | Same, but auto-fixes what it can          |
| `pnpm format`       | Formats the whole repo with Prettier      |
| `pnpm format:check` | Checks formatting without writing changes |

## Per-package scripts

| Package      | Script            | What it does                                                               |
| ------------ | ----------------- | -------------------------------------------------------------------------- |
| `domain`     | `build`           | Type-checks and compiles `src/` to `dist/` via `tsc -b`                    |
| `domain`     | `test`            | Type-checks `src/` + `test/`, then runs the Vitest suite                   |
| `domain`     | `test:watch`      | Runs Vitest in watch mode                                                  |
| `server`     | `dev`             | Runs `src/index.ts` directly with `tsx` (watch mode, no build step needed) |
| `server`     | `build`           | Compiles to `dist/` via `tsc -b`                                           |
| `server`     | `start`           | Runs the compiled output (`node dist/index.js`) — run `build` first        |
| `web-client` | `dev`             | Starts the Vite dev server                                                 |
| `web-client` | `build`           | Type-checks are skipped here (see note below) and Vite bundles to `dist/`  |
| `web-client` | `preview`         | Serves the production build locally                                        |
| `web-client` | `storybook`       | Runs Storybook in watch mode on port 6006                                  |
| `web-client` | `build-storybook` | Builds a static Storybook site to `storybook-static/`                      |

## Editor setup

Open the repo root in VS Code — it'll prompt you to install the recommended extensions (`.vscode/extensions.json`): ESLint, Prettier, and EditorConfig. Format-on-save is already configured in `.vscode/settings.json`.

## Things worth knowing

- **TypeScript 7 vs. 6.0.3**: every package builds with TypeScript 7 (`tsc -b`), but the ESLint toolchain (`typescript-eslint`) doesn't support TS7's new API yet, so it's pinned to TypeScript 6.0.3 for linting only, via `pnpm.overrides` in the root `package.json`. This doesn't affect how the code actually builds or runs — it's purely a linter-compatibility shim, worth removing once `typescript-eslint` catches up.
- **Vue + TS7**: the "Vue - Official" VS Code extension and `vue-tsc` also don't support TS7 yet, so `.vue` files won't get full IDE type-checking from Vue tooling right now. `web-client`'s `build` script relies on Vite/esbuild (which doesn't type-check) rather than `vue-tsc`, so builds still succeed; a manual `tsc --noEmit` in `packages/web-client` will still catch plain `.ts` errors.
- **Tests** live in `packages/domain/test/` (kept outside `src/` so `tsc -b` doesn't compile them into `dist/`) and run with [Vitest](https://vitest.dev). `pnpm test` at the root runs every package's suite; `domain` is currently the only package with one.
- **Storybook** lives in `packages/web-client` (config in `.storybook/`, stories alongside components as `*.stories.ts`) rather than a separate package — there's exactly one frontend app and no shared component library consumed by multiple packages, so a split package would only add cross-package import friction for no current benefit. `storybook init`'s defaults pull in a lot more than a component browser: a Chromatic (paid SaaS) addon, a Playwright-driven interaction-testing addon with its own `vitest`/browser wiring in `vite.config.ts`, and an onboarding-tour addon. All of that was stripped back to just `@storybook/addon-docs` and `@storybook/addon-a11y` (the latter is just `axe-core`, no browser automation). `eslint-plugin-storybook` is a root-level devDependency, not `web-client`'s, because the shared `eslint.config.js` that imports it lives at the repo root — pnpm's per-package `node_modules` isolation means a plugin used only by a nested package's script wouldn't resolve from there.

## Decisions

Design decisions made while building the musical-score model in `packages/domain`, recorded so they aren't re-litigated by accident.

### Timewise, not partwise

The score model is **timewise**: a `Score` holds a sequence of `Measure`s, and each measure holds one `StaffContent` entry per staff. The alternative (partwise — each staff owning its own measure sequence, as MusicXML defaults to) was considered and rejected.

Rationale:

- Everything on a `Measure` besides its contents — key/time/tempo changes, barlines, repeats, volta endings, segno/coda marks, jumps — is **score-wide**: every staff repeats together, changes key together, jumps together. Timewise gives those attributes one home. Partwise would force either duplicating them onto every staff (with "do they agree?" drift validation, which is what MusicXML does) or hoisting them into a parallel form track with its own length-equality invariants.
- The roadmap is **playback** (walks time forward, measure by measure) and **full-score rendering** (vertically aligned systems) — both iterate in the timewise grain.
- The two views are mutually derivable, so the real choice is which one is canonical and validated by construction. Part extraction ("give me just the bass part") can be added later as a cheap derived projection without changing the model.

If the product's center of gravity ever shifts to individual part editing, revisit — that's the world partwise serves. A per-part composition DSL does **not** require revisiting: the DSL can accept per-part input and assemble timewise measures at build time.

### Validation layering: `create` vs. `check`

Validity lives in three layers, and only two of them belong in constructors:

1. **Shape** — the types themselves (a `Pitch` cannot lack an octave).
2. **Local invariants** — single-object coherence needing no outside context (`repeatTimes` without a `RepeatClose`, a one-note chord). These stay in `create` functions: a UI submits them atomically, so rejecting them at construction never blocks a legitimate draft.
3. **Whole-structure coherence** — measure fullness under a changing time signature, ties across barlines, a jump whose segno exists. These are validated by on-demand **`check` functions** (`Score.check`, `Measure.check`), each returning `Result<void>` with every problem aggregated. They cannot be constructor-enforced without making editing impossible: a score mid-composition legitimately violates them, and the UI must be able to hold that draft as a real value.

Consequences: `Score.of` is a plain builder (its former `create` validations moved into `Score.check`), and future playback/rendering entry points should call `check` internally so an unchecked score can't produce sound or engraving. If compile-time proof of checkedness is ever wanted, `check` can be upgraded to return a branded `Result<CheckedScore>` — deferred because UI mutation would invalidate the brand constantly.

`Score.check` currently covers: staff alignment, navigation targets, measure fullness (first measure may be underfull as a pickup; the "final measure complements the pickup" convention is not handled), repeat pairing (no nesting, no unclosed opens), volta ending structure (dense passage numbers, non-final brackets close with a repeat), tie continuity per staff/voice (including per-tone chord ties; rests and voice gaps break ties), and slur balance. Fullness uses exact rational arithmetic (the `Fraction` fundamental) — written-notation math, still no mapping to performance parameters.

### Known omissions and simplifications

Deliberate gaps in the current vocabulary, in roughly the order they'll matter:

- **Slurs have no numbering.** A note's `slur` is just Begin/End/Both, so overlapping or nested slurs cannot be told apart. MusicXML-style slur numbers can be added when engraving needs them.
- **Tuplet brackets are per-duration, not grouped.** A tuplet lives on each `Duration` (`{ count, inSpaceOf }`); there is no grouping element spanning the notes. Rendering must infer bracket spans from adjacency.
- **Hairpin extent is implicit.** A Crescendo/Diminuendo element runs "until the next dynamic indication" rather than having an explicit end point.
- **Grace notes cannot be dotted or beamed.** A `GraceNote` is a bare pitch + note value + style (acciaccatura/appoggiatura).
- **Lyric melisma extension lines are not modeled.** Syllables carry hyphenation (`Syllabic`), but the sustained-vowel extension line is absent.
- **A `RepeatClose` without a preceding `RepeatOpen` is deliberately legal** (traditionally "repeat from the beginning"); other repeat and volta structure is validated by `Score.check`.
- **Voices are per-measure with no cross-measure consistency check** — intentional, since voices genuinely appear and disappear measure to measure.
