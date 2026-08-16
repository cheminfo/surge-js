/** What a surge range looks like: `3`, `1:3`, or `1-3`. */
export const RANGE_PATTERN = String.raw`\d+([:-]\d+)?`;

/**
 * Everything that changes which structures surge enumerates. A range is
 * written `#` for an exact number or `#:#` for an interval; an empty string
 * means the restriction is not applied, so a form may send every field.
 */
export interface SurgeOptions {
  /**
   * Keep one structure of each set of Kekulé structures that are equivalent
   * under carbon-ring aromaticity (`-R`).
   * @default true
   */
  aromaticity?: boolean;

  /**
   * Disallow triple bonds (`-T`).
   * @default false
   */
  disallowTripleBonds?: boolean;

  /**
   * Only generate planar structures (`-P`).
   * @default false
   */
  requirePlanarity?: boolean;

  /**
   * Only rings of even length (`-b`).
   * @default false
   */
  evenRingsOnly?: boolean;

  /**
   * Limit the number of distinct non-H bonds (`-e`).
   * @default undefined
   */
  limitBonds?: string;

  /**
   * Limit the number of cycles of length 3 (`-t`).
   * @default undefined
   */
  limit3Rings?: string;

  /**
   * Limit the number of cycles of length 4 (`-f`).
   * @default undefined
   */
  limit4Rings?: string;

  /**
   * Limit the number of cycles of length 5 (`-p`).
   * @default undefined
   */
  limit5Rings?: string;

  /**
   * Limit the number of cycles of length 6 (`-h`).
   * @default undefined
   */
  limit6Rings?: string;

  /**
   * Limit the number of chord-free cycles of 6 carbon atoms (`-C`).
   * @default undefined
   */
  limitCarbon6Rings?: string;

  /**
   * Maximum degree, not counting bond multiplicity or hydrogens (`-d`).
   * @default 4
   */
  maxDegree?: number;

  /**
   * Maximum number of distinct atoms, hydrogens included, an atom may be
   * bonded to (`-c`).
   * @default 4
   */
  maxCoordination?: number;

  /**
   * No triple bonds in rings up to length 7 (`-B1`).
   * @default false
   */
  noSmallRingsTripleBonds?: boolean;

  /**
   * Bredt's rule for two rings ij with one bond in common (`-B2`).
   * @default false
   */
  bredsRuleOne?: boolean;

  /**
   * Bredt's rule for two rings ij with two bonds in common (`-B3`).
   * @default false
   */
  bredsRuleTwo?: boolean;

  /**
   * Bredt's rule for two rings of length 6 sharing three bonds (`-B4`).
   * @default false
   */
  bredsRuleThree?: boolean;

  /**
   * No substructure A=A=A, in a ring or not (`-B5`).
   * @default false
   */
  noAllene?: boolean;

  /**
   * No substructure A=A=A in rings up to length 8 (`-B6`).
   * @default false
   */
  noAlleneInSmallRings?: boolean;

  /**
   * No K33 or K24 substructure (`-B7`).
   * @default false
   */
  noK33K24?: boolean;

  /**
   * No cone of P4 and no K4 with a 3-ear (`-B8`).
   * @default false
   */
  noCone?: boolean;

  /**
   * No atom in more than one ring of length 3 or 4 (`-B9`).
   * @default false
   */
  noSmallRingsCommonAtoms?: boolean;
}
