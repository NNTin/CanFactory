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

interface Runner { kind: RunnerKind; command: string; version: string }

let detected: Promise<Runner | undefined> | undefined;

/**
 * Runner selection. `OPENSCAD_RUNNER=native|docker|wasm` forces one; otherwise the first available of: `$OPENSCAD_BIN` or
 * `openscad` on PATH, the optional openscad-wasm-prebuilt package, then the pinned Docker image (last, because it may
 * have to pull a large image).
 */
export function detectRunner(): Promise<Runner | undefined> {
  detected ??= probeRunner();
  return detected;
}

async function probeNative(): Promise<Runner | undefined> {
  const command = process.env['OPENSCAD_BIN'] ?? 'openscad';
  const version = await tryExec(command, ['--version']);
  return version === undefined ? undefined : { kind: 'native', command, version: version.split('\n')[0] ?? version };
}

async function probeDocker(): Promise<Runner | undefined> {
  return await tryExec('docker', ['--version']) === undefined ? undefined : { kind: 'docker', command: 'docker', version: RENDERER_IMAGE };
}

async function probeWasm(): Promise<Runner | undefined> {
  const wasm = await loadWasm();
  return wasm ? { kind: 'wasm', command: 'openscad-wasm-prebuilt', version: wasm.version } : undefined;
}

async function probeRunner(): Promise<Runner | undefined> {
  const probes: Record<RunnerKind, () => Promise<Runner | undefined>> = { native: probeNative, wasm: probeWasm, docker: probeDocker };
  const forced = process.env['OPENSCAD_RUNNER'];
  const order: RunnerKind[] = forced === 'native' || forced === 'docker' || forced === 'wasm' ? [forced] : ['native', 'wasm', 'docker'];
  for (const kind of order) {
    const found = await probes[kind]();
    if (found) return found;
  }
  return undefined;
}

interface WasmInstance { FS: { writeFile(path: string, data: string): void; readFile(path: string): Uint8Array }; callMain(args: string[]): number }
interface WasmModule { create: () => Promise<WasmInstance>; version: string }
type CreateOpenScad = (options: { print: (line: string) => void; printErr: (line: string) => void }) => Promise<{ getInstance(): WasmInstance }>;

async function loadWasm(): Promise<WasmModule | undefined> {
  const specifier = process.env['OPENSCAD_WASM_MODULE'] ?? 'openscad-wasm-prebuilt';
  try {
    const module = await import(/* @vite-ignore */ specifier) as { createOpenSCAD: CreateOpenScad };
    const lines: string[] = [];
    const probe = (await module.createOpenSCAD({ print: line => lines.push(line), printErr: line => lines.push(line) })).getInstance();
    try { probe.callMain(['--version']); } catch { /* the version banner is printed before the runtime exits */ }
    const banner = lines.find(line => /openscad/i.test(line))?.trim() ?? 'unknown OpenSCAD';
    return { version: `${banner} via ${specifier}`, create: async () => (await module.createOpenSCAD({ print: () => undefined, printErr: () => undefined })).getInstance() };
  } catch { return undefined; }
}

/** Render a self-contained SCAD file to a binary STL with the Manifold backend (as the production worker does). */
export async function renderScad(scadPath: string, defines: Defines = {}, timeoutMs = 600_000): Promise<Render> {
  const runner = await detectRunner();
  if (!runner) throw new Error('No OpenSCAD runtime found. Install openscad, set OPENSCAD_BIN, run `npm i --no-save openscad-wasm-prebuilt`, or install Docker (OPENSCAD_RUNNER=docker).');
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
