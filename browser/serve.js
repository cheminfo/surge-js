// Bundles the package for a browser and serves it, so the Playwright test
// loads exactly what a page would.
import { createServer } from 'node:http';

import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['lib/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
const source = bundle.outputFiles[0].text;

const page =
  '<!doctype html><html><head><title>surge-wasm</title></head><body></body></html>';

createServer((request, response) => {
  if (request.url === '/surge-wasm.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(source);
  } else {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(page);
  }
}).listen(31_230);
