import { ClosingBarline } from '@scoregrove/domain/Barline';
import { Duration, NoteValue, Tuplet } from '@scoregrove/domain/Duration';
import type { Clef } from '@scoregrove/domain/Clef';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Fraction } from '@scoregrove/domain/Fraction';
import type { Measure } from '@scoregrove/domain/Measure';
import type { Chord, MeasureElement, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { Syllabic, type Articulation, type GraceNote } from '@scoregrove/domain/Notations';
import type { Accidental } from '@scoregrove/domain/Pitch';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { engravingDefaults } from './Bravura';
import { Accidentals } from './Accidentals';
import { Annotations } from './Annotations';
import { Beaming } from './Beaming';
import type { MeasureContext } from './ContextWalk';
import { Glyphs } from './Glyphs';
import type {
  LaidOutText,
  LaidOutBeam,
  LaidOutGrace,
  LaidOutTuplet,
  LaidOutChord,
  LaidOutChordTone,
  LaidOutElement,
  LaidOutGlyph,
  LaidOutMeasure,
  LaidOutNote,
  LaidOutRest,
  ScoreAddress,
} from './LayoutTree';
import { Signatures } from './Signatures';
import { Spacing } from './Spacing';
import { approximateTextMeasurer, type TextMeasurer } from './TextMeasure';
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

/** The baseline of the first lyric verse, below the dynamics line */
const lyricY = 9.2;

/** Vertical distance between verse baselines */
const verseSpacing = 2.2;

/** The em height of lyric text, in staff spaces */
const lyricSize = 1.8;

/** Breathing room a syllable keeps from its column neighbors */
const lyricPad = 0.6;

/** Grace notes render at this fraction of full size */
const graceScale = 0.6;

/** Horizontal advance per grace note in a group */
const graceAdvance = 1.4;

/** A miniature stem's length, in staff spaces */
const graceStemHeight = 2.4;

/** Gap between the last grace and the principal's accidental or notehead */
const graceGap = 0.4;

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

/**
 * One sounded or dynamic element waiting for its column x: where it sits in
 * the score, what accidental it prints, and how much room it needs.
 */
type ColumnItem = {
  staff: number;
  voice: number;
  element: number;
  value: MeasureElement;
  /** Printed accidentals, one slot per sounded pitch (per tone for chords) */
  printed: readonly (Accidental | undefined)[];
  beamDirection?: StemDirection;
};

type Column = {
  onset: Fraction;
  items: ColumnItem[];
  /** The notehead x once widths are resolved */
  x: number;
};

const onsetKey = (onset: Fraction): string => `${onset.numerator}/${onset.denominator}`;

const contentWidthOf = (item: ColumnItem, clef: Clef, measureText: TextMeasurer): number => {
  const { value } = item;

  if (value.kind === 'dynamic') return 0;

  /** The widest syllable a note or chord carries widens its column */
  const lyricWidth =
    value.kind === 'note' || value.kind === 'chord'
      ? Math.max(
          0,
          ...(value.lyrics ?? []).map(
            (lyric) => measureText(lyric.text, { size: lyricSize }) + lyricPad,
          ),
        )
      : 0;

  const dots = value.duration.dots
    ? (Glyphs.width('augmentationDot') + dotGap) * value.duration.dots
    : 0;

  if (value.kind === 'rest') {
    return Glyphs.width(Glyphs.forRest(value.duration.noteValue)) + dots + minimumTail;
  }

  const head = Glyphs.width(Glyphs.forNotehead(value.duration.noteValue));

  if (value.kind === 'note') return Math.max(head + dots + minimumTail, lyricWidth);

  // A chord with a second spreads across both sides of the stem
  const positions = value.tones
    .map((tone) => StaffPosition.of(clef, tone.pitch))
    .sort((a, b) => a - b);
  const hasSecond = positions.some(
    (position, index) => index > 0 && position - positions[index - 1] === 1,
  );

  return Math.max(head * (hasSecond ? 2 : 1) + dots + minimumTail, lyricWidth);
};

const graceBlockWidth = (item: ColumnItem): number => {
  const count =
    item.value.kind === 'note' || item.value.kind === 'chord'
      ? (item.value.graces?.length ?? 0)
      : 0;

  return count ? count * graceAdvance + graceGap : 0;
};

const prefixWidthOf = (item: ColumnItem): number => {
  const widest = Math.max(
    0,
    ...item.printed.flatMap((printed) =>
      printed ? [Glyphs.width(Glyphs.forAccidental(printed))] : [],
    ),
  );

  return (widest > 0 ? widest + accidentalGap : 0) + graceBlockWidth(item);
};

export const MeasureLayout = {
  /**
   * The baseline y of dynamic marks below a staff; hairpins share it so
   * wedges and marks sit on one line.
   */
  dynamicY,

  /**
   * Rests print on fixed staff rows: the whole rest hangs from the line above
   * the middle, everything else centers on the middle line.
   */
  restY(noteValue: NoteValue): number {
    return noteValue === NoteValue.Whole ? 1 : 2;
  },

  /**
   * Lays out one measure across every staff at once, returning one
   * LaidOutMeasure per staff, all sharing the same width so barlines align.
   *
   * Simultaneity is the point: every voice of every staff contributes its
   * onsets (computed as exact Fractions) to a shared set of alignment
   * columns, and elements at the same onset take the same x wherever they
   * live. The gap between adjacent columns is priced by the spacing curve on
   * the time between them; a column's accidentals hang in a prefix before
   * its notehead x.
   *
   * Voices beyond the first stem by voice index (first up, second down);
   * accidentals resolve per voice for now (a voice-shared measure state is a
   * later refinement), and colliding rests between voices are not yet
   * offset. Draft measures missing a staff's content render that staff's
   * signatures over an empty measure.
   *
   * `stretch` multiplies each column gap's rhythmic room (never signatures
   * or content minimums) — how line justification widens a measure.
   */
  layout(args: {
    contexts: readonly MeasureContext[];
    measure: Measure;
    measureIndex: number;
    stretch?: number;
    measureText?: TextMeasurer;
  }): LaidOutMeasure[] {
    const { contexts, measure, measureIndex } = args;
    const stretch = args.stretch ?? 1;
    const measureText = args.measureText ?? approximateTextMeasurer;

    /** Signatures per staff; the columns start after the widest run */
    const staffSignatures = contexts.map((context) => {
      const signatures: LaidOutGlyph[] = [];
      let cursor = pad;

      const appendRun = (run: { glyphs: readonly LaidOutGlyph[]; width: number }) => {
        if (!run.glyphs.length) return;

        signatures.push(...run.glyphs.map((laid) => ({ ...laid, x: laid.x + cursor })));
        cursor += run.width + pad;
      };

      if (context.printClef) appendRun(Signatures.clef(context.clef, context.clefChanged));
      if (context.printKey) appendRun(Signatures.key(context.clef, context.key));
      if (context.printTime) appendRun(Signatures.time(context.time));

      return { signatures, end: cursor };
    });

    const signatureEnd = Math.max(...staffSignatures.map((staff) => staff.end));

    /** Every voice's elements, walked onto the shared columns */
    const columns = new Map<string, Column>();
    const beamDirections = new Map<string, StemDirection>();
    const beamGroupsByVoice: {
      staff: number;
      voice: number;
      context: MeasureContext;
      elements: readonly MeasureElement[];
      groups: ReturnType<typeof Beaming.groups>;
    }[] = [];

    contexts.forEach((context, staffIndex) => {
      const content = measure.contents[staffIndex];

      content?.voices.forEach((voice, voiceIndex) => {
        const printed = Accidentals.resolve(context.key, voice.elements);
        const groups = Beaming.groups(voice.elements, context.time);
        const multiVoice = content.voices.length > 1;

        groups.forEach((group) => {
          const positions = group.elements.flatMap((elementIndex) => {
            const element = voice.elements[elementIndex];

            return element.kind === 'note' ? [StaffPosition.of(context.clef, element.pitch)] : [];
          });

          const direction = multiVoice
            ? Stems.directionForVoice(voiceIndex)
            : Stems.direction(positions);

          group.elements.forEach((elementIndex) =>
            beamDirections.set(`${staffIndex}:${voiceIndex}:${elementIndex}`, direction),
          );
        });

        beamGroupsByVoice.push({
          staff: staffIndex,
          voice: voiceIndex,
          context,
          elements: voice.elements,
          groups,
        });

        let onset = Fraction.zero();

        voice.elements.forEach((element, elementIndex) => {
          const key = onsetKey(onset);
          const column = columns.get(key) ?? { onset, items: [], x: 0 };

          column.items.push({
            staff: staffIndex,
            voice: voiceIndex,
            element: elementIndex,
            value: element,
            printed: printed[elementIndex],
            beamDirection: beamDirections.get(`${staffIndex}:${voiceIndex}:${elementIndex}`),
          });
          columns.set(key, column);

          if (element.kind !== 'dynamic') {
            onset = Fraction.add(onset, Duration.fractionOfWhole(element.duration));
          }
        });
      });
    });

    /** Resolve column x positions left to right */
    const ordered = [...columns.values()].sort((a, b) => Fraction.compare(a.onset, b.onset));
    const capacity = TimeSignature.capacity(contexts[0]?.time ?? TimeSignature.commonTime());

    let cursor = signatureEnd;

    ordered.forEach((column, columnIndex) => {
      const prefix = Math.max(0, ...column.items.map(prefixWidthOf));
      const content = Math.max(
        0,
        ...column.items.map((item) => contentWidthOf(item, contexts[item.staff].clef, measureText)),
      );

      const next = ordered[columnIndex + 1]?.onset ?? capacity;
      const delta = Fraction.add(
        next,
        Fraction.of(-column.onset.numerator, column.onset.denominator),
      );
      const rhythmic = Spacing.widthOfFraction(delta) * stretch;

      column.x = cursor + prefix;
      cursor = column.x + Math.max(rhythmic, content);
    });

    const width = cursor + pad;

    /** Place every staff's elements at their column x */
    const staves = contexts.map((context, staffIndex): LaidOutMeasure => {
      const elements: LaidOutElement[] = [];
      const laidNotes = new Map<string, LaidOutNote>();
      const beams: LaidOutBeam[] = [];

      /** Sounded elements per voice in x order, for tuplet run detection */
      const voiceSounded = new Map<
        number,
        {
          laid: LaidOutNote | LaidOutRest | LaidOutChord;
          top: number;
          right: number;
          beamed: boolean;
          tuplet?: Tuplet;
        }[]
      >();

      /** Per voice-and-verse, syllables in x order, for hyphen pairing */
      const lyricRows = new Map<
        string,
        { centerX: number; halfWidth: number; text: string; hyphenAfter: boolean; y: number }[]
      >();

      ordered.forEach((column) => {
        column.items.forEach((item) => {
          if (item.staff !== staffIndex) return;

          const address: ScoreAddress = {
            measure: measureIndex,
            staff: staffIndex,
            voice: item.voice,
            element: item.element,
          };

          if (item.value.kind === 'dynamic') {
            if (DynamicMark.is(item.value.dynamic)) {
              elements.push({
                kind: 'dynamic',
                address,
                glyph: Glyphs.forDynamicMark(item.value.dynamic),
                x: Math.min(column.x, width - pad),
                y: dynamicY,
              });
            }

            return;
          }

          const voiceDirection =
            measure.contents[staffIndex]!.voices.length > 1
              ? Stems.directionForVoice(item.voice)
              : undefined;

          /**
           * A whole rest that is its voice's only sounded element centers in
           * the measure's music region, per convention.
           */
          const wholeMeasureRest =
            item.value.kind === 'rest' &&
            item.value.duration.noteValue === NoteValue.Whole &&
            (measure.contents[staffIndex]?.voices[item.voice]?.elements.filter(
              (e) => e.kind !== 'dynamic',
            ).length ?? 0) === 1;
          const restX = wholeMeasureRest
            ? (signatureEnd + width - pad) / 2 - Glyphs.width('restWhole') / 2
            : column.x;

          const laid =
            item.value.kind === 'note'
              ? layoutNote(
                  item.value,
                  address,
                  column.x,
                  context,
                  item.printed[0],
                  voiceDirection,
                  item.beamDirection,
                )
              : item.value.kind === 'chord'
                ? layoutChord(item.value, address, column.x, context, item.printed, voiceDirection)
                : layoutRest(item.value, address, restX);

          elements.push(laid);

          if (laid.kind === 'note' && item.beamDirection) {
            laidNotes.set(`${item.voice}:${item.element}`, laid);
          }

          {
            const glyphWidth =
              laid.kind === 'rest' ? Glyphs.width(laid.glyph) : Glyphs.width(laid.notehead);
            const top =
              laid.kind === 'rest'
                ? laid.y - 1
                : Math.min(
                    laid.stem?.top ?? Number.POSITIVE_INFINITY,
                    ...(laid.kind === 'note'
                      ? [StaffPosition.y(laid.position) - 0.5]
                      : laid.tones.map((tone) => StaffPosition.y(tone.position) - 0.5)),
                  );
            const sounded = voiceSounded.get(item.voice) ?? [];

            sounded.push({
              laid,
              top,
              right: laid.x + glyphWidth,
              beamed: beamDirections.has(`${staffIndex}:${item.voice}:${item.element}`),
              ...(item.value.duration.tuplet ? { tuplet: item.value.duration.tuplet } : {}),
            });
            voiceSounded.set(item.voice, sounded);
          }

          if (item.value.kind !== 'rest' && item.value.lyrics) {
            const centerX =
              laid.x + Glyphs.width((laid as LaidOutNote | LaidOutChord).notehead) / 2;

            item.value.lyrics.forEach((lyric, verse) => {
              const rowKey = `${item.voice}:${verse}`;
              const row = lyricRows.get(rowKey) ?? [];

              row.push({
                centerX,
                halfWidth: measureText(lyric.text, { size: lyricSize }) / 2,
                text: lyric.text,
                hyphenAfter:
                  lyric.syllabic === Syllabic.Begin || lyric.syllabic === Syllabic.Middle,
                y: lyricY + verse * verseSpacing,
              });
              lyricRows.set(rowKey, row);
            });
          }
        });
      });

      /** Extend beamed stems to their group's beam line, per voice */
      beamGroupsByVoice
        .filter((entry) => entry.staff === staffIndex)
        .forEach((entry) => {
          entry.groups.forEach((group) => {
            const members = group.elements.flatMap((elementIndex) => {
              const laid = laidNotes.get(`${entry.voice}:${elementIndex}`);
              const element = entry.elements[elementIndex];

              return laid?.stem && element.kind === 'note' ? [{ laid, note: element }] : [];
            });

            if (members.length < 2) return;

            const direction = members[0].laid.stem!.direction;
            const up = direction === StemDirection.Up;

            const { tips, lines } = Beaming.geometry({
              stems: members.map(({ laid, note }) => ({
                x: laid.stem!.x,
                noteY: up ? laid.stem!.bottom : laid.stem!.top,
                count: Beaming.beamCount(note.duration.noteValue),
              })),
              direction,
            });

            members.forEach(({ laid }, memberIndex) => {
              if (up) {
                laid.stem!.top = tips[memberIndex];
              } else {
                laid.stem!.bottom = tips[memberIndex];
              }
            });

            beams.push(
              ...lines.map((line) => ({
                ...line,
                thickness: engravingDefaults.beamThickness,
                direction,
              })),
            );
          });
        });

      const lyrics: LaidOutText[] = [];

      lyricRows.forEach((row) => {
        row.forEach((entry, entryIndex) => {
          lyrics.push({
            text: entry.text,
            x: entry.centerX,
            y: entry.y,
            size: lyricSize,
            anchor: 'middle',
          });

          const next = row[entryIndex + 1];

          if (entry.hyphenAfter && next) {
            const gapLeft = entry.centerX + entry.halfWidth;
            const gapRight = next.centerX - next.halfWidth;

            // A cross-measure hyphen has no next syllable here: skipped (a
            // known gap)
            if (gapRight > gapLeft + 0.4) {
              lyrics.push({
                text: '-',
                x: (gapLeft + gapRight) / 2,
                y: entry.y,
                size: lyricSize,
                anchor: 'middle',
              });
            }
          }
        });
      });

      /**
       * Maximal runs of equal tuplet ratios take one marking each. Whether a
       * run completes whole tuplet units is not validated yet — a known gap.
       */
      const tuplets: LaidOutTuplet[] = [];

      voiceSounded.forEach((entries) => {
        let run: typeof entries = [];

        const flush = () => {
          if (run.length >= 2 && run[0].tuplet) {
            tuplets.push({
              x1: Math.min(...run.map((entry) => entry.laid.x)) - 0.2,
              x2: Math.max(...run.map((entry) => entry.right)) + 0.2,
              y: Math.min(...run.map((entry) => entry.top)) - 0.8,
              label: String(run[0].tuplet.count),
              bracket: !run.every((entry) => entry.beamed),
            });
          }

          run = [];
        };

        entries.forEach((entry) => {
          if (!entry.tuplet) {
            flush();

            return;
          }

          if (run.length && run[0].tuplet && !Tuplet.equals(run[0].tuplet, entry.tuplet)) {
            flush();
          }

          run.push(entry);
        });

        flush();
      });

      return {
        width,
        signatures: staffSignatures[staffIndex].signatures,
        elements,
        beams,
        lyrics,
        tuplets,
        annotations:
          staffIndex === 0
            ? Annotations.forMeasure({ context, measure, startX: signatureEnd, width })
            : [],
        ...(measure.opening ? { opening: measure.opening } : {}),
        closing: measure.closing ?? ClosingBarline.Regular,
      };
    });

    return staves;
  },
};

/**
 * The pre-onset carve-out of the strategy: a group of miniature grace notes
 * laid right-to-left before the principal's accidental (or notehead), each
 * with an always-up stem, a scaled flag, and the acciaccatura's slash.
 */
const layoutGraces = (
  graces: readonly GraceNote[],
  rightEdge: number,
  context: MeasureContext,
): LaidOutGrace[] => {
  const blockLeft = rightEdge - graces.length * graceAdvance;

  return graces.map((grace, index) => {
    const position = StaffPosition.of(context.clef, grace.pitch);
    const y = StaffPosition.y(position);
    const notehead = Glyphs.forNotehead(grace.noteValue);
    const headWidth = Glyphs.width(notehead) * graceScale;
    const x = blockLeft + index * graceAdvance;
    const stemX = x + headWidth - (engravingDefaults.stemThickness * graceScale) / 2;
    const top = y - graceStemHeight;

    const flagGlyph = Glyphs.forFlag(grace.noteValue, StemDirection.Up);

    return {
      x,
      position,
      notehead,
      scale: graceScale,
      stem: { x: stemX, top, bottom: y, direction: StemDirection.Up },
      ...(flagGlyph ? { flag: { glyph: flagGlyph, x: stemX, y: top } } : {}),
      ...(grace.style === 'Acciaccatura'
        ? { slash: { x1: x - 0.2, y1: y - 0.9, x2: x + headWidth + 0.6, y2: y - 1.9 } }
        : {}),
      ledgers: StaffPosition.ledgerLines(position),
    };
  });
};

/**
 * Attack marks stack outward from the notehead on the side opposite the
 * stem, a fermata always above everything. Marks near the middle of the
 * staff can still overlap staff lines — sitting them in spaces is a later
 * refinement.
 */
const attachmentsOf = (args: {
  articulations?: readonly Articulation[];
  fermata?: boolean;
  centerX: number;
  /** The notehead edge y on the articulation side */
  edgeY: number;
  /** The topmost y the element reaches (stem tip included) */
  topY: number;
  side: 'above' | 'below';
}): { articulations?: LaidOutGlyph[]; fermata?: LaidOutGlyph } => {
  const { centerX, edgeY, topY, side } = args;
  const step = side === 'below' ? 1.2 : -1.2;

  const articulations = args.articulations?.map((articulation, index) => {
    const glyph = Glyphs.forArticulation(articulation, side);

    return {
      glyph,
      x: centerX - Glyphs.width(glyph) / 2,
      y: edgeY + step * (index + 1),
    };
  });

  const fermata: LaidOutGlyph | undefined = args.fermata
    ? {
        glyph: Glyphs.forFermata('above'),
        x: centerX - Glyphs.width(Glyphs.forFermata('above')) / 2,
        y: Math.min(-1.5, topY - 1.2),
      }
    : undefined;

  return {
    ...(articulations?.length ? { articulations } : {}),
    ...(fermata ? { fermata } : {}),
  };
};

const layoutNote = (
  note: Note,
  address: ScoreAddress,
  x: number,
  context: MeasureContext,
  printed: Accidental | undefined,
  voiceDirection?: StemDirection,
  beamDirection?: StemDirection,
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
    const direction = beamDirection ?? voiceDirection ?? Stems.direction([position]);
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

    // A beamed note draws the beam instead of a flag
    const flagGlyph = beamDirection
      ? undefined
      : Glyphs.forFlag(note.duration.noteValue, direction);

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

  const graces = note.graces
    ? layoutGraces(note.graces, (accidental ? accidental.x : x) - graceGap, context)
    : undefined;

  const side: 'above' | 'below' = stem && stem.direction === StemDirection.Up ? 'below' : 'above';
  const attachments = attachmentsOf({
    ...(note.articulations ? { articulations: note.articulations } : {}),
    ...(note.fermata ? { fermata: note.fermata } : {}),
    centerX: x + headWidth / 2,
    edgeY: side === 'below' ? y + 0.5 : y - 0.5,
    topY: Math.min(y - 0.5, stem?.top ?? y),
    side,
  });

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
    ...attachments,
    ...(graces ? { graces } : {}),
    ledgers: StaffPosition.ledgerLines(position),
  };
};

/**
 * A chord cluster: tones sorted from the stem's base end, each second
 * flipping to the far side of the stem (never two offsets in a row), one
 * stem spanning the extreme tones, accidentals stacked naively in a single
 * column at the cluster's left (multi-column placement for dense chords is a
 * known gap). Chords are not yet beamed — short values keep their flags.
 */
const layoutChord = (
  chord: Chord,
  address: ScoreAddress,
  x: number,
  context: MeasureContext,
  printed: readonly (Accidental | undefined)[],
  voiceDirection?: StemDirection,
): LaidOutChord => {
  const notehead = Glyphs.forNotehead(chord.duration.noteValue);
  const headWidth = Glyphs.width(notehead);

  const toneData = chord.tones.map((tone, toneIndex) => ({
    tone: toneIndex,
    printed: printed[toneIndex],
    position: StaffPosition.of(context.clef, tone.pitch),
  }));

  const direction = voiceDirection ?? Stems.direction(toneData.map((tone) => tone.position));
  const up = direction === StemDirection.Up;

  const offsetX = up
    ? x + headWidth - engravingDefaults.stemThickness
    : x - headWidth + engravingDefaults.stemThickness;

  const walkOrder = [...toneData].sort((a, b) =>
    up ? a.position - b.position : b.position - a.position,
  );

  let previousPosition: number | undefined;
  let previousOffset = false;

  const placed = walkOrder.map((data) => {
    const isSecond =
      previousPosition !== undefined && Math.abs(data.position - previousPosition) === 1;
    const offset = isSecond && !previousOffset;

    previousPosition = data.position;
    previousOffset = offset;

    return { ...data, x: offset ? offsetX : x };
  });

  const clusterLeft = Math.min(...placed.map((tone) => tone.x));
  const clusterRight = Math.max(...placed.map((tone) => tone.x)) + headWidth;

  const tones: LaidOutChordTone[] = placed.map((tone) => {
    const y = StaffPosition.y(tone.position);
    const accidental: LaidOutGlyph | undefined = tone.printed
      ? {
          glyph: Glyphs.forAccidental(tone.printed),
          x: clusterLeft - accidentalGap - Glyphs.width(Glyphs.forAccidental(tone.printed)),
          y,
        }
      : undefined;

    return {
      tone: tone.tone,
      position: tone.position,
      x: tone.x,
      ...(accidental ? { accidental } : {}),
      ...(dotGlyphs(chord.duration, clusterRight + dotGap, tone.position)
        ? { dots: dotGlyphs(chord.duration, clusterRight + dotGap, tone.position) }
        : {}),
    };
  });

  const positions = toneData.map((tone) => tone.position);
  const highest = Math.max(...positions);
  const lowest = Math.min(...positions);

  const stemless =
    chord.duration.noteValue === NoteValue.Breve || chord.duration.noteValue === NoteValue.Whole;

  let stem: LaidOutChord['stem'];
  let flag: LaidOutGlyph | undefined;

  if (!stemless) {
    const anchors = Glyphs.data(notehead).anchors;
    const anchor = up ? anchors?.stemUpSE : anchors?.stemDownNW;
    const [anchorX, anchorY] = anchor ?? [up ? headWidth : 0, 0];

    const stemX = up
      ? x + anchorX - engravingDefaults.stemThickness / 2
      : x + anchorX + engravingDefaults.stemThickness / 2;

    const basePosition = up ? lowest : highest;
    const baseY = StaffPosition.y(basePosition) - anchorY;
    const tip = StaffPosition.y(Stems.tipPosition(up ? highest : lowest, direction));

    stem = {
      x: stemX,
      top: Math.min(baseY, tip),
      bottom: Math.max(baseY, tip),
      direction,
    };

    const flagGlyph = Glyphs.forFlag(chord.duration.noteValue, direction);

    if (flagGlyph) {
      const flagAnchors = Glyphs.data(flagGlyph).anchors;
      const flagAnchor = up ? flagAnchors?.stemUpNW : flagAnchors?.stemDownSW;
      const [flagX, flagY] = flagAnchor ?? [0, 0];
      const edge = stemX + (up ? -1 : 1) * (engravingDefaults.stemThickness / 2);

      flag = { glyph: flagGlyph, x: edge - flagX, y: tip + flagY };
    }
  }

  const ledgers = [
    ...new Set([...StaffPosition.ledgerLines(highest), ...StaffPosition.ledgerLines(lowest)]),
  ];

  const accidentalLeft = Math.min(
    clusterLeft,
    ...tones.flatMap((tone) => (tone.accidental ? [tone.accidental.x] : [])),
  );
  const graces = chord.graces
    ? layoutGraces(chord.graces, accidentalLeft - graceGap, context)
    : undefined;

  const side: 'above' | 'below' = stem && stem.direction === StemDirection.Up ? 'below' : 'above';
  const attachments = attachmentsOf({
    ...(chord.articulations ? { articulations: chord.articulations } : {}),
    ...(chord.fermata ? { fermata: chord.fermata } : {}),
    centerX: x + headWidth / 2,
    edgeY: side === 'below' ? StaffPosition.y(lowest) + 0.5 : StaffPosition.y(highest) - 0.5,
    topY: Math.min(StaffPosition.y(highest) - 0.5, stem?.top ?? StaffPosition.y(highest)),
    side,
  });

  return {
    kind: 'chord',
    address,
    x,
    notehead,
    tones,
    ...(stem ? { stem } : {}),
    ...(flag ? { flag } : {}),
    ...attachments,
    ...(graces ? { graces } : {}),
    ledgers,
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
