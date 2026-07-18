/**
 * Resolves once the Bravura music font is ready. SVG text glyphs render as
 * tofu until the font loads, so gate the first paint of any score on this
 * (noted as a potential problem in the rendering strategy).
 */
export async function loadMusicFont(): Promise<void> {
  await document.fonts.load('4px Bravura');
}
