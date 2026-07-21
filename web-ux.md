# Web UX Strategy

The editor described in TODO-UX.md, built the same way the renderer was: pure, tested logic in
packages, thin components that draw state and forward intents, and a strategy checklist that
tracks honest progress. Decisions already made with the user: rest-backed placement, the "p"
eyedropper-with-persistence, key-aware semitone spelling, localStorage projects.

## Strategy

1. **Editing is pure functions in a new `packages/editing`** — the engraving pattern again.
   Every operation is `(Score, intent) → Score` (plain JSON in, plain JSON out): placing a
   note, erasing, stepping pitch, resizing durations, staff management. Depends on domain
   only; no Vue, fully vitest-testable. The UI never mutates a score — it dispatches intents.

2. **The rest-backed invariant.** Empty measures hold whole rests; placing consumes rest time
   (splitting remainders greedily into note values, exact-Fraction throughout); erasing
   restores rest time and merges. `Score.check` passes after **every** operation — the editing
   test suite asserts this invariant on every op, which is what makes fearless editing cheap.

3. **One reactive store, no new dependencies.** A plain-Vue `reactive` module (no pinia, no
   router — view switching is a store field) holding: the score, the undo/redo snapshot stack
   (plain JSON makes snapshots trivial), the active tool, recent selections (max 12,
   dedupe-and-promote), per-view presentation prefs (flow preset, staff visibility), and the
   current project name. localStorage persistence reads/writes the same JSON.

4. **Interaction reuses the layout tree.** Hit-testing existing elements rides the
   `ScoreAddress` `data-*` attributes emitted since day one. Placement on empty staff needs
   the inverse — pointer position → (measure, onset, staff position) — computed from the
   `LaidOut*` structures by pure "interaction geometry" helpers in `packages/editing`. Hidden
   staves are a **display projection**: a derived score with staves filtered out, plus a staff
   index map so addresses translate back to the real score. The renderer is never modified for
   editing.

5. **Design system before features.** The primitives below get built and storybook'd first;
   every editor surface composes them. UI chrome is hand-rolled HTML/CSS on design tokens
   (CSS custom properties) — no component-library dependency, matching the repo's ethos.
   Overlays (dialogs, flyouts) teleport to `body` and share one z-layer scheme. Accessibility
   floor: focus trap + Esc in dialogs, `aria-pressed` on tool toggles, `aria-expanded` on
   flyout triggers, native form controls styled rather than reinvented.

6. **Two views, one score display.** Editor: ≤300px sidebar (view switch / pallet / projects)
   beside the interactive staff. Performance: full-bleed read-only score, hover corner menu
   (Edit, Print, Staff), always vertical flow; Print is browser print via a print stylesheet.
   Flow presets map to layouts that already exist — vertical = `ScoreLayout` line breaking,
   horizontal = `SystemLayout.unbroken` with horizontal scrolling — behind one score-display
   component with a `flow` prop.

## The design system (`web-client/src/ui/`)

Each primitive exists because two or more surfaces need it:

| Component        | Used by                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `AppButton`      | everything; `pressed` prop covers radio-style pallet tools           |
| `AppDialog`      | staff dialog, project dialogs, confirmations                         |
| `ConfirmDialog`  | staff removal, project delete, bar erase (composes AppDialog)        |
| `AppFlyout`      | duration picker, right-click element editor (anchored or at pointer) |
| `AppSelect`      | flow preset, per-staff clef                                          |
| `AppTextField`   | staff label, project name                                            |
| `AppCheckbox`    | per-staff visibility                                                 |
| `MusicIcon`      | pallet tools, recents, dot/accidental/articulation pickers — a SMuFL |
|                  | glyph as an inline icon-sized SVG, reusing Bravura + `Glyphs`        |
| `SidebarSection` | the sidebar's three regions                                          |

Composables: `useDismissable` (outside click + Esc, shared by dialog and flyout),
`useFocusTrap` (dialogs), `useHotkeys` (scoped key handling with a hover-target context).
Tokens: `tokens.css` — color, spacing, type scale, radii, shadows, z-layers, motion.

Deliberately excluded for now: tooltips (native `title` to start), toasts, the performance
corner menu (single-use — lives in the performance view), drag-and-drop.

## Checklist

Ordered for implementation: tokens and primitives first, then the pure editing core, then the
shell, then the feature steps of TODO-UX.md.

### Design system

- [x] `tokens.css` — color, spacing, type, radii, shadows, z-layers, motion (light + dark via
      `prefers-color-scheme`; no manual toggle in v1)
- [x] useDismissable / useFocusTrap / useHotkeys composables
- [x] AppButton (default / quiet / danger / link; icon slot; `pressed` toggle state)
- [x] AppDialog (teleported, focus-trapped, Esc/overlay dismiss, title + footer slots)
- [x] ConfirmDialog (message + confirm/cancel over AppDialog)
- [x] AppFlyout (anchored to trigger or pointer position; dismissable; clamped to viewport)
- [x] AppSelect (label + styled native select)
- [x] AppTextField (label + input + validation message)
- [x] AppCheckbox
- [x] MusicIcon (SMuFL glyph at icon size; sized via bounding box)
- [x] SidebarSection (heading + slot)
- [x] Stories for every primitive

### Editing core (`packages/editing`)

- [x] Duration decomposition — a Fraction as a sequence of rest values (7/16 → dotted quarter +
      sixteenth), exact arithmetic, the foundation of rest-backing. Backtracking, not plain
      greedy: pure greedy takes a wrong turn on at least one reachable case (5/128 = dotted
      64th + plain 64th; greedy grabs a plain 32nd instead, since it's also ≤5/128 and bigger
      than the dotted 64th, then gets stuck on the 1/128 left over). Throws only when no exact
      decomposition exists at all — a real, narrow limit of the Duration model for a few
      fine remainders next to dotted/double-dotted short notes, not a bug.
- [x] `emptyMeasure` / `emptyStaffContent` builders (whole-rest-backed)
- [x] `placeElement` (`Placement.place`) — consume rest time at an onset, splitting
      remainders; spans multiple consecutive rests when one isn't enough. A note landing on a
      same-duration note or chord already at that onset forms/extends a chord instead of
      failing (`formChord`) — clicking twice on one beat is how a chord gets built. Pending:
      append measures when placing past the end (rejected for now, not silently clipped)
- [x] `eraseElement` (`Placement.erase`) — restore rest time, merge adjacent rests on both
      sides, remove a dynamic outright. A chord needs a `targetPitch` (the same derivation
      `place` uses) to know which tone to remove — collapses to a plain `Note` once one tone is
      left; without a `targetPitch` a chord is still refused outright. Refuses a tied/slurred
      note (or a chord tone/chord carrying one) rather than attempting repair, since ties/slurs
      aren't user-editable in v1 and a wrong repair would silently corrupt the score
- [x] `eraseBar` (`Placement.eraseBar`) — resolved as leaned: resets every staff/voice in the
      measure to whole rests rather than shortening the piece; preserves the measure's own
      key/time/barline/navigation fields and any genuine clef change (only content resets) —
      leaves a staff's clef unset if the measure didn't already carry a change there, rather
      than fabricating one from the staff's starting clef, same fix and reasoning as
      `MeasureOps.addMeasure`. An ordinary chord resets along with everything else — it doesn't
      reach outside its own measure. A tied note or chord tone doesn't block the reset either
      (fixed a bug where it did): any tie reaching into an adjacent measure — starting there,
      closing there, or both, for a `Both`-role note in the middle of a chain — is cleaned up
      first via `removeTie`, downgrading whichever neighbor it's tied to, the same as erasing
      that one note/tone directly would. Only a slurred note or chord still refuses the whole
      reset, checked across every staff and voice in the bar
- [x] Pitch stepping (`PitchStepping.step`) — chromatic number ↔ written pitch, key-aware
      spelling (key-implied spelling first, e.g. G major steps to F♯ never G♭; then the plain
      natural letter, explicit-Natural only when the key alters it; sharps ascending / flats
      descending only for the five pitch classes with no natural-letter match). Caught and
      fixed a real bug before it shipped: a pitch's chromatic value depends on the key
      whenever its own accidental is omitted (an omitted accidental means "follow the key
      signature," so bare "F" in G major sounds as F♯, not F-natural) — `chromaticIndex` takes
      the key for exactly this reason, not just for spelling the output
- [x] Duration ops (`DurationOps`) — halve/double (breve–64th clamp, dots and tuplet
      membership preserved), dot cycle, articulation toggle (empty → `undefined`, never `[]`)
- [x] Staff ops (`StaffOps`) — add (back-filled with rests, using the time signature actually
      in force at each measure — not necessarily the measure's own `time` field, if the last
      change was earlier in the piece), remove (min one staff), update clef/label (whole-row
      replacement, not a partial patch — no ambiguity about "unchanged" vs "cleared")
- [x] Undo stack (`UndoStack<T>`) — generic snapshot push/undo/redo, capped past history,
      redo history abandoned on a fresh push after undoing
- [x] Interaction geometry (`InteractionGeometry`) — nearest measure/staff-row/element (true 2D
      distance, not just x — a note and the dynamic mark below it share an x, only y tells them
      apart) and onset-by-summing-durations (the layout tree carries x, not onset). The pure,
      testable half; converting an actual pointer/DOM event into staff-space coordinates is a
      web-client concern, not built yet (see TO-VERIFY.md)
- [x] Display projection (`DisplayProjection`) — visible-staff filtering with a `staffMap` for
      address remapping back to the real score. Falls back to showing everything if hiding
      would remove every staff (a guess — see TO-VERIFY.md)
- [x] Invariant harness: every op leaves `Score.check` green — `expectScoreCheckOk` asserted on
      every successful place/erase in the test suite

### Store and persistence

- [x] Editor store (`createEditorStore`, `packages/web-client/src/store/editorStore.ts`) —
      score + undo integration (place/erase/staff ops all commit through one path), active
      tool, recents (12, dedupe-and-promote), view/flow/staff-visibility prefs (deliberately
      _not_ undo-tracked — undoing "you scrolled" would be strange), current project. A
      factory, not a module-level singleton, so tests get isolated instances. `hiddenStaves` is
      reindexed on staff removal (shift down above the removed index, drop the removed index
      itself) rather than left stale
- [x] localStorage projects (`Projects`) — list / save / load / delete, keyed by name with the
      keys themselves as the index (no separate list to drift out of sync); autosave on edit,
      debounced (1s), flushed immediately before switching projects or on dispose so the
      debounce window can't lose the last edit. First test coverage for `web-client`: added
      vitest + happy-dom (for `localStorage`) and a `tsc --noEmit` step, matching the other
      packages' `test` script shape

### Shell and views

- [x] App shell — view switching from store state (no router); editor/performance layouts
- [x] Score display component — `flow` prop: vertical (line-broken) or horizontal (unbroken,
      scrolling); wraps the existing ScoreView/SystemView machinery
- [x] Performance view — full-bleed vertical score, corner hover menu (Edit / Print / Staff),
      print stylesheet (not yet visually verified — see TO-VERIFY.md)

### Step 1 — staff setup

- [x] StaffDialog — row per staff (clef AppSelect, label AppTextField, visibility AppCheckbox,
      remove with confirm), add-staff button, flow AppSelect
- [x] Visibility per view wired through the display projection

### Step 2 — notes, rests, eraser

- [x] Pallet — note/rest tools, duration flyout, element + bar erasers, prominent staff button
- [x] Recents strip (MusicIcon compositions of duration + dots + articulation + accidental)
- [x] Right-click pallet flyout — dots and articulations on an existing placed note or chord,
      plus tie start/remove and removal; accidental override is not wired up yet (see
      TO-VERIFY.md — a guess, not a bug). Dots/articulations are always chord-wide fields
      (`Placement.cycleDots`/`toggleArticulation` now dispatch on note-or-chord via a shared
      `editSoundedElement`, generalized from the old note-only `editNote`), so they act on the
      whole chord at once. Tie and removal are per-tone for a chord: the click's derived pitch
      (the same mechanism the eraser already uses) picks out which tone
- [x] Interactive staff — hover highlight/ghost preview and click to place/erase, both flow
      modes, both wired through `ScoreDisplay`'s new `interactive` prop
- [x] Hotkeys — `p` (eyedropper-to-recents-top + select), `-`/`=` duration, arrows key-aware
      semitones, Backspace/Delete remove; Ctrl+Z / Ctrl+Shift+Z undo/redo; `a`/`s` add/remove the
      last measure
- [x] Measure count — `MeasureOps.addMeasure` (always safe, continues the piece's effective time
      signature; leaves clef unset, since an explicit clef means "a change happens here" and
      `ContextWalk` already carries the previous effective clef forward on its own) /
      `MeasureOps.removeLastMeasure` (refuses below one measure, or a tied/slurred last
      measure); pallet buttons plus the `a`/`s` hotkeys above
- [x] Keyboard shortcuts reference — a subtle `AppButton` `link` variant opens a static
      `HotkeysDialog` listing every hotkey; not generated from the hotkey map, so it needs
      updating by hand if that map changes
- [x] Ties — a pallet tool (click a note or chord tone to start, click the next same-pitch
      note/chord tone to close) and a right-click flyout "Start Tie"/"Remove Tie".
      `Placement.closeTie`/`removeTie` are the only adjacency a tie ever has: the next sounded
      (non-dynamic) element after the start note, matching pitch, which may cross a measure
      boundary — the same rule `Score.check` and the renderer already resolve ties through, so a
      closed tie always passes both. `erase` now cleans up a tied note's partner automatically
      instead of refusing it (slurs still refuse). Store-level `tieMode`/`pendingTie` are
      mutually exclusive with `activeTool`/`eraserMode`, same pattern as the eraser; changing
      tool/eraser mode cancels a pending tie, a failed close attempt leaves it pending for
      another try. Chains across three or more measures build one link at a time — closing a tie
      into a note may leave it with an `End` role already, and `closeTie` promotes that to `Both`
      rather than refusing, so clicking that same note again to start the next link works.
      Chords tie per-tone, on either or both ends: `closeTie`/`removeTie` take an optional
      `pitch` (required when the note/chord side is a chord, since there's no single pitch to
      default to) that picks out which tone participates, via shared `hasPitch`/`tieRoleAt`/
      `withTieRoleAt` helpers that treat a plain note and a chord tone the same way. Erasing a
      tied chord tone cleans up just that tone's tie (via the same `removeTie` path), leaving
      other tones and their ties untouched
- [x] Time signature — a pallet tool defaulting to common time on click, with its own flyout to
      key in beats/unit (`TimeSignature.create`, validated); reopening the flyout on an active
      time signature tool pre-fills its current beats/unit. Recents track it like any other
      `ToolConfig` (`sameToolConfig` compares by value via `TimeSignature.equals`). Placing sets
      `measure.time` and rebuilds that measure's rest-backed content to the new capacity
      (`TimeSignatureOps.setTimeSignature`); erasing reverts to whatever's effective just before
      it (`clearTimeSignature`) — except the very first measure, which has no earlier measure to
      fall back to and always shows a time signature regardless of whether it restates one of its
      own (`ContextWalk` prints one there either way, from `score.time` otherwise), so erasing it
      instead resets the piece's own starting signature to common time. Both refuse outright on a
      measure that isn't fully rest-backed — resizing written music around a new meter isn't
      attempted. A time signature is measure-wide,
      not a voice element, so it needed its own hit-test: `InteractionGeometry.locate` flags
      `timeSignature: true` when a click lands left of a measure's first element _and_ that
      measure prints one, identified by glyph name (`timeSig0`-`timeSig9`/`timeSigCommon`/
      `timeSigCutCommon`) since the layout tree's `signatures` array doesn't otherwise distinguish
      clef/key/time. Only the element eraser acts on it — `eraseBar` already preserved
      `measure.time` (spreads the measure before only overriding `contents`), so no change was
      needed there to keep the bar eraser from touching it

## Major assumptions

- Mouse + keyboard only to start — no touch, no responsive sidebar collapse.
- Single-voice editing (voice 1). Chords are placeable and single tones erasable (clicking a
  second note onto an occupied beat of the same duration forms/extends one). Dot cycle and
  articulation toggle apply chord-wide (they're shared fields, not per-tone). Tying works on a
  plain note or one tone of a chord, in any combination, via an optional pitch that picks out
  the tone. Transposition and adding a tone to an already-tied note/chord still only work on a
  plain `Note` (chord transpose, and merging a new tone into a tied chord, remain unbuilt).
  Multi-voice input, slurs, dynamics, lyrics render if present in a loaded score but are not
  editable yet.
- The pallet never represents pitches; pitch comes from the click's staff position, spelling
  from the tool's accidental or the arrow-stepping policy.
- Recents are tool configurations (kind + duration + dots + articulations + accidental);
  re-acquiring an existing configuration promotes it rather than duplicating.
- Undo/redo is included though TODO-UX.md doesn't list it — snapshot stacks over plain JSON
  are nearly free, and editing without undo is hostile.
- The counter demo (App.vue + server API) is replaced by the editor shell; the server is
  untouched and unused by v1.

## Potential problems

- **Full re-layout per edit.** Every keystroke re-runs the pipeline. Fine at fixture scale;
  the memoization story (per-measure caching) exists in rendering-strategy.md when it hurts.
- **Hover-scoped hotkeys** collide with browser/OS bindings and keyboard layouts (`=` is
  shifted on some layouts); the hotkey layer needs a remap point from day one.
- **Address remapping under projection.** Hidden staves shift staff indices; every hit-test
  and dispatch must translate through the projection map — a class of off-by-one bugs the
  editing tests must cover explicitly.
- **Placement past the music's end** (auto-appending measures) interacts with pickup-measure
  and time-signature-change semantics; keep the append rule dumb (clone the effective time
  signature, whole-rest-backed).
- **Right-click flyouts** must suppress the native context menu without breaking it elsewhere.
- **Print** needs SVG scaling and page breaks between systems; the print stylesheet is its own
  small project — don't underestimate it.
- **Unrepresentable remainders.** A few fractions adjacent to a dotted or double-dotted short
  note (nothing in the Duration model is finer than a plain 64th) have no exact rest
  decomposition at all. `DurationDecomposition.decompose` throws rather than approximate —
  this should never surface from ordinary pallet durations, but a future tuplet-aware pallet
  tool would need to extend the candidate set, not work around the throw.

## Open questions

- ~~**Bar eraser semantics**~~ — resolved: `Placement.eraseBar` resets to whole rests (piece
  length preserved); deletion-that-shortens-the-piece remains a possible second tool later.
- ~~**Double accidentals via arrows**~~ — resolved: `PitchStepping` never produces 𝄪/𝄫;
  every pitch class has a single-accidental (or natural) spelling available and
  `spellPitchClass` always finds one.
- ~~**Autosave vs explicit save**~~ — resolved: implemented exactly as leaned, debounced (1s)
  autosave plus explicit `saveProjectAs`/`saveProject`, with a flush before switching projects.

## Build order

Tokens + composables + primitives (with stories) → editing core with the invariant harness →
store + persistence → shell and score display flows → staff dialog (Step 1) → pallet,
interactive staff, hotkeys (Step 2) → performance view + print. Each stage lands verified
(vitest + storybook build + lint) before the next begins, as with the rendering work.

**Status (2026-07-20):** the design system is landed — `packages/web-client/src/ui/` has
`tokens.css`, the three composables, and all nine primitives with stories, verified via build,
`build-storybook`, lint, and Prettier (no vue-tsc in this repo, matching the existing
convention — Vue type-checking rides on `vite build` + `eslint` rather than a dedicated
typecheck step).

The editing core is now complete except interaction geometry and the display projection (both
of which need the shell to exist first to be worth building). Beyond the first slice
(duration decomposition, rest-backed builders, `Placement.place`/`Placement.erase`,
`domain/Fraction` gaining `subtract`), this round added `PitchStepping` (key-aware spelling —
caught a real bug in code review before it shipped: a pitch's chromatic value depends on the
key whenever its own accidental is omitted, not just its spelling does, so `chromaticIndex`
had to take the key too), `DurationOps` (halve/double/dot-cycle/articulation-toggle), `StaffOps`
(add/remove/update, min one staff), and a generic `UndoStack<T>`. 87 editing tests (398 across
the workspace), every place/erase/staff-op still running through the `Score.check` invariant
harness.

The store and persistence layer is landed too: `createEditorStore` ties the score, undo
history, pallet state, presentation prefs, and current project together in one factory-built
reactive object, and `Projects` persists to localStorage with debounced autosave. This is
`web-client`'s first tested logic — added vitest + happy-dom and a `tsc --noEmit` step,
matching the other packages' `test` script shape, specifically so state-machine behavior this
non-trivial (undo integration, index reindexing on staff removal, debounced autosave) doesn't
ship unverified the way the "thin" Vue components have been. 35 new tests (433 across the
workspace). Both remaining open questions from this doc are now resolved as leaned. Next per
the order above: the shell — view switching, the staff dialog, and the score display's `flow`
prop.

**Status (2026-07-20, later the same day):** the checklist is now complete end to end. The
shell (App shell, `ScoreDisplay`, `PerformanceView` + print stylesheet), Step 1 (`StaffDialog`),
and Step 2 (pallet, recents, right-click flyout, interactive staff, hotkeys) all landed in one
autonomous pass while the user was away — see `TO-VERIFY.md` for the full list of judgment
calls made without asking, organized under a "Guesses" section as instructed.

The interactive staff turned out to need more new editing-core surface than expected:
`StaffPosition.pitch` (the inverse of the existing `StaffPosition.of` — position+clef → a
bare-letter pitch, deliberately never spelling an accidental, since an absent accidental
already means "follow the key signature"), `Placement.transposeNote` (arrow-key semitone
stepping, key-aware via `PitchStepping`, refusing tied/slurred notes like `erase` does),
`Placement.cycleDots`/`toggleArticulation` (the right-click flyout's controls, implemented as
erase-then-place at the same onset rather than a bespoke duration-patching path, so the
surrounding rests re-decompose exactly the way any other duration change would), and
`Placement.elementAtOnset` (re-resolving a note's address by onset rather than trusting a
stale element index, since dot/articulation edits can shift what's after them). 33 new editing
tests (126 in the package, 483 across the workspace).

Wiring the click itself took real plumbing: `SystemView` now emits raw pointer coordinates
converted to system-space (an opt-in addition — nothing renders differently for existing
read-only consumers), `ScoreView` resolves those into a `StaffHit` via
`InteractionGeometry.locate` and forwards it, and `ScoreDisplay` gained an `interactive` prop
that's true only for the editor view's usage (the performance view and every Storybook story
except the new `Interactive` one stay read-only, exercising none of this). Hover state drives
both a ghost-preview glyph (snapped to the nearest pitch line, tracking the cursor
horizontally) and an eraser highlight; the hover-scoped hotkeys act on whatever's currently
hovered. All of this is necessarily thin-component territory (matching the established "no
unit tests for Vue components, verified via build/lint/storybook" policy) — the editing
operations it dispatches into are the fully-tested part.

Full verification chain (build, all 483 tests across every package, lint, format, storybook
build) is green as of this status note.
