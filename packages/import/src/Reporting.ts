/**
 * The importer's warning channel.
 *
 * `Result` carries *errors* — reasons a file cannot be read at all. Most of
 * what an importer needs to say is neither that nor silence: a key with no
 * declared mode, a clef change we can only approximate, two parts disagreeing
 * about a time signature. Losing those would break the project's one
 * inviolable rule — never drop something silently — so readers take a `Warn`
 * and say so, and the import still produces a score.
 *
 * A plain callback rather than a wrapper type keeps every reader's signature
 * `Result<T>`, and makes them trivial to test by passing a pushing function.
 */
export type Warn = (message: string) => void;

/** A `Warn` plus the messages it has collected, in the order they were raised */
export type WarningCollector = {
  warn: Warn;
  messages: readonly string[];
};

export const Reporting = {
  collector(): WarningCollector {
    const messages: string[] = [];

    return {
      warn: (message) => void messages.push(message),
      messages,
    };
  },

  /** A `Warn` that discards — for call sites that genuinely do not care */
  ignore: (() => {}) as Warn,
};
