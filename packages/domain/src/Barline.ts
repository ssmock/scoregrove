import { vocabulary } from './Vocabulary';

const openingMembers = {
  RepeatOpen: 'RepeatOpen',
} as const;

/**
 * A special barline at the start of a measure. An absent opening barline is
 * the ordinary case; RepeatOpen begins a repeated passage.
 */
export type OpeningBarline = (typeof openingMembers)[keyof typeof openingMembers];

export const OpeningBarline = {
  ...openingMembers,
  ...vocabulary<OpeningBarline>(openingMembers),
};

const closingMembers = {
  Regular: 'Regular',
  Double: 'Double',
  Final: 'Final',
  RepeatClose: 'RepeatClose',
} as const;

/**
 * The barline at the end of a measure. An absent closing barline means
 * Regular; Double marks a section boundary; Final ends the piece; RepeatClose
 * ends a repeated passage (jumping back to the matching RepeatOpen, or to the
 * beginning of the score when none precedes it).
 */
export type ClosingBarline = (typeof closingMembers)[keyof typeof closingMembers];

export const ClosingBarline = {
  ...closingMembers,
  ...vocabulary<ClosingBarline>(closingMembers),
};
