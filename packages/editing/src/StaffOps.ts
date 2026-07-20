import type { Clef } from '@scoregrove/domain/Clef';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { RestBacking } from './RestBacking';

export const StaffOps = {
  /**
   * Adds a new staff at the end, back-filled with rests in every existing
   * measure so the score stays structurally complete. Each measure's
   * back-fill uses the time signature actually in force there (which the
   * measure's own `time` field may not carry directly, if the last change
   * was earlier in the piece) — the same effective-context walk the
   * renderer uses, since time signature changes are score-wide and so the
   * same for every staff.
   */
  addStaff(score: Score, clef: Clef, label?: NonEmptyString): Score {
    const contexts = ContextWalk.walk(score);

    return {
      ...score,
      staves: NonEmptyArray.of([...score.staves, Staff.of(clef, label)]),
      measures: NonEmptyArray.of(
        score.measures.map((measure, measureIndex) => ({
          ...measure,
          contents: NonEmptyArray.of([
            ...measure.contents,
            RestBacking.emptyStaffContent(contexts[measureIndex][0].time, clef),
          ]),
        })),
      ),
    };
  },

  /**
   * Removes a staff and its content from every measure. Refuses to drop the
   * score's last staff.
   */
  removeStaff(score: Score, staffIndex: number): Result<Score> {
    if (!score.staves[staffIndex]) return Result.invalid(`No staff at index ${staffIndex}`);

    if (score.staves.length <= 1) {
      return Result.invalid('A score must keep at least one staff');
    }

    return Result.ok({
      ...score,
      staves: NonEmptyArray.of(score.staves.filter((_staff, index) => index !== staffIndex)),
      measures: NonEmptyArray.of(
        score.measures.map((measure) => ({
          ...measure,
          contents: NonEmptyArray.of(
            measure.contents.filter((_content, index) => index !== staffIndex),
          ),
        })),
      ),
    });
  },

  /**
   * Replaces a staff's starting clef and label wholesale — the staff-setup
   * dialog's row always shows both together, so there's no ambiguity to
   * resolve between "unchanged" and "explicitly cleared." Existing music
   * is untouched: a note's stored pitch never depends on which clef its
   * staff starts with, only its rendered position does.
   */
  updateStaff(score: Score, staffIndex: number, clef: Clef, label?: NonEmptyString): Result<Score> {
    if (!score.staves[staffIndex]) return Result.invalid(`No staff at index ${staffIndex}`);

    const staff = Staff.of(clef, label);

    return Result.ok({
      ...score,
      staves: NonEmptyArray.of(
        score.staves.map((existing, index) => (index === staffIndex ? staff : existing)),
      ),
    });
  },
};
