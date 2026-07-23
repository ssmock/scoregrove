import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Dynamics } from './Dynamics';
import { EventFlattening } from './EventFlattening';
import { NavigationUnfolding } from './NavigationUnfolding';
import { TimeMapping, type MeasureTime, type NoteEvent } from './TimeMapping';

/**
 * The compiled performance: every sounded pitch placed in real time, in start
 * order, the total duration, and where each measure first falls on the
 * timeline (for seeking to a bar or looping a passage). Plain JSON —
 * serializable, so it can back a later MIDI/WAV export or a piano-roll view as
 * readily as the audio driver.
 */
export type Performance = {
  events: readonly NoteEvent[];
  durationSeconds: number;
  /** First-occurrence real-time span per measure index (holes only for measures never played) */
  measureTimes: readonly MeasureTime[];
};

export const Compiler = {
  /**
   * Compiles a score into a `Performance`, composing the pure stages:
   * unfold the navigation into a play order, flatten it into beat events, and
   * map those onto seconds through the tempo map. Refuses an invalid score up
   * front — no sound comes from a structurally broken score, the same rule
   * engraving follows.
   */
  compile(score: Score): Result<Performance> {
    const checked = Score.check(score);

    if (!Result.isOk(checked)) return Result.mapError(checked);

    const playOrder = NavigationUnfolding.unfold(score);
    const beatEvents = EventFlattening.flatten(score, playOrder);
    const tempoMap = TimeMapping.build(score, playOrder);
    const velocities = Dynamics.velocities(score);
    const events = TimeMapping.toNoteEvents(beatEvents, tempoMap, velocities);
    const measureTimes = TimeMapping.measureTimes(playOrder, tempoMap);

    return Result.ok({ events, durationSeconds: tempoMap.durationSeconds, measureTimes });
  },
};
