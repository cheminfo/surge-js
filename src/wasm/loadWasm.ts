import { decode } from 'uint8-base64';

import { wasmBase64 } from './data.ts';
import surgeModule from './glue.ts';

/**
 * What a device of the module's file system answers. Only writing is
 * implemented: surge is given one to write its structures to.
 */
export interface DeviceOps {
  open: () => void;
  close: () => void;
  write: (
    stream: unknown,
    buffer: Uint8Array,
    offset: number,
    length: number,
  ) => number;
}

/** The parts of the Emscripten module this package uses. */
export interface SurgeInstance {
  callMain: (args: string[]) => void;

  FS: {
    makedev: (major: number, minor: number) => number;
    registerDevice: (device: number, ops: DeviceOps) => void;
    mkdev: (path: string, device: number) => void;
  };
}

/** How an instance reports what surge writes while it runs. */
export interface InstanceOptions {
  print: (line: string) => void;
  printErr: (line: string) => void;
  onExit: (status: number) => void;
}

let binary: Promise<Uint8Array> | undefined;

/**
 * Build a module to run surge once. Surge is a command line program: it ends
 * by calling `exit` and keeps the state of the generator in globals, so an
 * instance is used for a single run and thrown away. Decompressing the
 * WebAssembly is the expensive part and is done once for the whole process.
 * @param options - Where the two output streams go.
 * @returns A module whose `main` has not been called yet.
 */
export async function createInstance(
  options: InstanceOptions,
): Promise<SurgeInstance> {
  binary ??= decompress(wasmBase64);
  const factory = surgeModule as unknown as (
    moduleOptions: Record<string, unknown>,
  ) => Promise<SurgeInstance>;
  return factory({
    wasmBinary: await binary,
    noInitialRun: true,
    thisProgram: 'surge',
    print: options.print,
    printErr: options.printErr,
    onExit: options.onExit,
    // Emscripten's Node build writes the exit status onto `process.exitCode`,
    // which a library must never do to the process embedding it.
    quit: (_status: number, toThrow: unknown) => {
      throw toThrow;
    },
  });
}

async function decompress(base64: string): Promise<Uint8Array> {
  const compressed = decode(new TextEncoder().encode(base64));
  const stream = new Blob([compressed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
