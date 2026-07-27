import { Glyphs } from './Glyphs';
import type { LaidOutElement, LaidOutGlyph, LaidOutMeasure, LaidOutSystem } from './LayoutTree';
import { StaffPosition } from './StaffPosition';

/**
 * Properties any correct engraving must have, whatever its house style.
 *
 * The strategy's argument for these over snapshots: a layout snapshot of 500
 * measures changes on every spacing tweak and teaches nothing, while these
 * survive refactoring because they are objectively true or false rather than
 * matters of taste. Two engravers may disagree about how wide a bar should be;
 * neither of them lets a dynamic sit on top of a notehead.
 *
 * Each violation names where it is, because a bare count over 531 measures is
 * not something anyone can act on.
 */

export type Violation = {
  invariant: string;
  /** Where, in terms a reader can find on the page */
  where: string;
  detail: string;
};

/** A rectangle in one staff's coordinates */
type Box = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const glyphBox = (glyph: LaidOutGlyph): Box => {
  const data = Glyphs.data(glyph.glyph);

  return {
    left: glyph.x + data.bBoxSW[0],
    right: glyph.x + data.bBoxNE[0],
    top: glyph.y - data.bBoxNE[1],
    bottom: glyph.y - data.bBoxSW[1],
  };
};

/** The noteheads, accidentals and rests of one measure, as boxes */
const noteBoxes = (measure: LaidOutMeasure): { box: Box; what: string }[] =>
  measure.elements.flatMap((element): { box: Box; what: string }[] => {
    if (element.kind === 'dynamic') return [];

    if (element.kind === 'rest') {
      return [
        { box: glyphBox({ glyph: element.glyph, x: element.x, y: element.y }), what: 'rest' },
      ];
    }

    if (element.kind === 'note') {
      return [
        {
          box: glyphBox({
            glyph: element.notehead,
            x: element.x,
            y: StaffPosition.y(element.position),
          }),
          what: 'notehead',
        },
        ...(element.accidental ? [{ box: glyphBox(element.accidental), what: 'accidental' }] : []),
      ];
    }

    return element.tones.flatMap((tone) => [
      {
        box: glyphBox({ glyph: element.notehead, x: tone.x, y: StaffPosition.y(tone.position) }),
        what: 'notehead',
      },
      ...(tone.accidental ? [{ box: glyphBox(tone.accidental), what: 'accidental' }] : []),
    ]);
  });

const dynamicBoxes = (measure: LaidOutMeasure): { box: Box; glyph: string }[] =>
  measure.elements.flatMap((element) =>
    element.kind === 'dynamic'
      ? [
          {
            box: glyphBox({ glyph: element.glyph, x: element.x, y: element.y }),
            glyph: element.glyph,
          },
        ]
      : [],
  );

const elementX = (element: LaidOutElement): number[] => {
  if (element.kind === 'chord') return element.tones.map((tone) => tone.x);

  return [element.x];
};

export const Invariants = {
  /**
   * Every system fits the width it was justified to. A system that overflows
   * is not a taste question: it runs off the page.
   */
  systemsFitWidth(systems: readonly LaidOutSystem[], width: number): Violation[] {
    // Justification works to a tolerance, so a hair over is not a defect
    const tolerance = 0.5;

    return systems.flatMap((system, index) =>
      system.width > width + tolerance
        ? [
            {
              invariant: 'systems fit the page width',
              where: `system ${index}`,
              detail: `${system.width.toFixed(2)} wide against a target of ${width}`,
            },
          ]
        : [],
    );
  },

  /**
   * No element is drawn outside the measure that holds it. Catches a spacing
   * bug that would otherwise only show as notes creeping across a barline.
   */
  elementsWithinMeasures(systems: readonly LaidOutSystem[]): Violation[] {
    const violations: Violation[] = [];

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((measure, staff) => {
          for (const element of measure.elements) {
            for (const x of elementX(element)) {
              if (x < -0.01 || x > measure.width + 0.01) {
                violations.push({
                  invariant: 'no element escapes its measure',
                  where: `system ${systemIndex}, measure ${entry.index}, staff ${staff + 1}`,
                  detail: `a ${element.kind} sits at x=${x.toFixed(2)} in a measure ${measure.width.toFixed(2)} wide`,
                });
              }
            }
          }
        });
      });
    });

    return violations;
  },

  /**
   * A dynamic does not collide with the notes it belongs to.
   *
   * Deliberately narrower than "no glyph overlaps another". Plenty of overlaps
   * are correct — a chord's offset second, an accidental tucked under a slur —
   * so a blanket rule would report mostly noise. A dynamic sits in its own
   * band below the staff and has nothing to be tangled with, which makes this
   * one unambiguous, and it is the collision the rendered corpus actually
   * shows.
   */
  dynamicsClearOfNotes(systems: readonly LaidOutSystem[]): Violation[] {
    const violations: Violation[] = [];

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((measure, staff) => {
          const notes = noteBoxes(measure);

          for (const dynamic of dynamicBoxes(measure)) {
            const hit = notes.find((note) => overlaps(dynamic.box, note.box));

            if (hit) {
              violations.push({
                invariant: 'a dynamic clears the notes on its staff',
                where: `system ${systemIndex}, measure ${entry.index}, staff ${staff + 1}`,
                detail: `${dynamic.glyph} overlaps a ${hit.what}`,
              });
            }
          }
        });
      });
    });

    return violations;
  },

  /**
   * Every note under one beam points the same way. A beam group with mixed
   * stem directions is not a style choice; it cannot be drawn.
   */
  beamGroupsAgreeOnDirection(systems: readonly LaidOutSystem[]): Violation[] {
    const violations: Violation[] = [];

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((measure, staff) => {
          for (const beam of measure.beams) {
            // Filtering by voice as well as position is what makes this
            // meaningful: two voices on one staff overlap in x, and their
            // stems point opposite ways precisely because they should.
            const under = measure.elements.filter(
              (element) =>
                (element.kind === 'note' || element.kind === 'chord') &&
                element.address.voice === beam.voice &&
                element.stem &&
                element.stem.x >= Math.min(beam.x1, beam.x2) - 0.01 &&
                element.stem.x <= Math.max(beam.x1, beam.x2) + 0.01,
            );

            const directions = new Set(
              under.flatMap((element) =>
                element.kind === 'note' || element.kind === 'chord'
                  ? [element.stem?.direction]
                  : [],
              ),
            );

            if (directions.size > 1) {
              violations.push({
                invariant: 'a beam group agrees on stem direction',
                where: `system ${systemIndex}, measure ${entry.index}, staff ${staff + 1}`,
                detail: `stems under one beam point ${[...directions].join(' and ')}`,
              });
            }
          }
        });
      });
    });

    return violations;
  },

  /** Every invariant, run together */
  all(systems: readonly LaidOutSystem[], width: number): Violation[] {
    return [
      ...Invariants.systemsFitWidth(systems, width),
      ...Invariants.elementsWithinMeasures(systems),
      ...Invariants.dynamicsClearOfNotes(systems),
      ...Invariants.beamGroupsAgreeOnDirection(systems),
    ];
  },
};
