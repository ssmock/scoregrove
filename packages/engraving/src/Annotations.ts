import { ClosingBarline } from '@scoregrove/domain/Barline';
import type { Measure } from '@scoregrove/domain/Measure';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import { MetronomeMark, TempoChange, type Tempo } from '@scoregrove/domain/Tempo';
import { Swing } from '@scoregrove/domain/TimeSignature';
import type { MeasureContext } from './ContextWalk';
import { Glyphs } from './Glyphs';
import type { LaidOutAnnotation } from './LayoutTree';

/** Baseline of the tempo/swing line, above stem and beam room */
const tempoY = -4.5;

/** Baseline of navigation signs and instructions */
const navigationY = -2.5;

/** Baseline of the repeat count over a closing repeat barline */
const repeatTimesY = -1.2;

const tempoSize = 2.2;
const textSize = 1.8;

/**
 * The conventional printed forms of the gradual tempo instructions; absolute
 * markings print their Italian names as-is.
 */
const tempoChangeTexts: Record<TempoChange, string> = {
  Accelerando: 'accel.',
  Ritardando: 'rit.',
  Rallentando: 'rall.',
  Ritenuto: 'riten.',
  ATempo: 'a tempo',
};

const tempoText = (tempo: Tempo): string => {
  // A metronome mark prints its exact form ("quarter = 120"); a change prints
  // its abbreviation ("rit."); an absolute marking prints its Italian name.
  if (MetronomeMark.is(tempo)) return MetronomeMark.format(tempo);

  return TempoChange.is(tempo) ? tempoChangeTexts[tempo] : tempo;
};

/** The feel names as printed on charts */
const swingTexts: Record<Swing, string> = {
  Straight: 'Straight',
  LightSwing: 'Light Swing',
  MediumSwing: 'Medium Swing',
  HardSwing: 'Hard Swing',
  Shuffle: 'Shuffle',
};

const jumpTexts: Record<NavigationJump, string> = {
  DaCapo: 'D.C.',
  DaCapoAlFine: 'D.C. al Fine',
  DaCapoAlCoda: 'D.C. al Coda',
  DalSegno: 'D.S.',
  DalSegnoAlFine: 'D.S. al Fine',
  DalSegnoAlCoda: 'D.S. al Coda',
  ToCoda: 'To Coda',
};

export const Annotations = {
  /**
   * The furniture one measure prints above the first staff: tempo and swing
   * words (joined on one line when both change at once — text width cannot
   * be measured, so stacking side by side is not an option yet), segno/coda
   * signs and Fine at the start, jump instructions right-aligned at the end,
   * and the repeat count over a closing repeat.
   */
  forMeasure(args: {
    context: MeasureContext;
    measure: Measure;
    /** Where the measure's music begins (after the signatures) */
    startX: number;
    width: number;
  }): LaidOutAnnotation[] {
    const { context, measure, startX, width } = args;
    const annotations: LaidOutAnnotation[] = [];

    const tempoParts: string[] = [];

    if (context.printTempo && context.tempo) tempoParts.push(tempoText(context.tempo));
    if (context.printSwing) tempoParts.push(swingTexts[context.swing]);

    if (tempoParts.length) {
      annotations.push({
        kind: 'text',
        text: tempoParts.join(', '),
        x: startX,
        y: tempoY,
        size: tempoSize,
        anchor: 'start',
        bold: true,
      });
    }

    let markX = startX;

    measure.marks?.forEach((mark) => {
      const glyph = Glyphs.forNavigationMark(mark);

      if (glyph) {
        annotations.push({ kind: 'glyph', glyph, x: markX, y: navigationY });
        markX += Glyphs.width(glyph) + 1;
      }

      if (mark === NavigationMark.Fine) {
        annotations.push({
          kind: 'text',
          text: 'Fine',
          x: width - 0.5,
          y: navigationY,
          size: textSize,
          anchor: 'end',
          italic: true,
          bold: true,
        });
      }
    });

    if (measure.jump) {
      annotations.push({
        kind: 'text',
        text: jumpTexts[measure.jump],
        x: width - 0.5,
        // A Fine mark already owns the right corner; sit the jump higher
        y: measure.marks?.includes(NavigationMark.Fine) ? navigationY - 2 : navigationY,
        size: textSize,
        anchor: 'end',
        italic: true,
      });
    }

    if (measure.repeatTimes !== undefined && measure.closing === ClosingBarline.RepeatClose) {
      annotations.push({
        kind: 'text',
        text: `×${measure.repeatTimes}`,
        x: width - 1,
        y: repeatTimesY,
        size: textSize,
        anchor: 'end',
      });
    }

    return annotations;
  },
};
