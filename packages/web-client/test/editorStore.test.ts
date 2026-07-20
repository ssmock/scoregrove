import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Mode } from '@scoregrove/domain/KeySignature';
import { Articulation } from '@scoregrove/domain/Notations';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { RestBacking } from '@scoregrove/editing/RestBacking';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { autosaveDelayMs, createEditorStore, type ToolConfig } from '../src/store/editorStore';
import { Projects } from '../src/store/Projects';

const noteAt = (element: number): ScoreAddress => ({ measure: 0, staff: 0, voice: 0, element });
const g4 = Pitch.of(PitchClass.of(PitchLetter.G), Octave.of(4));

const quarterNote: ToolConfig = {
  kind: 'note',
  duration: Duration.of(NoteValue.Quarter),
};

/** A minimal, valid score independent of the store, for seeding localStorage directly */
const sampleScore = (): Score => {
  const time = TimeSignature.commonTime();
  const staves = NonEmptyArray.of([Staff.of(Clef.Treble)]);

  return {
    staves,
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time,
    measures: NonEmptyArray.of([RestBacking.emptyMeasure(time, staves)]),
  };
};

beforeEach(() => {
  localStorage.clear();
});

describe('createEditorStore initial state', () => {
  it('starts with a blank, rest-backed score and no history', () => {
    const store = createEditorStore();

    expect(store.state.score.staves).toHaveLength(1);
    expect(store.state.undo.past).toEqual([]);
    expect(store.state.view).toBe('editor');
    expect(store.state.flow).toBe('vertical');
    expect(store.state.hiddenStaves.size).toBe(0);
    expect(store.state.activeTool).toBeNull();
    expect(store.state.eraserMode).toBeNull();
    expect(store.state.recents).toEqual([]);
    expect(store.state.projectName).toBeUndefined();

    store.dispose();
  });
});

describe('createEditorStore place/erase and undo', () => {
  it('commits a successful placement onto the undo stack', () => {
    const store = createEditorStore();

    const result = store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );

    expect(Result.isOk(result)).toBe(true);
    expect(store.state.undo.past).toHaveLength(1);
    expect(store.state.score.measures[0].contents[0].voices[0].elements[0]).toMatchObject({
      kind: 'note',
    });

    store.dispose();
  });

  it('does not commit a failed placement', () => {
    const store = createEditorStore();
    const before = store.state.score;

    const result = store.place(
      { measure: 9, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );

    expect(Result.isError(result)).toBe(true);
    expect(store.state.score).toBe(before);
    expect(store.state.undo.past).toEqual([]);

    store.dispose();
  });

  it('undoes and redoes a placement', () => {
    const store = createEditorStore();
    const original = store.state.score;

    store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );
    store.undo();

    expect(store.state.score).toEqual(original);
    expect(store.state.undo.past).toEqual([]);

    store.redo();
    expect(store.state.score.measures[0].contents[0].voices[0].elements[0]).toMatchObject({
      kind: 'note',
    });

    store.dispose();
  });

  it('erases what was placed, restoring the rest-backed measure', () => {
    const store = createEditorStore();

    store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );
    const result = store.erase(noteAt(0));

    expect(Result.isOk(result)).toBe(true);
    expect(store.state.score.measures[0].contents[0].voices[0].elements[0]).toMatchObject({
      kind: 'rest',
    });

    store.dispose();
  });

  it('transposes a placed note by a semitone', () => {
    const store = createEditorStore();

    store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );
    const result = store.transposeNote(noteAt(0), 1);

    expect(Result.isOk(result)).toBe(true);
    expect(
      (store.state.score.measures[0].contents[0].voices[0].elements[0] as { pitch: Pitch }).pitch
        .pitchClass.letter,
    ).toBe(PitchLetter.G);

    store.dispose();
  });

  it('cycles dots on a placed note', () => {
    const store = createEditorStore();

    store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );
    const result = store.cycleDots(noteAt(0));

    expect(Result.isOk(result)).toBe(true);
    expect(
      (store.state.score.measures[0].contents[0].voices[0].elements[0] as { duration: Duration })
        .duration.dots,
    ).toBe(1);

    store.dispose();
  });

  it('toggles an articulation on a placed note', () => {
    const store = createEditorStore();

    store.place(
      { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
      { kind: 'note', pitch: g4, duration: Duration.of(NoteValue.Quarter) },
    );
    const result = store.toggleArticulation(noteAt(0), Articulation.Staccato);

    expect(Result.isOk(result)).toBe(true);
    expect(
      (
        store.state.score.measures[0].contents[0].voices[0].elements[0] as {
          articulations?: readonly Articulation[];
        }
      ).articulations,
    ).toEqual([Articulation.Staccato]);

    store.dispose();
  });
});

describe('createEditorStore staff operations', () => {
  it('adds a staff and commits it to history', () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);

    expect(store.state.score.staves).toHaveLength(2);
    expect(store.state.undo.past).toHaveLength(1);

    store.dispose();
  });

  it('refuses to remove the last staff, without committing', () => {
    const store = createEditorStore();

    const result = store.removeStaff(0);

    expect(Result.isError(result)).toBe(true);
    expect(store.state.undo.past).toEqual([]);

    store.dispose();
  });

  it('reindexes hidden staves when a lower-indexed staff is removed', () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);
    store.addStaff(Clef.Alto);
    // Hide staff 2 (Alto), then remove staff 1 (Bass) — Alto shifts to index 1
    store.toggleStaffVisibility(2);
    store.removeStaff(1);

    expect(store.state.hiddenStaves).toEqual(new Set([1]));
    expect(store.state.score.staves[1].clef).toBe(Clef.Alto);

    store.dispose();
  });

  it('drops the removed index from hidden staves rather than leaving it stale', () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);
    store.toggleStaffVisibility(1);
    store.removeStaff(1);

    expect(store.state.hiddenStaves.size).toBe(0);

    store.dispose();
  });

  it('updates a staff clef and label', () => {
    const store = createEditorStore();

    const result = store.updateStaff(0, Clef.Bass, NonEmptyString.of('LH'));

    expect(Result.isOk(result)).toBe(true);
    expect(store.state.score.staves[0]).toEqual({ clef: Clef.Bass, label: 'LH' });

    store.dispose();
  });
});

describe('createEditorStore presentation prefs', () => {
  it('changes view and flow without touching undo history', () => {
    const store = createEditorStore();

    store.setView('performance');
    store.setFlow('horizontal');

    expect(store.state.view).toBe('performance');
    expect(store.state.flow).toBe('horizontal');
    expect(store.state.undo.past).toEqual([]);

    store.dispose();
  });

  it('toggles staff visibility independent of undo history', () => {
    const store = createEditorStore();

    store.toggleStaffVisibility(0);
    expect(store.state.hiddenStaves.has(0)).toBe(true);

    store.toggleStaffVisibility(0);
    expect(store.state.hiddenStaves.has(0)).toBe(false);
    expect(store.state.undo.past).toEqual([]);

    store.dispose();
  });
});

describe('createEditorStore tool selection and recents', () => {
  it('selects a tool and adds it to recents', () => {
    const store = createEditorStore();

    store.selectTool(quarterNote);

    expect(store.state.activeTool).toEqual(quarterNote);
    expect(store.state.recents).toEqual([quarterNote]);

    store.dispose();
  });

  it('clears the eraser mode when a tool is selected', () => {
    const store = createEditorStore();

    store.setEraserMode('element');
    store.selectTool(quarterNote);

    expect(store.state.eraserMode).toBeNull();
    expect(store.state.activeTool).toEqual(quarterNote);

    store.dispose();
  });

  it('clears the active tool when an eraser mode is selected', () => {
    const store = createEditorStore();

    store.selectTool(quarterNote);
    store.setEraserMode('bar');

    expect(store.state.activeTool).toBeNull();
    expect(store.state.eraserMode).toBe('bar');

    store.dispose();
  });

  it('clears the eraser mode entirely when set to null', () => {
    const store = createEditorStore();

    store.setEraserMode('element');
    store.setEraserMode(null);

    expect(store.state.eraserMode).toBeNull();

    store.dispose();
  });

  it('cycles the active tool duration shorter and longer, promoting each step', () => {
    const store = createEditorStore();

    store.selectTool(quarterNote);
    store.cycleActiveDuration('shorter');

    expect(store.state.activeTool?.duration.noteValue).toBe(NoteValue.Eighth);
    expect(store.state.recents[0]?.duration.noteValue).toBe(NoteValue.Eighth);

    store.cycleActiveDuration('longer');

    expect(store.state.activeTool?.duration.noteValue).toBe(NoteValue.Quarter);

    store.dispose();
  });

  it('does nothing if there is no active tool to cycle', () => {
    const store = createEditorStore();

    store.cycleActiveDuration('shorter');

    expect(store.state.activeTool).toBeNull();

    store.dispose();
  });

  it('promotes a re-selected matching config instead of duplicating it', () => {
    const store = createEditorStore();
    const eighthNote: ToolConfig = { kind: 'note', duration: Duration.of(NoteValue.Eighth) };

    store.selectTool(quarterNote);
    store.selectTool(eighthNote);
    store.selectTool(quarterNote);

    expect(store.state.recents).toEqual([quarterNote, eighthNote]);

    store.dispose();
  });

  it('treats different articulations as a different configuration', () => {
    const store = createEditorStore();
    const staccatoQuarter: ToolConfig = {
      ...quarterNote,
      articulations: [Articulation.Staccato],
    };

    store.selectTool(quarterNote);
    store.selectTool(staccatoQuarter);

    expect(store.state.recents).toEqual([staccatoQuarter, quarterNote]);

    store.dispose();
  });

  it('caps recents at 12, dropping the oldest', () => {
    const store = createEditorStore();

    // 16 distinct configs: every note value as both a note and a rest
    const kinds: ToolConfig['kind'][] = ['note', 'rest'];

    kinds.forEach((kind) => {
      NoteValue.values.forEach((noteValue) =>
        store.selectTool({ kind, duration: Duration.of(noteValue) }),
      );
    });

    expect(store.state.recents.length).toBe(12);
    // The very first selection (a Breve note) should have aged out
    expect(
      store.state.recents.some(
        (tool) => tool.kind === 'note' && tool.duration.noteValue === NoteValue.Breve,
      ),
    ).toBe(false);
    // The most recent selection (a SixtyFourth rest) should still be there, at the front
    expect(store.state.recents[0]).toEqual({
      kind: 'rest',
      duration: Duration.of(NoteValue.SixtyFourth),
    });

    store.dispose();
  });
});

describe('createEditorStore project management', () => {
  it('refuses a new project name that already exists', () => {
    Projects.save('Existing', sampleScore());

    const store = createEditorStore();
    const result = store.newProject('Existing');

    expect(Result.isError(result)).toBe(true);

    store.dispose();
  });

  it('starts a fresh project, resetting undo history and hidden staves', () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);
    store.toggleStaffVisibility(1);

    const result = store.newProject('Fresh Start');

    expect(Result.isOk(result)).toBe(true);
    expect(store.state.projectName).toBe('Fresh Start');
    expect(store.state.undo.past).toEqual([]);
    expect(store.state.hiddenStaves.size).toBe(0);
    expect(store.state.score.staves).toHaveLength(1);

    store.dispose();
  });

  it('saves as, then loads the same project back', () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);
    store.saveProjectAs('Study in G');

    expect(Projects.exists('Study in G')).toBe(true);

    const fresh = createEditorStore();
    const result = fresh.loadProject('Study in G');

    expect(Result.isOk(result)).toBe(true);
    expect(fresh.state.score.staves).toHaveLength(2);
    expect(fresh.state.projectName).toBe('Study in G');

    store.dispose();
    fresh.dispose();
  });

  it('fails to load a project that does not exist', () => {
    const store = createEditorStore();

    expect(Result.isError(store.loadProject('Nope'))).toBe(true);

    store.dispose();
  });

  it('fails to save under the current name until one has been set', () => {
    const store = createEditorStore();

    expect(Result.isError(store.saveProject())).toBe(true);

    store.dispose();
  });

  it('deletes a project, clearing the current name if it matches', () => {
    const store = createEditorStore();

    store.saveProjectAs('Study in G');
    store.deleteProject('Study in G');

    expect(Projects.exists('Study in G')).toBe(false);
    expect(store.state.projectName).toBeUndefined();

    store.dispose();
  });

  it('lists saved projects', () => {
    const store = createEditorStore();

    store.saveProjectAs('Study in G');

    expect(store.listProjects()).toEqual(['Study in G']);

    store.dispose();
  });
});

describe('createEditorStore autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves a debounced snapshot once a project name is set', async () => {
    const store = createEditorStore();

    store.saveProjectAs('Study in G');
    store.addStaff(Clef.Bass);

    await nextTick();
    vi.advanceTimersByTime(autosaveDelayMs);

    expect(Projects.load('Study in G')?.staves).toHaveLength(2);

    store.dispose();
  });

  it('debounces rapid successive changes into a single save', async () => {
    const store = createEditorStore();
    const saveSpy = vi.spyOn(Projects, 'save');

    store.saveProjectAs('Study in G');
    saveSpy.mockClear();

    store.addStaff(Clef.Bass);
    await nextTick();
    store.addStaff(Clef.Alto);
    await nextTick();

    vi.advanceTimersByTime(autosaveDelayMs);

    expect(saveSpy).toHaveBeenCalledTimes(1);

    store.dispose();
    saveSpy.mockRestore();
  });

  it('does not autosave when no project name has been set', async () => {
    const store = createEditorStore();

    store.addStaff(Clef.Bass);
    await nextTick();
    vi.advanceTimersByTime(autosaveDelayMs);

    expect(Projects.list()).toEqual([]);

    store.dispose();
  });

  it('flushes a pending autosave immediately on dispose', async () => {
    const store = createEditorStore();

    store.saveProjectAs('Study in G');
    store.addStaff(Clef.Bass);
    await nextTick();

    // Dispose before the debounce timer would have fired on its own
    store.dispose();

    expect(Projects.load('Study in G')?.staves).toHaveLength(2);
  });

  it('flushes a pending autosave before loading a different project', async () => {
    const store = createEditorStore();

    store.saveProjectAs('Study in G');
    store.addStaff(Clef.Bass);
    await nextTick();

    store.newProject('Another Project');

    expect(Projects.load('Study in G')?.staves).toHaveLength(2);

    store.dispose();
  });
});
