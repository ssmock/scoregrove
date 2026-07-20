import { beforeEach, describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode } from '@scoregrove/domain/KeySignature';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { RestBacking } from '@scoregrove/editing/RestBacking';
import { Projects } from '../src/store/Projects';

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

describe('Projects', () => {
  it('lists nothing before any project is saved', () => {
    expect(Projects.list()).toEqual([]);
    expect(Projects.exists('Study in G')).toBe(false);
  });

  it('saves and loads a project by name', () => {
    const score = sampleScore();

    Projects.save('Study in G', score);

    expect(Projects.exists('Study in G')).toBe(true);
    expect(Projects.load('Study in G')).toEqual(score);
  });

  it('returns undefined for a project that was never saved', () => {
    expect(Projects.load('Nonexistent')).toBeUndefined();
  });

  it('lists saved projects sorted by name', () => {
    Projects.save('Zeta', sampleScore());
    Projects.save('Alpha', sampleScore());

    expect(Projects.list()).toEqual(['Alpha', 'Zeta']);
  });

  it('overwrites a project saved again under the same name', () => {
    const score = sampleScore();

    Projects.save('Study in G', score);
    Projects.save('Study in G', { ...score, title: NonEmptyString.of('Renamed') });

    expect(Projects.list()).toEqual(['Study in G']);
    expect(Projects.load('Study in G')?.title).toBe('Renamed');
  });

  it('deletes a project', () => {
    Projects.save('Study in G', sampleScore());
    Projects.delete('Study in G');

    expect(Projects.exists('Study in G')).toBe(false);
    expect(Projects.list()).toEqual([]);
  });

  it('does not collide with unrelated localStorage entries', () => {
    localStorage.setItem('someOtherApp:setting', 'value');
    Projects.save('Study in G', sampleScore());

    expect(Projects.list()).toEqual(['Study in G']);
  });
});
