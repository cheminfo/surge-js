import { SurgeError } from './SurgeError.ts';
import { buildFlags } from './buildFlags.ts';
import type { SurgeOptions } from './options.ts';
import { parseLog } from './parseLog.ts';
import type { RunEnd } from './wasm/runSurge.ts';
import { runSurge } from './wasm/runSurge.ts';

/** How many structures pass between two calls of `onBatch` by default. */
const DEFAULT_BATCH_SIZE = 1000;

/** What to enumerate, and how far to go. */
export interface GenerateOptions extends SurgeOptions {
  /**
   * Called as the structures come, with the ones written since the last call
   * and the number written so far. **Returning `false` ends the run**, which
   * is how a page shows what is being generated and lets somebody stop it.
   * @default undefined
   */
  onBatch?: (batch: string[], total: number) => boolean | void;

  /**
   * How many structures pass between two calls of `onBatch`. Watching a run
   * costs a call per structure rather than one string for the whole of it, so
   * a small batch on a large formula is paid for.
   * @default 1000
   */
  batchSize?: number;

  /**
   * Stop after this many milliseconds, keeping the structures enumerated so
   * far.
   * @default undefined
   */
  timeoutMs?: number;
}

/** The structures of a formula. */
export interface GenerateResult {
  /** One SMILES per structure, in the order surge enumerates them. */
  smiles: string[];
  /**
   * Whether surge enumerated everything (`complete`), or what ended the run
   * early: its deadline (`timeout`) or `onBatch` returning `false`
   * (`stopped`).
   */
  ended: RunEnd;
  /** What surge wrote to stderr, its summary line included. */
  log: string;
  /** How long the enumeration took, in milliseconds. */
  durationMs: number;
}

/**
 * Enumerate the constitutional isomers of a molecular formula, as SMILES.
 *
 * The enumeration is a synchronous loop, so a browser should call this inside
 * a worker. How long a formula takes is not something its size tells you:
 * give a `timeoutMs`, or an `onBatch` that follows the count and ends the run
 * once it has seen enough.
 * @param formula - Molecular formula, like `C4H10O`.
 * @param options - What to enumerate, and how far to go.
 * @returns The structures surge wrote, and how the run ended.
 */
export async function generate(
  formula: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const run = await runSurge(
    buildFlags(formula, { ...options, smiles: true }),
    {
      onBatch: options.onBatch,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      timeoutMs: options.timeoutMs,
    },
  );

  // A run we ended ourselves stops on the output error we caused, which is
  // not something to report to the caller.
  const complete = run.ended === 'complete';
  const { error } = parseLog(complete ? run.log : '');
  if (error !== null || (run.status !== 0 && complete)) {
    throw new SurgeError(error ?? `surge exited with status ${run.status}`, {
      formula,
      log: run.log,
    });
  }

  return {
    smiles: run.smiles,
    ended: run.ended,
    log: run.log,
    durationMs: run.durationMs,
  };
}
