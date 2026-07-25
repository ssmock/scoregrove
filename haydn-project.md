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

## A. What the piece will demand that we do not have

Predicted from reading the domain against the score. The importer's report will replace this
list with a measured one; until then, this is the planning assumption.

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

`Notations` carries articulations, slur, fermata, graces, lyrics. `Articulation` is five members
(Staccato, Staccatissimo, Tenuto, Accent, Marcato). There is **no ornament concept at all**:
no trill, turn, mordent, tremolo, arpeggio. Haydn will not get through movement I without
trills. Bowing marks (up/down bow) and `pizz.`/`arco` as directions come next; string-specific
techniques (harmonics, mutes, sul ponticello) can wait for the Beethoven tier.

### Fidelity gaps we already know about

These are recorded in the two existing gap lists and will all become visible at quartet scale:

- No stub (partial) secondary beams — a dotted-eighth–sixteenth figure draws one beam. Ubiquitous
  in Haydn.
- Chords never beam. Double stops are chords, and they occur inside beamed runs.
- Accidental state is per voice, and a note tied across a barline restates its accidental.
- Multi-voice rest placement collides (divisi passages put two voices on one staff).
- Crescendo/diminuendo step rather than ramp; a dynamic applies to its own voice, not the staff.
  A `cresc.` under a quartet texture is a staff-level, arguably ensemble-level, instruction.
- Accel./rit. not performed.
- A slur spanning 3+ systems draws only its first and last segments.

---

## Module checklist

Ordered for implementation. Smoke test end-to-end first, breadth second, polish last.

### Phase 0 — Harness and target (before any importer code)

- [ ] **Manual step (human):** download the MusicXML of Op. 76 No. 3 from the OpenScore String
      Quartets set on MuseScore.com (score `20428156`), choosing **uncompressed `.musicxml`**, not
      `.mxl`. MuseScore.com blocks automated fetching (403), so this is a browser download done
      once. Commit it under `packages/import/corpus/` with a `PROVENANCE.md` recording the source
      URL, CC0 status, and OpenScore's requested credit line. After this the corpus is in-repo and
      every later import is reproducible and offline.
- [ ] Obtain a reference engraving (published PDF or the source editor's own render) to compare
      against, page by page.
- [ ] `scripts/haydn.mjs` — the one command: import, engrave, capture per-system PNGs headlessly,
      write them somewhere reviewable alongside the reference. Playwright-core is already known
      to work in this environment.
- [ ] Hand-author the movement II theme (~20 bars) as a fixture. Small enough to be honest work,
      and it becomes the importer's correctness oracle: importing the same 20 bars must produce
      an equivalent `Score`.

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
      failure, not a rounding.
- [ ] `PitchReading` — `<pitch>`/`<alter>`/`<octave>` → domain `Pitch`; `<rest>` → `Rest`;
      simultaneous notes with `<chord/>` folded into `Chord`.
- [ ] `NotationReading` — ties, slurs, articulations, fermatas, grace notes, tuplets, dynamics,
      wedges, directions. Every element it meets and cannot map goes to the report rather than
      being silently dropped — **silent dropping is the one thing this importer must never do.**
- [ ] `StructureReading` — barlines, repeats, endings/voltas, segno/coda/D.C./D.S., so
      `NavigationUnfolding` gets real navigation to unfold.
- [ ] `ImportReport` — `{ score, unsupported: Histogram, warnings }`. A `Result`, consistent with
      the rest of the domain. The histogram is the deliverable that ranks all subsequent work.
- [ ] CLI entry — `pnpm --filter @scoregrove/import run <file>` writing score JSON plus the
      report. Score JSON must be loadable by `Projects.ts` as-is.
- [ ] Vitest suite — round-trip the hand-authored theme, plus focused fixtures per reader module.

### Phase 2 — Domain additions (driven by the report, expected order)

Parts and grouping are **two concepts, not one** (review item 5), modeled the way MusicXML's
`<score-part>` / `<part-group>` / `<staves>` split already works — which the importer has to map
to regardless. Crucially, `staves` stays the flat ordered list that `measure.contents` indexes
against, so `Score.check`'s existing `contents.length === staves.length` invariant survives
untouched.

- [ ] **`Part`** — identity: full name, short name (systems after the first print "Vln. I", not
      "Violin I"), and a sound/instrument reference for playback. A part owns one _or more_
      staves (quartet: 4 parts × 1 staff; piano: 1 part × 2 staves). Replaces the bare `label?`.
- [ ] **`StaffGroup`** — a bracket/brace over a staff range, with a symbol (bracket / brace /
      line) and whether barlines run through the group. Nestable, because MusicXML's groups are.
      For the quartet: one bracket over all four, barlines joined. Affects engraving's
      `VerticalLayout` and `SystemLayout`.
- [ ] **Slur numbering** — make overlapping and nested slurs distinguishable. Touches
      `Notations`, engraving's `Slurs`, and the importer's `NotationReading` simultaneously.
- [ ] **Ornaments in the domain, not derived** (review item 4) — `ornaments?` on `Notations`,
      covering the single-note symbols: trill, turn, inverted turn, mordent, inverted mordent.
      A trill cannot be inferred from pitches, so deriving it is not an option, and both
      pipelines interpret it differently (engraving prints glyph + wavy extension; playback
      realizes the alternation). This follows the fermata precedent `Notations.ts` already sets.
- [ ] **Arpeggio and tremolo modeled separately** — not as `ornaments` members. An arpeggio is a
      chord-attack property (it belongs on `Chord`), and a tremolo carries duration semantics and
      a measured/unmeasured distinction, and can span two notes. Folding either into a flat
      ornament list would repeat the mistake of folding the fermata into `Articulation`.
- [ ] **Bowing and technique directions** — up/down bow, `pizz.`/`arco`. Possibly a general
      staff-attached text direction, which the score needs anyway.
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
   handle a container format. Since we commit exactly one corpus file, we simply commit the
   uncompressed `.musicxml` — MuseScore exports it on request. If `.mxl` becomes worth having
   later, `fflate` is the pick (tiny, MIT, zero-dep), and the change is confined to `XmlReading`.

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
