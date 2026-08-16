import { createInstance } from './loadWasm.ts';

/** Where surge is told to write: a device of the module's own file system. */
const OUTPUT_PATH = '/surge.out';

/** A major number no emscripten device uses. */
const DEVICE_MAJOR = 64;

/** Why a run came to its end. */
export type RunEnd = 'complete' | 'timeout' | 'stopped';

/** Watching a run as it goes, and being able to end it. */
export interface RunWatcher {
  /**
   * Called every `batchSize` structures with the ones written since the last
   * call and the number written so far. Returning `false` ends the run.
   */
  onBatch?: (batch: string[], total: number) => boolean | void;
  /** How many structures pass between two calls. */
  batchSize: number;
  /** Stop the run after this long, keeping what was written. */
  timeoutMs?: number;
}

/** What one run of surge produced. */
export interface RawRun {
  /** One SMILES per structure, empty when surge was only counting. */
  smiles: string[];
  /** What surge wrote to stderr, its summary line included. */
  log: string;
  /** Whether surge enumerated everything, and if not what ended it. */
  ended: RunEnd;
  /** What surge exited with: anything but 0 means it refused to run. */
  status: number;
  /** How long `main` took, in milliseconds. */
  durationMs: number;
}

/** Thrown out of the output device to bring a run to its end. */
class Ended extends Error {}

/**
 * Run surge once, in the calling thread.
 *
 * Surge writes to a device rather than to its standard output, which is what
 * makes watching a run nearly free: C buffers what it writes to a file, so
 * the structures arrive in chunks of about a kilobyte instead of one call
 * each. Every chunk is a moment the run can be ended on.
 * @param flags - The command line, the formula last.
 * @param watcher - What follows the run, and what may end it.
 * @returns What surge wrote, and how the run ended.
 */
export async function runSurge(
  flags: string[],
  watcher: RunWatcher,
): Promise<RawRun> {
  const log: string[] = [];
  const smiles: string[] = [];
  const pending: string[] = [];
  const decoder = new TextDecoder();
  let partial = '';
  let announced = 0;
  let status = 0;
  let ended: RunEnd = 'complete';
  let deadline = Number.POSITIVE_INFINITY;

  const instance = await createInstance({
    print: () => {
      // Surge writes its structures to the device, and nothing to stdout.
    },
    printErr: (line: string) => log.push(line),
    onExit: (code: number) => {
      status = code;
    },
  });

  const { FS } = instance;
  const device = FS.makedev(DEVICE_MAJOR, 0);
  FS.registerDevice(device, {
    open: () => undefined,
    close: () => undefined,
    write: (
      _stream: unknown,
      buffer: Uint8Array,
      offset: number,
      length: number,
    ) => {
      if (performance.now() >= deadline) {
        ended = 'timeout';
        throw new Ended();
      }
      const text = decoder.decode(buffer.subarray(offset, offset + length), {
        stream: true,
      });
      const lines = (partial + text).split('\n');
      // What follows the last newline is the beginning of the next structure.
      partial = lines.pop() ?? '';
      for (const line of lines) pending.push(line);
      if (flush(false) === false) {
        ended = 'stopped';
        throw new Ended();
      }
      return length;
    },
  });
  FS.mkdev(OUTPUT_PATH, device);

  const start = performance.now();
  if (watcher.timeoutMs !== undefined) deadline = start + watcher.timeoutMs;
  try {
    instance.callMain([`-o${OUTPUT_PATH}`, ...flags]);
  } catch (error) {
    if (!(error instanceof Ended)) throw error;
  }
  const durationMs = performance.now() - start;

  if (ended === 'complete') {
    // The last batch is short of `batchSize` and is handed over all the same,
    // so a caller counting batches ends on the number this returns.
    flush(true);
  } else {
    // What is returned is exactly what was announced, so a caller may
    // accumulate the batches instead of reading `smiles`.
    pending.length = 0;
  }

  return { smiles, log: log.join('\n'), ended, status, durationMs };

  /**
   * Hand over whole batches, and the remainder too when the run is over.
   * @param last - Whether what is left is the end of the enumeration.
   * @returns `false` as soon as the caller asks for the run to end.
   */
  function flush(last: boolean): boolean | void {
    const least = last ? 1 : watcher.batchSize;
    while (pending.length >= least) {
      const batch = pending.splice(
        0,
        Math.min(watcher.batchSize, pending.length),
      );
      for (const line of batch) smiles.push(line);
      announced += batch.length;
      if (watcher.onBatch?.(batch, announced) === false) return false;
    }
  }
}
