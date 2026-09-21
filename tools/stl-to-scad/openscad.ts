import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { RENDERER_IMAGE } from '../../packages/server/src/config.ts';

const exec = promisify(execFile);

export type RunnerKind = 'native' | 'docker' | 'wasm';

export interface Render { stl: Buffer; runner: RunnerKind; version: string; milliseconds: number }

/** OpenSCAD variable overrides, e.g. { ROUNDNESS: '96' } becomes -D ROUNDNESS=96 (values are OpenSCAD literals). */
export type Defines = Record<string, string>;

const NAME = /^[A-Za-z_$][A-Za-z0-9_]*$/;

function defineArgs(defines: Defines): string[] {
  return Object.entries(defines).flatMap(([name, value]) => {
    if (!NAME.test(name)) throw new Error(`Invalid OpenSCAD variable name: ${name}`);
    return ['-D', `${name}=${value}`];
  });
}

async function tryExec(file: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await exec(file, args, { timeout: 20_000 });
    return `${stdout}${stderr}`.trim();
  } catch { return undefined; }
}

/** Runner preference: $OPENSCAD_BIN, `openscad` on PATH, the pinned Docker image, then the optional openscad-wasm-prebuilt package. */
export async function detectRunner(): Promise<{ kind: RunnerKind; command: string; version: string } | undefined> {
  const forced = process.env['OPENSCAD_BIN'];
  for (const command of forced ? [forced] : ['openscad']) {
    const version = await tryExec(command, ['--version']);
    if (version !== undefined) return { kind: 'native', command, version: version.split('\n')[0] ?? version };
  }
  if (process.env['OPENSCAD_RUNNER'] !== 'wasm' && await tryExec('docker', ['--version']) !== undefined)
    return { kind: 'docker', command: 'docker', version: RENDERER_IMAGE };
  const wasm = await loadWasm();
  if (wasm) return { kind: 'wasm', command: 'openscad-wasm-prebuilt', version: `openscad-wasm-prebuilt ${wasm.version}` };
  return undefined;
}

interface WasmInstance { FS: { writeFile(path: string, data: string): void; readFile(path: string): Uint8Array }; callMain(args: string[]): number }
interface WasmModule { create: () => Promise<WasmInstance>; version: string }

async function loadWasm(): Promise<WasmModule | undefined> {
  const specifier = process.env['OPENSCAD_WASM_MODULE'] ?? 'openscad-wasm-prebuilt';
  try {
    const module = await import(/* @vite-ignore */ specifier) as { createOpenSCAD: (options: object) => Promise<{ getInstance(): WasmInstance }> };
    let version = 'unknown';
    try {
      const packageJson = JSON.parse(await readFile(new URL('package.json', await resolvePackageDir(specifier)), 'utf8')) as { version?: string };
      version = packageJson.version ?? version;
    } catch { /* version is informational only */ }
    return { version, create: async () => (await module.createOpenSCAD({ print: () => undefined, printErr: () => undefined })).getInstance() };
  } catch { return undefined; }
}

async function resolvePackageDir(specifier: string): Promise<URL> {
  const { createRequire } = await import('node:module');
  const path = createRequire(join(process.cwd(), 'noop.js')).resolve(`${specifier}/package.json`);
  return new URL(`file://${path.slice(0, path.length - 'package.json'.length)}`);
}

/** Render a self-contained SCAD file to a binary STL with the Manifold backend (as the production worker does). */
export async function renderScad(scadPath: string, defines: Defines = {}, timeoutMs = 600_000): Promise<Render> {
  const runner = await detectRunner();
  if (!runner) throw new Error('No OpenSCAD runtime found. Install openscad, set OPENSCAD_BIN, install Docker, or run `npm i --no-save openscad-wasm-prebuilt`.');
  const directory = await mkdtemp(join(tmpdir(), 'stl-to-scad-'));
  const started = Date.now();
  try {
    const input = join(directory, 'model.scad');
    const output = join(directory, 'model.stl');
    await copyFile(scadPath, input);
    const args = ['--backend', 'Manifold', '--export-format', 'binstl', ...defineArgs(defines)];
    if (runner.kind === 'native') {
      await exec(runner.command, [...args, '-o', output, input], { timeout: timeoutMs, maxBuffer: 16_777_216 });
    } else if (runner.kind === 'docker') {
      await exec('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '4g',
        '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        '--mount', `type=bind,src=${directory},dst=/data`, RENDERER_IMAGE,
        'openscad', ...args, '-o', `/data/${basename(output)}`, `/data/${basename(input)}`], { timeout: timeoutMs, maxBuffer: 16_777_216 });
    } else {
      const wasm = await loadWasm();
      if (!wasm) throw new Error('openscad-wasm-prebuilt disappeared.');
      const instance = await wasm.create();
      instance.FS.writeFile('/model.scad', await readFile(input, 'utf8'));
      const code = instance.callMain(['/model.scad', '--backend=Manifold', '--export-format', 'binstl', ...defineArgs(defines), '-o', '/model.stl']);
      if (code !== 0) throw new Error(`openscad-wasm exited with code ${code}`);
      await writeFile(output, instance.FS.readFile('/model.stl'));
    }
    return { stl: await readFile(output), runner: runner.kind, version: runner.version, milliseconds: Date.now() - started };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
