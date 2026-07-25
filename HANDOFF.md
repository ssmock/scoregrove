# Handoff — Haydn project, in progress

Written 2026-07-25 when the Bash tool briefly became unavailable mid-task. Bash recovered and
everything below was verified. Delete this file once the open threads are resolved.

## State: green

`pnpm build`, `pnpm test` (706 passing), `pnpm lint`, and prettier all clean as of the last run.
Nothing is committed — the whole Haydn effort is uncommitted working-tree changes plus the
untracked `packages/import/` and this file.

Removing the old "measure 0 may be underfull" exemption broke exactly two tests, and **both were
genuine defects the exemption had been masking**:

- `Compiler.test.ts` — a bar of two quarters in 4/4, compiling only because it sat at index 0.
  Changed to halves, so a velocity test no longer leans on a fullness exemption.
- `Placement.test.ts` — quarter + dotted _quarter_ = 5/8 in a 4/4 bar, where every sibling test
  uses a dotted half. Fixed.

Nothing needed the `partial` flag to keep working.

## Where things stand

Working on `main`, nothing committed. `haydn-project.md` is the plan of record — read it first;
its "Items for review" section records every settled decision and why.

### Done and verified (686+ tests passing at the time)

1. **`Clef.Tenor`** — domain, plus the four engraving sites the `Record<Clef, …>` types flushed
   out: `StaffPosition` (middle line A3), `Signatures` (same `cClef` glyph at y=1 — no new Bravura
   glyph), `KeySignatureLayout`, and the `StaffDialog` picker. Verified visually via Storybook
   screenshots, not just arithmetic.

   The non-obvious part: `KeySignatureLayout`'s `clefShift: Record<Clef, number>` assumes every
   clef is a uniform offset of the treble pattern, and **tenor is the one clef where that is
   false**. Shifted up one, F♯ and G♯ land above the top line, so the engraving convention drops
   both an octave. Tenor sharps are therefore an explicit pattern, `[-2, 2, -1, 3, 0, 4, 1]`;
   flats shift normally.

2. **`DynamicMark.Forzando` (`fz`)** — 149 occurrences in the corpus, the most common dynamic in
   the piece, ahead of `p`. Kept distinct from `Sforzando` (`sfz`) because they print differently.
   Added `dynamicForzando` to `generate-bravura.mjs` and regenerated. Playback treats it as a
   one-note accent.

3. **`Measure.label?: NonEmptyString`** — carries a source's bar numbering for display only.
   Deliberately not named `number`: in this corpus four measures are labelled `0`, fifteen carry
   `X1`–`X6`, and `X1` occurs four separate times. Positional index is the only identity.

4. **`Measure.partial?: boolean`** — opts a measure out of the fullness rule. Overfull is still an
   error; a flagged measure must still hold some duration (a voice of nothing but dynamics sums to
   zero and is rejected). `Measure.check` lost its `options: { allowUnderfull }` parameter, and
   `Score.check` lost its `allowUnderfull: i === 0` special case, so **no positional rule remains**.

   Deliberately excluded: a cross-voice agreement check. It would misfire in the editor, because
   `RestBacking.emptyStaffContent` fills untouched staves to full capacity — editing one staff of
   a partial measure would make the others disagree and fail a valid work-in-progress.

   Also deliberately excluded: modeling which measure completes which. The partner is sometimes
   adjacent (idx 148→149) and sometimes a backward repeat's target 36 bars away (idx 340→304), so
   finding it requires unfolding navigation — playback's `NavigationUnfolding` job, not a
   measure's.

5. **`NavigationMark.Capo`** — where a da capo returns to, resolved as the nearest _preceding_
   Capo (so several sections can each carry one), falling back to measure 0. Never printed, and
   optional, so ordinary scores need nothing. Fixes a real bug: `NavigationUnfolding` previously
   sent every da capo to score index 0.

   Honest caveat, recorded in the module header: this is **not** multi-section support. Segno,
   Coda, and Fine are still resolved to their _first_ occurrence in the score.

6. **`Measure.newSection?: { title?, break? }`** — a movement, variation, or trio beginning at the
   measure carrying it. Position is implicit, so sections are contiguous, ordered, and
   non-overlapping by construction, with no ranges to validate. Flat, not nested.

   Engraving forces a system break there and renders the heading in HTML above the system;
   `SectionBreak.Page` is honored by `ScoreView`'s print CSS, since the layout tree has no page
   concept. **Playback ignores sections entirely** — that fell out of working backwards from what
   each pipeline actually needs, and it is why the model stayed this small.

   **Horizontal (DAW) flow is deliberately untouched**: it takes `SystemLayout.unbroken`, never
   `LineBreaking`, so it stays one continuous line with no break and no heading. There is a test
   pinning identical geometry with and without a section, and a `HorizontalWithSection` story.

7. **Fixed a pre-existing Storybook bug** found while verifying the above: `ScoreDisplay`'s stories
   had no store decorator on the meta, so `Vertical`, `Horizontal`, and `WithAHiddenStaff` all threw
   `useEditorStore() called with no editorStore provided` and rendered nothing. Added
   `withEditorStore()` to the meta.

## Corpus

`packages/import/corpus/` holds the Haydn Op. 76 No. 3 MusicXML (4.09 MB, MusicXML 4.0
partwise, CC0 from OpenScore), the original `.mxl`, the 26-page reference PDF, and
`PROVENANCE.md` with attribution and the positional movement boundaries.

**`packages/import` does not exist yet** — only the corpus directory. There is no importer, and
`@rgrove/parse-xml` is not installed. That is Phase 1.

Useful facts already measured (full detail in `haydn-project.md` section A): 531 measures × 4
parts; divisions constant at 24; ornaments are only trill (52) and turn (13); 1,040 articulations,
every one staccato; zero tremolo, arpeggio, or `<technical>`; voice 2 carries just 57 notes total,
so multi-voice barely arises.

On slurs specifically — 2,416 of them, but **2,400 are `number="1"` and only 8 moments in the
whole work have two open at once.** Raw count made this look like the dominant domain problem; it
is not. See the downgraded checklist entry in `haydn-project.md`.

**The smoke-test theme (idx 128–148) needs nothing the domain lacks.** Its census: 140 slurs (all
`number="1"`, zero overlap), 28 dynamics, 10 staccato, 8 chords, 4 fermata, 4 grace, 4
`other-dynamics` (" dolce"), 2 invisible noteheads — and **no ornaments, no tuplets, no ties**.

## Open threads, in the order they came up

- ~~Trap 1 — movement delimiting~~ — **resolved** via `Capo` + `newSection` (items 5 and 6). One
  factual correction came out of it: the navigation is **not** prose. `Fine` and the da capo are
  encoded as `<sound fine="yes">` / `<sound dacapo="yes">`, with the `<words>` being duplicates —
  so the importer reads attributes. Those attributes sit on **Violin I only** and need hoisting in
  `PartwiseToTimewise`. `Trio` really is prose-only, but it is a section label, not navigation.

- ~~Per-movement `Score`s vs. one combined `Score`~~ — **decided: one combined `Score`**, with
  movements carried by sections and explicit navigation rather than by splitting the file.

  This makes `NavigationMark.Capo` load-bearing rather than insurance. Under the per-movement plan
  it was moot (each movement's start would have been index 0); combined, the Menuetto's da capo
  rewinds to the opening of movement I without a synthesised Capo at each movement start.

  The known limitation applies but does not bite here: Segno, Coda, and Fine still resolve to
  their _first_ occurrence score-wide, and this work has exactly one Fine and no segno or coda.
  Correct for this piece — **accidentally so**. A second work with a Fine per movement would need
  those lookups made jump-relative, the same way Capo already is.

- ~~`TimeSignatureOps.refill` vs. `partial`~~ — **resolved.** A time signature change now clears
  the flag: `refilled` rebuilds the content to the new capacity and drops `partial` with it, so
  the flag can never assert a shortfall that no longer exists. The cost is that a deliberately
  short bar silently loses its shortness; accepted rather than solved, since only rest-backed
  measures can be resized at all and a stale flag would be worse than a lost one.

- **Nothing renders `Measure.label` yet.** Bar numbers are not engraved at all.

## Environment notes

- `unzip` is installed (UnZip 6.00), as are `python3` and `node`. The corpus was extracted with
  `python3 -m zipfile` before `unzip` was available; `PROVENANCE.md` records that command, which
  still reproduces the file byte-for-byte, so there is nothing to redo.
- Storybook screenshots work: `npx storybook dev -p 6006` from `packages/web-client`, then drive
  `playwright-core` against `localhost:6006/iframe.html?id=<story-id>&viewMode=story`. It must be
  imported by absolute path from `node_modules/.pnpm/...` and destructured as a default export
  (`import pw from '…'; const { chromium } = pw;`) — the bare specifier does not resolve.
- Prettier is not idempotent on a blank-line-separated continuation paragraph inside a `- [ ]`
  checklist item; it re-indents forever. Keep such items to a single paragraph.
- Never read `.env*`; never run Docker (see `CLAUDE.md`).
