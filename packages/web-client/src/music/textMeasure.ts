import {
  approximateTextMeasurer,
  type TextMeasurer,
  type TextStyle,
} from '@scoregrove/engraving/TextMeasure';

/** Must match the .music-text font stack in smufl.css */
const fontFamily = "Georgia, 'Times New Roman', serif";

/** Measured at a comfortable pixel size, scaled back to staff spaces */
const probeSize = 32;

/**
 * The real text measurer the strategy calls for: an offscreen canvas
 * measuring in the score's text face, injected into the pipeline so layout
 * itself stays DOM-free. Falls back to the approximation when the canvas is
 * unavailable.
 */
export function canvasTextMeasurer(): TextMeasurer {
  const context = document.createElement('canvas').getContext('2d');

  if (!context) return approximateTextMeasurer;

  return (text: string, style: TextStyle): number => {
    const italic = style.italic ? 'italic ' : '';
    const bold = style.bold ? 'bold ' : '';

    context.font = `${italic}${bold}${probeSize}px ${fontFamily}`;

    return (context.measureText(text).width / probeSize) * style.size;
  };
}
