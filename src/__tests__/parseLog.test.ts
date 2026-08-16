import { expect, test } from 'vitest';

import { parseLog } from '../parseLog.ts';

test('the last count of a written run is what was written', () => {
  expect(
    parseLog(
      'C8OH10  H=10 C=8 O=1  nv=9\n>Z wrote 4232 -> 15835 -> 69669 in 0.02 sec',
    ),
  ).toStrictEqual({ generated: 69_669, error: null });
});

test('a counting run says generated, and may report four stages', () => {
  expect(
    parseLog('>Z generated 9 -> 32 -> 32 -> 32 in 0.00 sec'),
  ).toStrictEqual({ generated: 32, error: null });
});

test('an error is read without its prefix', () => {
  expect(parseLog('>E surge : impossible parity')).toStrictEqual({
    generated: null,
    error: 'impossible parity',
  });
});

test('a log that says nothing', () => {
  expect(parseLog('')).toStrictEqual({ generated: null, error: null });
});
