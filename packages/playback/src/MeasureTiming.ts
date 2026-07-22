import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import type { Measure } from '@scoregrove/domain/Measure';

/**
 * The sounded length of a measure's content, as an exact `Fraction` of a whole
 * note: the longest voice's summed durations. A full bar equals its time
 * signature's capacity; an underfull pickup is shorter, so time advances by
 * what actually sounds rather than a padded full bar. Dynamics take no time.
 *
 * Both the event stage (placing onsets) and the time map (measuring each
 * measure's span) must advance by exactly this, or an event's beat position
 * would not line up with its measure's tempo segment — so it lives here, once.
 */
export const measureContentLength = (measure: Measure): Fraction => {
  let longest = Fraction.zero();

  for (const content of measure.contents) {
    for (const voice of content.voices) {
      let sum = Fraction.zero();

      for (const element of voice.elements) {
        if (element.kind === 'dynamic') continue;

        sum = Fraction.add(sum, Duration.fractionOfWhole(element.duration));
      }

      if (Fraction.compare(sum, longest) > 0) longest = sum;
    }
  }

  return longest;
};
