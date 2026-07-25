# Corpus provenance

## `haydn-op76-no3.musicxml`

Joseph Haydn — String Quartet in C major, Hob. III:77, Op. 76 No. 3 ("Emperor").

| Field       | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Source      | OpenScore String Quartets, score `20428156` on MuseScore.com            |
| Set page    | https://musescore.com/user/37221589/sets/6403741                        |
| License     | **CC0** (stated in the file's own `<rights>` element)                   |
| Transcriber | mozbadel, from IMSLP https://imslp.org/wiki/Special:ReverseLookup/28079 |
| Format      | MusicXML **4.0**, `score-partwise`                                      |
| Downloaded  | 2026-07-25                                                              |
| Size        | 4,090,810 bytes                                                         |

OpenScore ask that public-facing use credit them:

> Score from **OpenScore String Quartets** — https://github.com/OpenScore/StringQuartets

### How this file was produced

MuseScore.com offers MusicXML as `.mxl` (compressed) only. The original download is kept
alongside as `haydn-op76-no3.mxl`; this file is its single root document, extracted once:

```sh
python3 -c "import zipfile; open('haydn-op76-no3.musicxml','wb').write(
    zipfile.ZipFile('haydn-op76-no3.mxl').read('score.xml'))"
```

The archive contains exactly two entries — `META-INF/container.xml` and `score.xml` — with the
container naming `score.xml` as the rootfile. Decompressing at ingest rather than at import time
is deliberate: it keeps the importer free of a zip dependency (see `haydn-project.md`, review
item 3).

`reference/haydn-op76-no3.pdf` is the matching 26-page engraving from the same source, used as
the visual comparison target.

## Structure

All four movements share **one file**, with no structural delimiter — they are marked only by
`<words>` text and `light-light` barlines.

**`measure/@number` is a display label, not an index.** Numbering restarts at each movement, and
15 measures carry non-numeric labels (`X1`–`X6`, all `implicit="yes"`), which repeat across
movements. Slice by **positional index** instead; the ranges below are 0-based and inclusive.

| Section              | Positional range | Measures |
| -------------------- | ---------------- | -------- |
| **I. Allegro**       | 0 – 127          | 128      |
| **II. Poco adagio**  | 128 – 236        | 109      |
| — Theme              | 128 – 148        | 21       |
| — Var. I             | 149 – 169        | 21       |
| — Var. II            | 170 – 190        | 21       |
| — Var. III           | 191 – 211        | 21       |
| — Var. IV            | 212 – 236        | 25       |
| **III. Menuetto**    | 237 – 340        | 104      |
| — Menuetto (to Fine) | 237 – 294        | 58       |
| — Trio (to D.C.)     | 295 – 340        | 46       |
| **IV. Finale**       | 341 – 530        | 190      |
| **Total**            | 0 – 530          | **531**  |

The smoke-test target is **movement II's theme, indices 128–148**.

Movement I carries `la seconda volta più presto` at its measure labelled 105 — a repeat-dependent
tempo change with no representation in our domain today.
