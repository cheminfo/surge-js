import { expect, test } from 'vitest';

import { SurgeError } from '../SurgeError.ts';
import { count } from '../count.ts';
import { generate } from '../generate.ts';

test('the three isomers of pentane', async () => {
  const result = await generate('C5H12');

  expect(result.smiles).toStrictEqual(['CC(C)(C)C', 'CC(C)CC', 'CCCCC']);
  expect(result.ended).toBe('complete');
});

test('the seven isomers of C4H10O', async () => {
  const { smiles } = await generate('C4H10O');

  expect(smiles).toStrictEqual([
    'CC(C)(O)C',
    'CC(C)OC',
    'CC(O)CC',
    'CC(C)CO',
    'CCCOC',
    'CCCCO',
    'CCOCC',
  ]);
});

test('the whole enumeration of a formula with many isomers', async () => {
  const { smiles, log } = await generate('C7H8O');

  expect(smiles).toHaveLength(13_175);
  expect(smiles[0]).toBe('CC(C#CC#C)(O)C');
  expect(log).toContain('>Z wrote');
});

test('disallowing triple bonds drops the two alkynes of C4H6', async () => {
  const { smiles } = await generate('C4H6', { disallowTripleBonds: true });

  expect(smiles).toStrictEqual([
    'C=C=CC',
    'C=CC=C',
    'CC1=CC1',
    'C=C1CC1',
    'CC1C=C1',
    'C1C=CC1',
    'C1C2C1C2',
  ]);
});

test('a maximum degree drops neopentane', async () => {
  const { smiles } = await generate('C5H12', { maxDegree: 3 });

  expect(smiles).toStrictEqual(['CC(C)CC', 'CCCCC']);
});

test('an invalid range is refused', async () => {
  await expect(generate('C5H12', { limit3Rings: '2:' })).rejects.toThrow(
    'Invalid range "2:" for -t, expected # or #:#',
  );
});

test('counting agrees with enumerating', async () => {
  const { count: total } = await count('C6H14O');
  const { smiles } = await generate('C6H14O');

  expect(total).toBe(32);
  expect(smiles).toHaveLength(total);
});

test('an impossible parity is an error', async () => {
  await expect(generate('C4H11')).rejects.toThrow('impossible parity');
});

test('an unknown element is an error', async () => {
  await expect(count('Xx4')).rejects.toThrow('unknown element name');
});

test('the error carries the formula and the log', async () => {
  const error = await generate('C4H11').catch((error_: unknown) => error_);

  expect(error).toBeInstanceOf(SurgeError);
  expect(error).toMatchObject({
    name: 'SurgeError',
    formula: 'C4H11',
    log: '>E surge : impossible parity',
  });
});

test('a formula that is not one is refused before surge runs', async () => {
  await expect(generate('-oevil')).rejects.toThrow('Invalid formula: "-oevil"');
});

test('the summary line is reported', async () => {
  const { log, durationMs } = await generate('C5H12');

  expect(log).toContain('C5H12  H=12 C=5');
  expect(log).toContain('>Z wrote 3 -> 3 -> 3');
  expect(durationMs).toBeGreaterThan(0);
});

test('a timeout keeps the beginning of the enumeration', async () => {
  const result = await generate('C11H16O', { timeoutMs: 100 });

  expect(result.ended).toBe('timeout');
  expect(result.durationMs).toBeLessThan(1000);
  // 6 733 475 in full, and the first hundred milliseconds are a prefix of it.
  expect(result.smiles.length).toBeGreaterThan(1000);
  expect(result.smiles.length).toBeLessThan(6_733_475);
  // The same two surge writes first when it enumerates the whole set.
  expect(result.smiles.slice(0, 2)).toStrictEqual([
    'CC(C#CC#CC(C)(O)C)(C)C',
    'CC(OC(C#CC#C)(C)C)(C)C',
  ]);
});

test('a run that finishes before its deadline is complete', async () => {
  const result = await generate('C5H12', { timeoutMs: 10_000 });

  expect(result.ended).toBe('complete');
  expect(result.smiles).toStrictEqual(['CC(C)(C)C', 'CC(C)CC', 'CCCCC']);
});

test('a formula surge refuses is still an error under a deadline', async () => {
  await expect(generate('C4H11', { timeoutMs: 10_000 })).rejects.toThrow(
    'impossible parity',
  );
});

test('onBatch follows the count as the structures come', async () => {
  const totals: number[] = [];
  const collected: string[] = [];

  const { smiles, ended } = await generate('C7H8O', {
    batchSize: 5000,
    onBatch: (batch, total) => {
      collected.push(...batch);
      totals.push(total);
    },
  });

  expect(ended).toBe('complete');
  expect(totals).toStrictEqual([5000, 10_000, 13_175]);
  expect(collected).toStrictEqual(smiles);
});

test('onBatch ends the run by returning false', async () => {
  const totals: number[] = [];

  const { smiles, ended, durationMs } = await generate('C11H16O', {
    batchSize: 1000,
    onBatch: (_batch, total) => {
      totals.push(total);
      return total < 4000;
    },
  });

  expect(ended).toBe('stopped');
  expect(totals).toStrictEqual([1000, 2000, 3000, 4000]);
  expect(smiles).toHaveLength(4000);
  expect(smiles[0]).toBe('CC(C#CC#CC(C)(O)C)(C)C');
  // The whole formula is 6 733 475 structures and takes about a second.
  expect(durationMs).toBeLessThan(500);
});

test('the last batch is reported even when it is not a whole one', async () => {
  const totals: number[] = [];

  await generate('C4H10O', {
    batchSize: 5,
    onBatch: (_batch, total) => {
      totals.push(total);
    },
  });

  expect(totals).toStrictEqual([5, 7]);
});

test('a batch bigger than the enumeration is still reported once', async () => {
  const batches: string[][] = [];

  await generate('C5H12', {
    batchSize: 1000,
    onBatch: (batch) => {
      batches.push(batch);
    },
  });

  expect(batches).toStrictEqual([['CC(C)(C)C', 'CC(C)CC', 'CCCCC']]);
});
