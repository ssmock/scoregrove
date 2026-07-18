import { ClosingBarline } from '@scoregrove/domain/Barline';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import type { Measure } from '@scoregrove/domain/Measure';
import type { Note, Rest } from '@scoregrove/domain/MeasureElement';
import type { Accidental } from '@scoregrove/domain/Pitch';
import { engravingDefaults } from './Bravura';
import { Accidentals } from './Accidentals';
import type { MeasureContext } from './ContextWalk';
import { Glyphs } from './Glyphs';
import type {
  LaidOutDynamic,
  LaidOutElement,
  LaidOutGlyph,
  LaidOutMeasure,
  LaidOutNote,
  LaidOutRest,
  ScoreAddress,
} from './LayoutTree';
import { Signatures } from './Signatures';
import { Spacing } from './Spacing';
import { StaffPosition } from './StaffPosition';
import { Stems, StemDirection } from './Stems';

/** Breathing room at the start of a measure and after each signature run */
const pad = 0.75;

/** Gap between a printed accidental and its notehead */
const accidentalGap = 0.25;

/** Gap between a notehead (or previous dot) and an augmentation dot */
const dotGap = 0.4;

/** The least room an element keeps after its notehead, whatever its duration */
const minimumTail = 1.0;

/** How far below the bottom line a dynamic mark sits (y of its baseline) */
const dynamicY = 7;

/**
 * Augmentation dots sit in a space: a notehead on a line borrows the space
 * above.
 */
const dotPosition = (position: StaffPosition): StaffPosition =>
  position % 2 === 0 ? position + 1 : position;

const dotGlyphs = (
  duration: Duration,
  x: number,
  position: StaffPosition,
): LaidOutGlyph[] | undefined => {
  const count = duration.dots ?? 0;

  if (count === 0) return undefined;

  const y = StaffPosition.y(dotPosition(position));
  const advance = Glyphs.width('augmentationDot') + dotGap;

  return Array.from({ length: count }, (_dot, index) => ({
    glyph: 'augmentationDot' as const,
    x: x + index * advance,
    y,
  }));
};

export const MeasureLayout = {
  /**
   * Rests print on fixed staff rows: the whole rest hangs from the line above
   * the middle, everything else centers on the middle line.
   */
  restY(noteValue: NoteValue): number {
    return noteValue === NoteValue.Whole ? 1 : 2;
  },

  /**
   * Lays out one staff's slice of one measure for a single voice: signatures
   * the context says to print, then the voice's elements spaced on the
   * logarithmic curve, with accidentals resolved against the key. Multi-voice
   * contents render their first voice only for now (multi-voice layout is a
   * later stage of the plan). Tolerates draft measures missing this staff's
   * content by producing an empty measure.
   *
   * `stretch` multiplies each element's rhythmic room (never the signatures
   * or the content minimums) — how line justification widens a measure to
   * fill its system.
   */
  layout(args: {
    context: MeasureContext;
    measure: Measure;
    measureIndex: number;
    staffIndex: number;
    stretch?: number;
  }): LaidOutMeasure {
    const { context, measure, measureIndex, staffIndex } = args;
    const stretch = args.stretch ?? 1;

    const signatures: LaidOutGlyph[] = [];
    let cursor = pad;

    const appendRun = (run: { glyphs: readonly LaidOutGlyph[]; width: number }) => {
      if (!run.glyphs.length) return;

      signatures.push(...run.glyphs.map((laid) => ({ ...laid, x: laid.x + cursor })));
      cursor += run.width + pad;
    };

    if (context.printClef) appendRun(Signatures.clef(context.clef));
    if (context.printKey) appendRun(Signatures.key(context.clef, context.key));
    if (context.printTime) appendRun(Signatures.time(context.time));

    const content = measure.contents[staffIndex];
    const voice = content?.voices[0];
    const elements: LaidOutElement[] = [];

    if (voice) {
      const accidentals = Accidentals.resolve(context.key, voice.elements);
      const address = (element: number): ScoreAddress => ({
        measure: measureIndex,
        staff: staffIndex,
        voice: 0,
        element,
      });

      /** Dynamics wait here to attach to the next sounded element's x */
      let pendingDynamics: LaidOutDynamic[] = [];

      const placeDynamics = (x: number) => {
        elements.push(...pendingDynamics.map((dynamic) => ({ ...dynamic, x })));
        pendingDynamics = [];
      };

      voice.elements.forEach((element, index) => {
        if (element.kind === 'dynamic') {
          if (DynamicMark.is(element.dynamic)) {
            pendingDynamics.push({
              kind: 'dynamic',
              address: address(index),
              glyph: Glyphs.forDynamicMark(element.dynamic),
              x: cursor,
              y: dynamicY,
            });
          }

          // Gradual changes (hairpins) are spanners resolved in a later
          // pipeline stage; they take no room here.
          return;
        }

        if (element.kind === 'chord') {
          // Chords are a later slice; skip their room for now so drafts
          // containing them still render the rest of the measure.
          return;
        }

        const printed = accidentals[index][0];
        const accidentalWidth = printed
          ? Glyphs.width(Glyphs.forAccidental(printed)) + accidentalGap
          : 0;

        const laid =
          element.kind === 'note'
            ? layoutNote(element, address(index), cursor + accidentalWidth, context, printed)
            : layoutRest(element, address(index), cursor + accidentalWidth);

        placeDynamics(laid.x);
        elements.push(laid);

        const headWidth =
          laid.kind === 'note' ? Glyphs.width(laid.notehead) : Glyphs.width(laid.glyph);
        const dotsWidth = laid.dots?.length
          ? (Glyphs.width('augmentationDot') + dotGap) * laid.dots.length
          : 0;

        cursor +=
          accidentalWidth +
          Math.max(
            Spacing.widthOf(element.duration) * stretch,
            headWidth + dotsWidth + minimumTail,
          );
      });

      placeDynamics(cursor);
    }

    return {
      width: cursor + pad,
      signatures,
      elements,
      ...(measure.opening ? { opening: measure.opening } : {}),
      closing: measure.closing ?? ClosingBarline.Regular,
    };
  },
};

const layoutNote = (
  note: Note,
  address: ScoreAddress,
  x: number,
  context: MeasureContext,
  printed: Accidental | undefined,
): LaidOutNote => {
  const position = StaffPosition.of(context.clef, note.pitch);
  const notehead = Glyphs.forNotehead(note.duration.noteValue);
  const headWidth = Glyphs.width(notehead);
  const y = StaffPosition.y(position);

  const accidental: LaidOutGlyph | undefined = printed
    ? {
        glyph: Glyphs.forAccidental(printed),
        x: x - accidentalGap - Glyphs.width(Glyphs.forAccidental(printed)),
        y,
      }
    : undefined;

  const stemless =
    note.duration.noteValue === NoteValue.Breve || note.duration.noteValue === NoteValue.Whole;

  let stem: LaidOutNote['stem'];
  let flag: LaidOutGlyph | undefined;

  if (!stemless) {
    const direction = Stems.direction([position]);
    const anchors = Glyphs.data(notehead).anchors;
    const anchor = direction === StemDirection.Up ? anchors?.stemUpSE : anchors?.stemDownNW;
    const [anchorX, anchorY] = anchor ?? [direction === StemDirection.Up ? headWidth : 0, 0];

    const stemX =
      direction === StemDirection.Up
        ? x + anchorX - engravingDefaults.stemThickness / 2
        : x + anchorX + engravingDefaults.stemThickness / 2;
    const noteEnd = y - anchorY;
    const tip = StaffPosition.y(Stems.tipPosition(position, direction));

    stem = {
      x: stemX,
      top: Math.min(noteEnd, tip),
      bottom: Math.max(noteEnd, tip),
      direction,
    };

    const flagGlyph = Glyphs.forFlag(note.duration.noteValue, direction);

    if (flagGlyph) {
      const flagAnchors = Glyphs.data(flagGlyph).anchors;
      const flagAnchor =
        direction === StemDirection.Up ? flagAnchors?.stemUpNW : flagAnchors?.stemDownSW;
      const [flagX, flagY] = flagAnchor ?? [0, 0];
      const edge =
        stemX + (direction === StemDirection.Up ? -1 : 1) * (engravingDefaults.stemThickness / 2);

      flag = { glyph: flagGlyph, x: edge - flagX, y: tip + flagY };
    }
  }

  const dots = dotGlyphs(note.duration, x + headWidth + dotGap, position);

  return {
    kind: 'note',
    address,
    x,
    position,
    notehead,
    ...(accidental ? { accidental } : {}),
    ...(dots ? { dots } : {}),
    ...(stem ? { stem } : {}),
    ...(flag ? { flag } : {}),
    ledgers: StaffPosition.ledgerLines(position),
  };
};

const layoutRest = (rest: Rest, address: ScoreAddress, x: number): LaidOutRest => {
  const glyph = Glyphs.forRest(rest.duration.noteValue);
  const y = MeasureLayout.restY(rest.duration.noteValue);
  const dots = dotGlyphs(rest.duration, x + Glyphs.width(glyph) + dotGap, 1);

  const fermata: LaidOutGlyph | undefined = rest.fermata
    ? {
        glyph: Glyphs.forFermata('above'),
        x: x + Glyphs.width(glyph) / 2 - Glyphs.width(Glyphs.forFermata('above')) / 2,
        y: -1.5,
      }
    : undefined;

  return {
    kind: 'rest',
    address,
    x,
    glyph,
    y,
    ...(dots ? { dots } : {}),
    ...(fermata ? { fermata } : {}),
  };
};
