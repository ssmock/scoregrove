# Playback Strategy

Audio playback, built the same way engraving was: a pure, DOM-free, side-effect-free pipeline
that turns a `Score` into a fully-resolved, plain-JSON **performance** (a timeline of sounded
events), and a thin impure driver that hands that timeline to the Web Audio API. The pipeline
lives in a new `packages/playback` (depends on domain only, no Vue, no Web Audio, fully
vitest-testable); the driver and transport UI live in `web-client`. Same subpath-export scheme
as domain/engraving, no barrels.

The guiding parallel throughout: **engraving maps a Score into space; playback maps a Score
into time.** Wherever engraving resolves "what is drawn here," playback resolves "what sounds,
when, and how loud." The two share the timewise domain model, the `Fraction`-exact onset
arithmetic, the `ContextWalk`-style change resolution, and the `ScoreAddress` back-reference —
so playback is far less new machinery than it first appears.

> **This document is a proposal.** Sections A/B/C below are the requested breakdown (domain
> modeling, API usage, UX). Every decision I could not settle from the existing code or the
> domain's own stated conventions is collected under **Items for review** at the end and marked
> inline with **⚠ REVIEW**. Nearly all of them are the performance-parameter mappings the domain
> deliberately deferred ("mapping … is deliberately left for later" appears verbatim on `Tempo`,
> `DynamicMark`, and `Swing`) — this is where that deferred work comes due.

## Strategy

1. **Separate performance compilation (pure) from audio driving (impure).**

   The single most important factoring decision, mirroring engraving/rendering exactly. A pure
   pipeline turns a `Score` into a **`Performance`**: a flat, immutable, plain-JSON list of
   timed events with absolute times in seconds, each carrying a `ScoreAddress` back into the
   score. A dumb driver in `web-client` reads that timeline and schedules Web Audio nodes; it
   makes no musical decisions. This is what makes everything else fall into place: highlight-sync
   is an address lookup against the timeline, re-deriving after an edit is re-running a pure
   function, and the entire musical interpretation is unit-testable with no audio hardware.

   Just as `Score.check` gates rendering, **the compiler calls `Score.check` internally and
   refuses to compile an invalid score** (per the README's standing rule: "an unchecked score
   can't produce sound or engraving").

2. **Pipeline stages** (each a pure function, each independently testable — the spine of
   `packages/playback`):

   1. **Navigation unfolding** — resolve repeats, volta endings, and D.C./D.S./al Fine/al Coda
      jumps into a linear **play order**: the sequence of measure indices actually performed,
      each tagged with which repeat _pass_ it is (so voltas select the right ending). Pure
      `Score → PlayStep[]`. This is the biggest genuinely-new algorithm and is reusable beyond
      audio (a future "linearized/practice view," part extraction, MIDI export). It leans
      entirely on structure `Score.check` already validates (repeat pairing, volta ending
      structure, navigation-target existence).
   2. **Performance-context resolution** — the `ContextWalk` analog, but resolving _performance_
      values rather than notational ones: effective tempo (marking → BPM), dynamic level (mark →
      loudness), and swing feel (name → timing ratio) at each measure, plus the _gradual_
      spanners resolved globally — crescendo/diminuendo extents (exactly as `Hairpins.attach`
      resolves them for engraving: a change "runs until the next dynamic indication") and
      accel./rit. tempo ramps. Produces a **tempo map** and a **dynamics map** over play order.
   3. **Event flattening** — walk each performed measure, each staff, each voice; compute every
      element's onset as a `Fraction` (the exact arithmetic already used by editing/engraving)
      and its written duration; fold ties into single sustained events; apply articulation,
      slur, fermata, and grace-note effects to duration and velocity. Emits notational events in
      _beat_ time.
   4. **Time mapping** — convert beat time to absolute **seconds** through the tempo map
      (integrating over accel./rit. ramps). Apply swing offsets to subdivision onsets. Produces
      the final `Performance`: `NoteEvent[]` sorted by start time, each with
      `{ startSeconds, durationSeconds, pitchNumber, velocity, address }`.
   5. **Scheduling** _(driver-side, in web-client, but with a pure core)_ — the classic Web
      Audio look-ahead scheduler: a timer wakes periodically and schedules every event whose
      start falls inside the next look-ahead window against `AudioContext.currentTime`. The
      "which events fall in `[t, t+window)`" selection is pure and testable; only the node
      creation and the clock are impure.

3. **Time model** (the coordinate-system analog): two layers, exactly like engraving's
   staff-spaces-then-scale. Internally everything is **beats** (`Fraction`, exact, tempo-free) —
   cross-staff alignment keys on fractions with no float drift, same as spacing. A single tempo
   map converts beats → **seconds** at the boundary, the way one scale factor converts
   staff-spaces → pixels. Seconds are `number` (audio is inherently floating-point and the
   `AudioContext` clock is `number` seconds); the exact/inexact boundary is drawn deliberately
   at the tempo map and nowhere else.

4. **Sound source** (the "glyph font" analog — the biggest dependency decision, as Bravura was
   for engraving). v1: a **built-in oscillator + ADSR-envelope synth**, zero bundled assets,
   fully deterministic, and testable by asserting on the constructed node graph. The instrument
   sits behind a small `Instrument` interface (`noteOn/noteOff` or `schedule(event, ctx,
destination)`), so a sampled/SoundFont instrument can be swapped in later behind the same
   seam — mirroring how the injected `TextMeasurer` and the pluggable Bravura metadata kept
   engraving's core independent of its asset. **⚠ REVIEW: oscillator-synth v1 vs. bundling a
   sampled instrument up front** (see Items for review).

5. **Driver/UI split** (the HTML/SVG-split analog). The **transport** — an impure controller in
   `web-client` owning the single `AudioContext`, the look-ahead scheduler, and play/pause/stop/
   seek/loop state — is the counterpart of `ScoreView` owning resize/DOM. Vue components stay
   dumb: a transport bar dispatches intents (`play()`, `seek(seconds)`) and renders transport
   state; the currently-sounding note's `ScoreAddress` flows back out so the existing score
   display can highlight it, reusing the very same address plumbing hit-testing already uses —
   **time → address is just the inverse of the click → address lookup we already built.**

6. **Testability via injection** (mirroring the injected text measurer that keeps engraving
   pure). The compiler takes no clock and no audio — it is a plain data transform, tested by
   asserting on the emitted `Performance` (exact seconds, velocities, ordering). The scheduler
   takes an injected **clock** and an injected **output sink** so its look-ahead logic can be
   driven by a fake clock in a vitest test and asserted against a recorded list of scheduled
   events — no `AudioContext`, no real time, no flakiness.

7. **Storybook / demo** (the full-rendering-demo analog). A **playback demo** page wires the
   transport to the existing fixtures with a visible cursor highlighting the sounding note, plus
   a "compile and inspect" story that renders the `Performance` as a piano-roll/event table (no
   audio) so the pure output is a visual regression surface. Because the fixtures already exist
   (`@scoregrove/engraving/Fixtures`: monophonic melody, two-staff multi-voice, repeats/voltas/
   navigation), the navigation-unfolding and multi-voice paths get exercised from day one.

---

## A. New concepts and domain modeling

The domain is **timewise and already carries every notational input playback needs** — the
work is adding _performance-parameter_ meaning to symbols the domain intentionally kept
symbolic, and adding one genuinely missing input (an exact tempo). Most new types belong in
`packages/playback`, not `domain`, because they are interpretation, not notation. The few that
are arguably notational (an exact BPM the composer sets) are flagged for the domain.

### New types (in `packages/playback`)

- **`Performance`** — the compiled output: `{ events: NoteEvent[]; durationSeconds: number }`,
  events sorted by `startSeconds`. Plain JSON, serializable (enables future MIDI/WAV export and
  caching).
- **`NoteEvent`** — `{ startSeconds; durationSeconds; pitchNumber; velocity; address:
ScoreAddress }`. `pitchNumber` is an absolute chromatic number (MIDI-compatible; see below);
  `velocity` is a normalized 0–1 loudness. One event per _sounded_ pitch — a chord is N events
  at one onset; a tie-chain is one event spanning the whole chain.
- **`PlayStep`** — one entry of the unfolded play order: `{ measureIndex; pass:
PositiveInteger }`. The whole play order is `PlayStep[]`.
- **`TempoMap`** — beats → seconds. A piecewise function built from the resolved tempo per
  measure plus accel./rit. ramps; exposes `secondsAt(beat: Fraction): number` and the total
  duration. The single home of the exact→inexact conversion.
- **`DynamicsMap`** — play-order position → velocity, with crescendo/diminuendo interpolated
  between anchor marks (globally resolved, like hairpin extents).
- **`Instrument`** (interface) — `schedule(event, ctx, destination): void`, plus `stopAll()`.
  The oscillator synth is the v1 implementation; the seam for future sampled instruments.

### Reused domain facts (no new domain code required)

- **Onsets & durations** — `Duration.fractionOfWhole` already yields exact written length
  _including dots and tuplets_ (a triplet eighth = 1/12). Event flattening reuses the same
  `onsetBefore` accumulation editing already uses. No new arithmetic.
- **Ties** — the domain's per-note/per-chord-tone `TieRole` (`Begin`/`End`/`Both`) and the
  adjacency rule `Score.check` enforces are exactly what event-folding needs to merge a chain
  into one sustained event. Playback consumes the validated invariant directly.
- **Navigation** — `NavigationMark` (Segno/Coda/Fine), `NavigationJump` (D.C./D.S. + al Fine/al
  Coda + To Coda), `Measure.repeatTimes`, `Measure.ending` (voltas), and the repeat barlines are
  a _complete_ description of play order; unfolding is pure traversal, no new domain concepts.

### Pitch → frequency — ✅ RESOLVED (item 4 done)

The key-aware pitch→semitone logic is now **`Semitone` in `domain`** (`ofPitch(pitch, key)`, C4 =
48, key-aware because a bare "F" in G major sounds F♯), hoisted out of `editing`. Along the way,
the "which letters a key alters" theory (`KeySignature.accidentals`/`impliedAccidental`) moved
from `engraving`'s `KeySignatureLayout` into `domain` where it belongs — engraving now reads it
for printed positions, editing for stepping/spelling, playback for sounding. No dependency arrow
is inverted: all three siblings depend only on `domain`.

Playback's **`PitchSounding`** (`packages/playback`) is the performance mapping on top:
`pitchNumber(pitch, key) = Semitone.ofPitch + 12` (standard MIDI, C4 = 60, A4 = 69) and
`frequency = 440 · 2^((n − 69) / 12)` (equal temperament, A4 = 440).

### The performance-parameter mappings (the deferred domain work, now due)

These are the crux. The domain stores _names_; playback must assign _numbers_. Each is a
**⚠ REVIEW** item (values below are proposed starting points, not settled):

- **Exact tempo — ✅ RESOLVED (item 1 implemented).** The domain now carries a **`MetronomeMark`**
  (`{ noteValue; dots?; bpm }`, e.g. "♩ = 120") as a third variant of `Tempo`
  (`TempoMarking | TempoChange | MetronomeMark`), alongside `Tempo.isMarking`/`isChange`/
  `isMetronome` discriminators and `MetronomeMark.of`/`create`/`format`/`equals`. Because it
  appears wherever `Tempo` does (`Score.tempo`, `Measure.tempo`), an exact tempo can be pinned at
  the start _or_ at any mid-piece change, and `ContextWalk` carries it through unchanged.
  Playback reads `bpm` directly — no table needed for an exact mark. Engraving prints it (prose
  form "quarter = 120" for now; the SMuFL note-glyph form "♩ = 120" is future work, see gaps).
- **Tempo _marking_ → BPM — ✅ RESOLVED.** Implemented in
  `packages/playback/src/TempoResolution.ts`: a default table (Larghissimo 24 … Moderato 112 …
  Prestissimo 200, one representative value per marking, strictly increasing), used only as the
  fallback when no `MetronomeMark` is in force. `TempoResolution.resolve(tempo, time)` returns a
  `{ bpm, beat }`, and `wholeNoteSeconds` is the exact→inexact boundary the event stage will
  multiply each element's `fractionOfWhole` by.
- **Which note value gets the BPM beat — ✅ RESOLVED (metric pulse, compound-aware).**
  `TempoResolution.metricBeat(time)` counts simple meters on their denominator (♩ in x/4, 𝅗𝅥 in
  x/2) and compound meters (numerator a multiple of three and ≥ 6, over an eighth-or-shorter
  denominator: 6/8, 9/8, 12/8, 6/16 …) on the dotted grouping of three denominator units (♩. in
  6/8). 3/8 stays simple (felt in three) and 6/4 stays simple (documented simplifications), and
  irregular meters (5/8, 7/8) fall to simple. An exact `MetronomeMark` ignores all this and uses
  its own carried beat. The effective time signature is taken per measure from `ContextWalk`, so
  a mid-piece meter change re-picks the pulse.
- **Dynamic mark → velocity/gain.** `DynamicMark` ppp…fff → a 0–1 loudness curve
  (e.g. ppp ≈ 0.12 … mf ≈ 0.5 … fff ≈ 1.0). Accent dynamics need behavior, not just a level:
  **sforzando** = a sharp velocity spike on its one note; **fortepiano** = loud attack then
  immediate drop. **⚠ REVIEW** the curve and the accent semantics.
- **Crescendo/diminuendo target.** A `DynamicChange` "runs until the next dynamic indication" —
  playback ramps velocity from the prevailing level to _the next mark's_ level across that span.
  If no mark follows, the target is undefined. **⚠ REVIEW:** proposed default = ramp one dynamic
  step (e.g. mf→f) when unterminated.
- **Swing → timing ratio.** `Swing` (Light/Medium/Hard/Shuffle) lengthens the first of each
  subdivision pair. Medium = the classic 2:1 triplet feel; others graded around it. **⚠ REVIEW:**
  the ratios, and _which_ subdivision swings (eighths under a quarter beat — needs a rule tied to
  the beat unit).
- **Accel./rit. (`TempoChange`).** These are gradual and _open-ended_ — "rit." has no written
  end or target; it resolves at the next "a tempo" or tempo mark. Modeling a ramp needs both.
  **⚠ REVIEW:** v1 could **defer accel./rit. entirely** (treat as constant tempo, flagged as a
  known gap) rather than guess ramp shapes — recommended, to keep the first cut honest.
- **Articulations → duration & velocity.** Staccato/staccatissimo shorten sounding length
  (e.g. 50% / 25% of written), tenuto sustains full (or slightly over), accent/marcato boost
  velocity (marcato also shortens). Portato (staccato+tenuto) is the combination. **⚠ REVIEW**
  the numbers.
- **Slur → legato.** A slurred span suppresses the small inter-note gap the default detached
  articulation leaves (notes meet or slightly overlap). Uses the domain's `SlurRole` spans
  directly.
- **Fermata → duration.** Multiply the held element's sounding length by a factor (e.g. 1.75×),
  or add a fixed pause. **⚠ REVIEW.** (Applies to rests too — a fermata over a rest lengthens
  silence.)
- **Grace notes → stolen time.** Acciaccatura: a very short fixed pre-beat crush stealing from
  the _previous_ note's tail (or the principal's head). Appoggiatura: takes half the principal's
  written value (a third for compound). **⚠ REVIEW** the exact stealing rule; grace notes
  consume no _written_ measure time (domain invariant), so this is purely a performance carve-out
  — the direct analog of engraving's pre-onset spacing carve-out for graces.

---

## B. New API usage (Web Audio, in `web-client` only)

The Web Audio API is the sole new runtime dependency, and it is confined to the driver — the
compiler never imports it. Nothing new is bundled for v1 (the oscillator synth needs no assets).

- **`AudioContext`** — one per app, created lazily. Browsers require a **user gesture** to start
  audio, so the context is created/resumed on the first Play click (autoplay policy — a UX
  constraint, not a bug). The transport owns it.
- **The look-ahead scheduler** — the standard pattern (Chris Wilson's "A Tale of Two Clocks"): a
  `setInterval`/`setTimeout` (or an `AudioWorklet`/`MessageChannel` for jitter-resistance) wakes
  every ~25 ms and schedules all events starting within the next ~100 ms against
  `AudioContext.currentTime`. JS timer jitter never reaches the audio because every node is
  scheduled at a _sample-accurate_ `AudioContext` time. **The event-selection logic is pure and
  unit-tested; only the timer and node creation are impure.**
- **Per-note graph (oscillator synth v1)** — per event: an `OscillatorNode` → a per-note
  `GainNode` (the ADSR envelope via `gain.setValueAtTime`/`linearRampToValueAtTime`/
  `setTargetAtTime`) → a shared master `GainNode` → `ctx.destination`. `velocity` sets the
  envelope peak; `frequency` sets the oscillator; `start(startSeconds)`/`stop(startSeconds +
durationSeconds + release)`. **⚠ REVIEW:** oscillator waveform/voicing is placeholder-grade —
  acceptable for v1, the seam is the `Instrument` interface.
- **Transport controls** — `play` (resume ctx + start scheduler from the seek point), `pause`
  (stop scheduler, hold position), `stop` (scheduler off + reset to start + `stopAll()` to kill
  ringing voices), `seek(seconds)` (reposition; re-derive the scheduler cursor), and `loop`
  (wrap the cursor at the end). Position is read from `AudioContext.currentTime` minus the start
  offset — the audio clock is the source of truth, never a JS timer.
- **Highlight sync** — the transport emits the `ScoreAddress` of the event(s) currently sounding
  (derived from the same look-ahead pass) at animation-frame cadence; the score display
  highlights that address. This reuses the exact address plumbing already emitted as `data-*`
  and consumed by hit-testing — **no new coupling between playback and rendering, just the
  existing address as the shared key.**
- **Cleanup / lifecycle** — the transport is disposable (mirroring the editor store's
  `dispose`): stop the scheduler, disconnect nodes, and `close()` the context. Guard against
  scheduling across a score edit (recompile → reset transport).

Nothing here touches the `server` package; playback is entirely client-side. (A future
server-side MIDI/WAV render could reuse the _same_ pure `Performance` — another payoff of the
pure/impure split.)

---

## C. New UX

Playback is a **third capability alongside the pallet and the eraser**, surfaced primarily in
the performance view (its natural home) and available in the editor. Mirrors the existing
mutually-exclusive-mode store pattern and the dumb-component/thin-intent split of `web-ux.md`.

- **Transport bar** — Play/Pause, Stop, a seek scrubber (position / total time), a loop toggle,
  and a tempo override (see below). In the **performance view**, it lives in or beside the
  existing hover corner menu (Edit / Print / Staff → add Play). In the **editor**, a compact
  transport in the sidebar so a composer can audition while writing. Built from existing `ui/`
  primitives (`AppButton`, a new slider primitive if needed).
- **Playhead / note highlight** — the sounding note(s) highlight on the staff via the emitted
  `ScoreAddress`, and (in the horizontal/scrolling flow) the view auto-scrolls to keep the
  playhead visible. This is the audible counterpart of the hover highlight and reuses its
  overlay slot. **⚠ REVIEW:** highlight styling (a wash under the note vs. a moving vertical
  cursor line).
- **Click-to-seek / play-from-here** — clicking the staff while a "play" mode is active seeks to
  that onset (time → address's inverse again). A natural, cheap affordance given hit-testing
  already yields an onset.
- **Tempo & feel overrides at playback time** — because the domain may not carry an exact BPM
  (see A), the transport offers a **BPM control and a master tempo scale** (e.g. 50–200%) so a
  user can slow a passage down to practice. These are _playback preferences_, not score edits
  (like flow/zoom — they don't go through undo). **⚠ REVIEW:** are per-session tempo/instrument
  choices worth persisting per project (localStorage, like other prefs), or ephemeral?
- **Count-in / metronome** _(optional, flagged)_ — a click track and an N-beat count-in before
  Play. Nice for practice; **⚠ REVIEW** whether it's v1 scope.
- **Instrument picker** _(deferred with the sampled-instrument decision)_ — only meaningful once
  more than the oscillator exists.
- **Store integration** — a `playbackMode`/transport slice in (or beside) `editorStore`,
  mutually exclusive with the note/eraser/tie click-modes when "play-from-here" is armed, same
  pattern as `eraserMode`/`tieMode`. Editing the score recompiles the `Performance` and resets
  the transport (guarded so audio never plays against a stale timeline). Autosave/undo are
  untouched — playback state is presentation, not score content.
- **Accessibility & autoplay** — Play is always an explicit user gesture (required anyway);
  transport controls are real buttons with `aria-pressed`/labels; nothing auto-plays on load.

---

## Module checklist

Ordered for implementation, single-voice/single-staff end-to-end first, demo last. Pure modules
in `packages/playback`; driver/UI in `web-client`.

### Pure pipeline (`packages/playback`)

- [x] Package skeleton — `packages/playback` (depends on domain only; same build/test/export
      scheme as the other packages)
- [x] `TempoResolution` — the marking→BPM table, compound-aware metric pulse, per-indication
      `resolve`, `defaultTempo` (Moderato), and `wholeNoteSeconds` (the exact→inexact boundary).
      11 tests
- [x] `PitchSounding` — key-aware `pitchNumber(pitch, key)` (MIDI) and `frequency`, on top of the
      new domain `Semitone` (item 4's hoist: `Semitone` +
      `KeySignature.accidentals`/`impliedAccidental` now live in `domain`). 5 tests
- [x] `NavigationUnfolding` — `Score → PlayStep[]`: a stateful cursor honoring repeats
      (open/close, `repeatTimes`, start-repeats), volta endings by pass (1st/2nd/…), and
      D.C./D.S. + al Fine/al Coda/To Coda. Two documented conventions at the hard corners: a
      jump is taken once and suppresses inner repeats on its traversal; that post-jump traversal
      takes each volta group's final ending. 10 tests (incl. the repeats/voltas + D.S. al Fine
      shape → `[0,1,0,2,3,0,2]`)
- [x] `EventFlattening` — `(score, playOrder) → BeatEvent[]`: walks the unfolded order emitting
      one event per sounded pitch in beat time (exact `Fraction` from the performance start),
      folding tie chains into single spans, one event per chord tone, key-aware pitch numbers,
      offset advancing by each measure's actual length (pickup-correct). Velocity and
      articulation/slur/fermata/grace shaping deferred to the unsigned mapping tables. 8 tests
      (tie chains incl. `Both`, chords, repeats accumulation, G-major F♯, pickup)
- [x] `TimeMapping` — the tempo map (a segment per performed measure) + `secondsAt` +
      `toNoteEvents`: the exact→inexact boundary, resolving tempo per written measure with the
      prevailing absolute tempo carried forward (a `TempoChange` inherits it; accel./rit. ramps
      not performed yet; untempo'd → Moderato). A tied note spanning measures at different tempos
      gets the right total. `MeasureTiming.measureContentLength` is shared with `EventFlattening`
      so beat spaces line up. Velocity is a uniform placeholder pending `DynamicsMap`. 8 tests
- [x] `Compiler` — `compile(score): Result<Performance>`: calls `Score.check` first (no sound
      from an invalid score), then composes unfold → flatten → time-map into a plain-JSON
      `Performance` (`{ events, durationSeconds }`). 3 end-to-end tests (a C-E-G-C bar at ♩=120 →
      pitches `[60,64,67,72]` at seconds `[0,0.5,1,1.5]`; a repeat sounding twice; an invalid
      score refused)
- [ ] `PerformanceContext` / `DynamicsMap` — resolving dynamic level (and swing) per measure and
      the global crescendo/diminuendo interpolation, feeding real velocities into
      `toNoteEvents` in place of the current placeholder. Needs the still-unsigned dynamics table
      (item 6). (Tempo resolution already lives in `TimeMapping`.)
- [ ] Remaining mapping tables — dynamic→velocity / swing→ratio / articulation numbers,
      alongside the tempo table in `TempoResolution`, in one place and easy to retune (mirrors
      engraving's Bravura-metadata centralization). The tempo table is done

### Driver + transport (`web-client`)

- [ ] `Instrument` interface + `OscillatorInstrument` (ADSR synth)
- [ ] `Scheduler` — look-ahead selection (pure core) + injected clock/output
- [ ] `Transport` — owns `AudioContext`, play/pause/stop/seek/loop, position from the audio
      clock, `dispose()`
- [ ] Store slice — transport state, recompile-on-edit, mode exclusivity, playback prefs
- [ ] Highlight-sync — sounding `ScoreAddress` → existing display overlay; auto-scroll

### UI

- [ ] TransportBar (performance corner menu + editor sidebar)
- [ ] Playhead/highlight overlay + click-to-seek
- [ ] Tempo/scale control; (optional) count-in/metronome toggle

### Demo / tests

- [ ] Piano-roll "inspect the Performance" story (no audio; visual regression on pure output)
- [ ] Playback demo wiring the transport to each fixture with live highlight
- [ ] Vitest suites: unfolding (repeats/voltas/D.C.), tempo/dynamics maps, tie folding, grace
      stealing, scheduler look-ahead with a fake clock

---

## Known gaps (proposed deliberate v1 simplifications)

Each is a shortcut to take _knowingly_ and record at its code site, exactly like engraving's
gap list.

- Accel./rit. (`TempoChange`) not performed — constant tempo per span (see A / review).
- Single default instrument (oscillator synth); no per-staff instruments, no percussion (the
  domain has no unpitched notation anyway — same gap engraving notes).
- No micro-timing/humanization; onsets are mathematically exact (swing is the only deliberate
  offset).
- Fermata/grace/articulation numbers are uniform constants, not context-sensitive.
- No repeats of _dynamics/tempo state_ subtleties across a D.C. (state is resolved along the
  unfolded order; edge cases in al Coda + volta interaction need test coverage — flag, don't
  assume).
- No audio export (WAV/MIDI) yet — but the pure `Performance` makes it a later add, not a
  rewrite.
- Loop is whole-piece only in v1 (no A–B loop region).
- **Metronome marks engrave as prose** ("quarter = 120") rather than the score-standard SMuFL
  note glyph + "= 120"; the serif text face has no note glyphs, and a proper glyph-plus-number
  metronome annotation (composing the existing `kind:'glyph'`/`kind:'text'` machinery, or new
  SMuFL `metNote…` glyphs) is future work. The exact tempo is fully carried in the data
  meanwhile, so playback is unaffected.

## Major assumptions

- **The Web Audio API is the target** (all evergreen browsers; requires a user-gesture to
  start). This is the platform decision analogous to "Bravura + SMuFL is acceptable."
- **Performance parameters are interpretation, not notation** — they live in `packages/playback`
  and are freely retunable, _except_ an exact tempo, which may warrant a domain field (review).
- **The pure `Performance` is the contract** — every consumer (audio driver now; MIDI/WAV/server
  render later) reads the same JSON; audio specifics never leak into the compiler.
- **`Score.check` gates compilation** — no sound from an invalid score, per the README rule.
- **Beats stay exact (`Fraction`), seconds are the inexact boundary** at the tempo map and
  nowhere else.

## Potential problems

- **Navigation unfolding correctness** — ✅ built (`NavigationUnfolding`), leaning on
  `Score.check`'s validated structure and covered by tests (repeats, start-repeats, voltas,
  D.C./D.S. al Fine/al Coda/To Coda). Two conventions were _chosen_ at the genuinely-ambiguous
  corners (jump taken once + inner repeats suppressed on the post-jump traversal; that traversal
  takes each volta group's final ending); exotic combinations beyond the tested set remain the
  place to watch, but the common repertoire is handled.
- **Scheduler drift & GC** — long pieces create many short-lived nodes; disconnect/collect
  finished voices, and never trust JS timers for timing (schedule against the audio clock).
- **Recompile churn on edit** — every keystroke could recompile; memoize per-measure flattening
  (stages are per-measure and cacheable; only unfolding/time-mapping are global — same shape as
  engraving's per-measure-width memoization opportunity).
- **Tie/slur/grace at system and repeat boundaries** — a tie or slur crossing a repeat back-jump
  is a correctness question the domain's adjacency rule may not fully answer; test explicitly.
- **Autoplay policy & context suspension** — handle a suspended/again-suspended context (tab
  backgrounding) without desyncing the position readout.
- **Float determinism across machines** — keep as much math as possible in `Fraction`; accept
  that seconds are float and don't assert on exact float equality in tests (tolerance compares).

## Build order

`packages/playback` skeleton → `PitchSounding` + a single sustained note end-to-end through a
throwaway driver (prove the seconds/pitch/velocity path audibly) → `EventFlattening` for a
single voice with ties → `PerformanceContext`/`TempoMap`/`DynamicsMap` (constant tempo, static
dynamics first) → `NavigationUnfolding` (the repeats/voltas fixture is the target) →
articulation/slur/fermata/grace shaping → `Scheduler`/`Transport`/`Instrument` with the injected
clock tested first → TransportBar + highlight sync → the piano-roll inspect story and the
playback demo as the capstone (the audible analog of the full rendering demo).

---

## Items for review

Collected for a decision pass before implementation. Ordered roughly by how much they shape the
work; the first three are the load-bearing forks.

1. ~~**Exact tempo in the domain? (A)**~~ — ✅ **DONE.** Implemented as a `MetronomeMark` variant
   of `Tempo` in `packages/domain` (`{ noteValue; dots?; bpm }`), wired through `ContextWalk` and
   engraving (prose text for now). A composer can pin an exact tempo at the start or any
   mid-piece change; playback reads `bpm` directly.
2. **Sound source for v1 (Strategy 4 / B)** — ship the zero-asset oscillator synth first
   (recommended), or invest up front in a bundled sampled/SoundFont instrument (the Bravura-scale
   dependency decision, with asset-size and licensing implications)?
3. **Accel./rit. in v1? (A)** — defer entirely (constant tempo, flagged) as recommended, or
   model ramps now despite the domain giving no ramp end/target?
4. ~~**Hoist key-aware pitch→semitone into `domain` (A)**~~ — ✅ **DONE.** `Semitone` (and the
   `KeySignature.accidentals`/`impliedAccidental` theory it needs) now live in `domain`; editing's
   `PitchStepping` and playback's `PitchSounding` both consume it. No dependency arrow inverted.
5. ~~**BPM beat unit (A)**~~ — ✅ **DONE.** Decided: the compound-aware metric pulse
   (`TempoResolution.metricBeat`), plus **default tempo = Moderato** for an untempo'd score.
6. **The remaining mapping tables (A)** — `TempoMarking`→BPM is ✅ done (`TempoResolution`). Still
   open: `DynamicMark`→velocity (and sfz/fp/accent behavior), `Swing`→ratios (and which
   subdivision swings), articulation duration/velocity factors, fermata factor, grace-note
   stealing rule. Proposed starting values are in §A; none of _these_ are settled.
7. **Crescendo/diminuendo with no following mark (A)** — ramp one dynamic step (proposed) or
   hold flat?
8. **Highlight & seek UX (C)** — cursor line vs. note wash; is click-to-seek / play-from-here in
   v1? Auto-scroll behavior in each flow.
9. **Playback prefs persistence (C)** — persist per-project tempo scale / (future) instrument
   like other prefs, or keep ephemeral?
10. **Count-in / metronome in v1? (C)** — include a click track and count-in, or defer?
11. ~~**Package name**~~ — ✅ **DONE.** Created `packages/playback` (parallel to `engraving`); its
    first module, `TempoResolution`, is in place.
