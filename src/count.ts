import { SurgeError } from './SurgeError.ts';
import { buildFlags } from './buildFlags.ts';
import type { SurgeOptions } from './options.ts';
import { parseLog } from './parseLog.ts';
import { runSurge } from './wasm/runSurge.ts';

/** How many isomers a formula has. */
export interface CountResult {
  /** How many structures surge enumerated. */
  count: number;
  /** What surge wrote to stderr, its summary line included. */
  log: string;
  /** How long the enumeration took, in milliseconds. */
  durationMs: number;
}

/**
 * Count the constitutional isomers of a molecular formula without writing
 * them. Surge still enumerates every structure, so this costs the same time
 * as `generate` minus the writing — it is not a shortcut for a formula too
 * large to enumerate.
 * @param formula - Molecular formula, like `C4H10O`.
 * @param options - What to enumerate.
 * @returns How many there are.
 */
export async function count(
  formula: string,
  options: SurgeOptions = {},
): Promise<CountResult> {
  // Counting writes no structure at all, so nothing is ever batched.
  const run = await runSurge(buildFlags(formula, options), {
    batchSize: Number.POSITIVE_INFINITY,
  });
  const { error, generated } = parseLog(run.log);

  if (error !== null || run.status !== 0) {
    throw new SurgeError(error ?? `surge exited with status ${run.status}`, {
      formula,
      log: run.log,
    });
  }
  if (generated === null) {
    throw new SurgeError('surge did not report how many it generated', {
      formula,
      log: run.log,
    });
  }

  return { count: generated, log: run.log, durationMs: run.durationMs };
}
