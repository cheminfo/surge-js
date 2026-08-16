import { expect, test } from '@playwright/test';

import type * as SurgeWasm from '../src/index.ts';

// The module is the one a browser would load: built by build/build-wasm.sh with
// -sENVIRONMENT=web,worker, so nothing in it is node.
test('enumerates, batches and stops, in a real browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  const result = await page.evaluate(async () => {
    // The bundle the server builds from lib/, loaded the way a page would.
    // The address is held in a variable so it is resolved by the browser
    // rather than by tsc, which knows nothing of what the server serves.
    const address = '/surge-wasm.js';
    const { generate, count, SURGE_VERSION } = (await import(
      address
    )) as unknown as typeof SurgeWasm;

    const whole = await generate('C4H10O');

    const totals: number[] = [];
    const stopped = await generate('C11H16O', {
      batchSize: 1000,
      onBatch: (_batch: string[], total: number) => {
        totals.push(total);
        return total < 5000;
      },
    });

    const timed = await generate('C11H16O', { timeoutMs: 100 });
    const counted = await count('C6H14O');

    return {
      version: SURGE_VERSION,
      whole: whole.smiles,
      wholeEnded: whole.ended,
      totals,
      stoppedCount: stopped.smiles.length,
      stoppedEnded: stopped.ended,
      stoppedFirst: stopped.smiles[0],
      timedEnded: timed.ended,
      timedCount: timed.smiles.length,
      timedMs: timed.durationMs,
      counted: counted.count,
    };
  });

  expect(errors).toStrictEqual([]);
  expect(result.version).toBe('2.0');
  expect(result.whole).toStrictEqual([
    'CC(C)(O)C',
    'CC(C)OC',
    'CC(O)CC',
    'CC(C)CO',
    'CCCOC',
    'CCCCO',
    'CCOCC',
  ]);
  expect(result.wholeEnded).toBe('complete');
  expect(result.totals).toStrictEqual([1000, 2000, 3000, 4000, 5000]);
  expect(result.stoppedCount).toBe(5000);
  expect(result.stoppedEnded).toBe('stopped');
  expect(result.stoppedFirst).toBe('CC(C#CC#CC(C)(O)C)(C)C');
  expect(result.timedEnded).toBe('timeout');
  expect(result.timedCount).toBeGreaterThan(1000);
  expect(result.timedMs).toBeLessThan(1000);
  expect(result.counted).toBe(32);
});
