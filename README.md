# surge-js

Enumerate every constitutional isomer of a molecular formula, in the browser or
in Node, with nothing to install and nothing to fetch.

[surge](https://github.com/StructureGenerator/surge) is a C program built on
[nauty](https://users.cecs.anu.edu.au/~bdm/nauty/): it takes a formula and
writes out every chemical graph that satisfies it, once each. This package
compiles it to WebAssembly and carries the binary inside itself — gzipped and
base64-encoded, 95 kB of source for a 195 kB module — so an application ships
the generator instead of calling a service that runs it.

## Installation

```console
npm i surge-js
```

## Usage

```js
import { generate, count } from 'surge-js';

const { smiles } = await generate('C4H10O');
// ['CC(C)(O)C', 'CC(C)OC', 'CC(O)CC', 'CC(C)CO', 'CCCOC', 'CCCCO', 'CCOCC']

const { count: howMany } = await count('C6H14O');
// 32
```

Restrictions are surge's own, under names that say what they do:

```js
await generate('C4H6', { disallowTripleBonds: true });
await generate('C5H12', { maxDegree: 3 });
await generate('C6H6', { limit3Rings: '0', limit6Rings: '1:2' });
```

A formula surge refuses — an impossible parity, an element it does not know —
throws a `SurgeError` carrying what it said:

```js
import { SurgeError } from 'surge-js';

try {
  await generate('C4H11');
} catch (error) {
  if (error instanceof SurgeError) {
    console.log(error.message); // 'impossible parity'
    console.log(error.log); // '>E surge : impossible parity'
  }
}
```

### Following a run, and ending it

Surge writes its structures one after another, so a run can be watched as it
goes — which is also the only moment it can be brought to an end. `onBatch`
receives the structures written since the last call and the number written so
far; **returning `false` ends the run**:

```js
const { smiles, ended } = await generate('C11H16O', {
  batchSize: 1000, // how often to look, in structures
  onBatch: (batch, total) => {
    setProgress(total); // 1000, 2000, 3000 ... as they come
    return total < 50_000; // false ends it here
  },
});
// ended === 'stopped', smiles.length === 50 000 of the 6 733 475 there are
```

`timeoutMs` is the same thing on a clock:

```js
const { smiles, ended } = await generate('C11H16O', { timeoutMs: 500 });
// ended === 'timeout', and smiles are the first surge would have written
```

`ended` is `'complete'`, `'timeout'` or `'stopped'`, and what comes back is
always a prefix of the whole enumeration — exactly the structures `onBatch`
announced, so a caller may accumulate the batches instead of reading `smiles`.

**Watching costs nothing.** Surge writes to a device of the module's own file
system rather than to its standard output, so C buffers the structures and
hands them over a kilobyte at a time — about fifty at once — instead of
calling out once per structure. Every chunk is a moment to read the clock, to
hand a batch over, and to end the run on. A watched run and an unwatched one
measure the same.

Two things still follow from surge having no way of being asked to stop:

- **Nothing is read between two structures.** A formula surge spends its time
  pruning rather than writing runs past its deadline, and `count` — which
  writes nothing at all — cannot be bounded this way.
- **A hard limit needs a worker**, and terminating it.

```js
// worker.js
import { generate } from 'surge-js';

globalThis.addEventListener('message', async ({ data }) => {
  const { smiles } = await generate(data.formula, data.options);
  globalThis.postMessage(smiles);
});
```

```js
const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});
const timeout = setTimeout(() => worker.terminate(), 10_000);
```

### Why only SMILES

Surge writes three formats, and this package asks for one of them. Its SDfile
holds **no coordinates** — every atom is `0.0000 0.0000 0.0000`, because surge
knows the graph and never lays it out — so anything that draws or exports a
structure has to go through a toolkit anyway:

```js
import { Molecule } from 'openchemlib';

const molfile = Molecule.fromSmiles(smiles[0]).toMolfile(); // with coordinates
```

The SMILES are the same molecules: over C4H10O, C2H6SxO, C6H6 and the 13 175
of C7H8O, both formats give an identical set of canonical structures. They are
also the only format surge checks its writes on, so they are the only one a
deadline can stop, and they are written five times faster.

The one thing given up is the higher valences: `CN(=O)=O` is read back by
openchemlib as charge-separated `C[N+]([O-])=O`, where surge's molfile carries
neutral pentavalent nitrogen in its valence column (4 of the 15 `CH3NxO2`
isomers differ this way). Both sides of a comparison normalise the same way,
so it is consistent — but it is not surge's own representation.

## API

|                                                          |                                                       |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `generate(formula, options?)`                            | Every isomer, as `{ smiles, ended, log, durationMs }` |
| `count(formula, options?)`                               | How many there are, as `{ count, log, durationMs }`   |
| `buildFlags(formula, options?)`                          | The surge command line the options amount to          |
| `parseLog(log)`                                          | The counts and the error surge wrote to stderr        |
| `SURGE_VERSION` / `NAUTY_VERSION` / `EMSCRIPTEN_VERSION` | What the embedded module was built from               |

`options` are the same for both, plus `onBatch`, `batchSize` (1000 by
default) and `timeoutMs` for `generate`. Every field is documented in
[`src/options.ts`](src/options.ts) with the surge flag it stands for:
`aromaticity` (`-R`, on by default), `disallowTripleBonds`, `requirePlanarity`,
`evenRingsOnly`, the ring and bond ranges, `maxDegree`, `maxCoordination`, and
the nine substructure sets of `-B`.

## Speed

Wall clock, best of three on an M4 Mac with node 24, against surge 2.0
compiled natively from the same sources and writing to `/dev/null`. The native
column carries the process spawn, because starting one is what an application
does instead of calling this:

| formula   | structures | native |    whole |  watched |    count |
| --------- | ---------: | -----: | -------: | -------: | -------: |
| `C8H10O`  |     69 659 |  24 ms |    29 ms |    30 ms |    15 ms |
| `C10H14O` |  1 548 233 | 376 ms |   582 ms |   579 ms |   264 ms |
| `C9H12O2` |  3 276 428 | 649 ms |   1.13 s |   1.18 s |   437 ms |
| `C11H16O` |  6 733 475 | 1.69 s |   2.85 s |   2.79 s |   1.15 s |
|           |            |  1.00x | 1.2-1.7x | 1.2-1.8x | 0.9-1.3x |

- **whole** is `generate(formula)`, every structure kept in an array.
- **watched** is the same with `batchSize: 1000` and an `onBatch` — the same
  time, which is the point of writing to a device rather than to stdout.
- **count** is `count(formula)`, which writes nothing and is the enumeration
  on its own: 1.3x native, and quicker than spawning the real thing.

Everyday formulas are milliseconds: the 13 175 isomers of `C7H8O` come back in
8 ms. Starting a module is 3 ms, paid per run — surge ends by calling `exit`
and keeps the state of the generator in globals, so an instance is used once
and thrown away, which is what makes every run independent of the last.

Memory is what bounds a large formula, not time: 6.7 million SMILES are about
a gigabyte of JavaScript strings, and node needs `--max-old-space-size` raised
to hold much more than that.

## Building the WebAssembly

`src/wasm/data.ts` and `src/wasm/glue.ts` are committed, so installing this
package needs no compiler. To rebuild them:

```console
npm run build-wasm
```

The script downloads nauty and surge from upstream, checks them against pinned
checksums, and compiles them with no source change at all — the flags are
surge's own Makefile minus `-march=native`. It runs inside a pinned Emscripten
image when `emcc` is not on the PATH, so Docker is enough.

## Licence and citation

The TypeScript here is MIT. The WebAssembly it embeds is surge and nauty, both
Apache 2.0 — see [NOTICE](NOTICE) and [LICENSE-APACHE-2.0.txt](LICENSE-APACHE-2.0.txt).
The package therefore declares `MIT AND Apache-2.0`, because what it ships is
both.

If you publish work that used this, cite the science and not the wrapper:

> B. D. McKay, M. A. Yirik, C. Steinbeck, Surge: a fast open-source chemical
> graph generator, _Journal of Cheminformatics_ **14** (2022) 24.
> <https://doi.org/10.1186/s13321-022-00604-9>

> B. D. McKay, A. Piperno, Practical graph isomorphism II, _Journal of Symbolic
> Computation_ **60** (2014) 94-112.
