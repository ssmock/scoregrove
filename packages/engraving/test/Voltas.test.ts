import { describe, expect, it } from 'vitest';
import { Fixtures } from '../src/Fixtures';
import { LineBreaking } from '../src/LineBreaking';
import { SystemLayout } from '../src/SystemLayout';

const piece = Fixtures.repeatsAndNavigation();

describe('Voltas', () => {
  it('brackets the two endings of the repeats fixture', () => {
    const system = SystemLayout.unbroken(piece);

    expect(system.voltas).toHaveLength(2);

    const [first, second] = system.voltas;

    expect(first.label).toBe('1.');
    expect(first.hookStart).toBe(true);
    // The first ending closes with a repeat: hooked shut
    expect(first.hookEnd).toBe(true);

    expect(second.label).toBe('2.');
    // The final passage runs on open-ended
    expect(second.hookEnd).toBe(false);

    // Each bracket spans its own measure, in order
    expect(first.x1).toBeCloseTo(system.measures[1].x);
    expect(first.x2).toBeCloseTo(system.measures[1].x + system.measures[1].staves[0].width);
    expect(second.x1).toBeGreaterThanOrEqual(first.x2);
  });

  it('keeps brackets with their measures across line breaks', () => {
    const systems = LineBreaking.breakIntoSystems(piece, { width: 12 });
    const withVoltas = systems.filter((system) => system.voltas.length > 0);

    expect(withVoltas.length).toBeGreaterThanOrEqual(2);
    withVoltas.forEach((system) =>
      system.voltas.forEach((volta) => expect(volta.x2).toBeGreaterThan(volta.x1)),
    );
  });
});
