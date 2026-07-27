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
  **Two of those places fall inside the smoke-test theme** (measures 131 and 135), so the "simplest
  possible first target" is not single-voice after all and `VoiceBuilding` had to handle the cursor
  properly from the first commit rather than later.

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
   **The `<other-dynamics>` cost less than it looked.** Each shares its `<dynamics>` block with a
   real mark — " dolce" rides on a `p` four times and " sempre" on an `fz` once, which is why 406
   blocks hold 411 marks — so the loudness is imported and the annotation alone is lost.

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

- ~~No stub (partial) secondary beams~~ — **fixed.** The prediction from 1,947 sixteenths and 421
  thirty-seconds against 3,833 eighths was right: the work needs **278** fractional beams.
- ~~Chords never beam~~ — **fixed.** **534 `<chord/>` elements**, which `VoiceBuilding` groups into
  **502 chords carrying 1,036 tones** (mostly double stops, 32 of them thicker); the two figures
  count different things and both are right. The prediction that they occur inside beamed runs was
  right and understated: **238 of the 502 do**, in 75 beam groups.
- Accidental state is per voice — 976 accidentals and 350 ties. **Moderate.** The tied-across-a-
  barline half is **fixed**: 147 notes tie across a barline, 30 carrying an explicit accidental.
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
  **Not built yet, and the gap is easy to misread.** `Coverage.audit` partitions element _names_,
  not counts, so the CLI's `unaccounted 0` means every distinct tag in the file appears on one of
  the four lists — a real check, and the one that caught the score header the moment it moved.
  But it is silent about _how many_ elements each name stood for, so a reader that handles the
  first `<notations>` block of a note and quietly discards the second still reads as fully
  accounted. That exact bug happened, and corpus counts rather than the audit are what found it.
  Until `ImportReport` totals the elements each reader actually consumed, `unaccounted 0` should
  be read as "no unknown vocabulary", not as "nothing was dropped".
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

### The independent oracle — ~~a hand-authored fixture~~ the reference engraving

Every estimator above compares the importer against **the source file**. None can catch an error
where the importer and the estimator share a misreading of MusicXML semantics — both ignoring
`<backup>`, say. Something independent of MusicXML is needed to close that.

This document proposed a few bars transcribed by hand from the printed page. **Dropped, and it was
the wrong instrument for the job.** A hand transcription is a second thing that can be wrong, with
no way to tell which of the two is — the doc's own caveat about "debugging the fixture instead of
the importer" applies at four bars as much as at twenty-one, because a fixture small enough to
trust is too small to cover anything. It would have pinned `<backup>` semantics across two staves
of one bar and said nothing about the other 530.

**The reference PDF is the independent oracle, and it always was.** It is a published engraving of
this exact work, derived from no MusicXML at all, covering all 531 measures; the capture harness
already puts our rendering beside it for one command. Reading the two against each other is the
check, and it is the same act the project already calls its comparison loop — which is why this
never needed a separate artifact. The residual risk is a shared misreading that also happens to
look right on the page, which is small, and smaller than the risk of trusting a transcription we
wrote ourselves.

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
- [x] ~~Hand-author a **short excerpt** from the reference PDF.~~ **Dropped — see "The independent
      oracle" in section B.** It was meant to pin MusicXML semantics from a source independent of
      MusicXML, which is a real gap; a hand transcription is just the wrong way to close it, being
      a second thing that can be wrong with no way to tell which of the two is. The reference
      engraving is the independent oracle, covers all 531 measures rather than four bars, and the
      capture harness already puts our rendering beside it in one command.

### Phase 1 — `packages/import`

- [x] **Package skeleton** — `packages/import`, depending on domain plus exactly one runtime
      dependency, **`@rgrove/parse-xml` 4.2.2** (ISC, zero transitive deps). Same build/test/export
      scheme as playback and engraving, no barrels. `@types/node` is a _dev_ dependency and is
      wired into `tsconfig.test.json` only, deliberately not `tsconfig.json`, so `src` cannot reach
      for a Node API — the importer stays environment-agnostic like the other pure packages, and
      reading a file from disk stays the caller's job.
- [x] **`XmlReading`** — parse to a validated node tree, plus the traversal vocabulary every later
      reader needs (`elements`, `childNamed`, `childrenNamed`, `textOf`, `attribute`) and the
      element counters the accounting identity needs (`countElements`, `totalElements`). Rejects
      only what cannot be read: malformed XML, a rootless document, and `score-timewise` — refused
      outright rather than half-supported, since a timewise file is a different traversal.
      **One deviation from the plan as written:** a missing DOCTYPE is _not_ an error — MusicXML
      3.1 and later are commonly XSD-validated and shipped without one, so requiring it would
      reject valid files, and the root element plus its `version` attribute are the reliable
      identification. Verified against the real corpus by 20 tests: the 4 MB file parses offline
      despite declaring a DOCTYPE pointing at `musicxml.org`, all four parts and 531 measures per
      part are found, document order survives around `<backup>`, and the element counts match the
      census exactly (113,657, the census's 113,658 less the root).
- [x] **`Reporting`** — the warning channel. `Result` carries reasons a file cannot be read at
      all; most of what an importer must say is neither that nor silence, so readers take a `Warn`
      callback. A plain callback rather than a wrapper type keeps every reader's signature
      `Result<T>`.
- [x] **`AttributeReading`** — `<attributes>` children into domain values (divisions, key, time,
      clef), so reconciliation can compare _domain_ values and whitespace cannot masquerade as
      disagreement. Two corpus findings shaped it: the file uses `symbol="common"`/`"cut"`, and it
      declares **no `<mode>` anywhere** — so Major is assumed and reported. That assumption is
      lossless downstream, since a signature's printed accidentals and implied pitches depend only
      on the fifths count; C minor and E-flat major engrave and sound identically, and only a
      spelled-out key name would show the difference.
- [x] **`PartwiseToTimewise`** — the grid and score-wide reconciliation, reading **no notes**: it
      hands each measure's children on per part, in document order, so the alignment logic is
      testable before a pitch is parsed and no note bug can masquerade as an alignment bug. The
      plan called this "per-part duplication", which was half the story — measured, score-wide data
      splits into _duplicated on every part_ (key, time, divisions, repeats: identical indices and
      values) and _written on one part only_ (voltas and the `<sound>` Fine/da capo, on Violin I
      alone). Reading "from part 1" would work here by luck while dropping the viola's two
      `<words>`; demanding agreement fails on voltas. So the rule is **union with conflict
      detection** — absent everywhere is absent, agreement wins, and a genuine disagreement is
      reported with the parts named and resolved to the first in score order. Divisions is
      deliberately excluded: it never reaches a `Score`, parts may legitimately differ, so it is
      per-part walking state. Refuses only what cannot be aligned (differing measure counts, no
      parts, an empty part); everything else warns. 47 tests, including the whole corpus: 531
      aligned measures, key and time reconciled to the census's indices, **zero disagreements**,
      the cello's tenor clef and its one mid-measure change reported, and a whole-warning-set
      assertion so anything new surfaces rather than joining a pile.
- [x] **`DivisionsToDuration`** — MusicXML states a note's length twice, and the two are different
      kinds of fact: `<type>`/`<dot>`/`<time-modification>` are the **written** form our `Duration`
      models, while `<duration>` is the **sounded** length in divisions that advances position and
      that `<backup>`/`<forward>` speak in. So the written form drives and the sounded value
      **checks** it — converting a parsed `Duration` back into divisions must reproduce
      `<duration>` exactly, in `Fraction` arithmetic that never rounds a tuplet into agreement.
      A mismatch means either the file contradicts itself or we misread it; both are worth hearing.
      The census missed that **160 notes carry no `<type>` at all** — every one a whole-measure
      rest, stating only how long it lasts — so the module also provides the inverse, searching the
      representable written values for one of exactly that length and reporting a failure rather
      than rounding when none fits. Verified by reading **all 10,593 notes of the corpus: zero
      failures and zero warnings**, with the 1,254 tuplets (1,224 triplets, 30 sextuplets), 547
      dotted notes, and 160 recovered whole-measure rests all matching the census.
- [x] **`PitchReading`** — `<pitch>` into domain `Pitch`, plus the rest/chord/grace predicates and
      the chord grouping (`<chord/>` means "sounds with the note before", so grouping is purely a
      matter of document order). The subtlety is that **`<alter>` and `<accidental>` say different
      things** — the sounding alteration versus what is printed — and the corpus holds all four
      combinations: 6,968 notes with neither, 1,353 altered but unprinted (an F♯ in G major, where
      the key supplies it), 663 altered and printed, and **313 printed with no alteration at all**,
      every one a natural cancelling the key. That last group is why `<alter>` alone is not enough:
      a B in F major with no `<alter>` is B-natural, but omitting the accidental means "follow the
      key", which would sound B♭. So a non-zero `<alter>` gives the accidental, an unaltered note
      takes `Natural` only when one is printed, and otherwise the key decides. A redundant
      accidental is harmless because both pipelines treat an explicit one as an _override_ rather
      than an addition (`Semitone.effective` and `Accidentals.resolve` agree on this) — pinned by a
      test that an F♯ in G major sounds identically spelled either way. Microtones and unpitched
      notation are refused by name rather than rounded or mistaken for a missing pitch. Verified
      across the corpus: every sounded pitch read with no failures, no sounding/printed
      disagreements, 2,329 explicit accidentals (2,016 alterations plus the 313 naturals), 45 grace
      notes, and the three rests whose printed position we cannot honor reported.
- [x] **`NotationReading`** — a note's tie and the `<notations>` the domain models (articulations,
      slurs, fermatas), plus a grace `<note>` into the `GraceNote` its principal carries.
      `<tuplet>` brackets are read as **redundant rather than unsupported**: `<time-modification>`
      already gave `DivisionsToDuration` the ratio and engraving derives the bracket, so reading
      both would give the tuplet two sources of truth. Ornaments are genuinely unsupported and
      reported by name, turning the 52 trills and 13 turns into a measured backlog item.
      **Two real bugs surfaced here**, both found by corpus counts refusing to match the census and
      both of the kind this project forbids — silent loss. First, a note may carry _several_
      `<notations>` blocks, additively: 155 notes here have two, with 25 staccatos living only in
      the second, which reading just the first dropped without a word. Second, 33 of the 45 grace
      notes are slurred to their principal and `GraceNote` has nowhere to put a slur — engraving
      could not draw one either — so the loss is real, and is now reported rather than silent.
      Corpus: 350 tie roles as 152 Begin, 152 End and **23 mid-chain `Both`** (ties spanning three
      or more notes), 1,040 articulations, 43 fermatas, 45 grace notes split 25 slashed / 20 not,
      and exactly three kinds of warning.
- [x] **`Coverage`** — the static manifest behind "nothing drops in silence", and not in this plan
      as first written. Reporting unsupported elements cannot enforce that rule on its own: an
      element no reader ever looks at raises no warning precisely _because_ nobody looked, so the
      failure is invisible by construction. Every element name a MusicXML file can contain is
      therefore accounted for in exactly one of four lists — **consumed**, **pending** (a planned
      module will read it), **ignored** (dropped deliberately, with the reason), **unrepresented**
      (a real loss the model cannot hold) — and `audit` partitions a file's census against them, so
      a name on no list is a defect whatever the readers happen to warn. Hand-kept rather than
      instrumented through every reader: that can drift from the code, but not _silently_, because
      the corpus test fails the moment the file holds a name no list mentions. `unrepresented` is
      currently **empty**, since the domain grew somewhere to put everything this corpus contains.
- [x] **`VoiceBuilding`** — the element builder, absent from this checklist until the code was
      audited against it; `Coverage.pending` is what named it, listing `backup`, `forward` and
      `voice` under a module the plan never had. It walks a part's measure children in document
      order behind a divisions cursor and emits `StaffContent`. **Two coordinate systems meet
      here**: the cursor moves in _sounded_ divisions, because that is the unit `<backup>` and
      `<forward>` speak, while the elements it places carry _written_ durations from `<type>`,
      because that is what the domain models — `DivisionsToDuration` already cross-checks the two,
      so each is used for what it is good for rather than one being chosen over the other. The
      load-bearing decision is **the extent rule**: every voice is padded with rests to the
      furthest the cursor ever reached, which covers a voice entering late, a `<forward>` opening a
      hole, and a `<forward>` trailing at a measure's end all at once — the last being how this
      corpus ends a short second voice. Deliberately not the time signature's capacity, which would
      silently fill the 22 partial measures. Verified over the whole corpus: **2,124 staff-measures
      built with zero failures**, every voice of every measure spanning the same duration (the
      sharpest available check on `<backup>`/`<forward>`), an accounting identity tying each class
      of `<note>` back to its own source total, 14 rests synthesised for the `<forward>`s, and
      **exactly the 22 short measures `Measure.partial` was sized for, with none overfull** —
      arrived at from the opposite direction, so the two measurements confirm each other. One
      warning in 531 measures, a grace note's slur. `Rest.of` gained the `position` argument
      `PitchReading` had been reading with nowhere to put.
- [x] **`DirectionReading`, the dynamics half** — `<direction>` splits in two, and not where this
      plan first drew the line. The split is not "dynamics versus everything else" but **what
      becomes an element in a voice versus what belongs to the measure**: a `DynamicElement` is a
      `MeasureElement` sitting at a position, because a mark takes effect at the note after it. So
      **`<wedge>` came here too**, against the checklist's first guess — `DynamicChange` is a
      `Dynamic`, so a hairpin is a voice element like any other mark; only tempo and the section
      titles are genuinely measure-level. 414 dynamics placed across the corpus (406 marks and 8
      hairpin openings). **One real bug, found by writing the corpus's own measure 131 as a test:**
      a direction routinely _precedes_ the first note of the voice it belongs to, because a second
      voice is written by rewinding, so taking the voice from the last note seen put the mark in
      the previous voice. It now looks forward to the voice it introduces, which is also what
      "takes effect at the following note" means. Three kinds of loss are reported rather than
      dropped: a hairpin's _end_ (8, unrepresentable since a change runs to the next dynamic), the
      `<words>` awaiting `StructureReading` (20), and the expressive text below.
      `Coverage.unrepresented` is no longer empty — it holds `other-dynamics`, the one thing in
      this file the model genuinely cannot carry.
- [x] **`ScoreAssembly`** — `TimewiseScore` plus the built measures into a `Score`, and **the whole
      531-measure quartet now passes `Score.check`** — staff alignment, part and group bounds,
      navigation, measure fullness, repeat pairing, volta endings, tie continuity and slur balance,
      on real music with no fixture in sight. Small, as predicted, because everything hard had
      already happened; the only decisions were positional. `Score` holds a key, time and clef
      while `Measure` holds _changes_ to them, so measure 0's declarations become the score's and
      every later one a change — and a file declaring nothing at measure 0 is refused rather than
      defaulted, since guessing C major would misspell every accidental in the piece. A measure
      short of its capacity is flagged `partial` rather than reported, which is safe only because
      the extent rule makes the alternative failure (a dropped note) show up as cross-voice
      disagreement instead. Title and composer come from `<work>` and `<identification>`.
- [x] **`SpannerReconciliation`** — the second module the corpus named that the plan had not. It
      clears tie _and slur_ roles whose other end is not where the model requires it, and two quite
      different things cause that. **A slice cuts a spanner**: importing measures 128–148 takes the
      end of a slur that began in measure 127, and dropping the orphan is simply correct, since
      nothing is lost that the slice ever contained. **A voice number is not an identity**, which
      is the real finding rather than a defect. A tie is a relationship between two noteheads, but the
      model stores it as a _role_ on each end and `Score.check` requires the two to meet inside one
      voice. MusicXML has no such rule: a voice number there is a per-measure grouping, freely
      reused, so a line can be voice 1 in one bar and voice 2 in the next while the music runs
      straight on. This work does it **once**, and the shape is instructive — measure 22 ends on a
      G4–B4 double stop written as one voice with the G4 tied over, and measure 23 separates the
      lines so the continuation lands in voice 2. Both ends are correct in the source; only the
      pairing is unreachable, and since engraving pairs ties within a voice too, it is a tie we
      could not draw either. So both ends are cleared and reported. What is deliberately **not**
      done is renumbering the file's voices to make the tie meet — that would be guessing at the
      writer's intent to flatter our model, and silently rearranging music to do it. It runs for
      every import rather than for this corpus, because a dangling tie is ordinary in real
      MusicXML: deleting the note at one end leaves the other behind. **This is containment, not a
      fix** — losing a tie the source got right is a limitation of our model, and the ways out are
      weighed under "Ties that outlive a voice number" in Phase 2.
- [x] **`MeasureSlicing`** — a measure range as a grid in its own right. More than `Array.slice`
      for one reason: MusicXML declares an attribute where it _changes_, so a slice beginning at
      measure 128 inherits everything declared before it, and cutting the array plainly would give
      a score with **no clefs at all** — this file declares them once at measure 0 and never again.
      The first measure of a slice therefore states the key, time and clef in force at that point
      whether or not the source restated them. Positional indices keep their original values so an
      error about measure 131 still names a measure a reader can find; nothing downstream keys on
      them, because `ScoreAssembly` was changed to decide what is initial by **position in the
      grid** rather than by the source's own index, which is what makes a slice assemble exactly
      like a whole file. A **development affordance, not the shipping shape**: the deliverable is
      one combined `Score`, and this exists so the smoke test can be 21 bars instead of 531.
- [x] **CLI entry** — `pnpm --filter @scoregrove/import run import <file> [--from=n] [--to=n]`,
      writing score JSON plus the report. (`run` is not optional: `pnpm import` is a builtin.) It
      lives in `scripts/` rather than `src/` so the package stays environment-agnostic — reading a
      file from disk is the caller's job, and this is that caller. **One environment surprise:**
      every package builds with `moduleResolution: "Bundler"`, so `dist` keeps the extensionless
      relative specifiers the sources are written with; Vite and Vitest resolve those, Node's ESM
      loader does not. A 15-line resolver hook, confined to this package's scripts, adds `.js` only
      where resolution has already failed. The real fix is in the build output or a bundling step,
      and papering over it repo-wide would hide a genuine inconsistency between how the code is
      compiled and how it is run.
- [x] **`StructureReading`** — barlines, repeats, voltas, navigation and tempo, so
      `NavigationUnfolding` finally has real navigation to unfold: 11 repeats, 4 voltas, a `Fine`
      at measure 294 and the Menuetto's `DaCapoAlFine` at 340. Three things the corpus settled.
      **Endings are ranges, not marks**: MusicXML brackets a volta between a start and a stop while
      `Measure.ending` says "this measure is in volta _n_", so the measures _between_ them have to
      be filled in — which is why this reads the whole grid at once. **Navigation is read from
      `<sound>` attributes**, not from the prose beside them, and a da capo is promoted to
      `DaCapoAlFine` once a Fine is known to exist — resolved after the whole grid, since the Fine
      may come later. **Tempo has two sources and one slot**: a printed `<words>Allegro` and an
      unprinted `<sound tempo="112">`. The printed word wins where it names a marking we model,
      because it is what a reader sees and playback resolves a marking to bpm anyway
      (`TempoResolution.markingBpm`); where the words are prose the model has no name for — this
      work's "Poco adagio; cantabile" — the metronome mark carries the measure and the text is
      reported rather than rounded to the nearest marking it happens to contain. A **repeat that
      opens and never closes** is dropped and reported, which the whole work never needs and every
      slice cutting a repeat does.
- [x] **`SectionAndCapoSynthesis`** — **one combined `Score` for the whole work**, exactly as
      planned: nine sections, with the four movements taking a page and `Var. I`–`Var. IV` and the
      `Trio` a system, and a `NavigationMark.Capo` at each movement start without which the
      Menuetto's da capo rewinds to the opening of movement I. **Where a section begins is read
      structurally, not by matching titles**: a section starts where a `<print>` forces a break
      _and_ the measure carries text, and the break's own strength chooses the section's. That is
      the one place this project reads the engraver's layout rather than re-deriving it, and it
      earns the exception by carrying structure rather than spacing. **The title is the first
      unclaimed text on the top part**, and both halves of that were forced by the corpus: a
      section measure often carries two texts ("Var. I" then "sempre piano"), and requiring the top
      part came from getting it wrong — the viola's stray "♮" at measure 19 lands on a measure the
      engraver also broke a system at, and titled a section "♮" until headings had to sit where a
      heading is actually printed.
- [x] **`ImportReport`** — the score, four occurrence histograms partitioning all 113,657 elements
      (93,605 consumed, 20,047 dropped by design, 5 unrepresented, 0 unaccounted), and the
      warnings. **Building it corrected the plan rather than completing it.** The identity was
      billed as what "turns _never drop silently_ into something enforced"; it is not. Elements are
      partitioned by **name** against `Coverage`'s manifest, so the partition balances _by
      construction_ — a run where it did not would mean the manifest was broken, not the import.
      What it genuinely catches is a name on **no** list, which is real and did catch the score
      header the moment it moved. What it cannot catch is a reader meeting an element and
      discarding part of it: `<notations>` sat in the consumed column throughout the bug where
      reading only the first block lost 25 staccatos. So a clean report reads "no unknown
      vocabulary, and every decision stated" — never "nothing was lost". The checks that could say
      that live below, and the CLI prints the distinction rather than leaving the number to be
      misread.
- [x] **`Verification`** — `--verify`, eight estimators, every one comparing the built `Score`
      against the **source file or against itself** rather than against a manifest, which is
      exactly what `ImportReport` cannot do. All eight pass on the corpus: `Score.check`;
      per-measure element counts; a **per-measure pitch digest** matching every letter, alteration
      and octave in order; cross-part duration agreement; determinism; a slice matching the same
      measures of the whole; no part below its instrument's lowest string; and rests a minority of
      the elements. Counts are per (part, measure) throughout, because a score-wide total lets a
      note dropped in bar 12 cancel one duplicated in bar 300 — and a per-measure failure says
      _where_ to look. Each catches a class the others miss: counting sees a dropped note but not a
      wrong octave, the pitch digest sees the octave, cross-part agreement needs no oracle at all
      and is the sharpest check on `<backup>`/`<forward>`, and the range check is the only one that
      can catch a whole-class transposition error, since every per-measure comparison would agree
      with a source and importer that were wrong together. Its own tests deliberately break a score
      three ways, because a check that cannot fail is worth nothing.
- [x] **Vitest suite** — focused fixtures per reader module, and the corpus itself at scale: 180
      tests across nine files, including `Verification`'s deliberate three-way breakage of a score
      to prove its checks can fail. The round-trip against a hand-authored excerpt is gone with the
      excerpt.

**Milestone reached: movement II's theme is on screen.** One command imports measures 128–148 and
a second engraves them, and the result is readable four-staff music — correct clefs, G major, cut
time, the `fz` and `p` dynamics, fermatas, slurs, the viola's double stop, and the turn in the
first violin. The import passes `Score.check` and reports 28 decisions. That answers the risk this
document left open on purpose: **the OpenScore encoding is good.** Nothing in the rendered theme
suggests we are debugging someone else's transcription, so the fallback to Op. 76 No. 2 is off the
table.

What the first read-through shows, all of it already on the Phase 3 list and none of it a surprise:
no bracket and no joined barlines, so the four staves still read as four unrelated instruments; no
staff labels; and dynamics that collide with the staff and with slurs, since a dynamic is placed
without consulting what is already there. Slur placement is the one judgement call worth a second
look — many sit below where the reference puts them above.

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
- [x] **`Part`** — name, abbreviation, and an instrument-sound reference for playback. Parts
      partition `Score.staves` in score order via a `staves` count, so `staves` stays the flat list
      `Measure.contents` indexes against — parts are a layer over it, not a replacement. Optional,
      so every existing fixture stays valid; `Score.check` validates that parts cover the staves.
- [x] **`StaffGroup`** — a symbol (bracket / brace / line) over a staff range, with optional joined
      barlines. A range rather than a tree, because groups nest by containment; `Score.check`
      validates bounds and ordering. The importer reads `<part-group>` as the stack MusicXML
      encodes (groups open and close _between_ `<score-part>` entries), and the corpus's bracket
      comes through as one group over all four staves with barlines joined. **Engraving does not
      draw it yet** — the information is carried, the rendering is Phase 3.
- [ ] **Ties that outlive a voice number** — the open question `TieReconciliation` records rather
      than answers. Dropping a tie the source got right is a limitation, not a resolution: the
      music is continuous and both ends are correctly encoded, and we lose it only because our tie
      is a _role on each end_ that `Score.check` requires to meet inside one voice index, while
      MusicXML treats a voice number as a per-measure grouping that is freely reused. Three ways
      out, none obviously right. **Relax the check to per staff** — cheap, but it would pair
      genuinely independent lines that happen to share a pitch, weakening a check that is otherwise
      catching real errors. **Give a tie an identity** rather than a role on each end, which is
      what the notation actually is and would also settle the same question for slurs (see below) —
      the honest fix, and much the largest. **Track voice continuity at import**, matching a
      measure's voices to the previous measure's by pitch and position rather than by number, which
      keeps the domain untouched but puts a heuristic in the importer. Only one tie in this work
      hits it, so it is not blocking; do it when a piece makes it hurt, and prefer the second
      option if the slur work lands first, since they are the same problem twice.
- [ ] **Slur numbering** — make overlapping and nested slurs distinguishable; touches `Notations`,
      engraving's `Slurs`, and the importer's `NotationReading` at once. **Downgraded on
      measurement:** section A called this the dominant domain change on the strength of 2,416
      slurs, but raw count is not ambiguity — **2,400 are `number="1"`, only 16 are `number="2"`,
      and the whole work has just 8 moments with two slurs open at once.** The smoke-test theme
      has 140 slurs, every one `number="1"`, zero overlap, so `SlurRole`'s Begin/End is fully
      sufficient there. A real gap that will mis-engrave 8 places in 531 measures — not a blocker.
      Do it when those 8 places matter, not before.
- [x] **Ornaments in the domain** (review item 4) — `Ornament` (Trill, Turn) with
      `ornaments?: NonEmptyArray<Ornament>` on `Notations`. Modeled rather than derived, since
      nothing in a sequence of pitches implies an ornament and the two pipelines read one
      differently: engraving prints a sign, playback realizes the figure it stands for — the same
      reason the fermata is modeled apart from `Articulation`. Deliberately narrow: mordents and
      the inverted turn are equally standard but wait until a piece asks, and adding one is a
      member plus a SMuFL glyph (`ornamentMordent`, `ornamentTurnInverted` both exist). Arpeggios
      and tremolos stay out, as review item 4 argued. Engraving draws them above the note through
      the whole stack — Bravura glyphs, layout tree, `NoteView`/`ChordView` — and the importer now
      keeps all 65 (52 trills, 13 turns) instead of reporting them as losses. **Marks above an
      element now stack by their own bounding boxes rather than a fixed step**: the trill glyph is
      1.56 staff spaces tall against the fermata's 1.32, so any uniform step shorter than the
      tallest glyph overlaps — which the old 1.2 did, found by looking at a rendered fixture rather
      than by a test.
- [x] **Movement structure — RESOLVED (trap 1), with one correction.** I had this wrong: the
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

- [x] **Bracket and joined barlines for the grouped staves.** The single most visible defect, and
      the first thing the rendered theme confirmed: without them four staves read as four unrelated
      instruments. `StaffGroup` reaches the rendering side through `LaidOutScore.groups`, so nothing
      downstream needs the `Score` — which staves a group spans is a domain fact, where its bracket
      lands is geometry the system already has in `staffYs`. Three pieces: the **bracket** is drawn
      as a path rather than set from Bravura's `bracketTop`/`bracketBottom`, because those are
      fixed-size glyphs and a bracket has to span whatever distance vertical layout put between the
      staves; the **systemic barline** closes the left edge, running unbroken since there is no
      per-staff barline at x = 0 to join up with; and the **joined barlines** are drawn as bridges
      across the gaps _between_ staves rather than by redrawing each barline full height, which
      keeps every repeat dot where its own staff already put it.
- [x] **Staff labels: full names on the first system, abbreviations after.** It did expose the
      fixed 8-space margin immediately — "Violoncello" overran it. The margin is now the widest
      label actually printed, measured with the same injected `TextMeasurer` the rest of the
      pipeline uses, and nothing printed means no margin at all. Names come from `Score.parts`
      where it has them and fall back to `Staff.label`, so every hand-authored fixture prints
      exactly what it printed before parts existed; a part spanning several staves names only its
      first, which is how a grand staff is printed. **The corpus has no `<part-abbreviation>`**, as
      the census warned, so the short form falls back to the full name and later systems still read
      "Violoncello" — correct given the data, and the cue that authoring the short forms is ours to
      do.
- [x] Ornament glyphs — `ornamentTrill` and `ornamentTurn` extracted and drawn above the note,
      with marks now stacking by their own bounding boxes rather than a fixed step.
- [ ] Remaining ornament glyphs (mordents, inverted turn) when a piece asks. Added to the
      extraction list in
      `generate-bravura.mjs` and a regenerate.
- [x] **Stub (partial) secondary beams.** `Beaming.geometry` drew a secondary level only where two
      or more adjacent notes carried it (`runEnd > runStart`), so a level belonging to **one** note
      produced nothing at all — and a dotted-eighth–sixteenth pair printed as two notes that look
      like eighths, which is the wrong rhythm on the page rather than a spacing quibble. A lone
      level now draws a fractional beam. **Which way it points is the only real decision**: back at
      the note before it, except at the start of a group where there is nothing behind it and it
      must point forward. That is the conventional default and it gets both common figures right.
      The reach is capped at half the distance to the neighbour, so two facing stubs cannot meet
      and read as a full beam — a rhythm neither note has. **278 fractional beams** across the
      work, against the census's prediction that dotted-eighth–sixteenth figures were "certain".
- [x] **Chord beaming.** A one-line cause with a five-site fix: `Beaming.groups` tested
      `element.kind === 'note'`, so a chord could never join a beam, and `MeasureLayout` never
      registered one for the geometry pass or passed it a beam direction. A chord beams exactly as
      a note does — one written duration, one stem — and its several noteheads change where the
      beam sits, not whether there is one; each tone now counts toward the group's stem direction,
      since the beam has to clear all of them. **238 of the corpus's 502 chords beam**, across 75
      groups, every one of which drew a flag before. The second violin's repeated double stops in
      measures 26–30 are the clearest case: continuous sixteenth runs where there had been a flag
      per chord.
- [x] **Tie-aware accidental suppression across barlines.** A note tied over a barline restated its
      accidental, which reads as a second, fresh alteration rather than a continuation. It now
      prints nothing — and is **transparent to the rest of the measure**, not seeding the accidental
      state, so a later note of that letter and octave is judged against the key alone and states
      itself. That is the conventional reading: the tied accidental holds for the tied note, not
      for the bar it lands in. **It needed no lookahead into the previous measure**, which was the
      thing that made this look bigger than it was: a tie must be continued by the element
      immediately following it — `Score.check` enforces exactly that — so a tie received anywhere
      but at a voice's first sounding element came from earlier in the same measure, where the
      state already carries the alteration and nothing prints anyway. 147 notes tie across a
      barline in this work, 30 of them carrying an explicit accidental.
- [ ] Multi-voice rest placement for divisi.
- [ ] Slur segments across 3+ systems.
- [x] **Invariant test suite over the imported corpus.** Four properties any correct engraving has
      whatever its house style, run over all 531 measures: **systems fit the page width**, **no
      element escapes its measure**, **every note under one beam agrees on stem direction**, and
      **a dynamic clears the notes on its staff**. The first three pass. Measure capacity is
      already `Score.check`'s and runs in `Verification`. The invariants live in engraving, which
      knows what a layout tree means; the corpus run lives with the corpus, which is why `import`
      gained engraving as a dev dependency. Each violation names its system, measure and staff,
      because a bare count over 531 measures is not something anyone can act on.
      **Two findings, and the first was mine.** The stem-direction check reported three broken
      beams that were not broken: it gathered elements by x position, and two voices on one staff
      overlap in x with stems pointing opposite ways, exactly as they should. The layout tree could
      not express "under this beam" at all, so `LaidOutBeam` gained a `voice`. The second is real:
      **39 places where a dynamic collides with a notehead**, all one cause — `dynamicY` is a fixed
      7 spaces below the top line and never consults what hangs below the staff. It is kept as a
      running test asserting the count rather than omitted, so fixing placement would fail it and
      force the number to be revisited — which is exactly what happened, twice, in the item below.
- [x] **Dynamic placement that consults the staff below it** — `DynamicPlacement`, and the 39
      collisions are **zero**. One baseline per staff per system, set by the deepest content
      anywhere in that staff's slice: nudging each mark independently would clear every collision
      and leave the row staggered, which reads worse than the collision it fixed. Hairpins move
      with the marks, since they share the baseline on purpose. It is a **pass rather than a
      placement rule** because the depth is not knowable when a measure is laid out — it depends on
      every measure of the system, and which measures share one is decided later by line breaking;
      so it runs after the spanners attach and before `VerticalLayout` measures the system, whose
      extents then include the marks where they finally sit. **The invariant caught the fix being
      incomplete**: the first pass left four, every one a flat or a sharp hanging lower than the
      notehead that cleared the mark, because only noteheads were being counted as obstacles.

### Phase 4 — Playback

**The bar for "supported" is structural correctness** (review item 6): right pitches, rhythms,
repeats, and tempo; dynamics and articulation audibly distinct; ornaments realized. Timbre stays
synthetic — sampled instruments and true bowed legato are explicitly a later project, not part of
calling this piece done.

- [x] **Per-part instruments behind the existing `Instrument` interface.** The seam took a whole
      quartet as readily as the sampled instrument it was documented for. **No pipeline change was
      needed**: every `NoteEvent` already carries `address.staff`, so the routing key existed all
      along and this was wiring in `web-client`, not a change to the domain or the compiler.
      Four decisions worth recording. **Route by part, not staff** (`PartRouting`): identical for
      this quartet, and wrong at the first piano score, where one player owns two staves and would
      be handed two instruments playing over each other. **An `Ensemble` behind the single seam**
      rather than an array in the transport, which calls `stopAll` from five places — every one
      would have become a fan-out, and the scheduler would have gained a concern it does not need.
      **Players are built lazily and shared by sound**, so the two violins get one audio graph; safe
      only because mute is decided _before_ routing, so a silenced part never reaches an instrument.
      **Routing is read per tone rather than captured**, so editing the parts reaches playback
      without rebuilding the transport and losing its position.
      The scheduled type was called `Voice`, which already meant a line within a staff _and_ one of
      the four players; it is now `Tone`. Timbre is a sawtooth through a per-instrument lowpass —
      the cutoff falling with the instrument's range is what makes a cello read as darker rather
      than merely lower.
- [x] **Per-part mute/solo** — pulled forward from Phase 5 deliberately, because **timbre cannot
      separate the two violins**: they share an instrument sound, correctly, and the ear follows
      the line rather than the colour. Muting the other three is what actually answers "is this
      part wrong?". It lives on the `Ensemble` because a muted part must be a note that is never
      scheduled — anywhere else means either teaching the scheduler about parts or cancelling notes
      after they have begun. Solo overrides mute as on any mixer, and clearing the solo restores
      the mutes rather than forgetting them.
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
- [x] **Per-part mute/solo** — done early, alongside the per-part instruments; see Phase 4. The
      store carries the flags so the UI can show them, but the decision is the ensemble's. **No UI
      control yet** — the actions exist and are tested, the buttons do not.
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

1. ~~Phase 0 in full before any importer code.~~ **Overtaken, deliberately.** The source, the
   reference and the capture command exist; the hand-authored excerpt was dropped rather than
   deferred, the reference engraving being the independent oracle it was standing in for.
2. **Get the theme on screen.** `VoiceBuilding` → `DirectionReading` (dynamics) → `ScoreAssembly` →
   `MeasureSlicing` → CLI, then idx 128–148 through the capture harness. Success is 21 rendered
   bars to read against the PDF — which is also the first real test of the one risk this document
   leaves open on purpose, whether the OpenScore encoding is a _good_ transcription.
3. First full report on movement II. Read the histogram before deciding anything else.
4. Staff grouping and part identity — the two structural blockers. **The domain half is done**
   (`Part`, `StaffGroup`); what remains is Phase 3's bracket and joined barlines, which come
   regardless of what the histogram says, because the page is wrong without them.
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
