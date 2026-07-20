import { describe, expect, it } from 'vitest';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import { InteractionGeometry } from '../src/InteractionGeometry';

const melody = Fixtures.monophonicMelody();
const system = SystemLayout.unbroken(melody);
const firstMeasure = system.measures[0].staves[0];

describe('InteractionGeometry.nearestPosition', () => {
  it('inverts StaffPosition.y at the reference lines', () => {
    expect(InteractionGeometry.nearestPosition(2)).toBe(0); // middle line
    expect(InteractionGeometry.nearestPosition(0)).toBe(4); // top line
    expect(InteractionGeometry.nearestPosition(4)).toBe(-4); // bottom line
  });

  it('rounds an off-grid y to the nearest position', () => {
    expect(InteractionGeometry.nearestPosition(1.9)).toBe(0);
    expect(InteractionGeometry.nearestPosition(1.7)).toBe(1);
  });
});

describe('InteractionGeometry.nearestStaffRow', () => {
  it('picks whichever row is closest', () => {
    expect(InteractionGeometry.nearestStaffRow([0, 10, 20], 8)).toBe(1);
    expect(InteractionGeometry.nearestStaffRow([0, 10, 20], 2)).toBe(0);
    expect(InteractionGeometry.nearestStaffRow([0, 10, 20], 19)).toBe(2);
  });
});

describe('InteractionGeometry.nearestMeasureIndex', () => {
  it('finds the measure whose span contains x', () => {
    const secondEntry = system.measures[1];

    expect(InteractionGeometry.nearestMeasureIndex(system, secondEntry.x + 1)).toBe(1);
  });

  it('falls back to the nearest measure past the last one', () => {
    expect(InteractionGeometry.nearestMeasureIndex(system, system.width + 50)).toBe(
      system.measures.length - 1,
    );
  });
});

describe('InteractionGeometry.nearestElementIndex', () => {
  it('does not confuse a note with the dynamic mark sharing its x', () => {
    // Element 0 is the opening Piano dynamic and element 1 the first note —
    // both placed at the same x. A click at the note's staff height must
    // resolve to the note, not the dynamic below the staff.
    const dynamic = firstMeasure.elements[0];
    const note = firstMeasure.elements[1];

    expect(dynamic.x).toBe(note.x);

    const nearNote = InteractionGeometry.nearestElementIndex(firstMeasure.elements, note.x, 0);
    const nearDynamic = InteractionGeometry.nearestElementIndex(
      firstMeasure.elements,
      dynamic.x,
      7,
    );

    expect(nearNote).toBe(1);
    expect(nearDynamic).toBe(0);
  });

  it('is undefined for an empty element list', () => {
    expect(InteractionGeometry.nearestElementIndex([], 0, 0)).toBeUndefined();
  });
});

describe('InteractionGeometry.onsetOf', () => {
  it('sums durations before the index, skipping dynamics', () => {
    const elements = melody.measures[0].contents[0].voices[0].elements;

    // element 0: the dynamic (no time); element 1: G4 quarter at onset 0
    expect(InteractionGeometry.onsetOf(elements, 1)).toEqual(Fraction.zero());
    // element 2: A4 eighth, after the quarter
    expect(InteractionGeometry.onsetOf(elements, 2)).toEqual(Fraction.of(1, 4));
    // element 3: B4 eighth, after both
    expect(InteractionGeometry.onsetOf(elements, 3)).toEqual(Fraction.of(3, 8));
  });

  it('is zero at index 0', () => {
    const elements = melody.measures[0].contents[0].voices[0].elements;

    expect(InteractionGeometry.onsetOf(elements, 0)).toEqual(Fraction.zero());
  });
});

describe('InteractionGeometry.locate', () => {
  it('locates the first note of the first measure', () => {
    const note = firstMeasure.elements[1];

    const hit = InteractionGeometry.locate({
      system,
      measures: melody.measures,
      x: note.x,
      y: 2,
    });

    expect(hit).toMatchObject({ measureIndex: 0, staffIndex: 0, elementIndex: 1 });
    expect(hit?.onset).toEqual(Fraction.zero());
  });

  it('locates a later measure by x', () => {
    const secondEntry = system.measures[1];

    const hit = InteractionGeometry.locate({
      system,
      measures: melody.measures,
      x: secondEntry.x + 1,
      y: 2,
    });

    expect(hit?.measureIndex).toBe(1);
  });

  it('returns undefined for a system with no measures', () => {
    const hit = InteractionGeometry.locate({
      system: { ...system, measures: [] },
      measures: [],
      x: 0,
      y: 0,
    });

    expect(hit).toBeUndefined();
  });
});
