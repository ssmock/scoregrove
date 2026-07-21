import type { Measure } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { RestBacking } from './RestBacking';

export const MeasureOps = {
  /**
   * Appends one rest-backed measure at the end, continuing the piece's
   * currently effective time signature — the same effective-context walk
   * `StaffOps.addStaff` and `Placement.eraseBar` use, since a measure's own
   * `time` field may not carry the change directly if the last one was
   * earlier in the piece. Carries no clef, key/time/tempo change, barline,
   * or navigation of its own: an explicit `StaffContent.clef` means "a
   * change happens here," so a measure that isn't changing anything, this
   * one included, must leave it unset and let `ContextWalk` carry the
   * previous effective clef forward implicitly — the same reasoning
   * `RestBacking.emptyMeasure` already documents for key/time/tempo.
   */
  addMeasure(score: Score): Score {
    const contexts = ContextWalk.walk(score);
    const time = contexts[contexts.length - 1][0].time;

    const newMeasure: Measure = {
      contents: NonEmptyArray.of(score.staves.map(() => RestBacking.emptyStaffContent(time))),
    };

    return {
      ...score,
      measures: NonEmptyArray.of([...score.measures, newMeasure]),
    };
  },

  /**
   * Removes the last measure. Refuses to leave the score with none, and
   * refuses if the last measure carries a tied or slurred note or chord
   * tone: either would strand its matching role in what's now the new last
   * measure, the same reason `Placement.erase`/`eraseBar` refuse those.
   */
  removeLastMeasure(score: Score): Result<Score> {
    if (score.measures.length <= 1) {
      return Result.invalid('A score must keep at least one measure');
    }

    const lastMeasure = score.measures[score.measures.length - 1];

    for (const content of lastMeasure.contents) {
      for (const voice of content.voices) {
        for (const element of voice.elements) {
          if (element.kind === 'note' && (element.tie || element.slur)) {
            return Result.invalid(
              'The last measure has a tied or slurred note; removing it is not supported yet',
            );
          }

          if (
            element.kind === 'chord' &&
            (element.slur || element.tones.some((tone) => tone.tie))
          ) {
            return Result.invalid(
              'The last measure has a tied or slurred chord; removing it is not supported yet',
            );
          }
        }
      }
    }

    return Result.ok({
      ...score,
      measures: NonEmptyArray.of(score.measures.slice(0, -1)),
    });
  },
};
