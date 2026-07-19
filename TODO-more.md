# More Elements

## Unpitched Elements

1. Domain (the real gap): an unpitched element kind — e.g. UnpitchedNote { duration, line?/instrument?, noteheadStyle? } — or a notehead-style/percussion-map concept on Note; plus Clef.Percussion and possibly a staff line-count on Staff. This is the same category of gap as "no staff grouping," which the strategy doc already flags as a known domain limitation — this one isn't listed there yet.
2. Engraving: staff position by instrument assignment rather than pitch; glyph mapping for the new heads. Bravura/SMuFL has everything needed (unpitchedPercussionClef1, noteheadSlashHorizontalEnds, noteheadXBlack, etc.) — they'd just need adding to the extraction list in generate-bravura.mjs and rerunning pnpm --filter @scoregrove/engraving generate.
3. Rendering: nearly free — GlyphView is generic, and layout already tells components exactly which glyph to draw.

So: representable today only by abusing pitched notes on a normal staff. If drum/strum notation matters to you, it's worth adding to the "Major assumptions" list in rendering-strategy.md as a called-out domain gap so it gets designed deliberately rather than bolted on.

## Chord Names

## Remarks

Just a starting bar; wrap text to the end of line or the start of the next remark.
