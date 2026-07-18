import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Fixtures } from '../src/Fixtures';
import { SystemLayout } from '../src/SystemLayout';

describe('Fixtures', () => {
  it.each([
    ['monophonicMelody', Fixtures.monophonicMelody],
    ['twoStaffMultiVoice', Fixtures.twoStaffMultiVoice],
    ['repeatsAndNavigation', Fixtures.repeatsAndNavigation],
  ])('%s passes Score.check', (_name, build) => {
    const result = Score.check(build());

    if (Result.isError(result)) {
      expect.fail(result.error.messages.join('; '));
    }
  });
});

describe('SystemLayout.singleStaff', () => {
  it('lays the melody out measure after measure', () => {
    const system = SystemLayout.singleStaff(Fixtures.monophonicMelody());

    expect(system.measures).toHaveLength(4);
    expect(system.measures[0].x).toBe(0);

    system.measures.slice(1).forEach((entry, index) => {
      const previous = system.measures[index];

      expect(entry.x).toBeCloseTo(previous.x + previous.measure.width);
    });

    expect(system.width).toBeCloseTo(
      system.measures.reduce((sum, entry) => sum + entry.measure.width, 0),
    );
  });
});
