# The Haydn Project

Take one real piece of published chamber music — **Haydn, String Quartet in C major, Op. 76
No. 3 ("Emperor")** — and drive it end-to-end through engraving and playback until the result is
good enough to read from and listen to. The piece is the specification; every gap it exposes is
real, prioritized by how often actual music uses it, rather than guessed at from a feature list.

The two existing strategy docs each built a pipeline from nothing against fixtures we invented.
This one is the opposite move: **stop inventing inputs.** The fixtures in
`engraving/src/Fixtures.ts` were designed to exercise the features we had just built, so they
can only ever confirm what we already know. A Haydn quartet was written with no knowledge of our
domain model at all, which is exactly what makes it useful.

> **This document is a proposal, with its open questions now closed.** The checklist below is
> ordered for implementation. Every decision I could not settle from the existing code was
> collected under **Items for review** and has since been resolved — that section records each
> answer and the reasoning, so the choices can be revisited deliberately rather than rediscovered.
> One risk stays open on purpose: whether the OpenScore encoding is a _good_ transcription, which
> only reading the rendered result will tell us.

## Strategy

1. **Build an importer before anything else, because it is also the gap detector.**

   There is no importer of any kind in the repo today — every fixture is hand-authored
   TypeScript. A movement of this quartet is several hundred measures across four staves;
   hand-authoring it is not on the table, and hand-authoring it _badly_ would be worse than
   useless, because we would unconsciously write only the notation we already support.

   So: a new `packages/import` turning MusicXML into a `Score`. It earns its cost three times
   over.

   - It is the only viable ingest path.
   - MusicXML is **partwise** and our model is **timewise** (a decision the README records and
     defends). The importer owns that transposition once, in one place — including the
     "do the parts agree about the key change?" reconciliation the domain deliberately refuses
     to represent.
   - Run in `--report` mode it emits **a frequency histogram of every element it could not
     map**. That histogram is the project backlog, ranked by real usage. `<tremolo>` appearing
     412 times and `<harmonic>` appearing twice tells us what to build in an afternoon of
     reading output rather than a week of arguing.

   `Projects.ts` already persists a `Score` as `JSON.stringify` in localStorage, so imported
   output drops into the existing app with no new plumbing.

2. **One work, laddered by movement.**

   Not a survey of many pieces. One work means one consistent source, one set of stylistic
   conventions, and a difficulty ramp that maps cleanly onto machinery we have already built:

   The work is in **C major**, Hob. III:77 (1797). Movement facts below are verified (review
   item 7).

   | Movement                                           | What it exercises                                                                                                                               |
   | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
   | **II, theme only** (~20 bars)<br>G major, cut time | Smoke test. Four staves, homophonic hymn setting, slurs, dynamics. Nothing exotic. The first thing to render.                                   |
   | **II, complete**<br>Poco adagio cantabile, G major | Theme + **four** variations; each instrument takes the melody in turn, so every staff gets real melodic figuration and wide range.              |
   | **I**<br>Allegro, C major, common time             | Sonata form. Repeats with first/second endings (`Voltas` + `NavigationUnfolding` against real music), ornaments, dense dynamics.                |
   | **III Menuetto**<br>Allegro, C major 3/4           | Trio in **A minor**, then da capo — `NavigationUnfolding`'s jump handling on material actually written for it. Also a mid-work key change.      |
   | **IV Finale**<br>Presto, C minor → C major, 2/2    | Sonata form, opens in the tonic minor and passes through E♭ before ending in C major. Mode change, key changes, fastest tempo, densest texture. |

   Beethoven Op. 59 is held in reserve as a tier-3 target once the ladder is climbed — that is
   where pizzicato, tremolo, sul ponticello, and harmonics become unavoidable.

3. **The loop must be one command, or it will not get run.**

   Import → engrave → capture → compare, with playback compiled from the same score. The
   comparison against a reference engraving is **human**, not pixel-diff: two competent engravers
   legitimately disagree about spacing, and a pixel threshold would produce nothing but noise.
   What gets automated is the _capture_ (so looking costs one command) and a set of _invariants_
   that are objectively true or false regardless of engraving taste.

4. **Invariants over snapshots for regression.**

   A layout snapshot of 500 measures changes on every spacing tweak and teaches nothing. Instead
   assert properties that must hold for any correct engraving: no glyph collisions within a
   staff, every system fits the page width, no note escapes its measure box, stems consistent
   within a voice, every measure sums to its time signature's capacity. These survive
   refactoring; snapshots do not. Keep a layout-tree JSON snapshot too, but as a **review aid**
   for spotting unintended movement, not as a pass/fail gate.

5. **Playback verified structurally first, by ear second.**

   Listening is ground truth but is slow and unrepeatable. Cheap structural checks catch most
   regressions: per-part note counts against the source, total duration against the marked
   tempo, tie chains folded exactly once, no zero or negative durations, every part sounding in
   every measure it should. Then listen — the ear catches what no assertion will.

## A. What the piece demands that we do not have — measured

**This section is no longer a prediction.** The corpus file is in the repo, and a direct element
census of it (113,658 elements, 117 distinct tags) has replaced the guesses. The importer's
`--report` mode will still be built, because it must run per-import as the gap list evolves — but
its first answer is already known, and it reshaped the plan.

### The census

| Scale            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| Parts / measures | 4 parts × **531 measures**, all four movements in **one file** |
| Notes            | 10,593 (Vln I 3,321 · Vln II 2,809 · Vla 2,326 · Vc 2,080)     |
| Divisions        | **24, unchanging** — 16 declarations, all identical            |
| Note values      | whole → 32nd only; no 64ths, no breves                         |
| Tuplets          | 3:2 ×1,224, 6:4 ×30 — nothing exotic                           |
| Time signatures  | 4/4, 2/2, 3/4, 2/2 — matching the four movements               |
| Keys (fifths)    | 0 → 1 → 0 → −3 → 0 — C, G, C, c, C, matching the movements     |

The time signatures and keys independently confirm the movement facts from review item 7, which
is a useful sign the encoding is coherent.

### What the census confirmed

- **Staff grouping** — the file opens with exactly what review item 5 designed for:
  `<part-group><group-symbol>bracket</group-symbol><group-barline>yes</group-barline>`. One
  bracket over four parts, barlines joined.
- **Part identity** — `<part-name>` plus `<instrument-sound>strings.violin|viola|cello`, giving
  playback real per-part sound identity. **But there is no `<part-abbreviation>` anywhere**, so
  the short names ("Vln. I") must be derived or authored by us, not imported.
- **Slur numbering is the dominant notation problem** — **2,416 slurs**, more than any other
  notation element by a factor of two. This is the single most load-bearing domain change.
- **Ornaments are exactly trills and turns** — 65 total: 52 `trill-mark`, 13 `turn`. No mordents.
  Review item 4's proposed set is right, and can even be trimmed.

### What the census refuted — scope that vanished

Predictions I made that the piece simply does not contain. Each was going to cost real work:

- **Tremolo: zero.** **Arpeggiate: zero.** So the review item 4 sub-decision about modeling them
  separately from ornaments is real but **not needed for this piece** — defer it entirely.
- **`<technical>`: zero.** No up/down bow, no `pizz.`/`arco`, anywhere in the work. The whole
  "bowing and technique directions" line item drops out of Phase 2.
- **Articulations: 1,040, every one of them `staccato`.** Not one accent, tenuto, marcato, or
  staccatissimo in 531 measures. Our five-member `Articulation` is already four members more than
  this piece needs.
- **Lyrics, octave-shift, pedal: zero**, as expected.
- **Multi-voice is nearly absent.** Voice 2 carries **57 notes total across all four parts**
  (32 + 9 + 10 + 6) against voice 1's 10,536. The multi-voice collision problem that
  `rendering-strategy.md` calls "genuinely hard engraving" barely arises here. There are still 22
  `<backup>` and 18 `<forward>` elements to read correctly, but the engraving risk is small.

### New gaps the census found that I had not predicted

1. **`Clef` has no Tenor.** `Clef` is `Treble | Bass | Alto`. The cello uses **C4 tenor clef** —
   the six `<clef>` elements are the four initial clefs plus one change to tenor and its return
   to bass. A one-member addition, but a hard blocker: without it that passage is unrepresentable,
   not merely mis-drawn. It will also land straight on the known gap that mid-piece clef changes
   print full-size at the measure start rather than small before the preceding barline.

2. **`DynamicMark` has no Forzando (`fz`) — and `fz` is the most common dynamic in the piece.**
   149 occurrences, ahead of `p` (126), `f` (100), `pp` (23), `ff` (8). We have `Sforzando` (sfz)
   and `Fortepiano` (fp), but not `fz`. Mapping `fz` → Sforzando would print the wrong glyph on
   149 notes, so this needs a real member.

3. **All four movements are one file with no structural delimiter.** Movements are marked only by
   `<words>` text — `"I. "`, `"II."`, `"III. Menuetto"`, `"IV. Finale"` — and `light-light`
   barlines. **This directly changes Phase 0:** the movement II theme smoke test is a _measure
   range within one score_, not a separate file, so the importer needs a measure-slice option from
   the start. The same `<words>` track carries the tempo marks (`Allegro`, `Poco adagio; cantabile`,
   `Presto`), the variation labels (`Var. I`–`Var. IV`), and the navigation text (`Fine`,
   `Menuetto D.C.`, `Trio`, `la seconda volta più presto`) — so free text is doing structural work
   that our domain models properly, and the importer must recognize it rather than pass it through.

4. **Transcription noise, mild.** 14 `<notehead>none</notehead>` (invisible noteheads, which we
   have no notehead-style concept for — `TODO-more.md` already flags this); `<other-dynamics>`
   carrying `" dolce"` ×4 and `" sempre"` ×1 (expressive text encoded as dynamics, with
   leading space and non-breaking-space artifacts); three `<words>` containing a bare `♮`. Small
   enough to report-and-drop, and a fair early signal that the encoding is good.

### Structural blockers — a quartet is wrong on the page without these

1. **Staff grouping.** `Staff` is `{ clef, label? }`. There is no bracket, no brace, no joined
   barline. `rendering-strategy.md` already flags this as a known domain gap ("a piano grand
   staff renders as two unrelated staves"). A string quartet is bracketed with barlines running
   through all four staves; without it every system reads as four unrelated instruments. This is
   the single most visible defect and should be the first domain change.

2. **Part identity.** A `label?` string is not an instrument. We need at least a full name, a
   short name (systems after the first use abbreviations — "Vln. I", not "Violin I"), and enough
   of a sound identity for playback to give the cello a different timbre from the first violin.
   Playback currently drives one `OscillatorInstrument` for the entire score.

3. **Slur numbering.** `SlurRole` is `Begin | End | Both`, and `Notations.ts` states outright
   that overlapping or nested slurs cannot be told apart. `rendering-strategy.md` records the
   consequence: nested slurs "pair innermost-first because the domain cannot yet distinguish
   them." Quartet writing overlaps slurs constantly — a phrase mark over a bowing slur is
   routine. This is the first place the fixtures' politeness has been hiding a real limitation.

### Notation vocabulary — the ornament gap

`Notations` carries articulations, slur, fermata, graces, lyrics. There is **no ornament concept
at all**, and the piece needs exactly two: **trill** (52) and **turn** (13). Mordents, tremolo,
arpeggio, and every `<technical>` bowing mark are absent from this work — they belong to the
Beethoven tier, not here.

### Fidelity gaps we already know about

Recorded in the two existing gap lists, now annotated with how much this piece actually exercises
each:

- No stub (partial) secondary beams — with 1,947 sixteenths and 421 thirty-seconds against 3,833
  eighths, dotted-eighth–sixteenth figures are certain. **High impact.**
- Chords never beam — **534 chords** (double stops), and they occur inside beamed runs.
  **High impact.**
- Accidental state is per voice, and a note tied across a barline restates its accidental —
  976 accidentals and 350 ties. **Moderate.**
- Mid-piece clef changes print full-size at the measure start — hits the cello's tenor-clef
  passage exactly twice. **Low volume, high visibility.**
- Multi-voice rest placement collides — **near-zero impact here** (57 voice-2 notes total).
- Crescendo/diminuendo step rather than ramp, and a dynamic applies to its own voice rather than
  the staff — only 16 wedges, but 406 dynamics whose voice-vs-staff scope matters. **Moderate.**
- Accel./rit. not performed — the piece has one tempo instruction of this kind
  (`la seconda volta più presto`), and it is a repeat-dependent tempo change rather than a ramp.
  **Low, but interesting: it is not representable at all today.**
- A slur spanning 3+ systems draws only its first and last segments — with 2,416 slurs, some will
  be long. **Moderate.**

---

## B. Estimating import accuracy

"Did the import work?" recurs for every piece we ever ingest, so it should be a reusable mode of
the importer (`--verify`) rather than a one-off script for the Haydn. These estimators are cheap,
derived from the source file itself, and chosen so that each catches a class the others miss.

**The organising principle is per-measure, not global.** A total note count lets two errors cancel
— one note dropped in bar 12, one duplicated in bar 300, and the sum still matches. A per-measure
digest both refuses to cancel and tells you _where_ to look, which is the difference between "the
import is wrong" and a debuggable failure.

### Tier 1 — accounting identities (always hold; cheapest, strongest)

- **`consumed + unsupported == total elements`.** Every element in the file is either mapped or
  reported, and the counts must add up. This is the only thing that actually _enforces_ the rule
  the strategy already states — "silent dropping is the one thing this importer must never do."
  Reporting unsupported elements does not enforce it: an element the reader believes it handled but
  quietly discards appears in neither list. The identity closes that hole. **Build this first.**
- **Per-part element counts** — notes, rests, chord tones, measures — source against `Score`.
- **Paired-element arithmetic** — `<tied>` start/stop pairs versus tie chains, `<wedge>`
  start/stop versus hairpins, `<slur>` pairs versus slur roles. Each mapping has an expected
  relation; divergence is a bug rather than a judgement call.

### Tier 2 — per-measure fingerprints (localize the error)

- **Pitch sequence digest per (part, measure)** — MIDI numbers in order. Catches wrong octave,
  wrong `<alter>`, and reordering, none of which counting can see.
- **Duration sequence digest per (part, measure)** — catches wrong note values and mis-read dots
  or tuplets while the count stays right.

### Tier 3 — internal consistency (no source oracle needed at all)

These are the ones that generalize best, because they need no expected values:

- **Cross-part length agreement** — within a measure every part must span the same duration.
  Verified true across all 531 measures × 4 parts of this corpus, and it is the sharpest available
  check on `<backup>` / `<forward>` handling.
- **Divisions-sum versus `Fraction`-sum** — total each part's duration in raw divisions and again
  in exact `Fraction`s, and require exact agreement. Cross-checks the whole
  `DivisionsToDuration` conversion independently of any note-by-note comparison.
- **Determinism** — import twice, require identical output. Catches iteration-order leaks through
  `Map`/`Set`.
- **Slice consistency** — importing measures _m..n_ must equal importing everything and slicing to
  _m..n_. Tests the `MeasureSlicing` path against the full path with no external oracle whatever.
- **`Score.check` passes** — the domain's own invariants, free.

### Tier 4 — plausibility smells (cheap, catch gross errors fast)

Not proofs, but they fail loudly on whole-class mistakes and cost almost nothing:

- **Pitch range per instrument** — a violin part with notes below G3 means a transposition or
  octave bug. `<instrument-sound>` gives the instrument, so this generalizes to any score.
- **Duration histogram shape** — if thirty-seconds outnumber quarters, something is systematically
  misread.
- **Accidental density** — a spike suggests key-signature mishandling, since accidentals implied
  by the key should not be printed.

### Tier 5 — downstream sanity

- **Playback duration** against tempo × total beats, computed independently.
- **Engraving invariants** — the existing list: no glyph collisions, systems fit, no note escapes
  its measure box.
- **Page count** against the reference PDF's 26. Crude, but an order-of-magnitude divergence is a
  real signal.

### What the hand-authored fixture is still for

Every estimator above compares the importer against **the source file**. None can catch an error
where the importer and the estimator share a misreading of MusicXML semantics — both ignoring
`<backup>`, say. A small excerpt transcribed from the **printed page** is independent of MusicXML
entirely, and that is its whole value. Keep it to a handful of bars: enough to pin the semantics,
small enough that the transcription is unlikely to be wrong itself. Twenty-one bars of hand
transcription would risk debugging the fixture instead of the importer.

---

## Module checklist

Ordered for implementation. Smoke test end-to-end first, breadth second, polish last.

### Phase 0 — Harness and target (before any importer code)

- [x] **Corpus obtained** — downloaded from the OpenScore String Quartets set on MuseScore.com
      (score `20428156`), which offers `.mxl` (compressed) only. Extracted once at ingest with
      `python3 -m zipfile` (this box has no `unzip`), keeping the importer free of a zip
      dependency per review item 3. The archive held exactly `META-INF/container.xml` and
      `score.xml`. Now at `packages/import/corpus/haydn-op76-no3.musicxml` — MusicXML 4.0,
      `score-partwise`, 4.09 MB — with the original `.mxl` kept beside it and full attribution in
      `packages/import/corpus/PROVENANCE.md`.
- [x] **Reference engraving obtained** — the OpenScore PDF (26 pages, all four movements) at
      `packages/import/corpus/reference/haydn-op76-no3.pdf`, for page-by-page comparison.
- [x] **Element census run** — the measured backlog in section A, produced directly from the
      corpus file without an importer. This front-ran Phase 1's `--report` deliverable and
      changed the plan; see the "refuted" and "new gaps" lists.
- [x] **Movement boundaries located** — tabulated in `PROVENANCE.md`. Movement II's theme, the
      smoke-test target, is **positional indices 128–148** (21 measures) of 531. This turned up a
      trap worth stating loudly: **`measure/@number` is a display label, not an index.** Numbering
      restarts at every movement, and 15 measures carry non-numeric labels (`X1`–`X6`, all
      `implicit="yes"`) that themselves repeat across movements — there are four separate measures
      labelled `X1`. Any slicing, addressing, or error message keyed on `@number` will be wrong;
      positional order is the only reliable index.
- [x] **Capture harness, stage one** — `pnpm --filter web-client haydn [score.json] [outDir]`
      engraves a `Score` headlessly and writes `score.png`, a `system-NNN.png` per system, and a
      `capture.json` summary. Stage two adds the import step once Phase 1 lands; the seam is the
      score JSON, which is exactly what `Projects.ts` persists and what the importer will emit.
      It lives in `web-client`, not the repo root, because that is where `playwright-core` and the
      built Storybook are — a root script cannot reach either without a dependency the workspace
      deliberately does not have. An arbitrary score reaches the page through a dedicated
      harness story that reads a global the script injects, since a whole `Score` is far too
      large for Storybook's URL args. **Fails loudly rather than silently**: page and console
      errors are collected and printed, a score that lays out no systems exits 1 with a diagnosis
      rather than writing a blank PNG, and the browser is closed in a `finally` so a failed run
      cannot leave Chromium alive and the process hanging.
- [ ] Hand-author a **short excerpt** — the theme's first 2–4 bars, all four staves — transcribed
      from the reference PDF. Deliberately not the whole 21-bar theme: this exists only to pin
      MusicXML _semantics_ from an independent source, and a long hand transcription risks
      becoming the thing that is wrong, leaving us debugging the fixture instead of the importer.
      Everything else is covered by the estimators in section B, which compare against the source
      file directly and scale to all 531 measures.

### Phase 1 — `packages/import`

- [ ] Package skeleton — `packages/import`, depends on domain plus exactly one runtime
      dependency, **`@rgrove/parse-xml`** (review item 2). Same build/test/export scheme as
      playback and engraving. No barrels.
- [ ] `XmlReading` — parse to a node tree. Uncompressed `.musicxml` only; `.mxl` is deliberately
      out of scope for v1 (review item 3). Reject any document whose DOCTYPE is missing or whose
      root is neither `score-partwise` nor `score-timewise`, and refuse `score-timewise` with a
      clear message rather than half-supporting it.
- [ ] `PartwiseToTimewise` — the core transposition. Walk parts in parallel, emit one `Measure`
      per measure index with one `StaffContent` per staff. This is where MusicXML's per-part
      duplication of key/time/tempo/barline gets **reconciled** into the score-wide attributes
      our `Measure` carries — including deciding what to do when parts disagree (report and take
      the first, most likely).
- [ ] `DivisionsToDuration` — MusicXML counts in arbitrary `<divisions>` per quarter; we carry
      `NoteValue` + dots + tuplet. Exact `Fraction` arithmetic throughout, matching the rest of
      the codebase. Anything that will not land on a representable `Duration` is a reportable
      failure, not a rounding. **This corpus is kind here:** divisions is 24 throughout and never
      changes, and 24 = 2³·3 divides evenly for every value present (32nd = 3, triplet-eighth = 4,
      sixteenth = 6). Do not let that lull the implementation into assuming a constant — other
      scores change divisions mid-part — but it does mean rounding bugs cannot hide behind this
      piece.
- [ ] `MeasureSlicing` — import a measure range, not just a whole file. Required from day one,
      because the smoke test is movement II's theme inside a 531-measure score. Note this is a
      **development affordance, not the shipping shape**: the deliverable is one combined `Score`
      (see below), and slicing exists so the smoke test can be 21 bars instead of 531.
- [ ] `SectionAndCapoSynthesis` — **one combined `Score` for the whole work**, with movements
      carried by `Measure.newSection` rather than by splitting into four `Score`s. Consequences the
      importer owns, none of which the source states outright:
      a section (title + `SectionBreak.Page`) at each movement start, taken from the `<words>`
      title and the source's own `<print new-page>`; a section (`SectionBreak.System`) at each
      `Var. I`–`Var. IV` and the `Trio`, matching their `<print new-system>`; and a
      **`NavigationMark.Capo` at each movement start**, without which the Menuetto's da capo
      rewinds to the opening of movement I. Capo marks are synthesised — the source never writes
      one, because in MusicXML the D.C. is implicitly movement-relative.
- [ ] `PitchReading` — `<pitch>`/`<alter>`/`<octave>` → domain `Pitch`; `<rest>` → `Rest`;
      simultaneous notes with `<chord/>` folded into `Chord`.
- [ ] `NotationReading` — ties, slurs, articulations, fermatas, grace notes, tuplets, dynamics,
      wedges, directions. Every element it meets and cannot map goes to the report rather than
      being silently dropped — **silent dropping is the one thing this importer must never do.**
- [ ] `StructureReading` — barlines, repeats, endings/voltas, segno/coda/D.C./D.S., so
      `NavigationUnfolding` gets real navigation to unfold.
- [ ] `ImportReport` — `{ score, consumed: Histogram, unsupported: Histogram, warnings }`. A
      `Result`, consistent with the rest of the domain. The unsupported histogram ranks all
      subsequent work; the **consumed** histogram exists so `consumed + unsupported` can be checked
      against the file's total element count (section B, tier 1) — the accounting identity that
      turns "never drop silently" from an intention into something enforced.
- [ ] `Verification` — the reusable `--verify` mode implementing section B's estimators, so every
      future import gets them for free rather than re-deriving a one-off script per piece.
- [ ] CLI entry — `pnpm --filter @scoregrove/import run <file>` writing score JSON plus the
      report. Score JSON must be loadable by `Projects.ts` as-is.
- [ ] Vitest suite — round-trip the hand-authored theme, plus focused fixtures per reader module.

### Phase 2 — Domain additions (driven by the report, expected order)

Parts and grouping are **two concepts, not one** (review item 5), modeled the way MusicXML's
`<score-part>` / `<part-group>` / `<staves>` split already works — which the importer has to map
to regardless. Crucially, `staves` stays the flat ordered list that `measure.contents` indexes
against, so `Score.check`'s existing `contents.length === staves.length` invariant survives
untouched.

Ordered by measured impact. The first two are one-member additions that are nonetheless hard
blockers — they came out of the census, not the original prediction.

- [x] **`Clef.Tenor`** — the cello's C4 passage is otherwise unrepresentable. Landed with the four
      engraving sites the `Record<Clef, …>` types flushed out. The one surprise: tenor is the only
      clef whose key signature is _not_ a uniform shift of the treble pattern — F♯ and G♯ would sit
      above the top line, so both drop an octave, giving tenor sharps their own explicit pattern.
- [x] **`DynamicMark.Forzando` (`fz`)** — 149 occurrences, the most common dynamic in the work.
      Distinct from the existing `Sforzando` (`sfz`) in print, so it got its own member rather than
      a mapping. `dynamicForzando` added to the Bravura extraction list.
- [x] **`Measure.label`** — a source's own bar numbering, display-only. Deliberately not named
      `number`, because in this corpus four measures are labelled `0`, fifteen carry `X1`–`X6`, and
      `X1` occurs four separate times. Position is the only identity.
- [x] **`Measure.partial`** — the fullness opt-out. The corpus has **22 short measures**, and every
      one is half of a pair (a section's pickup completed by its closing bar), so the old
      "measure 0 only" exemption could not have imported even a single movement. `Score.check` now
      has no positional rule at all.
- [x] **`NavigationMark.Capo`** and **`Measure.newSection`** — the movement-structure work; see the
      trap 1 resolution below.
- [ ] **`Part`** — identity: full name, short name, and a sound/instrument reference for playback
      (`<instrument-sound>strings.violin|viola|cello` is present and usable). A part owns one _or
      more_ staves (quartet: 4 parts × 1 staff; piano: 1 part × 2 staves). Replaces the bare
      `label?`. Note the corpus has **no `<part-abbreviation>`**, so short names are ours to
      author — the importer cannot supply them.
- [ ] **`StaffGroup`** — a bracket/brace over a staff range, with a symbol (bracket / brace /
      line) and whether barlines run through the group. Nestable, because MusicXML's groups are.
      For the quartet: one bracket over all four, barlines joined. Affects engraving's
      `VerticalLayout` and `SystemLayout`.
- [ ] **Slur numbering** — make overlapping and nested slurs distinguishable; touches `Notations`,
      engraving's `Slurs`, and the importer's `NotationReading` at once. **Downgraded on
      measurement:** section A called this the dominant domain change on the strength of 2,416
      slurs, but raw count is not ambiguity — **2,400 are `number="1"`, only 16 are `number="2"`,
      and the whole work has just 8 moments with two slurs open at once.** The smoke-test theme
      has 140 slurs, every one `number="1"`, zero overlap, so `SlurRole`'s Begin/End is fully
      sufficient there. A real gap that will mis-engrave 8 places in 531 measures — not a blocker.
      Do it when those 8 places matter, not before.
- [ ] **Ornaments in the domain, not derived** (review item 4) — `ornaments?` on `Notations`.
      The census narrows the needed set to **trill and turn**; add inverted turn and the mordents
      only if a later piece asks. A trill cannot be inferred from pitches, so deriving it was
      never an option, and both pipelines interpret it differently (engraving prints glyph + wavy
      extension; playback realizes the alternation). Follows the fermata precedent `Notations.ts`
      already sets.
- [ ] **Movement structure — ✅ RESOLVED (trap 1), with one correction.** I had this wrong: the
      navigation is **not** prose. `Fine` and the Menuetto's da capo are structurally encoded as
      `<sound fine="yes">` (idx 294) and `<sound dacapo="yes">` (idx 340), with the `<words>` at
      those measures being duplicates. So the importer reads attributes, not text. Two details:
      those `<sound>` attributes sit on **Violin I only**, so they need hoisting to the measure in
      `PartwiseToTimewise`; and `dacapo` plus a Fine implies `DaCapoAlFine` rather than bare
      `DaCapo`. `Trio` genuinely is prose-only, but it is a **section label**, not navigation, so
      it lands in `Measure.newSection` alongside the movement titles and `Var. I`–`Var. IV`.
      Sections carry a title and a break strength (`System` / `Page` — the source's own `<print>`
      gives movements a page and interior sections a system), and playback ignores them entirely.
      `NavigationMark.Capo` covers a da capo that must return somewhere other than measure 0.
      Still not representable: `la seconda volta più presto` (idx 108), a repeat-dependent tempo
      change — report it and decide deliberately.

_Deferred by the census, not dropped:_ arpeggio and tremolo modeling (zero occurrences), and
bowing/technique directions (zero `<technical>` elements). Both are Beethoven-tier work. The
design reasoning for keeping arpeggio and tremolo out of a flat ornament list is preserved in
review item 4 for when it becomes due.

- [ ] Whatever else the histogram puts above these.

### Phase 3 — Engraving

- [ ] Bracket and joined barlines for the grouped staves.
- [ ] Staff labels: full names on the first system, abbreviations after. `TextMeasure` exists but
      the staff-label margin is still a fixed 8 spaces and does not consult it — a four-staff
      score with "Violoncello" in the margin will expose that immediately.
- [ ] Ornament glyphs. Bravura has all of them; they need adding to the extraction list in
      `generate-bravura.mjs` and a regenerate.
- [ ] Stub (partial) secondary beams.
- [ ] Chord beaming.
- [ ] Tie-aware accidental suppression across barlines.
- [ ] Multi-voice rest placement for divisi.
- [ ] Slur segments across 3+ systems.
- [ ] Invariant test suite over the imported corpus (collisions, page width, measure boxes, stem
      consistency, measure capacity).

### Phase 4 — Playback

**The bar for "supported" is structural correctness** (review item 6): right pitches, rhythms,
repeats, and tempo; dynamics and articulation audibly distinct; ornaments realized. Timbre stays
synthetic — sampled instruments and true bowed legato are explicitly a later project, not part of
calling this piece done.

- [ ] Per-part instruments behind the existing `Instrument` interface — the seam is already there
      and documented for exactly this ("a sampled or SoundFont instrument could replace it behind
      this same interface"). Four bowed-string voices, however approximate, beat four sine waves.
- [ ] String-appropriate envelope — the current ADSR is a plucked/keyed shape; bowed attack and
      release are different enough to matter.
- [ ] Articulation shaping of duration and velocity (staccato shortens, tenuto sustains, accent
      and marcato hit harder). Flagged as unapplied in `playback.md`.
- [ ] Slur → legato (overlap and suppressed re-attack).
- [ ] Ornament realization — at minimum trills; tremolo if the histogram demands it.
- [ ] Crescendo/diminuendo as true ramps, applied at staff rather than voice scope.
- [ ] Accel./rit. performed.
- [ ] Structural verification suite — per-part note counts, total duration, tie folding, no
      degenerate durations.

### Phase 5 — Application

- [ ] Load the imported quartet in the app and read it: multi-page scrolling, four-staff systems,
      print layout.
- [ ] Per-part mute/solo — the fastest way to hear whether one part is wrong.
- [ ] Storybook stories driven by the imported score, not just the invented fixtures.

---

## Known gaps (deliberate simplifications proposed up front)

- **Import is one-way.** No export back to MusicXML. Round-tripping is a much larger contract and
  nothing here needs it.
- **No layout import.** MusicXML carries page breaks, system breaks, and explicit positions; we
  ignore all of it and re-engrave from scratch. That is the point — we are testing our engraver,
  not replaying someone else's.
- **No beaming import.** The domain has no beam field and derives beaming from beat structure
  (`rendering-strategy.md` records this). Haydn's beaming will differ from ours in places, and
  those differences are _expected_, not defects — worth noting so they do not get "fixed" twice.
- **One movement in memory at a time.** No streaming, no lazy layout, until profiling says
  otherwise.
- **Report-and-drop for unsupported elements**, never silent-drop. An import that loses a trill
  must say so.

## Major assumptions

- The OpenScore encoding of this quartet is a faithful transcription. Its license is settled
  (CC0) and its existence is confirmed, but **quality is still an open risk**: if the encoding is
  poor we will spend the project debugging someone else's transcription instead of our pipeline.
  The first read-through of the rendered movement II theme against the reference is the check —
  if it fails, switch to Op. 76 No. 2 from the GitHub mirror rather than patching the corpus file.
- MusicXML is the right interchange format. It is the only one with the coverage we need and
  universal editor support; MIDI loses all notation, and MEI has a thinner ecosystem.
- The engraving and playback pipelines are architecturally sound and this project is about
  _coverage_, not redesign. Both docs report their pipelines complete with refinements
  outstanding. If the quartet breaks an architectural assumption instead of a feature gap, that
  is a genuine finding and this plan should stop and be rewritten.
- Four staves is not a scale problem. The engraving pipeline already does multi-staff vertical
  layout; going from two staves to four should be quantitative, not qualitative.
- Reference comparison is a human judgment. No pixel gate.

## Potential problems

- **The histogram could be overwhelming.** If the first report shows sixty unsupported element
  types, the discipline is to work strictly top-down by frequency and re-import after each fix,
  not to attempt breadth. Movement II's theme is chosen first precisely to keep the initial
  report small.
- **Partwise→timewise reconciliation is where importers rot.** Real MusicXML disagrees with
  itself: parts carry different `<divisions>`, repeat marks appear on some parts and not others,
  measure numbering skips. Every disagreement needs a stated policy, not an ad-hoc branch.
- **Slur numbering is a cross-cutting change** landing in domain, engraving, and importer at once.
  It cannot be staged the way an ornament glyph can.
- **Multi-voice engraving is the known hard part.** `rendering-strategy.md` calls it "genuinely
  hard engraving," and divisi in the inner voices will hit it directly.
- **Performance at movement scale.** ~500 measures × 4 staves is 50–100× the largest fixture the
  pipeline has ever laid out. Line breaking, spacing, and the invariant checks are all plausibly
  superlinear. Worth measuring early rather than discovering during Phase 5.
- **We may be tempted to fix the transcription.** If the source has errors, editing our copy of
  the corpus file to make our renderer look right is self-deception. Fix the pipeline, or record
  the source error explicitly.

## Build order

1. Phase 0 in full. Do not write importer code until the source, the reference, the capture
   command, and the hand-authored theme all exist.
2. Importer skeleton through `NotationReading`, aimed only at the 20-bar theme. Success is the
   imported theme matching the hand-authored one.
3. First full report on movement II. Read the histogram before deciding anything else.
4. Staff grouping and part identity — the two structural blockers — regardless of what the
   histogram says, because the page is wrong without them.
5. Histogram top-down, re-importing after each fix.
6. Movement II complete → I → III → IV, taking the same loop each time.
7. Playback fidelity once the engraving is readable. A wrong score played beautifully is still
   wrong.

## Items for review — all resolved

1. **The corpus source — ✅ RESOLVED.** The OpenScore String Quartets corpus is real: 100+
   quartets by 40+ composers, released **CC0**, with a public GitHub mirror. Two findings
   complicate the obvious path, though:

   - The **GitHub mirror stores `.mscx`** (MuseScore's native uncompressed XML), _not_ MusicXML.
     Using it as a source would mean a local MuseScore CLI install to convert.
   - The mirror's Haydn directory holds **Op. 76 Nos. 1 and 2 only — No. 3 is absent.** The
     Emperor _does_ exist as an OpenScore set on MuseScore.com (score `20428156`), so the mirror
     is a partial or stale snapshot rather than the full collection.

   **Decision: stay with the Emperor, downloading MusicXML manually from MuseScore.com.** Since
   the corpus file gets committed to the repo either way, the mirror's scriptability advantage is
   largely illusory — it buys a one-time convenience at the cost of a MuseScore toolchain
   dependency and a less ideal smoke-test movement. MuseScore.com returns 403 to automated
   fetching, so this is one human browser download, recorded in Phase 0.

   **Fallback if the encoding proves poor:** Op. 76 No. 2 "Fifths" from the mirror, which also
   brings the "Witches' Minuet" — a strict canon at the octave between the violin pair and the
   viola/cello pair, which would be an excellent test of cross-staff rhythmic alignment.

2. **XML parser — ✅ RESOLVED: `@rgrove/parse-xml`.** The decisive factor is not speed but
   **document order**. MusicXML is order-sensitive throughout — the `<note>` sequence _is_ the
   music, and `<backup>`/`<forward>` only mean anything positionally. `fast-xml-parser` produces
   a plain JS object tree that collapses sibling order by default; its `preserveOrder` mode
   recovers it but yields an awkward shape to read against. `@rgrove/parse-xml` returns a real
   node tree that is order-preserving by construction, which is exactly what a reader wants.

   It also happens to be zero-dependency, TypeScript-native, and faster. And it parses the
   DOCTYPE **without loading external DTDs** — which matters, because every MusicXML file carries
   a DOCTYPE pointing at `musicxml.org`, and we want neither a network fetch nor an XXE surface
   at parse time. One runtime dependency in `packages/import`; domain, engraving, and playback
   keep their zero.

3. **`.mxl` in v1 — ✅ RESOLVED: no.** It would need a second dependency (a zip reader) purely to
   handle a container format.

   Note that MuseScore.com's MusicXML download is **`.mxl` only** — uncompressed is not on offer,
   so this is not avoided by asking for a different export. It is avoided by _when_ we decompress:
   `.mxl` is an ordinary zip, so we unzip once by hand at ingest and commit the uncompressed
   document. Since we commit exactly one corpus file, a decompression step in the importer would
   run once per project lifetime — that is a script's job, not a dependency's. If `.mxl` support
   becomes genuinely worth having later (accepting arbitrary user uploads would do it), `fflate`
   is the pick (tiny, MIT, zero-dep) and the change is confined to `XmlReading`.

4. **Ornaments — ✅ RESOLVED: in the domain.** A trill is not derivable — nothing in a sequence of
   pitches implies one — so "engraving-derived" was never actually available. And the two
   pipelines interpret it differently: engraving prints a glyph with a wavy extension, playback
   realizes an alternation. That is precisely the fermata's situation, which `Notations.ts`
   already resolved by modeling it separately.

   New `ornaments?` on `Notations` for the single-note symbols (trill, turn, inverted turn,
   mordent, inverted mordent). **Arpeggio and tremolo stay out of it**: an arpeggio is a
   chord-attack property belonging on `Chord`, and a tremolo carries duration semantics, a
   measured/unmeasured distinction, and can span two notes. Folding either into a flat ornament
   list would repeat the error of folding the fermata into `Articulation`.

5. **Part identity vs. staff grouping — ✅ RESOLVED: two concepts.** They vary independently.
   A part is a performer with an instrument; a staff is a notational surface; a group is a
   bracket. The mapping is not 1:1 in any direction — a piano is one part on two staves under a
   brace, a quartet is four parts on four staves under one bracket, and a divisi passage is one
   part temporarily needing two. Collapsing them would work for the quartet and break at the
   first piano score.

   Model it as MusicXML does (`<score-part>`, `<part-group>`, `<staves>`), since the importer must
   map to that anyway. The load-bearing constraint: **`Score.staves` stays the flat, ordered list
   that `measure.contents` indexes against**, with `parts` and `groups` as descriptive layers over
   it. That keeps `Score.check`'s `contents.length === staves.length` invariant — and the whole
   timewise model underneath it — untouched.

6. **Playback fidelity bar — ✅ RESOLVED: structural correctness.** Right pitches, rhythms,
   repeats, tempo; dynamics and articulation audibly distinct; ornaments realized. Synthetic
   timbre is acceptable. Sampled instruments, bowed envelopes, and true legato phrasing are a
   separate project and should get their own document rather than quietly expanding Phase 4.

7. **Movement details — ✅ RESOLVED and corrected.** The Strategy table now carries verified
   facts. Two things I had wrong or vague: the second movement is in **cut time**, not common
   time, and has **four** variations (one source claimed five); the finale is **C minor → E♭ →
   C major in 2/2**, not merely "a mode change". The Menuetto's Trio is in **A minor**, which
   makes movement III a mid-work key change as well as a da capo test.
