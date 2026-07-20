# To Verify

Work done autonomously while you were away, continuing down `web-ux.md`'s checklist from
"Shell and views" through the end of Step 2. The checklist is now fully checked off. Everything
listed here builds, type-checks (as far as this repo's `vite build` + `eslint` convention goes —
see the note at the very bottom), lints, and passes its tests — this document is about
**product/UX decisions**, not bugs. Organized so you can skim "Guesses" first (the things I
decided without you) and then look at the rest as time allows.

**I could not visually test any of this in a browser** — this environment has no working
headless browser (recorded in memory from an earlier session: Playwright's Chromium fails,
missing `libnspr4.so`). Everything below is verified by build/lint/test/Storybook-build passing
and by careful code reading, not by actually clicking through the editor. Please treat the
interactive staff, hotkeys, and flyout especially as "should work per the code" rather than
"confirmed working" until you've clicked around yourself.

## Guesses

Decisions made without asking, because you weren't there to ask. Each is reversible; none touch
data already saved.

### From the shell/Step-1 phase

- **StaffDialog avoids a nested dialog.** Removing a staff needed a confirmation, and the
  obvious choice was a `ConfirmDialog` inside the `AppDialog`. I didn't do that: two teleported
  dialogs stack under `<body>` as separate DOM subtrees, so a click inside the inner one reads
  as an "outside click" to the outer one's `useDismissable` and could close the whole staff
  dialog unexpectedly. `StaffDialog.vue` uses an inline, in-row confirmation ("Remove this
  staff? [Cancel] [Remove]") instead. If you'd rather fix `useDismissable` to understand nested
  dialogs (e.g. by checking `contains` across a registry of open dialogs rather than per-instance
  DOM membership), the inline version is easy to revert.
- **`DisplayProjection` falls back to showing everything if hiding every staff would leave
  nothing to lay out.** There's no way to render zero staves, so hiding the last visible one is
  silently ignored rather than erroring or showing a blank page. An alternative would be
  refusing the _toggle_ itself (disable the checkbox for the last visible staff) — currently
  `StaffDialog` lets you check every box and the display just quietly ignores it.
- **`Placement.eraseBar` resets to whole rests rather than deleting the measure.** "Bar eraser"
  could mean either; I picked the one that preserves piece length, since a click that
  unexpectedly shortens the piece (shifting every later measure's index) felt like the more
  dangerous default. Deleting the measure outright is a plausible second tool, not built.
- **`AppButton` gained `defineExpose({ rootEl })`.** A small change to an already-shipped design
  system primitive, needed so `EditorPallet.vue` (and now nothing else yet) can anchor an
  `AppFlyout` under a button. Same pattern as `SystemView`'s new `rootEl` expose this round.
- **`PerformanceView` always renders vertical flow**, ignoring `store.state.flow`, per
  TODO-UX's "revert to vertical flow" — a display-time override, not a change to the stored
  preference, so switching back to the editor view still shows whatever flow you'd picked there.
- **`print.css` has never been checked against real print/PDF output.** It hides the sidebar,
  the performance corner menu, and any open dialog/flyout, and lets the score flow full-width —
  reasonable in principle, unverified in practice (see the note in the file itself).

### From this round (interactive staff, hotkeys, right-click flyout)

- **Clicking the staff always places the bare, key-implied pitch — never an explicit
  accidental.** `StaffPosition.pitch(clef, position)` (new, the inverse of the existing
  `StaffPosition.of`) deliberately never spells an accidental, because an absent accidental
  already means "follow the key signature" (the domain's own convention). So clicking the F
  line in G major sounds as F♯ automatically, with no accidental glyph printed — which is
  correct per that convention, but there's currently **no way to click a _different_ spelling**
  (say, an explicit F-natural against a sharp key) directly from a click. Overriding the
  accidental after the fact needs the flyout's accidental control, which isn't built (see
  "Known gaps" below).
- **"-" / "=" cycle the _active tool's_ duration, not a hovered placed note's.** TODO-UX just
  says "duration" without saying which; I read it as a keyboard shortcut for what the duration
  flyout already does (pick what you're about to place next), not as editing something already
  on the page. Changing an _existing_ note's duration isn't exposed anywhere in the UI yet
  (only its dots, via the right-click flyout) — a plausible gap if you actually wanted "-"/"="
  to resize the hovered note instead.
- **Backspace/Delete erase the single hovered element, ignoring the current eraser mode.** If
  bar-eraser mode is active and you press Delete, it still erases just the one element under the
  cursor rather than the whole bar — I treated the keyboard shortcut as "delete what's under the
  cursor" uniformly, not as "do whatever click would currently do."
- **Arrow-key transposition and Backspace/Delete silently no-op when they don't apply** (nothing
  hovered, the hovered thing isn't a note, it's tied/slurred, or stepping would leave the
  representable octave range). There's no visible feedback (no shake, no toast) when this
  happens — you just won't see anything change. Worth a follow-up if that reads as "broken"
  rather than "nothing to do here."
- **The ghost preview and eraser highlight aren't gated on whether the action would actually
  succeed.** Hovering with a note tool active always shows a ghost, even over already-occupied
  time where the click would fail; hovering in eraser mode always shows a plain highlight
  circle, even over an element `erase` would refuse (a tied note, a chord). The click itself
  still correctly fails (via the existing `Result` plumbing) — only the _preview_ doesn't
  anticipate the refusal.
- **The eraser highlight is a plain circle at the hovered position, not shaped to the actual
  element, and bar-eraser mode shows the exact same circle** rather than highlighting the whole
  measure. A more literal "outline the thing that will be erased" treatment would need each laid
  out element's real bounding box, which isn't threaded through to the interactive layer.
- **The ghost preview's x tracks the raw cursor position; only y snaps** to the nearest staff
  line/space. So it glides smoothly left-right under the pointer rather than snapping to the
  exact onset it would land on. A tighter snap is possible (the layout tree has the real
  positions) but wasn't worth the extra plumbing for a preview.
- **The right-click flyout only opens on an existing placed _note_** — right-clicking a rest,
  a dynamic, or a chord does nothing. Chords aren't editable anywhere yet (consistent with
  `Placement`'s existing refusals); rests and dynamics have nothing the flyout currently offers
  to edit (no dots-on-a-rest control, no dynamic-level editor).
- **The right-click flyout re-resolves the target note's address by onset before every action**
  (`Placement.elementAtOnset` / `store.resolveAddress`), rather than reusing the address from
  when it opened. This isn't really a "guess" so much as a correctness fix I had to make: cycling
  dots or toggling an articulation re-places the note (erase, then place at the same onset), and
  the surrounding rests can re-decompose into a different number of elements, shifting the
  note's own index. Flagging it because it's a subtle invariant worth knowing about if you touch
  this code — a raw `ScoreAddress` captured once and reused across multiple edits would silently
  drift onto the wrong element.
- **Ctrl+Z / Ctrl+Shift+Z are live whenever the editor view is mounted, not scoped to hovering
  the staff itself** (they don't require anything to be hovered). Place/erase/eyedropper/arrows
  do require a hover target. I read "hover-scoped hotkeys" (the doc's phrase) as applying to the
  ones that need to know _what_ you're pointing at, not to undo/redo, which don't.

## Known gaps (not guesses — things I knew I wasn't building)

- **Accidental override isn't in the right-click flyout.** The flyout has dots, five
  articulation toggles, and Remove; an accidental picker (natural/sharp/flat/double-sharp/
  double-flat) would need a new `Placement` operation analogous to `cycleDots` and wasn't built
  in this pass, purely for time. `editNote`/`cycleDots`/`toggleArticulation` in `Placement.ts`
  already establish the pattern (erase, transform, re-place at the same onset) an
  `setAccidental` operation would follow.
- **Placing past the end of the piece** (auto-appending measures) is still unsupported — flagged
  in `web-ux.md` since the editing-core phase, unchanged.
- **Multi-voice, chords, ties, slurs, dynamics, lyrics remain non-editable** — they render if
  present in a loaded score, per the standing "Major assumptions," unchanged.
- **No touch support, no responsive sidebar** — unchanged standing assumption.

## What's new and where (for when you want to read the code, not just this summary)

- `packages/engraving/src/StaffPosition.ts` — `StaffPosition.pitch(clef, position)`, the inverse
  of `StaffPosition.of`.
- `packages/editing/src/Placement.ts` — `transposeNote`, `cycleDots`, `toggleArticulation`,
  `elementAtOnset`, and `ElementSpec` gained an optional `notations` field so `place` can carry
  articulations through an erase-then-replace edit.
- `packages/web-client/src/store/editorStore.ts` — `transposeNote`, `cycleDots`,
  `toggleArticulation`, `resolveAddress`, `cycleActiveDuration`.
- `packages/web-client/src/music/SystemView.vue` — opt-in `hover`/`leave`/`activate`/
  `contextmenu` emits (pixel-to-staff-space conversion), an `overlay` slot, and `rootEl` exposed.
  Unused by every existing read-only consumer — nothing changes for them.
- `packages/web-client/src/music/ScoreView.vue` — resolves those raw events into a `StaffHit`
  via `InteractionGeometry.locate` and re-emits; forwards the `overlay` slot per system.
- `packages/web-client/src/shell/ScoreDisplay.vue` — the new `interactive` prop; hover state,
  ghost/highlight rendering, click dispatch, the hover-scoped hotkeys. `interactive` is only set
  on the one usage in `EditorView.vue`.
- `packages/web-client/src/shell/ElementEditorFlyout.vue` — new; the right-click flyout.
- `packages/web-client/src/shell/ScoreDisplay.stories.ts` — new `Interactive` story, wired to a
  live store (not a static arg) so placing a note actually re-renders it.

## Verification run at the end of this session

`pnpm build`, `pnpm test` (483 tests across domain/engraving/editing/web-client), `pnpm lint`,
`pnpm format:check`, and `pnpm --filter web-client build-storybook` all pass. As noted at the
top: none of this is a substitute for actually opening the app and clicking around, which I
couldn't do here.
