import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { EventFlattening } from './EventFlattening';
import { NavigationUnfolding } from './NavigationUnfolding';
import { TimeMapping, type NoteEvent } from './TimeMapping';

/**
 * The compiled performance: every sounded pitch placed in real time, in start
 * order, plus the total duration. Plain JSON — serializable, so it can back a
 * later MIDI/WAV export or a piano-roll view as readily as the audio driver.
 */
export type Performance = {
  events: readonly NoteEvent[];
  durationSeconds: number;
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
    const events = TimeMapping.toNoteEvents(beatEvents, tempoMap);

    return Result.ok({ events, durationSeconds: tempoMap.durationSeconds });
  },
};
