import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { RENDERER_IMAGE, repositoryRoot } from '@canfactory/server';
import { runOpenScad, type OpenScadRunner } from '../apps/worker/src/render.ts';
import { renderScad } from './stl-to-scad/openscad.ts';

const exec = promisify(execFile);

/** The pinned renderer image, as the worker runs it: no network, bounded CPU and memory, the repository read-only at /app and the
 * store's data directory at /data. */
export function dockerRunner(dataDirectory: string): OpenScadRunner {
  return async (args, signal, fontPath) => {
    const mapped = args.map(arg => arg.startsWith(dataDirectory) ? arg.replace(dataDirectory, '/data') : arg.startsWith(repositoryRoot) ? arg.replace(repositoryRoot, '/app') : arg);
    await exec('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '2g',
      '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      '--env', `OPENSCAD_FONT_PATH=${fontPath.replace(repositoryRoot, '/app')}`, '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', `type=bind,src=${dataDirectory},dst=/data`,
      RENDERER_IMAGE, 'timeout', '120', 'openscad', ...mapped], { signal, maxBuffer: 1_048_576 });
  };
}

/** OPENSCAD_TEST_MODE=wasm renders with the optional openscad-wasm-prebuilt package (`npm i --no-save openscad-wasm-prebuilt`) and the bundled fonts. */
export const wasmRunner: OpenScadRunner = async (args) => {
  const defines: Record<string, string> = {};
  args.forEach((arg, index) => { if (args[index - 1] === '-D') { const [name, ...value] = arg.split('='); if (name) defines[name] = value.join('='); } });
  const scad = args.at(-1); const output = args[args.indexOf('-o') + 1];
  if (!scad || !output) throw new Error('Expected a SCAD file and -o');
  await writeFile(output, (await renderScad(scad, defines)).stl);
};

/** The runner OPENSCAD_TEST_MODE asks for: `native` (openscad on PATH, as in the worker image), `wasm`, or by default the pinned
 * Docker image. */
export function selectRunner(dataDirectory: string): OpenScadRunner {
  const mode = process.env['OPENSCAD_TEST_MODE'];
  return mode === 'native' ? runOpenScad : mode === 'wasm' ? wasmRunner : dockerRunner(dataDirectory);
}
