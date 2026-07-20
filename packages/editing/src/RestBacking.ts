import type { Clef } from '@scoregrove/domain/Clef';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Rest, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { DurationDecomposition } from './DurationDecomposition';

/**
 * Builds and rebuilds the rest-backed content the editor treats as "empty":
 * every measure a user hasn't touched, or has cleared, holds whole rests
 * that exactly fill the time signature's capacity, so the score is always
 * structurally complete and `Score.check` never sees an underfull measure.
 */
export const RestBacking = {
  /**
   * The rests that exactly fill one measure of the given time signature, in
   * score order.
   */
  wholeMeasureRests(time: TimeSignature): NonEmptyArray<MeasureElement> {
    const durations = DurationDecomposition.decompose(TimeSignature.capacity(time));

    return NonEmptyArray.of(durations.map((duration) => Rest.of(duration)));
  },

  /**
   * One staff's rest-backed content for a fresh or reset measure, under the
   * given clef (a staff's starting clef, or a mid-measure change).
   */
  emptyStaffContent(time: TimeSignature, clef?: Clef): StaffContent {
    return StaffContent.singleVoice(RestBacking.wholeMeasureRests(time), clef);
  },

  /**
   * A fresh rest-backed measure: one whole-rest-filled StaffContent per
   * staff, each under that staff's own clef. Carries no key/time/tempo
   * change, barlines, or navigation of its own — callers merge those in
   * separately when a specific measure needs them.
   */
  emptyMeasure(time: TimeSignature, staves: readonly Staff[]): Measure {
    return {
      contents: NonEmptyArray.of(
        staves.map((staff) => RestBacking.emptyStaffContent(time, staff.clef)),
      ),
    };
  },
};
