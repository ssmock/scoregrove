import { describe, expect, it } from 'vitest';
import { ClosingBarline, OpeningBarline } from '../src/Barline';
import { Clef } from '../src/Clef';
import { Duration, NoteValue } from '../src/Duration';
import { KeySignature, Mode } from '../src/KeySignature';
import { Measure, StaffContent } from '../src/Measure';
import { Chord, ChordTone, Note, Rest, TieRole, type MeasureElement } from '../src/MeasureElement';
import { NavigationJump, NavigationMark } from '../src/Navigation';
import { NonEmptyArray } from '../src/NonEmptyArray';
import { SlurRole } from '../src/Notations';
import { Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { PositiveInteger } from '../src/PositiveInteger';
import { Score } from '../src/Score';
import { Staff } from '../src/Staff';
import { BeatUnit, Swing, TimeSignature } from '../src/TimeSignature';
import { expectInvalid, expectOk } from './helpers';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const e4 = Pitch.of(PitchClass.of(PitchLetter.E), Octave.of(4));
const quarter = Duration.of(NoteValue.Quarter);
const half = Duration.of(NoteValue.Half);

const key = expectOk(KeySignature.create(PitchClass.of(PitchLetter.C), Mode.Major));

// One beat per measure keeps fullness trivial for tests that target other rules.
const oneFour = expectOk(TimeSignature.create(1, BeatUnit.Quarter));
const staves = NonEmptyArray.of([Staff.of(Clef.Treble), Staff.of(Clef.Bass)]);

const content = (...elements: [MeasureElement, ...MeasureElement[]]) =>
  StaffContent.singleVoice(NonEmptyArray.of(elements));

const quarterContent = () => content(Note.of(c4, quarter));

const measure = (spec: Partial<Measure> = {}) =>
  expectOk(
    Measure.create({
      contents: NonEmptyArray.of([quarterContent(), quarterContent()]),
      ...spec,
    }),
  );

const score = (measures: NonEmptyArray<Measure>, extras: Partial<Score> = {}) =>
  Score.of({ staves, key, time: oneFour, measures, ...extras });

describe('Score.of', () => {
  it('builds without validation, so drafts are representable', () => {
    const draft = score(NonEmptyArray.of([measure({ jump: NavigationJump.DalSegno })]), {
      swing: Swing.MediumSwing,
    });

    expect(draft.swing).toBe('MediumSwing');
    expect(draft.measures).toHaveLength(1);
  });
});

describe('Score.measureCount', () => {
  it('counts measures', () => {
    expect(Score.measureCount(score(NonEmptyArray.of([measure(), measure(), measure()])))).toBe(3);
  });
});

describe('Score.check: staff alignment', () => {
  it('accepts aligned measures', () => {
    expectOk(Score.check(score(NonEmptyArray.of([measure(), measure()]))));
  });

  it('rejects a measure whose contents do not span every staff', () => {
    const short = expectOk(Measure.create({ contents: NonEmptyArray.of([quarterContent()]) }));
    const error = expectInvalid(Score.check(score(NonEmptyArray.of([measure(), short]))));

    expect(error.messages).toEqual([
      'Measure 2 has content for 1 of the 2 staves the score defines',
    ]);
  });
});

describe('Score.check: navigation', () => {
  it('rejects a dal segno jump with no segno mark', () => {
    const error = expectInvalid(
      Score.check(score(NonEmptyArray.of([measure({ jump: NavigationJump.DalSegno })]))),
    );
    expect(error.messages).toEqual([
      'A dal segno jump requires a Segno mark somewhere in the score',
    ]);
  });

  it('rejects an al Fine jump with no Fine mark', () => {
    const error = expectInvalid(
      Score.check(score(NonEmptyArray.of([measure({ jump: NavigationJump.DaCapoAlFine })]))),
    );
    expect(error.messages).toEqual(['An al Fine jump requires a Fine mark somewhere in the score']);
  });

  it('rejects an al Coda jump missing the coda mark and departure point', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ marks: NonEmptyArray.of([NavigationMark.Segno]) }),
            measure({ jump: NavigationJump.DalSegnoAlCoda }),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'An al Coda jump requires a Coda mark somewhere in the score',
      'An al Coda jump requires a ToCoda jump marking the departure point',
    ]);
  });

  it('rejects a ToCoda jump with no Coda mark', () => {
    const error = expectInvalid(
      Score.check(score(NonEmptyArray.of([measure({ jump: NavigationJump.ToCoda })]))),
    );
    expect(error.messages).toEqual(['A ToCoda jump requires a Coda mark somewhere in the score']);
  });

  it('accepts a complete da capo al coda structure', () => {
    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            measure(),
            measure({ jump: NavigationJump.ToCoda }),
            measure({ jump: NavigationJump.DaCapoAlCoda }),
            measure({ marks: NonEmptyArray.of([NavigationMark.Coda]) }),
          ]),
        ),
      ),
    );
  });
});

describe('Score.check: measure fullness', () => {
  const threeFour = expectOk(TimeSignature.create(3, BeatUnit.Quarter));

  const fullThreeFour = () =>
    expectOk(
      Measure.create({
        contents: NonEmptyArray.of([
          content(Note.of(c4, quarter), Note.of(c4, quarter), Note.of(c4, quarter)),
          content(Note.of(c4, half), Rest.of(quarter)),
        ]),
      }),
    );

  it('accepts full measures', () => {
    expectOk(
      Score.check(score(NonEmptyArray.of([fullThreeFour(), fullThreeFour()]), { time: threeFour })),
    );
  });

  it('labels an underfull measure with its position', () => {
    const error = expectInvalid(
      Score.check(score(NonEmptyArray.of([fullThreeFour(), measure()]), { time: threeFour })),
    );

    expect(error.messages).toEqual([
      'Measure 2: staff 1, voice 1 underfills the measure: 1/4 of a whole note; the 3/4 measure holds 3/4',
      'Measure 2: staff 2, voice 1 underfills the measure: 1/4 of a whole note; the 3/4 measure holds 3/4',
    ]);
  });

  it('allows an underfull first measure as a pickup', () => {
    expectOk(
      Score.check(score(NonEmptyArray.of([measure(), fullThreeFour()]), { time: threeFour })),
    );
  });

  it('tracks time signature changes', () => {
    const shrinks = expectOk(
      Measure.create({
        contents: NonEmptyArray.of([quarterContent(), quarterContent()]),
        time: oneFour,
      }),
    );

    expectOk(
      Score.check(
        score(NonEmptyArray.of([fullThreeFour(), shrinks, measure()]), { time: threeFour }),
      ),
    );
  });
});

describe('Score.check: repeats', () => {
  it('accepts a closed repeat, and a close without an open', () => {
    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ opening: OpeningBarline.RepeatOpen }),
            measure({ closing: ClosingBarline.RepeatClose }),
            measure({ closing: ClosingBarline.RepeatClose }),
          ]),
        ),
      ),
    );
  });

  it('rejects a repeat that opens while another is open', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ opening: OpeningBarline.RepeatOpen }),
            measure({ opening: OpeningBarline.RepeatOpen }),
            measure({ closing: ClosingBarline.RepeatClose }),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Measure 2 opens a repeat while the repeat opened at measure 1 is still open',
    ]);
  });

  it('rejects a repeat that never closes', () => {
    const error = expectInvalid(
      Score.check(
        score(NonEmptyArray.of([measure(), measure({ opening: OpeningBarline.RepeatOpen })])),
      ),
    );

    expect(error.messages).toEqual(['The repeat opened at measure 2 is never closed']);
  });
});

describe('Score.check: volta endings', () => {
  const ending = (...numbers: [number, ...number[]]) =>
    NonEmptyArray.of(numbers.map((n) => PositiveInteger.of(n)));

  it('accepts a first and second ending around a repeat', () => {
    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ opening: OpeningBarline.RepeatOpen }),
            measure({ ending: ending(1), closing: ClosingBarline.RepeatClose }),
            measure({ ending: ending(2) }),
          ]),
        ),
      ),
    );
  });

  it('rejects a first ending that does not close with a repeat', () => {
    const error = expectInvalid(
      Score.check(
        score(NonEmptyArray.of([measure({ ending: ending(1) }), measure({ ending: ending(2) })])),
      ),
    );

    expect(error.messages).toEqual([
      'The ending at measures 1–1 must close with a repeat (only the final passage continues onward)',
    ]);
  });

  it('rejects skipped passage numbers', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ ending: ending(1), closing: ClosingBarline.RepeatClose }),
            measure({ ending: ending(3) }),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'The endings starting at measure 1 skip passage 2 (passages must cover 1 through 3)',
    ]);
  });

  it('rejects a passage number used by two brackets', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            measure({ ending: ending(1, 2), closing: ClosingBarline.RepeatClose }),
            measure({ ending: ending(2) }),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'The endings starting at measure 1 use passage 2 more than once',
    ]);
  });
});

describe('Score.check: tie continuity', () => {
  it('accepts a tie across a barline', () => {
    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { tie: TieRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { tie: TieRole.End })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );
  });

  it('accepts per-tone chord ties', () => {
    const first = expectOk(Chord.create([ChordTone.of(c4, TieRole.Begin), e4], quarter));
    const second = expectOk(Chord.create([ChordTone.of(c4, TieRole.End), e4], quarter));

    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([content(first), quarterContent()]),
              }),
            ),
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([content(second), quarterContent()]),
              }),
            ),
          ]),
        ),
      ),
    );
  });

  it('rejects a tie that is never completed', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { tie: TieRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Staff 1, voice 1: the tie begun on C4 in measure 1 is never completed',
    ]);
  });

  it('rejects a tie continued by a different pitch', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { tie: TieRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(e4, quarter, { tie: TieRole.End })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Measure 2, staff 1, voice 1: the tie begun on C4 in measure 1 is not continued here',
      'Measure 2, staff 1, voice 1: a tie ends on E4 that was never begun',
    ]);
  });

  it('rejects a tie interrupted by a rest', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { tie: TieRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([content(Rest.of(quarter)), quarterContent()]),
              }),
            ),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Measure 2, staff 1, voice 1: the tie begun on C4 in measure 1 is interrupted by a rest',
    ]);
  });
});

describe('Score.check: slur balance', () => {
  it('accepts a balanced slur', () => {
    expectOk(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { slur: SlurRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(e4, quarter, { slur: SlurRole.End })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );
  });

  it('rejects a slur that ends without beginning', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { slur: SlurRole.End })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Measure 1, staff 1, voice 1: a slur ends that was never begun',
    ]);
  });

  it('rejects a slur that never closes', () => {
    const error = expectInvalid(
      Score.check(
        score(
          NonEmptyArray.of([
            expectOk(
              Measure.create({
                contents: NonEmptyArray.of([
                  content(Note.of(c4, quarter, { slur: SlurRole.Begin })),
                  quarterContent(),
                ]),
              }),
            ),
          ]),
        ),
      ),
    );

    expect(error.messages).toEqual([
      'Staff 1, voice 1: the slur begun in measure 1 is never closed',
    ]);
  });
});

describe('Score.check: aggregation', () => {
  it('reports problems from different passes together', () => {
    const short = expectOk(Measure.create({ contents: NonEmptyArray.of([quarterContent()]) }));
    const error = expectInvalid(
      Score.check(score(NonEmptyArray.of([short, measure({ jump: NavigationJump.DalSegno })]))),
    );

    expect(error.messages).toContain(
      'Measure 1 has content for 1 of the 2 staves the score defines',
    );
    expect(error.messages).toContain(
      'A dal segno jump requires a Segno mark somewhere in the score',
    );
  });
});
