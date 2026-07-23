import { reactive, readonly, watch, type DeepReadonly } from 'vue';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Mode } from '@scoregrove/domain/KeySignature';
import type { Articulation } from '@scoregrove/domain/Notations';
import type { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter, type Pitch } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { DurationOps } from '@scoregrove/editing/DurationOps';
import { MeasureOps } from '@scoregrove/editing/MeasureOps';
import { Placement, type ElementSpec, type PlacementAddress } from '@scoregrove/editing/Placement';
import { RestBacking } from '@scoregrove/editing/RestBacking';
import { StaffOps } from '@scoregrove/editing/StaffOps';
import { TimeSignatureOps } from '@scoregrove/editing/TimeSignatureOps';
import { UndoStack } from '@scoregrove/editing/UndoStack';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { Compiler, type Performance } from '@scoregrove/playback/Compiler';
import {
  createBrowserTransport,
  type Transport,
  type TransportStatus,
} from '../playback/Transport';
import { Projects } from './Projects';

/**
 * A pallet tool configuration — what the next placement (or a "p" eyedropper
 * pickup) will place. Pitch is never part of it: pitch comes from where the
 * user clicks, not from the pallet. A time signature is measure-wide rather
 * than a voice element, so it carries a `TimeSignature` instead of a
 * duration and has no articulations to speak of.
 */
export type ToolConfig =
  | { kind: 'note' | 'rest'; duration: Duration; articulations?: readonly Articulation[] }
  | { kind: 'timeSignature'; time: TimeSignature };

export type View = 'editor' | 'performance';
export type Flow = 'vertical' | 'horizontal';
export type EraserMode = 'element' | 'bar';

const maxRecents = 12;
/** Exported so tests can advance fake timers by exactly this much */
export const autosaveDelayMs = 1000;

const sameArticulations = (
  a: readonly Articulation[] | undefined,
  b: readonly Articulation[] | undefined,
): boolean => {
  const left = a ?? [];
  const right = b ?? [];

  return left.length === right.length && left.every((articulation) => right.includes(articulation));
};

export const sameToolConfig = (a: ToolConfig, b: ToolConfig): boolean => {
  if (a.kind === 'timeSignature' || b.kind === 'timeSignature') {
    return (
      a.kind === 'timeSignature' &&
      b.kind === 'timeSignature' &&
      TimeSignature.equals(a.time, b.time)
    );
  }

  return (
    a.kind === b.kind &&
    Duration.equals(a.duration, b.duration) &&
    sameArticulations(a.articulations, b.articulations)
  );
};

/** Moves a matching entry to the front instead of duplicating it, capped */
const promote = (recents: readonly ToolConfig[], config: ToolConfig): ToolConfig[] =>
  [config, ...recents.filter((existing) => !sameToolConfig(existing, config))].slice(0, maxRecents);

/** A single rest-backed measure in common time on one treble staff */
const blankScore = (): Score => {
  const time = TimeSignature.commonTime();
  const staves = NonEmptyArray.of([Staff.of(Clef.Treble)]);

  return {
    staves,
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time,
    measures: NonEmptyArray.of([RestBacking.emptyMeasure(time, staves)]),
  };
};

type EditorState = {
  projectName: string | undefined;
  score: Score;
  undo: UndoStack<Score>;
  view: View;
  flow: Flow;
  hiddenStaves: ReadonlySet<number>;
  /**
   * What a click on the staff does next: place with `activeTool`, erase
   * (one element, or a whole bar) if `eraserMode` is set, or tie/close a tie
   * if `tieMode` is set. All three are mutually exclusive — picking one
   * clears the others — so the interactive staff (a sibling of the pallet,
   * not a descendant) has one unambiguous place to read "what happens if I
   * click right now."
   */
  activeTool: ToolConfig | null;
  eraserMode: EraserMode | null;
  /** The tie pallet tool (or the right-click flyout's "start tie") is selected */
  tieMode: boolean;
  /**
   * The note or chord that started a tie, awaiting a second click on
   * whatever it ties into. `pitch` disambiguates which tone within a chord
   * (undefined for a plain note, whose own pitch is unambiguous). Cleared by
   * picking a different tool/eraser mode, or by successfully closing the
   * tie — an unsuccessful attempt (wrong note clicked) leaves it pending, so
   * a misclick doesn't force starting over.
   */
  pendingTie: { address: ScoreAddress; pitch?: Pitch } | null;
  recents: readonly ToolConfig[];
  /**
   * Audio playback of the current score. Presentation state, not score
   * content — it never touches the undo stack. `status` mirrors the
   * transport; `positionSeconds`/`durationSeconds` drive the transport bar's
   * readout and scrubber.
   */
  playback: {
    status: TransportStatus;
    positionSeconds: number;
    durationSeconds: number;
    loop: boolean;
    /** The measures bounding an A–B loop passage (null when unset); either end may be set alone */
    loopStartMeasure: number | null;
    loopEndMeasure: number | null;
    /** Addresses of the notes/chords sounding right now, for the on-staff playhead highlight */
    sounding: readonly ScoreAddress[];
  };
};

/**
 * How the store obtains a transport — injected so tests can supply a fake
 * (the default builds a real Web Audio one, which needs a browser
 * `AudioContext`). Created lazily on the first play, so no audio context
 * exists until the user asks for sound (also the browser's autoplay rule).
 */
export type EditorStoreDeps = {
  createTransport?: (onPosition: (seconds: number) => void) => Transport;
};

export type EditorStore = ReturnType<typeof createEditorStore>;

/**
 * The whole app's editing session: the score and its undo history, the
 * active pallet tool and recents, view/flow/staff-visibility preferences,
 * and the current project's autosave. A factory (not a module-level
 * singleton) so tests get an isolated instance each time; the app calls
 * this once at startup and shares the result.
 *
 * Score-content changes (place, erase, staff add/remove/update) go through
 * the undo stack; presentation preferences (view, flow, staff visibility)
 * and pallet state (active tool, recents) do not — undoing "you scrolled"
 * would be a strange experience.
 */
export function createEditorStore(initial: Score = blankScore(), deps: EditorStoreDeps = {}) {
  const state = reactive<EditorState>({
    projectName: undefined,
    score: initial,
    undo: UndoStack.of(initial),
    view: 'editor',
    flow: 'vertical',
    hiddenStaves: new Set(),
    activeTool: null,
    eraserMode: null,
    tieMode: false,
    pendingTie: null,
    recents: [],
    playback: {
      status: 'stopped',
      positionSeconds: 0,
      durationSeconds: 0,
      loop: false,
      loopStartMeasure: null,
      loopEndMeasure: null,
      sounding: [],
    },
  });

  const makeTransport =
    deps.createTransport ??
    ((onPosition) => createBrowserTransport(new AudioContext(), { onPosition }));

  let transport: Transport | null = null;
  let performance: Performance | null = null;
  let loaded: Performance | null = null; // the performance currently loaded into the transport

  /** The compiled performance of the current score, cached; recompiled after edits. Null if invalid. */
  const ensureCompiled = (): Performance | null => {
    if (performance) return performance;

    const compiled = Compiler.compile(state.score);

    return Result.isOk(compiled) ? (performance = compiled.value) : null;
  };

  /**
   * Ensures the transport holds the current performance. The transport clamps
   * seeks and the loop region to the loaded performance's duration, so with
   * nothing loaded (duration 0) a seek would clamp to 0 — which is why seeking
   * or looping before the first Play must load the performance now, not just at
   * play time. Returns the performance, or null if the score can't be compiled.
   */
  const ensureLoaded = (): Performance | null => {
    const compiled = ensureCompiled();

    if (!compiled) return null;

    const t = ensureTransport();

    if (loaded !== compiled) {
      t.load(compiled);
      loaded = compiled;
    }

    return compiled;
  };

  /** The notes/chords sounding at `seconds` — events already begun and not yet ended. */
  const soundingAt = (seconds: number): ScoreAddress[] => {
    if (!performance) return [];

    const result: ScoreAddress[] = [];

    for (const event of performance.events) {
      if (event.startSeconds > seconds) break; // events are sorted by start
      if (seconds < event.startSeconds + event.durationSeconds) result.push(event.address);
    }

    return result;
  };

  /** The real-time position of a barline index — the measure's start, or the piece end for the final barline. */
  const barlineSeconds = (barline: number): number | undefined => {
    const compiled = ensureCompiled();

    if (!compiled) return undefined;

    return barline < compiled.measureTimes.length
      ? compiled.measureTimes[barline]?.startSeconds
      : compiled.durationSeconds;
  };

  /**
   * Translates the loop-passage barlines into seconds and hands the region to
   * the transport. The passage runs from the earlier barline up to (not
   * through) the later one, whatever order they were clicked; a single bound
   * defaults the other to the piece start/end.
   */
  const applyLoopRegion = (): void => {
    if (!ensureLoaded()) return;

    const t = ensureTransport();
    const { loopStartMeasure: a, loopEndMeasure: b } = state.playback;

    let start: number | null = null;
    let end: number | null = null;

    if (a !== null && b !== null) {
      start = barlineSeconds(Math.min(a, b)) ?? null;
      end = barlineSeconds(Math.max(a, b)) ?? null;
    } else if (a !== null) {
      start = barlineSeconds(a) ?? null;
    } else if (b !== null) {
      end = barlineSeconds(b) ?? null;
    }

    // A degenerate (empty or inverted) region would loop instantly — drop it.
    if (start !== null && end !== null && start >= end) {
      start = null;
      end = null;
    }

    t.setLoopRegion(start, end);
  };

  /** Moves the playhead to `seconds` and cues the highlight there, whatever the status. */
  const seekTo = (seconds: number): void => {
    if (!ensureLoaded()) return;

    const t = ensureTransport();

    t.seek(seconds);
    state.playback.positionSeconds = t.positionSeconds();
    state.playback.status = t.status();
    state.playback.sounding = soundingAt(t.positionSeconds());
  };

  /** Builds the transport (and its audio context) on first use, per the autoplay policy */
  const ensureTransport = (): Transport => {
    if (!transport) {
      transport = makeTransport((seconds) => {
        const status = transport?.status() ?? 'stopped';

        state.playback.status = status;
        state.playback.positionSeconds = seconds;
        state.playback.sounding = status === 'stopped' ? [] : soundingAt(seconds);
      });
    }

    return transport;
  };

  const syncPlayback = (): void => {
    if (!transport) return;

    state.playback.status = transport.status();
    state.playback.positionSeconds = transport.positionSeconds();
    state.playback.durationSeconds = transport.durationSeconds();
    state.playback.sounding =
      state.playback.status === 'stopped' ? [] : soundingAt(state.playback.positionSeconds);
  };

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Performs any pending debounced autosave immediately, e.g. before switching projects */
  const flushAutosave = (): void => {
    if (!autosaveTimer) return;

    clearTimeout(autosaveTimer);
    autosaveTimer = undefined;

    if (state.projectName) Projects.save(state.projectName, state.score);
  };

  const stopAutosaveWatch = watch(
    () => state.score,
    () => {
      if (!state.projectName) return;

      if (autosaveTimer) clearTimeout(autosaveTimer);

      autosaveTimer = setTimeout(() => {
        autosaveTimer = undefined;

        if (state.projectName) Projects.save(state.projectName, state.score);
      }, autosaveDelayMs);
    },
  );

  // Editing invalidates any compiled performance, so playback halts on any
  // score change rather than sounding a stale timeline.
  const stopPlaybackWatch = watch(
    () => state.score,
    () => {
      performance = null; // the compiled timeline is now stale
      loaded = null; // and so is whatever the transport is holding

      if (transport && state.playback.status !== 'stopped') {
        transport.stop();
        syncPlayback();
      }
    },
  );

  const commit = (next: Score): void => {
    state.undo = UndoStack.push(state.undo, next);
    state.score = next;
  };

  const commitResult = (result: Result<Score>): Result<Score> => {
    if (Result.isOk(result)) commit(result.value);

    return result;
  };

  return {
    state: readonly(state) as DeepReadonly<EditorState>,

    place(address: PlacementAddress, spec: ElementSpec): Result<Score> {
      return commitResult(Placement.place(state.score, address, spec));
    },

    /**
     * `targetPitch` disambiguates which tone to remove when `address` is a
     * chord (derived the same way `place` derives a pitch to add — the
     * eraser click's staff position); ignored for a plain note/rest/dynamic.
     */
    erase(address: ScoreAddress, targetPitch?: Pitch): Result<Score> {
      return commitResult(Placement.erase(state.score, address, targetPitch));
    },

    eraseBar(measureIndex: number): Result<Score> {
      return commitResult(Placement.eraseBar(state.score, measureIndex));
    },

    /** Arrow-key transposition of a hovered, placed note */
    transposeNote(address: ScoreAddress, semitones: number): Result<Score> {
      return commitResult(Placement.transposeNote(state.score, address, semitones));
    },

    /** Right-click flyout's dot control */
    cycleDots(address: ScoreAddress): Result<Score> {
      return commitResult(Placement.cycleDots(state.score, address));
    },

    /** Right-click flyout's articulation toggles */
    toggleArticulation(address: ScoreAddress, articulation: Articulation): Result<Score> {
      return commitResult(Placement.toggleArticulation(state.score, address, articulation));
    },

    /**
     * The current address of the note at `onset` — re-resolve this before
     * each flyout action on "the same note" rather than reusing a prior
     * address, since `cycleDots`/`toggleArticulation` can shift the note's
     * index (see `Placement.elementAtOnset`).
     */
    resolveAddress(
      location: { measure: number; staff: number; voice: number },
      onset: Fraction,
    ): ScoreAddress | undefined {
      return Placement.elementAtOnset(state.score, location, onset);
    },

    undo(): void {
      state.undo = UndoStack.undo(state.undo);
      state.score = state.undo.present;
    },

    redo(): void {
      state.undo = UndoStack.redo(state.undo);
      state.score = state.undo.present;
    },

    addStaff(clef: Clef, label?: NonEmptyString): void {
      commit(StaffOps.addStaff(state.score, clef, label));
    },

    removeStaff(index: number): Result<Score> {
      const result = StaffOps.removeStaff(state.score, index);

      if (Result.isOk(result)) {
        commit(result.value);

        const reindexed = new Set<number>();

        for (const hidden of state.hiddenStaves) {
          if (hidden < index) reindexed.add(hidden);
          else if (hidden > index) reindexed.add(hidden - 1);
        }

        state.hiddenStaves = reindexed;
      }

      return result;
    },

    updateStaff(index: number, clef: Clef, label?: NonEmptyString): Result<Score> {
      return commitResult(StaffOps.updateStaff(state.score, index, clef, label));
    },

    /** Appends one rest-backed measure at the end — always safe, so no Result */
    addMeasure(): void {
      commit(MeasureOps.addMeasure(state.score));
    },

    /** Removes the last measure; refuses to leave the score empty or strand a tie/slur */
    removeLastMeasure(): Result<Score> {
      return commitResult(MeasureOps.removeLastMeasure(state.score));
    },

    /** The time signature tool's click: sets a measure's own time signature, refusing unless it's empty */
    placeTimeSignature(measureIndex: number, time: TimeSignature): Result<Score> {
      return commitResult(TimeSignatureOps.setTimeSignature(state.score, measureIndex, time));
    },

    /** The element eraser clicking a time signature: reverts to whatever's effective before it */
    eraseTimeSignature(measureIndex: number): Result<Score> {
      return commitResult(TimeSignatureOps.clearTimeSignature(state.score, measureIndex));
    },

    toggleStaffVisibility(index: number): void {
      const next = new Set(state.hiddenStaves);

      if (next.has(index)) next.delete(index);
      else next.add(index);

      state.hiddenStaves = next;
    },

    setFlow(flow: Flow): void {
      state.flow = flow;
    },

    setView(view: View): void {
      state.view = view;
    },

    /**
     * Selects a tool for the next placement and promotes it to the top of
     * recents — used both by an ordinary pallet click and by the "p"
     * eyedropper (pick up the hovered element's configuration). Clears any
     * active eraser mode or pending tie, since placing, erasing, and tying
     * are mutually exclusive.
     */
    selectTool(config: ToolConfig): void {
      state.activeTool = config;
      state.eraserMode = null;
      state.tieMode = false;
      state.pendingTie = null;
      state.recents = promote(state.recents, config);
    },

    /** Sets (or clears, with `null`) the active eraser mode; clears activeTool and any pending tie */
    setEraserMode(mode: EraserMode | null): void {
      state.eraserMode = mode;
      state.tieMode = false;
      state.pendingTie = null;
      if (mode) state.activeTool = null;
    },

    /** Toggles the tie pallet tool; clears activeTool/eraserMode and any pending tie */
    setTieMode(active: boolean): void {
      state.tieMode = active;
      state.pendingTie = null;

      if (active) {
        state.activeTool = null;
        state.eraserMode = null;
      }
    },

    /**
     * Starts a tie from `address` — a click on an untied note or chord tone
     * while the tie tool is active, or the right-click flyout's "start
     * tie." `pitch` says which tone when `address` is a chord (unused, and
     * fine to omit, for a plain note). Also engages tie mode itself, so
     * starting a tie from the flyout (without the pallet tool selected)
     * still leaves the interactive staff expecting a closing click next.
     */
    startTie(address: ScoreAddress, pitch?: Pitch): void {
      state.tieMode = true;
      state.activeTool = null;
      state.eraserMode = null;
      state.pendingTie = { address, pitch };
    },

    /**
     * Closes the pending tie into `endAddress` — the matching pitch (the
     * pending chord tone's, or the pending note's own) is carried over from
     * `startTie`, since a tie only ever connects equal pitches. On success,
     * clears `pendingTie` but stays in tie mode, ready for the next pair. On
     * failure (the clicked note wasn't a valid match), leaves `pendingTie`
     * as-is so the user can just click again.
     */
    closeTie(endAddress: ScoreAddress): Result<Score> {
      if (!state.pendingTie) return Result.invalid('No tie is pending');

      const result = commitResult(
        Placement.closeTie(
          state.score,
          state.pendingTie.address,
          endAddress,
          state.pendingTie.pitch,
        ),
      );

      if (Result.isOk(result)) state.pendingTie = null;

      return result;
    },

    /**
     * The right-click flyout's "remove tie" — `erase` cleans up a tied
     * note's partner on its own via `Placement.removeTie`, so this is only
     * needed to drop a tie without removing the note itself. `pitch`
     * disambiguates which tone when `address` is a chord.
     */
    removeTie(address: ScoreAddress, pitch?: Pitch): Result<Score> {
      return commitResult(Placement.removeTie(state.score, address, pitch));
    },

    /** The "-"/"=" hotkeys: steps the active tool's duration, promoting like any other pick */
    cycleActiveDuration(direction: 'shorter' | 'longer'): void {
      if (!state.activeTool || state.activeTool.kind === 'timeSignature') return;

      const duration =
        direction === 'shorter'
          ? DurationOps.halve(state.activeTool.duration)
          : DurationOps.double(state.activeTool.duration);
      const config: ToolConfig = { ...state.activeTool, duration };

      state.activeTool = config;
      state.recents = promote(state.recents, config);
    },

    /** Starts a new, blank project. Fails if the name is already taken. */
    newProject(name: string): Result<void> {
      if (Projects.exists(name)) {
        return Result.invalid(`A project named "${name}" already exists`);
      }

      flushAutosave();

      const fresh = blankScore();

      state.projectName = name;
      state.score = fresh;
      state.undo = UndoStack.of(fresh);
      state.hiddenStaves = new Set();

      return Result.okNoValue();
    },

    /** Loads a saved project by name, replacing the current session's history */
    loadProject(name: string): Result<void> {
      const score = Projects.load(name);

      if (!score) return Result.invalid(`No project named "${name}"`);

      flushAutosave();

      state.projectName = name;
      state.score = score;
      state.undo = UndoStack.of(score);
      state.hiddenStaves = new Set();

      return Result.okNoValue();
    },

    /** Names (or renames) the current session and saves it immediately */
    saveProjectAs(name: string): void {
      state.projectName = name;
      Projects.save(name, state.score);
    },

    /** Saves under the current name; fails if no name has been set yet */
    saveProject(): Result<void> {
      if (!state.projectName) return Result.invalid('No project name set yet — use "save as"');

      Projects.save(state.projectName, state.score);

      return Result.okNoValue();
    },

    listProjects(): string[] {
      return Projects.list();
    },

    deleteProject(name: string): void {
      Projects.delete(name);

      if (state.projectName === name) state.projectName = undefined;
    },

    /**
     * Play/pause toggle. From stopped, compiles the current score and plays
     * from the start (refusing an invalid score — no sound from a broken
     * one); from paused, resumes; while playing, pauses. Building the
     * transport here (on a user gesture) is what unlocks audio.
     */
    togglePlayback(): Result<void> {
      const t = ensureTransport();

      if (state.playback.status === 'playing') {
        t.pause();
      } else if (state.playback.status === 'paused') {
        t.play();
      } else {
        // Reuse the cached compile if it's still valid (an edit clears it), so
        // a performance already loaded by a prior seek/loop stays loaded — no
        // reload, no lost playhead.
        const compiled = performance ? { value: performance } : Compiler.compile(state.score);

        if (!Result.isOk(compiled)) return Result.mapError(compiled);

        performance = compiled.value;
        ensureLoaded();

        // Resume from wherever a seek left the playhead, not always the top.
        const startAt = state.playback.positionSeconds;

        if (startAt > 0 && startAt < compiled.value.durationSeconds) t.seek(startAt);
        applyLoopRegion();
        t.play();
      }

      syncPlayback();

      return Result.okNoValue();
    },

    stopPlayback(): void {
      transport?.stop();
      syncPlayback();
    },

    /** Moves the playhead to `seconds`, cueing the highlight there even while stopped */
    seekPlayback(seconds: number): void {
      seekTo(seconds);
    },

    /** Left-click a bar handle: move the playhead to that barline (a measure start, or the piece end) */
    seekToMeasure(measureIndex: number): void {
      const seconds = barlineSeconds(measureIndex);

      if (seconds !== undefined) seekTo(seconds);
    },

    setPlaybackLoop(loop: boolean): void {
      state.playback.loop = loop;
      transport?.setLoop(loop);
    },

    /**
     * Toggle this measure as the loop-passage start (clears it if already the
     * start). Setting a start also seeks there, so playback picks up from the
     * loop's beginning.
     */
    toggleLoopStart(measureIndex: number): void {
      const setting = state.playback.loopStartMeasure !== measureIndex;

      state.playback.loopStartMeasure = setting ? measureIndex : null;
      applyLoopRegion();

      if (setting) {
        const seconds = barlineSeconds(measureIndex);

        if (seconds !== undefined) seekTo(seconds);
      }
    },

    /** Toggle this measure as the loop-passage end (clears it if already the end) */
    toggleLoopEnd(measureIndex: number): void {
      state.playback.loopEndMeasure =
        state.playback.loopEndMeasure === measureIndex ? null : measureIndex;
      applyLoopRegion();
    },

    /** Clears both loop-passage bounds */
    clearLoopRegion(): void {
      state.playback.loopStartMeasure = null;
      state.playback.loopEndMeasure = null;
      applyLoopRegion();
    },

    /** Stops the autosave watcher and tears down audio — call when the store is no longer needed */
    dispose(): void {
      flushAutosave();
      stopAutosaveWatch();
      stopPlaybackWatch();
      transport?.dispose();
    },
  };
}
