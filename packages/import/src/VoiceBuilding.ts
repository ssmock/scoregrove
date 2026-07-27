import type { Clef } from '@scoregrove/domain/Clef';
import { DotCount, Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { StaffContent, Voice } from '@scoregrove/domain/Measure';
import {
  Chord,
  ChordTone,
  DynamicElement,
  Note,
  Rest,
  type MeasureElement,
} from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { GraceNote, Notations } from '@scoregrove/domain/Notations';
import { Result } from '@scoregrove/domain/Result';
import type { XmlElement } from '@rgrove/parse-xml';
import { DirectionReading } from './DirectionReading';
import { DivisionsToDuration } from './DivisionsToDuration';
import { NotationReading } from './NotationReading';
import { PitchReading } from './PitchReading';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * One part's measure, as written in the file, into the `StaffContent` the
 * domain holds. This is where the readers stop reading one thing at a time and
 * something is finally *assembled*.
 *
 * ## Two coordinate systems, and which one moves the cursor
 *
 * A measure is a stream, not a list: `<backup>` and `<forward>` move a cursor
 * around inside it, and a second voice is written by rewinding to the start and
 * going again. Our `Voice` has no positions at all — it is a flat sequence
 * whose durations must add up — so the walk's job is to turn positions into
 * order, and holes into rests.
 *
 * The cursor moves in **sounded** divisions, taken from `<duration>`, because
 * that is the unit `<backup>` and `<forward>` themselves speak. The elements it
 * places carry **written** durations from `<type>`, because that is what the
 * domain models. `DivisionsToDuration` already cross-checks the two and warns
 * when a file disagrees with itself, so the walk can use each for what it is
 * good for rather than choosing between them.
 *
 * ## The extent rule
 *
 * Every voice is padded with rests to **the furthest the cursor ever reached**
 * in the measure.
 *
 * That single rule covers three separate things, which is why it is stated as
 * an extent rather than as three special cases. A voice entering late gets its
 * leading rests; a `<forward>` opening a hole mid-voice gets it filled; and a
 * `<forward>` trailing at the end of a measure — which is how this corpus ends
 * a short second voice, all 18 of them — pads that voice out to the bar line.
 * Without the last of these, measure 131 of the corpus (the smoke-test theme,
 * no less) has a voice summing to 72 divisions against voice 1's 96, and
 * `Measure.check` rightly rejects the whole measure.
 *
 * Deliberately *not* the time signature's capacity: a partial measure is
 * genuinely short in every voice at once, and padding to a capacity would
 * silently fill in the pickup bars this work has 22 of. The extent is what the
 * file itself says the measure spans, which is the only claim available here.
 */

/** A voice under construction, in the cursor's divisions coordinate */
type VoiceState = {
  id: string;
  /** Where this voice's written elements have reached */
  position: Fraction;
  elements: MeasureElement[];
  /** Grace notes read since this voice's last sounded element, awaiting their principal */
  graces: GraceNote[];
  /** First appearance in document order, to break ties in voice ordering */
  order: number;
};

/**
 * A span of divisions as a fraction of a whole note. The cursor counts
 * divisions, `Duration` counts whole notes, and `divisions` is the units per
 * *quarter* — so the conversion is exact and this is the only place it happens.
 */
const wholeNotesOf = (span: Fraction, divisions: number): Fraction =>
  Fraction.multiply(span, Fraction.of(1, divisions * 4));

/** Every representable rest length, longest first, for filling a gap */
const fillCandidates: readonly Duration[] = [
  NoteValue.Breve,
  NoteValue.Whole,
  NoteValue.Half,
  NoteValue.Quarter,
  NoteValue.Eighth,
  NoteValue.Sixteenth,
  NoteValue.ThirtySecond,
  NoteValue.SixtyFourth,
]
  .flatMap((noteValue) =>
    ([undefined, 1, 2] as readonly (DotCount | undefined)[]).map((dots) =>
      Duration.of(noteValue, dots ? { dots } : {}),
    ),
  )
  .sort((a, b) => Fraction.compare(Duration.fractionOfWhole(b), Duration.fractionOfWhole(a)));

/**
 * The rests spanning a gap. A single written value covers every gap this corpus
 * opens, but a gap need not be one — 3/8 is a quarter plus an eighth — so the
 * remainder is taken greedily, longest first. A gap no combination reaches
 * (a tuplet-length hole) is reported with what was left rather than rounded
 * away, and the short measure it leaves will fail `Measure.check` loudly.
 */
const gapDurations = (gap: Fraction, where: string, warn: Warn): Duration[] => {
  const durations: Duration[] = [];
  let remaining = gap;

  while (Fraction.compare(remaining, Fraction.zero()) > 0) {
    const fits = fillCandidates.find(
      (candidate) => Fraction.compare(Duration.fractionOfWhole(candidate), remaining) <= 0,
    );

    if (!fits) {
      warn(
        `${where}: ${Fraction.format(remaining)} of a whole note could not be filled with rests`,
      );
      break;
    }

    durations.push(fits);
    remaining = Fraction.subtract(remaining, Duration.fractionOfWhole(fits));
  }

  return durations;
};

/**
 * The notations that belong to an element as a whole, listed rather than
 * spread from the rest, so that the split between what is shared by a chord
 * and what is per tone (the tie and the notehead) stays visible here.
 */
const notationsOf = ({
  articulations,
  ornaments,
  slur,
  fermata,
  graces,
  lyrics,
}: Notations): Notations => ({
  ...(articulations ? { articulations } : {}),
  ...(ornaments ? { ornaments } : {}),
  ...(slur ? { slur } : {}),
  ...(fermata ? { fermata } : {}),
  ...(graces ? { graces } : {}),
  ...(lyrics ? { lyrics } : {}),
});

/**
 * Merges a `<chord/>` note into the element it sounds with, growing a `Note`
 * into a `Chord` or extending one. The principal's notations govern the chord
 * as a whole; only the tie and notehead are per tone, which is exactly the
 * split `ChordTone` models.
 */
const addChordTone = (
  previous: MeasureElement | undefined,
  tone: ChordTone,
  where: string,
  warn: Warn,
): Result<MeasureElement> => {
  if (!previous || (!Note.is(previous) && !Chord.is(previous))) {
    return Result.invalid(`${where}: a <chord/> note has nothing to sound with`);
  }

  if (Chord.is(previous)) {
    return Chord.create([...previous.tones, tone], previous.duration, notationsOf(previous));
  }

  const principal: ChordTone = {
    pitch: previous.pitch,
    ...(previous.tie ? { tie: previous.tie } : {}),
    ...(previous.notehead ? { notehead: previous.notehead } : {}),
  };

  const chord = Chord.create([principal, tone], previous.duration, notationsOf(previous));

  if (!Result.isOk(chord)) warn(`${where}: ${chord.error.messages.join('; ')}`);

  return chord;
};

export const VoiceBuilding = {
  /**
   * Walks one part's measure children in document order and returns what that
   * staff plays. `children` comes straight from `PartwiseToTimewise`, which has
   * already aligned the measure across parts and reconciled everything
   * score-wide; what is left here is purely this staff's own stream.
   *
   * Anything that is not a note or a cursor move is skipped in silence — not
   * dropped in silence. `<attributes>`, `<direction>`, `<barline>`, `<print>`
   * and `<sound>` are each read by another module or deliberately ignored, and
   * `Coverage` is what accounts for them; warning here would report them once
   * per part per measure for elements that are in fact handled.
   */
  staffContent(
    children: readonly XmlElement[],
    divisions: number,
    where: string,
    warn: Warn,
    options: { clef?: Clef } = {},
  ): Result<StaffContent> {
    const voices = new Map<string, VoiceState>();
    let cursor = Fraction.zero();
    let extent = Fraction.zero();
    let currentVoiceId = '1';

    const voiceFor = (id: string): VoiceState => {
      const existing = voices.get(id);

      if (existing) return existing;

      const created: VoiceState = {
        id,
        position: Fraction.zero(),
        elements: [],
        graces: [],
        order: voices.size,
      };

      voices.set(id, created);

      return created;
    };

    /**
     * Brings a voice up to a position with rests. Called before anything is
     * appended, so that whatever lands next lands where the file put it rather
     * than immediately after the voice's previous element.
     */
    const fillTo = (voice: VoiceState, target: Fraction) => {
      if (Fraction.compare(voice.position, target) >= 0) return;

      const gap = wholeNotesOf(Fraction.subtract(target, voice.position), divisions);

      for (const restDuration of gapDurations(gap, where, warn)) {
        voice.elements.push(Rest.of(restDuration));
      }

      voice.position = target;
    };

    /** A cursor move in divisions, from a `<backup>`, `<forward>` or `<duration>` */
    const divisionsOf = (element: XmlElement, name: string): Fraction | undefined => {
      const text = XmlReading.textOf(element, name);
      const value = text === undefined ? undefined : Number(text);

      if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;

      return Fraction.of(value, 1);
    };

    /**
     * The voice of the next `<note>` at or after each position in the stream.
     *
     * A `<direction>` needs this because it routinely *precedes* the first note
     * of the voice it belongs to — a second voice is written by rewinding, and
     * its dynamic comes before its first note, at which point the last note
     * seen still belongs to the previous voice. Reading backwards would put the
     * mark in the wrong voice, which is how it read until the corpus's own
     * measure 131 shape was written as a test. Looking forward also matches
     * what a `DynamicElement` means: it takes effect at the note that follows.
     */
    const followingVoice = children.reduceRight<(string | undefined)[]>((carry, child, index) => {
      const next = carry[index + 1];

      carry[index] =
        child.name === 'note' ? (XmlReading.textOf(child, 'voice') ?? currentVoiceId) : next;

      return carry;
    }, []);

    for (const [index, child] of children.entries()) {
      if (child.name === 'backup') {
        const amount = divisionsOf(child, 'duration');

        if (!amount) {
          warn(`${where}: a <backup> with no usable <duration>; ignoring it`);
          continue;
        }

        cursor = Fraction.subtract(cursor, amount);

        if (Fraction.compare(cursor, Fraction.zero()) < 0) {
          warn(`${where}: a <backup> reaches before the measure start; clamping to it`);
          cursor = Fraction.zero();
        }

        continue;
      }

      if (child.name === 'forward') {
        const amount = divisionsOf(child, 'duration');

        if (!amount) {
          warn(`${where}: a <forward> with no usable <duration>; ignoring it`);
          continue;
        }

        cursor = Fraction.add(cursor, amount);

        // The extent rule's whole point: a trailing <forward> is how a short
        // voice states that it lasts to the bar line, and nothing else records
        // that it did.
        if (Fraction.compare(cursor, extent) > 0) extent = cursor;

        continue;
      }

      if (child.name === 'direction') {
        const dynamics = DirectionReading.dynamics(child, where, warn);

        if (dynamics.length) {
          // A direction may name its own voice; absent that, it belongs to the
          // one it introduces. The voice is then brought up to the cursor
          // first, so the mark lands where the file put it rather than after
          // whatever rests are still owed.
          const voice = voiceFor(
            XmlReading.textOf(child, 'voice') ?? followingVoice[index] ?? currentVoiceId,
          );

          fillTo(voice, cursor);

          for (const dynamic of dynamics) voice.elements.push(DynamicElement.of(dynamic));
        }

        continue;
      }

      if (child.name !== 'note') continue;

      const note = child;
      const voiceId = XmlReading.textOf(note, 'voice') ?? currentVoiceId;

      currentVoiceId = voiceId;

      const voice = voiceFor(voiceId);

      // A grace note occupies no time at all — it steals from a neighbour — so
      // it neither moves the cursor nor becomes an element. It waits for the
      // principal it decorates.
      if (PitchReading.isGrace(note)) {
        const grace = NotationReading.graceNote(note, where, warn);

        if (Result.isOk(grace)) voice.graces.push(grace.value);
        else warn(`${where}: ${grace.error.messages.join('; ')}`);

        continue;
      }

      const duration = DivisionsToDuration.read(note, divisions, where, warn);

      if (!Result.isOk(duration)) {
        warn(`${where}: ${duration.error.messages.join('; ')}`);
        continue;
      }

      const tie = NotationReading.tie(note);
      const notehead = NotationReading.notehead(note, where, warn);

      // A chord member sounds *with* the note before it: it joins that element
      // and the cursor stays where the principal left it.
      if (PitchReading.isChordMember(note)) {
        const pitch = PitchReading.pitch(note, where, warn);

        if (!Result.isOk(pitch)) {
          warn(`${where}: ${pitch.error.messages.join('; ')}`);
          continue;
        }

        const tone: ChordTone = {
          pitch: pitch.value,
          ...(tie ? { tie } : {}),
          ...(notehead ? { notehead } : {}),
        };

        const merged = addChordTone(voice.elements.at(-1), tone, where, warn);

        if (Result.isOk(merged)) voice.elements[voice.elements.length - 1] = merged.value;

        continue;
      }

      // A voice reaching this point later than the cursor has a hole behind it,
      // whether from entering late or from a <forward>.
      fillTo(voice, cursor);

      const graces = voice.graces.splice(0);
      const notations = NotationReading.notations(note, where, warn, {
        endsGraceSlur: graces.some((grace) => grace.slurred),
      });

      if (graces.length) notations.graces = NonEmptyArray.of(graces);

      if (PitchReading.isRest(note)) {
        const position = PitchReading.restPosition(note, where, warn);

        voice.elements.push(
          Rest.of(duration.value, {
            ...(notations.fermata ? { fermata: true } : {}),
            ...(position ? { position } : {}),
          }),
        );
      } else {
        const pitch = PitchReading.pitch(note, where, warn);

        if (!Result.isOk(pitch)) {
          warn(`${where}: ${pitch.error.messages.join('; ')}`);
          continue;
        }

        voice.elements.push(
          Note.of(pitch.value, duration.value, {
            ...(tie ? { tie } : {}),
            ...(notehead ? { notehead } : {}),
            ...notations,
          }),
        );
      }

      const sounded = divisionsOf(note, 'duration');
      const advance = sounded ?? DivisionsToDuration.divisionsOf(duration.value, divisions);

      cursor = Fraction.add(cursor, advance);
      voice.position = cursor;

      if (Fraction.compare(cursor, extent) > 0) extent = cursor;
    }

    for (const voice of voices.values()) {
      if (voice.graces.length) {
        // Graces with no principal following them have nowhere to attach, and
        // `GraceNote` only exists as a decoration of a real note.
        warn(
          `${where}: ${voice.graces.length} grace note(s) end the measure with nothing to decorate`,
        );
      }

      fillTo(voice, extent);
    }

    const built = [...voices.values()]
      .filter((voice) => voice.elements.length > 0)
      .sort((a, b) => {
        const left = Number(a.id);
        const right = Number(b.id);

        if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
          return left - right;
        }

        return a.order - b.order;
      })
      .map((voice) => Voice.of(NonEmptyArray.of(voice.elements)));

    if (!built.length) {
      return Result.invalid(`${where}: no voices — the measure holds nothing this staff can play`);
    }

    return Result.ok(StaffContent.of(NonEmptyArray.of(built), options.clef));
  },
};
