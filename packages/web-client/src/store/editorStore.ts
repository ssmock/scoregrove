import { reactive, readonly, watch, type DeepReadonly } from 'vue';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Mode } from '@scoregrove/domain/KeySignature';
import type { Articulation } from '@scoregrove/domain/Notations';
import type { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { DurationOps } from '@scoregrove/editing/DurationOps';
import { Placement, type ElementSpec, type PlacementAddress } from '@scoregrove/editing/Placement';
import { RestBacking } from '@scoregrove/editing/RestBacking';
import { StaffOps } from '@scoregrove/editing/StaffOps';
import { UndoStack } from '@scoregrove/editing/UndoStack';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { Projects } from './Projects';

/**
 * A pallet tool configuration — what the next placement (or a "p" eyedropper
 * pickup) will place. Pitch is never part of it: pitch comes from where the
 * user clicks, not from the pallet.
 */
export type ToolConfig = {
  kind: 'note' | 'rest';
  duration: Duration;
  articulations?: readonly Articulation[];
};

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

export const sameToolConfig = (a: ToolConfig, b: ToolConfig): boolean =>
  a.kind === b.kind &&
  Duration.equals(a.duration, b.duration) &&
  sameArticulations(a.articulations, b.articulations);

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
   * What a click on the staff does next: place with `activeTool`, or erase
   * (one element, or a whole bar) if `eraserMode` is set instead. The two
   * are mutually exclusive — picking one clears the other — so the
   * interactive staff (a sibling of the pallet, not a descendant) has one
   * unambiguous place to read "what happens if I click right now."
   */
  activeTool: ToolConfig | null;
  eraserMode: EraserMode | null;
  recents: readonly ToolConfig[];
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
export function createEditorStore(initial: Score = blankScore()) {
  const state = reactive<EditorState>({
    projectName: undefined,
    score: initial,
    undo: UndoStack.of(initial),
    view: 'editor',
    flow: 'vertical',
    hiddenStaves: new Set(),
    activeTool: null,
    eraserMode: null,
    recents: [],
  });

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

    erase(address: ScoreAddress): Result<Score> {
      return commitResult(Placement.erase(state.score, address));
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
     * active eraser mode, since placing and erasing are mutually exclusive.
     */
    selectTool(config: ToolConfig): void {
      state.activeTool = config;
      state.eraserMode = null;
      state.recents = promote(state.recents, config);
    },

    /** Sets (or clears, with `null`) the active eraser mode; clears activeTool */
    setEraserMode(mode: EraserMode | null): void {
      state.eraserMode = mode;
      if (mode) state.activeTool = null;
    },

    /** The "-"/"=" hotkeys: steps the active tool's duration, promoting like any other pick */
    cycleActiveDuration(direction: 'shorter' | 'longer'): void {
      if (!state.activeTool) return;

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

    /** Stops the autosave watcher — call when the store is no longer needed */
    dispose(): void {
      flushAutosave();
      stopAutosaveWatch();
    },
  };
}
