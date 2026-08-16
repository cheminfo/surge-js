/** What surge was asked when it refused. */
export interface SurgeErrorDetails {
  /** The formula the run was for. */
  formula: string;
  /** Everything surge wrote to stderr. */
  log: string;
}

/**
 * Surge refused to enumerate: an impossible parity, an element it does not
 * know, a restriction it cannot honour.
 */
export class SurgeError extends Error {
  override readonly name = 'SurgeError';

  /** The formula the run was for. */
  readonly formula: string;

  /** Everything surge wrote to stderr. */
  readonly log: string;

  /**
   * Build the error from what surge wrote.
   * @param message - What surge said, without its `>E surge :` prefix.
   * @param details - The formula and the whole stderr of the run.
   */
  constructor(message: string, details: SurgeErrorDetails) {
    super(message);
    this.formula = details.formula;
    this.log = details.log;
  }
}
