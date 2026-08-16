import { expect, test } from 'vitest';

import { buildFlags } from '../buildFlags.ts';

test('the formula comes last, aromaticity is on', () => {
  expect(buildFlags('C5H12')).toStrictEqual(['-R', 'C5H12']);
});

test('the structures are asked for, surge counting by default', () => {
  expect(buildFlags('C5H12', { smiles: true })).toStrictEqual([
    '-S',
    '-R',
    'C5H12',
  ]);
});

test('the raw enumeration is asked for explicitly', () => {
  expect(buildFlags('C6H6', { aromaticity: false })).toStrictEqual(['C6H6']);
});

test('ranges accept both separators', () => {
  expect(
    buildFlags('C6H6', { limit3Rings: '1', limit6Rings: '0:2' }),
  ).toStrictEqual(['-R', '-t1', '-h0:2', 'C6H6']);
  expect(buildFlags('C6H6', { limitBonds: '1-3' })).toStrictEqual([
    '-R',
    '-e1-3',
    'C6H6',
  ]);
});

test('an empty range is not a restriction', () => {
  expect(buildFlags('C6H6', { limit3Rings: '', limitBonds: '' })).toStrictEqual(
    ['-R', 'C6H6'],
  );
});

test('a malformed range is refused', () => {
  expect(() => buildFlags('C6H6', { limit4Rings: 'two' })).toThrow(
    'Invalid range "two" for -f, expected # or #:#',
  );
});

test('the substructure sets are numbered the way surge numbers them', () => {
  expect(
    buildFlags('C6H6', { noSmallRingsTripleBonds: true, noCone: true }),
  ).toStrictEqual(['-R', '-B1,8', 'C6H6']);
  expect(buildFlags('C6H6', { noSmallRingsCommonAtoms: true })).toStrictEqual([
    '-R',
    '-B9',
    'C6H6',
  ]);
});

test('every flag at once', () => {
  expect(
    buildFlags('C8H6N2', {
      smiles: true,
      disallowTripleBonds: true,
      requirePlanarity: true,
      evenRingsOnly: true,
      maxDegree: 3,
      maxCoordination: 4,
      limitCarbon6Rings: '1',
      noAllene: true,
    }),
  ).toStrictEqual([
    '-S',
    '-R',
    '-T',
    '-P',
    '-b',
    '-C1',
    '-d3',
    '-c4',
    '-B5',
    'C8H6N2',
  ]);
});

test('the higher valences surge names are formulas too', () => {
  expect(buildFlags('C4H5NxO2')).toStrictEqual(['-R', 'C4H5NxO2']);
});

test('anything that could be read as a flag is refused', () => {
  expect(() => buildFlags('-S')).toThrow('Invalid formula: "-S"');
  expect(() => buildFlags('')).toThrow('Invalid formula: ""');
  expect(() => buildFlags('C5H12 C6H14')).toThrow(
    'Invalid formula: "C5H12 C6H14"',
  );
});
