import { describe, expect, it } from 'vitest';
import { ClosingBarline } from '@scoregrove/domain/Barline';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Fraction } from '@scoregrove/domain/Fraction';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import {
  Chord,
  DynamicElement,
  Note,
  Rest,
  TieRole,
  type MeasureElement,
} from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Articulation, SlurRole } from '@scoregrove/domain/Notations';
import { Accidental, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { Placement } from '../src/Placement';
import { RestBacking } from '../src/RestBacking';
import { buildScore, expectInvalid, expectOk, expectScoreCheckOk, pitch } from './helpers';

const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
const quarter = Duration.of(NoteValue.Quarter);
const half = Duration.of(NoteValue.Half);
const whole = Duration.of(NoteValue.Whole);

const g4 = pitch(PitchLetter.G, 4);
const a4 = pitch(PitchLetter.A, 4);
const b4 = pitch(PitchLetter.B, 4);
const c4 = pitch(PitchLetter.C, 4);
const c5 = pitch(PitchLetter.C, 5);
const d4 = pitch(PitchLetter.D, 4);
const e4 = pitch(PitchLetter.E, 4);

const measureWith = (elements: MeasureElement[]): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
});

const scoreWith = (elements: MeasureElement[]) =>
  buildScore({
    time: fourFour,
    staves: [Staff.of(Clef.Treble)],
    measures: [measureWith(elements)],
  });

const voiceElements = (score: ReturnType<typeof scoreWith>): readonly MeasureElement[] =>
  score.measures[0].contents[0].voices[0].elements;

const addressAt = (element: number): ScoreAddress => ({ measure: 0, staff: 0, voice: 0, element });

describe('Placement.place', () => {
  it('splits the whole rest of a fresh measure around a placed quarter note', () => {
    const score = scoreWith([Rest.of(whole)]);
    const placed = expectOk(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: g4, duration: quarter },
      ),
    );

    expectScoreCheckOk(placed);
    expect(voiceElements(placed)).toEqual([
      Note.of(g4, quarter),
      Rest.of(Duration.of(NoteValue.Half, { dots: 1 })),
    ]);
  });

  it('places a note in the middle of a rest, leaving rests on both sides', () => {
    const score = scoreWith([Rest.of(whole)]);
    const placed = expectOk(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.of(1, 4) },
        { kind: 'note', pitch: a4, duration: quarter },
      ),
    );

    expectScoreCheckOk(placed);
    expect(voiceElements(placed)).toEqual([Rest.of(quarter), Note.of(a4, quarter), Rest.of(half)]);
  });

  it('leaves no leftover rest when the placed duration exactly fills the gap', () => {
    const score = scoreWith([Rest.of(whole)]);
    const placed = expectOk(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: c5, duration: whole },
      ),
    );

    expectScoreCheckOk(placed);
    expect(voiceElements(placed)).toEqual([Note.of(c5, whole)]);
  });

  it('spans several consecutive rests when the duration needs more than one', () => {
    // Four quarter rests (as an erase might leave behind), placing a half
    // note across the middle two
    const score = scoreWith([
      Rest.of(quarter),
      Rest.of(quarter),
      Rest.of(quarter),
      Rest.of(quarter),
    ]);
    const placed = expectOk(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.of(1, 4) },
        { kind: 'note', pitch: b4, duration: half },
      ),
    );

    expectScoreCheckOk(placed);
    expect(voiceElements(placed)).toEqual([Rest.of(quarter), Note.of(b4, half), Rest.of(quarter)]);
  });

  it('places a rest (not just a note) the same way', () => {
    const score = scoreWith([Rest.of(whole)]);
    const placed = expectOk(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'rest', duration: quarter },
      ),
    );

    expectScoreCheckOk(placed);
    expect(voiceElements(placed)[0]).toEqual(Rest.of(quarter));
  });

  it('rejects placing onto already-occupied time', () => {
    const score = scoreWith([Note.of(c4, whole)]);

    expectInvalid(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: d4, duration: quarter },
      ),
    );
  });

  it('rejects an onset past the end of the measure', () => {
    const score = scoreWith([Rest.of(whole)]);

    expectInvalid(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.of(1, 1) },
        { kind: 'note', pitch: c4, duration: quarter },
      ),
    );
  });

  it('rejects a duration that overruns the available contiguous rest time', () => {
    const score = scoreWith([
      Rest.of(quarter),
      Note.of(e4, Duration.of(NoteValue.Half, { dots: 1 })),
    ]);

    expectInvalid(
      Placement.place(
        score,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: c4, duration: half },
      ),
    );
  });

  it('rejects an unknown measure or staff index', () => {
    const score = scoreWith([Rest.of(whole)]);

    expectInvalid(
      Placement.place(
        score,
        { measure: 5, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: c4, duration: quarter },
      ),
    );
    expectInvalid(
      Placement.place(
        score,
        { measure: 0, staff: 3, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: c4, duration: quarter },
      ),
    );
  });
});

describe('Placement.erase', () => {
  it('replaces an isolated note with a rest of the same duration, when neither neighbor is a rest', () => {
    const score = scoreWith([Note.of(a4, quarter), Note.of(g4, quarter), Note.of(b4, half)]);
    const erased = expectOk(Placement.erase(score, addressAt(1)));

    expectScoreCheckOk(erased);
    expect(voiceElements(erased)).toEqual([
      Note.of(a4, quarter),
      Rest.of(quarter),
      Note.of(b4, half),
    ]);
  });

  it('merges freed time with rests on both sides into a canonical decomposition', () => {
    const score = scoreWith([
      Rest.of(quarter),
      Note.of(g4, quarter),
      Rest.of(quarter),
      Rest.of(quarter),
    ]);
    const erased = expectOk(Placement.erase(score, addressAt(1)));

    expectScoreCheckOk(erased);
    // every element here is either the erased note or an adjacent rest, so
    // the whole measure collapses to a single whole rest
    expect(voiceElements(erased)).toEqual([Rest.of(whole)]);
  });

  it('merges freed time with only the rests actually adjacent to it', () => {
    const score = scoreWith([
      Note.of(a4, quarter),
      Note.of(g4, quarter),
      Rest.of(quarter),
      Rest.of(quarter),
    ]);
    const erased = expectOk(Placement.erase(score, addressAt(1)));

    expectScoreCheckOk(erased);
    // the freed quarter merges with the two rests to its right (3/4 total,
    // a single dotted half) but not with the unrelated note to its left
    expect(voiceElements(erased)).toEqual([
      Note.of(a4, quarter),
      Rest.of(Duration.of(NoteValue.Half, { dots: 1 })),
    ]);
  });

  it('removes a dynamic outright, with no rest inserted', () => {
    const score = scoreWith([DynamicElement.of(DynamicMark.Forte), Note.of(g4, whole)]);
    const erased = expectOk(Placement.erase(score, addressAt(0)));

    expectScoreCheckOk(erased);
    expect(voiceElements(erased)).toEqual([Note.of(g4, whole)]);
  });

  it('erasing a whole measure of one note restores the whole rest', () => {
    const score = scoreWith([Note.of(c4, whole)]);
    const erased = expectOk(Placement.erase(score, addressAt(0)));

    expectScoreCheckOk(erased);
    expect(voiceElements(erased)).toEqual(RestBacking.wholeMeasureRests(fourFour));
  });

  it('refuses to erase a chord', () => {
    const chord = expectOk(Chord.create([c4, e4], whole));
    const score = scoreWith([chord]);

    expectInvalid(Placement.erase(score, addressAt(0)));
  });

  it('refuses to erase a note carrying a tie role', () => {
    const score = scoreWith([
      Note.of(c4, half, { tie: TieRole.Begin }),
      Note.of(c4, half, { tie: TieRole.End }),
    ]);

    expectInvalid(Placement.erase(score, addressAt(0)));
    expectInvalid(Placement.erase(score, addressAt(1)));
  });

  it('refuses to erase a note carrying a slur role', () => {
    const score = scoreWith([
      Note.of(c4, quarter, { slur: SlurRole.Begin }),
      Note.of(d4, quarter),
      Note.of(e4, quarter, { slur: SlurRole.End }),
      Rest.of(quarter),
    ]);

    expectInvalid(Placement.erase(score, addressAt(0)));
    expectInvalid(Placement.erase(score, addressAt(2)));
    // the untouched middle note is fine to erase
    expectScoreCheckOk(expectOk(Placement.erase(score, addressAt(1))));
  });

  it('rejects an address with no element there', () => {
    const score = scoreWith([Rest.of(whole)]);

    expectInvalid(Placement.erase(score, addressAt(4)));
  });

  it('round-trips: placing then erasing returns to the rest-backed measure', () => {
    const original = scoreWith([Rest.of(whole)]);
    const placed = expectOk(
      Placement.place(
        original,
        { measure: 0, staff: 0, voice: 0, onset: Fraction.zero() },
        { kind: 'note', pitch: g4, duration: quarter },
      ),
    );
    const erased = expectOk(Placement.erase(placed, addressAt(0)));

    expectScoreCheckOk(erased);
    expect(voiceElements(erased)).toEqual(voiceElements(original));
  });
});

describe('Placement.eraseBar', () => {
  it('resets a measure with music to whole rests, across every staff', () => {
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(
              NonEmptyArray.of([
                Note.of(g4, quarter),
                Rest.of(Duration.of(NoteValue.Half, { dots: 1 })),
              ]),
            ),
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(c4, whole)])),
          ]),
        },
      ],
    });

    const reset = expectOk(Placement.eraseBar(score, 0));

    expectScoreCheckOk(reset);
    expect(reset.measures[0].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
    expect(reset.measures[0].contents[1].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
  });

  it('leaves other measures untouched', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
          ]),
        },
      ],
    });

    const reset = expectOk(Placement.eraseBar(score, 1));

    expectScoreCheckOk(reset);
    expect(reset.measures[0]).toEqual(score.measures[0]);
  });

  it('preserves the measure’s own barline and time-signature-change fields', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
          ]),
          closing: ClosingBarline.Final,
        },
      ],
    });

    const reset = expectOk(Placement.eraseBar(score, 0));

    expect(reset.measures[0].closing).toBe(ClosingBarline.Final);
  });

  it('refuses to reset a measure containing a chord', () => {
    const staves = [Staff.of(Clef.Treble)];
    const chord = expectOk(Chord.create([g4, pitch(PitchLetter.B, 4)], whole));
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of([chord]))]) },
      ],
    });

    expectInvalid(Placement.eraseBar(score, 0));
  });

  it('refuses to reset a measure containing a tied note', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(
              NonEmptyArray.of([Note.of(g4, half, { tie: TieRole.Begin }), Note.of(g4, half)]),
            ),
          ]),
        },
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole, { tie: TieRole.End })])),
          ]),
        },
      ],
    });

    expectInvalid(Placement.eraseBar(score, 0));
  });

  it('rejects an out-of-range measure index', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(Placement.eraseBar(score, 9));
  });
});

describe('Placement.transposeNote', () => {
  it('steps a placed note up or down by semitones, respelling per the key', () => {
    const score = scoreWith([Note.of(g4, whole)]);

    const up = expectOk(Placement.transposeNote(score, addressAt(0), 1));

    expectScoreCheckOk(up);
    expect(voiceElements(up)[0]).toEqual(Note.of(pitch(PitchLetter.G, 4, Accidental.Sharp), whole));

    const down = expectOk(Placement.transposeNote(score, addressAt(0), -1));

    expectScoreCheckOk(down);
    expect(voiceElements(down)[0]).toEqual(
      Note.of(pitch(PitchLetter.G, 4, Accidental.Flat), whole),
    );
  });

  it('leaves duration and other notations untouched', () => {
    const dotted = Duration.of(NoteValue.Half, { dots: 1 });
    const articulations = NonEmptyArray.of([Articulation.Accent]);
    const score = scoreWith([Note.of(g4, dotted, { articulations })]);

    const stepped = expectOk(Placement.transposeNote(score, addressAt(0), 2));

    const note = voiceElements(stepped)[0];

    if (note.kind !== 'note') return expect.fail('Expected a note');

    expect(note.duration).toEqual(dotted);
    expect(note.articulations).toEqual(articulations);
  });

  it('a zero step is a no-op', () => {
    const score = scoreWith([Note.of(g4, whole)]);

    const stepped = expectOk(Placement.transposeNote(score, addressAt(0), 0));

    expect(voiceElements(stepped)[0]).toEqual(Note.of(g4, whole));
  });

  it('refuses a rest', () => {
    const score = scoreWith([Rest.of(whole)]);

    expectInvalid(Placement.transposeNote(score, addressAt(0), 1));
  });

  it('refuses a tied note', () => {
    const score = scoreWith([Note.of(g4, whole, { tie: TieRole.Begin })]);

    expectInvalid(Placement.transposeNote(score, addressAt(0), 1));
  });

  it('refuses a slurred note', () => {
    const score = scoreWith([Note.of(g4, whole, { slur: SlurRole.Begin })]);

    expectInvalid(Placement.transposeNote(score, addressAt(0), 1));
  });

  it('rejects an out-of-range address', () => {
    const score = scoreWith([Note.of(g4, whole)]);

    expectInvalid(Placement.transposeNote(score, addressAt(5), 1));
  });

  it('fails when stepping would leave the representable octave range', () => {
    const score = scoreWith([Note.of(pitch(PitchLetter.C, 0), whole)]);

    expectInvalid(Placement.transposeNote(score, addressAt(0), -1));
  });
});

describe('Placement.cycleDots', () => {
  it('adds a dot, then a second, then clears back to none', () => {
    const score = scoreWith([
      Note.of(g4, quarter),
      Rest.of(Duration.of(NoteValue.Half, { dots: 1 })),
    ]);

    const once = expectOk(Placement.cycleDots(score, addressAt(0)));

    expectScoreCheckOk(once);
    expect(voiceElements(once)[0]).toEqual(
      Note.of(g4, Duration.of(NoteValue.Quarter, { dots: 1 })),
    );

    const twice = expectOk(Placement.cycleDots(once, addressAt(0)));

    expectScoreCheckOk(twice);
    expect(voiceElements(twice)[0]).toEqual(
      Note.of(g4, Duration.of(NoteValue.Quarter, { dots: 2 })),
    );

    const cleared = expectOk(Placement.cycleDots(twice, addressAt(0)));

    expectScoreCheckOk(cleared);
    expect(voiceElements(cleared)[0]).toEqual(Note.of(g4, quarter));
  });

  it('refuses a rest, chord, or tied note', () => {
    expectInvalid(Placement.cycleDots(scoreWith([Rest.of(quarter)]), addressAt(0)));

    const chord = expectOk(Chord.create([g4, pitch(PitchLetter.B, 4)], quarter));

    expectInvalid(Placement.cycleDots(scoreWith([chord]), addressAt(0)));
    expectInvalid(
      Placement.cycleDots(scoreWith([Note.of(g4, quarter, { tie: TieRole.Begin })]), addressAt(0)),
    );
  });
});

describe('Placement.toggleArticulation', () => {
  it('adds an articulation, then removes it', () => {
    const score = scoreWith([
      Note.of(g4, quarter),
      Rest.of(Duration.of(NoteValue.Quarter, { dots: 1 })),
    ]);

    const added = expectOk(
      Placement.toggleArticulation(score, addressAt(0), Articulation.Staccato),
    );

    expectScoreCheckOk(added);
    expect(voiceElements(added)[0]).toEqual(
      Note.of(g4, quarter, { articulations: NonEmptyArray.of([Articulation.Staccato]) }),
    );

    const removed = expectOk(
      Placement.toggleArticulation(added, addressAt(0), Articulation.Staccato),
    );

    expectScoreCheckOk(removed);
    expect(voiceElements(removed)[0]).toEqual(Note.of(g4, quarter));
  });

  it('preserves duration and dots', () => {
    const dotted = Duration.of(NoteValue.Half, { dots: 1 });
    const score = scoreWith([Note.of(g4, dotted)]);

    const toggled = expectOk(
      Placement.toggleArticulation(score, addressAt(0), Articulation.Accent),
    );

    expect(voiceElements(toggled)[0]).toEqual(
      Note.of(g4, dotted, { articulations: NonEmptyArray.of([Articulation.Accent]) }),
    );
  });
});

describe('Placement.elementAtOnset', () => {
  it('finds the element covering an onset', () => {
    const score = scoreWith([Note.of(g4, quarter), Note.of(a4, half), Rest.of(quarter)]);

    expect(
      Placement.elementAtOnset(score, { measure: 0, staff: 0, voice: 0 }, Fraction.zero()),
    ).toEqual(addressAt(0));
    expect(
      Placement.elementAtOnset(score, { measure: 0, staff: 0, voice: 0 }, Fraction.of(1, 4)),
    ).toEqual(addressAt(1));
    expect(
      Placement.elementAtOnset(score, { measure: 0, staff: 0, voice: 0 }, Fraction.of(3, 4)),
    ).toEqual(addressAt(2));
  });

  it('re-resolves the same note across a cycleDots call, since its index can shift', () => {
    const score = scoreWith([
      Rest.of(quarter),
      Note.of(g4, quarter),
      Rest.of(quarter),
      Rest.of(quarter),
    ]);
    const onset = Fraction.of(1, 4);
    const before = Placement.elementAtOnset(score, { measure: 0, staff: 0, voice: 0 }, onset);

    expect(before).toEqual(addressAt(1));

    const edited = expectOk(Placement.cycleDots(score, before!));
    const after = Placement.elementAtOnset(edited, { measure: 0, staff: 0, voice: 0 }, onset);

    expect(voiceElements(edited)[after!.element]).toMatchObject({ kind: 'note' });
  });

  it('returns undefined past the end of the voice or for an unknown measure/staff', () => {
    const score = scoreWith([Note.of(g4, whole)]);

    expect(
      Placement.elementAtOnset(score, { measure: 0, staff: 0, voice: 0 }, Fraction.of(1, 1)),
    ).toBeUndefined();
    expect(
      Placement.elementAtOnset(score, { measure: 9, staff: 0, voice: 0 }, Fraction.zero()),
    ).toBeUndefined();
  });
});
