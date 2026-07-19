import { describe, expect, it } from 'vitest';
import { Fixtures } from '../src/Fixtures';
import { LineBreaking } from '../src/LineBreaking';
import { ScoreLayout } from '../src/ScoreLayout';
import { SystemLayout } from '../src/SystemLayout';

const melody = Fixtures.monophonicMelody();

describe('LineBreaking.breakIntoSystems', () => {
  it('keeps everything on one ragged system when the width allows', () => {
    const unbroken = SystemLayout.unbroken(melody);
    const systems = LineBreaking.breakIntoSystems(melody, { width: unbroken.width + 10 });

    expect(systems).toHaveLength(1);
    expect(systems[0].measures).toHaveLength(4);
    expect(systems[0].width).toBeCloseTo(unbroken.width);
  });

  it('fills greedily and justifies every system but the last', () => {
    const unbroken = SystemLayout.unbroken(melody);
    const target = unbroken.width * 0.55;
    const systems = LineBreaking.breakIntoSystems(melody, { width: target });

    expect(systems.length).toBeGreaterThan(1);

    systems.slice(0, -1).forEach((system) => {
      expect(system.width).toBeCloseTo(target, 1);
    });

    expect(systems.at(-1)!.width).toBeLessThan(target);
  });

  it('accounts for every measure exactly once, in order', () => {
    const systems = LineBreaking.breakIntoSystems(melody, { width: 40 });
    const indices = systems.flatMap((system) =>
      system.measures.flatMap((entry) => entry.staves[0].elements.map((e) => e.address.measure)),
    );

    expect(new Set(indices)).toEqual(new Set([0, 1, 2, 3]));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('reprints clef and key at the start of later systems, but not time', () => {
    const systems = LineBreaking.breakIntoSystems(melody, { width: 40 });

    expect(systems.length).toBeGreaterThan(1);

    systems.slice(1).forEach((system) => {
      const glyphs = system.measures[0].staves[0].signatures.map((laid) => laid.glyph);

      expect(glyphs).toContain('gClef');
      expect(glyphs).toContain('accidentalSharp');
      expect(glyphs).not.toContain('timeSig4');
    });
  });

  it('stretches spacing under justification without moving signatures', () => {
    const unbroken = SystemLayout.unbroken(melody);
    const target = unbroken.width * 0.55;
    const justified = LineBreaking.breakIntoSystems(melody, { width: target })[0];
    const natural = SystemLayout.unbroken(melody).measures[0].staves[0];
    const stretched = justified.measures[0].staves[0];

    expect(stretched.signatures).toEqual(natural.signatures);
    expect(stretched.width).toBeGreaterThan(natural.width);
  });

  it('gives an over-wide measure its own overflowing system', () => {
    const systems = LineBreaking.breakIntoSystems(melody, { width: 10 });

    systems.forEach((system) => expect(system.measures).toHaveLength(1));
    expect(systems).toHaveLength(4);
    systems.slice(0, -1).forEach((system) => expect(system.width).toBeGreaterThan(10));
  });
});

describe('ScoreLayout.layout', () => {
  it('carries the header text and target width with the systems', () => {
    const laid = ScoreLayout.layout(melody, { width: 60 });

    expect(laid.title).toBe('Study in G');
    expect(laid.composer).toBe('Scoregrove');
    expect(laid.width).toBe(60);
    expect(laid.systems.length).toBeGreaterThan(0);
  });
});
