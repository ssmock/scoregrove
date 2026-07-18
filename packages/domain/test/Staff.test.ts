import { describe, expect, it } from 'vitest';
import { Clef } from '../src/Clef';
import { NonEmptyString } from '../src/NonEmptyString';
import { Staff } from '../src/Staff';

describe('Staff', () => {
  it('omits an absent label', () => {
    expect(Staff.of(Clef.Treble)).toEqual({ clef: 'Treble' });
  });

  it('carries a label when given', () => {
    expect(Staff.of(Clef.Bass, NonEmptyString.of('Piano LH'))).toEqual({
      clef: 'Bass',
      label: 'Piano LH',
    });
  });
});
