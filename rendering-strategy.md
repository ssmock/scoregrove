# Rendering Strategy

## Strategy

1. **Separate engraving (pure layout) from rendering (Vue components).**

   The single most important factoring decision: a pure, DOM-free engraving pipeline that turns a
   Score into a fully-positioned layout tree of plain JSON objects, and dumb Vue components that
   just draw that tree. Components never measure the DOM and never make layout decisions. This is
   what makes editing fall into place later — hit-testing is geometry lookup against the layout
   tree, and edits re-run a pure function.

   The pipeline lives in a new `packages/engraving` (depends on domain, no Vue, fully
   vitest-testable), with components in `web-client`. Same subpath-export scheme as domain, no
   barrels.

2. **Pipeline stages** (each a pure function, each independently testable):

   1. Context walk — resolve effective clef/key/time/tempo/swing per measure per staff (the
      domain only stores changes); resolve which accidentals must be printed (key signature +
      prior accidentals in the measure + ties across barlines); detect courtesy signatures at
      changes.
   2. Rhythm interpretation — derive beam groups from the time signature's beat structure; assign
      stem directions (staff position for single voice; voice index for multi-voice: voice 1 up,
      voice 2 down); compute onsets as Fractions (already in domain — exact arithmetic means
      cross-staff alignment can key on fractions, no float drift).
   3. Horizontal spacing — merge onsets across all staves/voices into system-wide alignment
      columns; width per column ∝ duration on a logarithmic curve (standard engraving practice);
      compute each measure's intrinsic width.
   4. Line breaking — greedy fill of measures into systems for a given width; justify each system
      by stretching column spacing (last system ragged).
   5. Vertical layout — staff stacking within a system, extra room for lyrics verses/dynamics,
      system stacking.
   6. Decoration geometry — beams (slanted quads), tie/slur béziers, tuplet brackets, hairpin
      wedges, volta brackets; each splits into segments at system breaks.

3. **Coordinate system**: everything in abstract staff spaces (SMuFL convention), one scale factor
   at the root. Each layout node carries an address back into the score
   (`{measure, staff, voice, element, role}`) emitted as `data-*` attributes — that's the future
   editing/hit-testing hook, nearly free now, painful to retrofit.

4. **Glyphs**: SMuFL font (Bravura, SIL OFL — bundleable). Render glyphs as SVG `<text>` with
   codepoints; position using Bravura's metadata JSON (bounding boxes, stem anchors, etc.) rather
   than DOM measurement. This keeps layout pure and deterministic, and buys us
   professional-quality clefs, noteheads, rests, accidentals, segno/coda for free. Hand-drawing
   these as paths is a rabbit hole to avoid.

5. **HTML/SVG split**: HTML for gross structure — score container, title/composer header,
   vertical stacking of systems, margins, resize observation. Each system is one `<svg>` (viewBox
   in staff spaces). Everything that must x-align with notes (lyrics, dynamics, tuplet numbers)
   stays inside the SVG; putting lyrics in HTML would make alignment fragile.

6. **Storybook**: every component gets stories. SVG-fragment components (root `<g>`) need a shared
   decorator that wraps them in an `<svg>` + staff lines. A small fixtures module of sample
   scores powers the composite stories, the engraving tests, and the full rendering demo.

   The capstone is a **full rendering demo** story: `ScoreView` fed by the complete engraving
   pipeline, one story per fixture score (monophonic melody; two-staff multi-voice piece;
   repeats/voltas/navigation piece), with a width control to exercise line re-breaking live.
   This story is the end-to-end proof that the pieces compose, and doubles as the visual
   regression surface for pipeline changes.

## Component checklist

Ordered for implementation: Storybook scaffolding first, then the primitives-to-structure ladder,
demo last. Within each group, items needed for the single-voice single-staff end-to-end slice
come first. Items with a parenthetical "pending:" are landed except for the named part.

### Storybook scaffolding

- [x] Staff-context decorator — wraps SVG-fragment stories in an `<svg>` + StaffLines
- [x] Score fixtures module — monophonic melody; two-staff multi-voice; repeats/voltas/navigation

### Primitives (SVG)

- [x] Glyph — one SMuFL codepoint at (x, y), plus a full-catalog story
- [x] StaffLines
- [x] LedgerLines
- [x] BarlineView — regular / double / final / repeat open / repeat close (with dots)

### Symbols (SVG)

- [x] ClefSign (treble, bass, alto; small change variant at mid-piece clef changes)
- [x] KeySignatureSign (accidental stack per clef)
- [x] TimeSignatureSign (numerals, common, cut)
- [x] Notehead (breve / whole / half / black), Stem, Flag, AugmentationDots
- [x] AccidentalSign (sharp, flat, natural, double-sharp, double-flat)
- [x] RestSign (breve–64th)
- [x] ArticulationMark (staccato, staccatissimo, tenuto, accent, marcato)
- [x] FermataMark
- [x] GraceNoteView (slashed acciaccatura / unslashed appoggiatura miniature, 0.6× scale, laid
      in the column prefix — the strategy's pre-onset carve-out)
- [x] TupletBracket (number + hooked bracket; number only over a fully beamed run)
- [x] DynamicMarkText (ppp–fff, sfz, fp)
- [x] HairpinView (crescendo/diminuendo wedge; globally-resolved extents, split across systems
      with a continuous taper)
- [x] LyricSyllable — syllables centered under noteheads via MusicText, per-verse rows,
      hyphens between split syllables, columns widened by measured text (pending: extender
      lines, cross-measure hyphens)
- [x] TempoText — as a measure annotation drawn by MusicText (markings verbatim, changes as
      "rit.", "accel.", "a tempo", …)
- [x] SwingText — joined onto the tempo line ("Moderato, Medium Swing"); text width can't be
      measured yet, so side-by-side stacking isn't an option
- [x] NavigationSign (segno, coda, fine, D.C./D.S./To Coda text; now emitted by the layout at
      measure start/end)
- [x] VoltaBracket (passage numbers, start hooks, close-hook when the passage repeats,
      system-break splitting)
- [x] RepeatTimesText ("×3" over the closing repeat) — as a measure annotation

### Composites (SVG)

- [x] NoteView — notehead + stem + flag + dots + accidental + ledgers + articulations + fermata
- [x] RestView — rest sign + optional fermata + whole-measure centering
- [x] ChordView — clustered noteheads (offset seconds), per-tone accidentals and ties, one
      stem/flag per chord
- [x] BeamGroupView (derived groups, slant + minimum-stem shift, secondary runs; pending: stub
      beams for isolated shorter notes, e.g. dotted-eighth–sixteenth)
- [x] TieArc, SlurArc (with system-break splitting) — ties pair adjacent pitches per voice and
      chord tone; slurs pair on a stack per voice with apex clearance over spanned notes
- [x] VoiceView — resolved structurally rather than as a component: voices render inline through
      voice-addressed layout nodes (stems up/down by voice index); no separate component proved
      necessary
- [x] MeasureView (one staff's slice of a measure)
- [x] SystemView (staff lines, aligned measures, adaptively stacked staves, all spanners; sized
      to measured content bounds)

### Structure (HTML)

- [x] StaffLabel (staff names in a left margin at the first system)
- [x] ScoreHeader — title, composer
- [x] ScoreView — header + stacked systems, resize → re-layout (pin with an explicit `width`, or
      let its ResizeObserver drive re-breaking)

### Demo

- [x] Full rendering demo story — `Music/Full Rendering Demo`: each fixture through the complete
      pipeline via ScoreView, width control for live re-breaking, plus a resize-driven story.
      The demo deepens as pipeline stages land (beams, ties, multi-voice, multi-staff).

Engraving modules (pure, not components): context walk ✓, accidental resolution ✓, stem
direction ✓, spacing curve ✓, signatures ✓, beam grouping + geometry ✓, onset-column
measure layout across all staves and voices ✓, chord layout ✓, ties/slurs/hairpins/voltas
with system-break splitting ✓, annotations ✓, lyrics with injected text measurement ✓,
adaptive vertical layout ✓, greedy line breaker with bisection justification ✓, Bravura
metadata extraction ✓ (`pnpm --filter @scoregrove/engraving generate`). The pipeline of the
strategy is complete; remaining work is refinement plus grace notes and tuplets.

## Known gaps (deliberate v1 simplifications)

Every entry here is a shortcut the current pipeline takes knowingly — tracked here so nothing
silently becomes load-bearing. Each is also noted at its code site.

### Not yet in the layout tree

- Nothing — every domain concept now reaches the layout tree.
- Tuplet runs are not validated for completeness (a run of equal ratios gets one marking
  whether or not it sums to whole tuplet units); grace notes are never beamed to each other or
  slurred to their principal.
- Annotation text (tempo, jumps, Fine, repeat counts, volta labels) is placed by anchor only —
  the injected text measurer now exists (TextMeasure, used by lyrics), but annotations and the
  staff-label margin don't consult it yet.
- Lyric extender lines (melismas after a word's End) and cross-measure hyphens are not drawn;
  a syllable's hyphen appears only when its continuation sits in the same measure.
- Lyrics share the below-staff region with dynamics at fixed baselines — no collision
  avoidance within the row (staff-to-staff overlap is now handled by vertical layout).
- Articulation marks stack at fixed offsets from the notehead and can overlap staff lines —
  snapping them into spaces is a refinement.
- The staff-label margin is a fixed 8 spaces; a long instrument name overflows it (the
  measurer could size it now — not yet wired).

### Horizontal layout

- Accidental state is per voice: two voices on one staff don't share carried accidentals, so a
  cancellation printed in one voice is neither suppressed nor restated in the other.
- A note tied across a barline restates its accidental (tie-aware suppression pending).
- An underfull (pickup) measure takes nearly a full measure's rhythmic width — the final
  column's gap is priced to the time signature's capacity, not the actual content.
- Rests print at their standard staff rows regardless of voice, so multi-voice measures can
  collide rests with the other voice.
- No stub (partial) secondary beams: a dotted-eighth–sixteenth figure draws only its primary
  beam.
- Chords never beam — a short-value chord keeps its flag, and an adjacent beamable run breaks
  around it.
- Chord accidentals stack naively in a single column at the cluster's left; dense chords (e.g.
  altered seconds) will overlap. Dots of offset second-tones can likewise collide.
- Mid-piece clef changes print full size at the measure start, not as the small change clef
  before the previous barline.
- No courtesy signatures at the end of a system before a key/time change, and no cancellation
  naturals when a key change drops accidentals.

### Vertical layout and systems

- Vertical layout separates staves by measured extents, but placement within a row is still
  fixed: dynamics, lyrics, and hairpins keep their set baselines, so content on the same staff
  can still collide horizontally (e.g. a low ledger note over a dynamic mark).
- Extents treat every element as spanning its whole measure — a tall stem at the measure's end
  opens the gap for the full row, not just locally.
- Justification stretch caps at 8× (an emptier system stays ragged rather than absurdly airy);
  a single measure wider than the target width overflows its system unjustified.
- Tie curve side follows the simple away-from-stem rule with no inner-voice adjustment; split
  ties reopen with a fixed-length stub.
- Slur clearance is apex-based: the arc's peak clears every spanned note, but a tall note right
  next to a slur endpoint (where the bézier runs low) can still touch the arc. Side follows
  majority stem direction; nested/overlapping slurs pair innermost-first because the domain
  cannot yet distinguish them.
- A tie's right endpoint ignores the tied-to note's accidental, so a printed accidental on the
  continuation (e.g. restated after a system-break reprint) can collide with the arc.
- A slur spanning three or more systems draws only its first and last segments — the middle
  systems get no arc.

## Major assumptions

- Bravura + SMuFL metadata is acceptable (bundled font asset + a metadata JSON in the repo). This
  is the biggest dependency decision in the plan.
- Beaming is derived, not stored — the domain has no beam field, so we auto-beam from beat
  structure. Composer overrides (e.g. beaming across a beat) aren't representable today.
- Stem direction, printed accidentals, and courtesy accidentals are all derived — no domain
  fields for overrides.
- No staff grouping in the domain — Staff has no brace/bracket concept, so a piano grand staff
  renders as two unrelated staves. Fine for now; will need a domain addition eventually.
- No unpitched notation in the domain — no unpitched element kind, percussion clef, notehead
  styles, or per-staff line counts — so drum/slash notation is representable only by abusing
  pitched notes. Same category as the staff-grouping gap: needs deliberate domain design
  (sketched in TODO.md under "Unpitched Elements"); the engraving side is nearly free once the
  domain exists (add the SMuFL percussion glyphs to the extraction list and regenerate).
- Layout is DOM-measurement-free except lyrics/text width, which needs an offscreen
  canvas.measureText (injected as a measurement function so the pipeline stays testable with a
  stub).
- Greedy line breaking is good enough initially (optimal Knuth-Plass-style breaking can be
  swapped in behind the same interface).

## Potential problems

- Multi-voice collisions — two voices on one staff sharing a staff position (unisons, seconds,
  rest placement) is genuinely hard engraving. First pass: simple horizontal offsets; polish
  later.
- Chord accidental stacking — dense chords need multi-column accidental placement; naive stacking
  will overlap. Start naive, flag it.
- Spanners crossing system breaks — ties, slurs, hairpins, and voltas all need split-rendering
  logic; hairpins especially, since a DynamicChange "runs until the next dynamic indication,"
  which can be measures away. The pipeline must resolve hairpin extents globally before line
  breaking.
- Font loading race — SVG `<text>` glyphs render as tofu until Bravura loads; gate first paint on
  `document.fonts.load`.
- Grace note spacing — graces consume no time but need real width, which distorts the column
  model; they need a pre-onset spacing carve-out.
- Performance on large scores — full re-layout on every resize/edit; mitigate by memoizing
  per-measure intrinsic widths (stages 1–3 are per-measure and cacheable; only breaking/assembly
  is global).
- Score.check vs drafts — rendering must tolerate structurally invalid drafts (that's why
  Score.of exists), so the pipeline needs defined fallbacks for e.g. missing staff contents or
  overfull measures, not crashes.

## Build order

Engraving package skeleton + Bravura assets → Storybook scaffolding (decorator, fixtures) →
Glyph/StaffLines/ClefSign etc. → single-voice, single-staff measure end-to-end → spacing/line
breaking → the long tail of symbols and composites → the full rendering demo story as the
capstone.

**Status (2026-07-19):** the component checklist is complete. Grace notes ride the column
prefix as the strategy's pre-onset carve-out — miniature (0.6×) noteheads with up-stems,
scaled flags, and the acciaccatura slash, placed before the principal's accidental. Tuplets
mark maximal equal-ratio runs (rests included): an italic count in a gapped, hooked bracket,
or the bare count when the run hangs from one beam. The melody's "shine" takes an
acciaccatura; the repeats fixture ends in a bracketed half-note triplet under its D.S. al
Fine. 128 engraving tests. Every checklist component and every pipeline stage of the original
plan is built; what remains is the Known gaps list — refinements, not architecture. (The
whole-measure rest now centers too — the checklist's last box.)
