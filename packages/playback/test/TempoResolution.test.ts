import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { MetronomeMark, TempoChange, TempoMarking } from '@scoregrove/domain/Tempo';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { TempoResolution } from '../src/TempoResolution';

const time = (beats: number, beatUnit: BeatUnit): TimeSignature => ({
  beats: PositiveInteger.of(beats),
  beatUnit,
});

const fourFour = time(4, BeatUnit.Quarter);
const cutTime = time(2, BeatUnit.Half);
const sixEight = time(6, BeatUnit.Eighth);

const dotted = (noteValue: NoteValue): Duration => Duration.of(noteValue, { dots: 1 });

describe('TempoResolution.markingBpm', () => {
  it('covers every marking, strictly slowest to fastest', () => {
    const values = TempoMarking.values.map((marking) => TempoResolution.markingBpm[marking]);

    expect(values).toHaveLength(15);

    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('TempoResolution.metricBeat', () => {
  it('counts simple meters on their denominator', () => {
    expect(TempoResolution.metricBeat(fourFour)).toEqual(Duration.of(NoteValue.Quarter));
    expect(TempoResolution.metricBeat(cutTime)).toEqual(Duration.of(NoteValue.Half));
    expect(TempoResolution.metricBeat(time(3, BeatUnit.Eighth))).toEqual(
      Duration.of(NoteValue.Eighth),
    );
  });

  it('counts compound meters on the dotted grouping of three denominator units', () => {
    expect(TempoResolution.metricBeat(sixEight)).toEqual(dotted(NoteValue.Quarter));
    expect(TempoResolution.metricBeat(time(9, BeatUnit.Eighth))).toEqual(dotted(NoteValue.Quarter));
    expect(TempoResolution.metricBeat(time(12, BeatUnit.Eighth))).toEqual(
      dotted(NoteValue.Quarter),
    );
    expect(TempoResolution.metricBeat(time(6, BeatUnit.Sixteenth))).toEqual(
      dotted(NoteValue.Eighth),
    );
  });

  it('keeps the documented edge meters simple', () => {
    // 3/8 is a multiple of three but under six — felt in three, not one
    expect(TempoResolution.metricBeat(time(3, BeatUnit.Eighth))).toEqual(
      Duration.of(NoteValue.Eighth),
    );
    // 6/4's quarter denominator has no compound grouping here
    expect(TempoResolution.metricBeat(time(6, BeatUnit.Quarter))).toEqual(
      Duration.of(NoteValue.Quarter),
    );
    // irregular meters fall to simple
    expect(TempoResolution.metricBeat(time(7, BeatUnit.Eighth))).toEqual(
      Duration.of(NoteValue.Eighth),
    );
    expect(TempoResolution.metricBeat(time(5, BeatUnit.Eighth))).toEqual(
      Duration.of(NoteValue.Eighth),
    );
  });
});

describe('TempoResolution.resolve', () => {
  it('reads a metronome mark directly, ignoring the meter', () => {
    const mark = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120));

    expect(TempoResolution.resolve(mark, fourFour)).toEqual({
      bpm: 120,
      beat: Duration.of(NoteValue.Quarter),
    });
    // same result in a different meter — a mark carries its own beat
    expect(TempoResolution.resolve(mark, sixEight)).toEqual({
      bpm: 120,
      beat: Duration.of(NoteValue.Quarter),
    });
  });

  it('keeps a dotted metronome mark’s own beat', () => {
    const mark = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(80), 1);

    expect(TempoResolution.resolve(mark, sixEight)).toEqual({
      bpm: 80,
      beat: dotted(NoteValue.Quarter),
    });
  });

  it('looks a marking up in the table on the meter’s pulse', () => {
    expect(TempoResolution.resolve(TempoMarking.Allegro, fourFour)).toEqual({
      bpm: 132,
      beat: Duration.of(NoteValue.Quarter),
    });
    // same marking, compound meter — counted on the dotted-quarter pulse
    expect(TempoResolution.resolve(TempoMarking.Allegro, sixEight)).toEqual({
      bpm: 132,
      beat: dotted(NoteValue.Quarter),
    });
  });

  it('treats a change as not-an-absolute-tempo', () => {
    expect(TempoResolution.resolve(TempoChange.Ritardando, fourFour)).toBeUndefined();
    expect(TempoResolution.resolve(TempoChange.ATempo, fourFour)).toBeUndefined();
  });
});

describe('TempoResolution.defaultTempo', () => {
  it('is Moderato on the meter’s pulse', () => {
    expect(TempoResolution.defaultTempo(fourFour)).toEqual({
      bpm: 112,
      beat: Duration.of(NoteValue.Quarter),
    });
    expect(TempoResolution.defaultTempo(sixEight)).toEqual({
      bpm: 112,
      beat: dotted(NoteValue.Quarter),
    });
  });
});

describe('TempoResolution.wholeNoteSeconds', () => {
  it('scales a whole note by the beat and its rate', () => {
    // quarter = 112 → whole note is four beats of 60/112 s
    expect(
      TempoResolution.wholeNoteSeconds({ bpm: 112, beat: Duration.of(NoteValue.Quarter) }),
    ).toBeCloseTo((60 / 112) * 4, 6);

    // half = 60 → whole note is two one-second beats
    expect(
      TempoResolution.wholeNoteSeconds({ bpm: 60, beat: Duration.of(NoteValue.Half) }),
    ).toBeCloseTo(2, 6);
  });

  it('makes a compound beat faster per written note than a naive quarter reading', () => {
    // 6/8 Moderato: dotted-quarter = 112 → each of the six eighths is short
    const compound = TempoResolution.wholeNoteSeconds(TempoResolution.defaultTempo(sixEight));
    // if we had (wrongly) counted the eighth denominator at 112, the whole note would be far longer
    const naiveEighth = TempoResolution.wholeNoteSeconds({
      bpm: 112,
      beat: Duration.of(NoteValue.Eighth),
    });

    expect(compound).toBeCloseTo((60 / 112) * (8 / 3), 6);
    expect(compound).toBeLessThan(naiveEighth);
  });
});
