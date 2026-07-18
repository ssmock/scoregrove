Strategy

1. Separate engraving (pure layout) from rendering (Vue components).

The single most important factoring decision: a pure, DOM-free engraving pipeline that turns a Score into a fully-positioned layout tree of plain JSON objects, and dumb Vue components
that just draw that tree. Components never measure the DOM and never make layout decisions. This is what makes editing fall into place later — hit-testing is geometry lookup against the
layout tree, and edits re-run a pure function.

I'd put the pipeline in a new packages/engraving (depends on domain, no Vue, fully vitest-testable), with components in web-client. Same subpath-export scheme as domain, no barrels.

2. Pipeline stages (each a pure function, each independently testable):

1. Context walk — resolve effective clef/key/time/tempo/swing per measure per staff (the domain only stores changes); resolve which accidentals must be printed (key signature + prior
   accidentals in the measure + ties across barlines); detect courtesy signatures at changes.
1. Rhythm interpretation — derive beam groups from the time signature's beat structure; assign stem directions (staff position for single voice; voice index for multi-voice: voice 1 up,
   voice 2 down); compute onsets as Fractions (already in domain — exact arithmetic means cross-staff alignment can key on fractions, no float drift).
1. Horizontal spacing — merge onsets across all staves/voices into system-wide alignment columns; width per column ∝ duration on a logarithmic curve (standard engraving practice);
   compute each measure's intrinsic width.
1. Line breaking — greedy fill of measures into systems for a given width; justify each system by stretching column spacing (last system ragged).
1. Vertical layout — staff stacking within a system, extra room for lyrics verses/dynamics, system stacking.
1. Decoration geometry — beams (slanted quads), tie/slur béziers, tuplet brackets, hairpin wedges, volta brackets; each splits into segments at system breaks.

1. Coordinate system: everything in abstract staff spaces (SMuFL convention), one scale factor at the root. Each layout node carries an address back into the score ({measure, staff,
   voice, element, role}) emitted as data-* attributes — that's the future editing/hit-testing hook, nearly free now, painful to retrofit.

1. Glyphs: SMuFL font (Bravura, SIL OFL — bundleable). Render glyphs as SVG <text> with codepoints; position using Bravura's metadata JSON (bounding boxes, stem anchors, etc.) rather
   than DOM measurement. This keeps layout pure and deterministic, and buys us professional-quality clefs, noteheads, rests, accidentals, segno/coda for free. Hand-drawing these as paths is
   a rabbit hole I recommend avoiding.

1. HTML/SVG split: HTML for gross structure — score container, title/composer header, vertical stacking of systems, margins, resize observation. Each system is one <svg> (viewBox in
   staff spaces). Everything that must x-align with notes (lyrics, dynamics, tuplet numbers) stays inside the SVG; putting lyrics in HTML would make alignment fragile.

1. Storybook: every component gets stories. SVG-fragment components (root <g>) need a shared decorator that wraps them in an <svg> + staff lines. Plus a small fixtures module of sample
   scores (monophonic melody, two-staff multi-voice piece, repeats/voltas piece) powering the composite stories and engraving tests.

Component checklist

Primitives (SVG)

- [ ] Glyph — one SMuFL codepoint at (x, y)
- [ ] StaffLines
- [ ] LedgerLines
- [ ] BarlineView — regular / double / final / repeat open / repeat close (with dots)

Symbols (SVG)

- [ ] ClefSign (treble, bass, alto)
- [ ] KeySignatureSign (accidental stack per clef)
- [ ] TimeSignatureSign (numerals, common, cut)
- [ ] Notehead, Stem, Flag, AugmentationDots
- [ ] AccidentalSign
- [ ] RestSign (breve–64th + whole-measure rest)
- [ ] ArticulationMark (staccato, staccatissimo, tenuto, accent, marcato)
- [ ] FermataMark
- [ ] GraceNoteView (slashed/unslashed miniature)
- [ ] DynamicMarkText (p, f, sfz, …)
- [ ] HairpinView (crescendo/diminuendo wedge)
- [ ] TupletBracket (number + optional bracket)
- [ ] LyricSyllable (+ hyphen/extender lines)
- [ ] NavigationSign (segno, coda, fine, D.C./D.S. text)
- [ ] TempoText (marking or change, above first staff)
- [ ] VoltaBracket (with passage numbers)
- [ ] RepeatTimesText ("×3")

Composites (SVG)

- [ ] NoteView — notehead + stem + flag + dots + accidental + ledgers + articulations
- [ ] ChordView — clustered noteheads (offset seconds), stacked accidentals, per-tone ties
- [ ] BeamGroupView
- [ ] TieArc, SlurArc (with system-break splitting)
- [ ] VoiceView
- [ ] MeasureView (one staff's slice of a measure)
- [ ] SystemView (the per-system <svg> root: staves, aligned measures, spanners)

Structure (HTML)

- [ ] ScoreHeader — title, composer
- [ ] ScoreView — header + stacked systems, resize → re-layout
- [ ] StaffLabel (staff names at first system)

Engraving modules (pure, not components): context walk, accidental resolution, beam grouping, stem direction, onset columns/spacing, line breaker, vertical layout, arc/beam geometry,
plus a bravura metadata loader.

Major assumptions

- Bravura + SMuFL metadata is acceptable (bundled font asset + a metadata JSON in the repo). This is the biggest dependency decision in the plan.
- Beaming is derived, not stored — the domain has no beam field, so we auto-beam from beat structure. Composer overrides (e.g. beaming across a beat) aren't representable today.
- Stem direction, printed accidentals, and courtesy accidentals are all derived — no domain fields for overrides.
- No staff grouping in the domain — Staff has no brace/bracket concept, so a piano grand staff renders as two unrelated staves. Fine for now; will need a domain addition eventually.
- Layout is DOM-measurement-free except lyrics/text width, which needs an offscreen canvas.measureText (injected as a measurement function so the pipeline stays testable with a stub).
- Greedy line breaking is good enough initially (optimal Knuth-Plass-style breaking can be swapped in behind the same interface).

Potential problems

- Multi-voice collisions — two voices on one staff sharing a staff position (unisons, seconds, rest placement) is genuinely hard engraving. First pass: simple horizontal offsets; polish
  later.
- Chord accidental stacking — dense chords need multi-column accidental placement; naive stacking will overlap. Start naive, flag it.
- Spanners crossing system breaks — ties, slurs, hairpins, and voltas all need split-rendering logic; hairpins especially, since a DynamicChange "runs until the next dynamic indication,"
  which can be measures away. The pipeline must resolve hairpin extents globally before line breaking.
- Font loading race — SVG <text> glyphs render as tofu until Bravura loads; gate first paint on document.fonts.load.
- Grace note spacing — graces consume no time but need real width, which distorts the column model; they need a pre-onset spacing carve-out.
- Performance on large scores — full re-layout on every resize/edit; mitigate by memoizing per-measure intrinsic widths (stages 1–3 are per-measure and cacheable; only breaking/assembly
  is global).
- Score.check vs drafts — rendering must tolerate structurally invalid drafts (that's why Score.of exists), so the pipeline needs defined fallbacks for e.g. missing staff contents or
  overfull measures, not crashes.

If this looks right, I'd start with: engraving package skeleton + Bravura assets → Glyph/StaffLines/ClefSign etc. in Storybook → single-voice, single-staff measure end-to-end → then
spacing/line breaking → then the long tail of symbols.
