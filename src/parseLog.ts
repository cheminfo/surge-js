/** What surge said about a run, on stderr. */
export interface SurgeLog {
  /**
   * How many structures surge reports having enumerated, or `null` when it
   * did not get as far as saying so.
   */
  generated: number | null;
  /** The reason surge refused to run, or `null` when it ran. */
  error: string | null;
}

/** `>Z wrote 4232 -> 15835 -> 69669 in 0.02 sec`, the last count being ours. */
const SUMMARY = /^>Z (?:wrote|generated) (?<counts>[\d\s>-]+?) in /m;

/** `>E surge : impossible parity` */
const ERROR = /^>E [^:]*:\s*(?<message>.*)$/m;

/**
 * Read the counts and the error message off what surge wrote to stderr.
 * @param log - Everything surge wrote to stderr.
 * @returns What could be read from it.
 */
export function parseLog(log: string): SurgeLog {
  return { generated: readGenerated(log), error: readError(log) };
}

function readGenerated(log: string): number | null {
  const counts = SUMMARY.exec(log)?.groups?.counts;
  if (counts === undefined) return null;
  const last = counts.split('->').at(-1)?.trim();
  if (last === undefined || !/^\d+$/.test(last)) return null;
  return Number(last);
}

function readError(log: string): string | null {
  return ERROR.exec(log)?.groups?.message?.trim() ?? null;
}
