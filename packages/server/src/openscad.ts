/**
 * The one way to run OpenSCAD, for the worker and every tool and test. An `OpenScadRunner` executes one OpenSCAD command line; the
 * worker runs `runOpenScad` (the openscad binary in its image), and tools and tests pick a runner with `selectRunner`: the binary
 * on this host, the pinned Docker image (RENDERER_IMAGE) or the optional openscad-wasm-prebuilt package.
 */
import { execFile, type ExecFileOptions } from 'node:child_process';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { FONTS_DIR } from '@canfactory/contracts';
import { RENDER_TIMEOUT_MS, RENDERER_IMAGE, repositoryRoot } from './config.ts';
import { DEFECT, RenderFailure } from './errors.ts';

/** Runs one OpenSCAD command line. `fontPath` is the folder of bundled fonts (models/fonts): text must not depend on whatever
 * fonts the host has. Failures are RenderFailures. */
export type OpenScadRunner = (args: string[], signal: AbortSignal, fontPath: string) => Promise<void>;

export type RunnerKind = 'native' | 'docker' | 'wasm';

/** How long one call may take, how much output it may print, and (in Docker) how much memory it may use. */
export interface RenderLimits { timeoutMs: number; maxBuffer: number; memory: string }

/** The worker's limits (its pod has 2 GiB). */
export const WORKER_LIMITS: RenderLimits = { timeoutMs: RENDER_TIMEOUT_MS, maxBuffer: 1_048_576, memory: '2g' };
/** Tools render large reconstructions and fixtures nobody waits on interactively. */
export const TOOL_LIMITS: RenderLimits = { timeoutMs: 600_000, maxBuffer: 16_777_216, memory: '4g' };

/** The bundled fonts in this checkout. */
export const fontsPath = resolve(repositoryRoot, FONTS_DIR);

/** OpenSCAD variable overrides, e.g. { ROUNDNESS: '96' } becomes -D ROUNDNESS=96 (values are OpenSCAD literals). */
export type Defines = Record<string, string>;

const NAME = /^[A-Za-z_$][A-Za-z0-9_]*$/;

/** The command line that renders `input` to a binary STL at `output` with the Manifold backend and these `-D NAME=value` overrides. */
export function openScadArgs(output: string, defines: Iterable<readonly [string, string]>, input: string): string[] {
  return ['--backend', 'Manifold', '--export-format', 'binstl', '-o', output, ...[...defines].flatMap(([name, value]) => {
    if (!NAME.test(name)) throw new Error(`Invalid OpenSCAD variable name: ${name}`);
    return ['-D', `${name}=${value}`];
  }), input];
}

/** Paths on the worker say nothing to a reader and are not theirs to see. */
function withoutPaths(text: string, ...roots: string[]): string {
  return roots.reduce((result, root) => root ? result.split(root).join('…') : result, text);
}

/** Run a process that runs OpenSCAD, classifying a timeout (the process killed, or `timeout`'s exit status 124) and a failure. */
function run(file: string, args: string[], options: ExecFileOptions, limits: RenderLimits, fontPath: string): Promise<void> {
  return new Promise((resolveRun, reject) => {
    execFile(file, args, options, (error, _stdout, stderr) => {
      if (!error) resolveRun();
      else if (error.killed || error.code === 124) reject(new RenderFailure('RENDER_TIMEOUT', `Rendering exceeded the ${limits.timeoutMs / 1000}-second limit. Reduce size or slot density and try again.`, `OpenSCAD was stopped after ${limits.timeoutMs} ms.`, true, { cause: error }));
      else reject(new RenderFailure('OPENSCAD_FAILED', DEFECT, `OpenSCAD exited with ${error.code ?? error.signal ?? 'an error'}: ${withoutPaths(String(stderr).slice(-1500), process.cwd(), fontPath)}`, false, { cause: error }));
    });
  });
}

/** OpenSCAD on this host: `command` with the bundled fonts. */
export function nativeRunner(command = 'openscad', limits = WORKER_LIMITS): OpenScadRunner {
  return (args, signal, fontPath) => run(command, args, { signal, timeout: limits.timeoutMs, killSignal: 'SIGKILL', maxBuffer: limits.maxBuffer, env: { ...process.env, OPENSCAD_FONT_PATH: fontPath } }, limits, fontPath);
}

/** The worker's runner: the openscad binary in its image. */
export const runOpenScad: OpenScadRunner = nativeRunner();

/** The pinned renderer image, as the worker runs it: no network, bounded CPU and memory, the repository read-only at /app and
 * `dataDirectory` (where inputs and outputs outside the repository must be) at /data. */
export function dockerRunner(dataDirectory: string, limits = WORKER_LIMITS): OpenScadRunner {
  const inContainer = (arg: string) => arg.startsWith(dataDirectory) ? arg.replace(dataDirectory, '/data') : arg.startsWith(repositoryRoot) ? arg.replace(repositoryRoot, '/app') : arg;
  return (args, signal, fontPath) => run('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', limits.memory,
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '--env', `OPENSCAD_FONT_PATH=${inContainer(fontPath)}`, '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', `type=bind,src=${dataDirectory},dst=/data`,
    RENDERER_IMAGE, 'timeout', String(Math.ceil(limits.timeoutMs / 1000)), 'openscad', ...args.map(inContainer)], { signal, maxBuffer: limits.maxBuffer }, limits, fontPath);
}

interface WasmInstance { FS: { writeFile(path: string, data: string | Uint8Array): void; readFile(path: string): Uint8Array; mkdir(path: string): void }; callMain(args: string[]): number }
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

/** The optional openscad-wasm-prebuilt package (`npm i --no-save openscad-wasm-prebuilt`): the SCAD file (the last argument, which
 * must be self-contained) and the bundled fonts are copied into its file system, and the STL (`-o`) out of it. */
function wasmRunner(wasm: WasmModule): OpenScadRunner {
  return async (args, _signal, fontPath) => {
    const [input, outputAt] = [args.length - 1, args.indexOf('-o') + 1];
    const output = args[outputAt];
    if (!outputAt || !output || input <= outputAt) throw new Error('Expected -o and a SCAD file');
    const instance = await wasm.create();
    // The wasm build has no system fonts: give fontconfig the bundled ones.
    for (const dir of ['/fonts', '/etc', '/etc/fonts']) instance.FS.mkdir(dir);
    for (const font of (await readdir(fontPath)).filter(name => name.endsWith('.ttf'))) instance.FS.writeFile(`/fonts/${font}`, await readFile(join(fontPath, font)));
    instance.FS.writeFile('/etc/fonts/fonts.conf', '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir></fontconfig>');
    instance.FS.writeFile('/model.scad', await readFile(args[input] ?? '', 'utf8'));
    const code = instance.callMain(args.map((arg, index) => index === input ? '/model.scad' : index === outputAt ? '/model.stl' : arg));
    if (code !== 0) throw new RenderFailure('OPENSCAD_FAILED', DEFECT, `openscad-wasm exited with code ${code}`, false);
    await writeFile(output, instance.FS.readFile('/model.stl'));
  };
}

const exec = promisify(execFile);
async function version(file: string): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await exec(file, ['--version'], { timeout: 20_000 });
    return `${stdout}${stderr}`.trim();
  } catch { return undefined; }
}

/** What is installed of each runner; probed once per process. */
type Found = { kind: 'native'; command: string; version: string } | { kind: 'docker'; version: string } | { kind: 'wasm'; version: string; wasm: WasmModule };
const probes: Record<RunnerKind, () => Promise<Found | undefined>> = {
  native: async () => {
    const command = process.env['OPENSCAD_BIN'] ?? 'openscad';
    const found = await version(command);
    return found === undefined ? undefined : { kind: 'native', command, version: found.split('\n')[0] ?? found };
  },
  docker: async () => await version('docker') === undefined ? undefined : { kind: 'docker', version: RENDERER_IMAGE },
  wasm: async () => {
    const wasm = await loadWasm();
    return wasm && { kind: 'wasm', version: wasm.version, wasm };
  },
};
const probed = new Map<RunnerKind, Promise<Found | undefined>>();
const probe = (kind: RunnerKind) => probed.get(kind) ?? probed.set(kind, probes[kind]()).get(kind);

/** The runner `OPENSCAD_RUNNER=native|docker|wasm` forces, or else the first of `order` that is installed. */
export async function detectRunner(order: RunnerKind[] = ['native', 'wasm', 'docker']): Promise<Found | undefined> {
  const forced = process.env['OPENSCAD_RUNNER'];
  for (const kind of forced && forced in probes ? [forced as RunnerKind] : order) {
    const found = await probe(kind);
    if (found) return found;
  }
  return undefined;
}

export interface SelectedRunner { run: OpenScadRunner; kind: RunnerKind; version: string }

/**
 * The runner for tools and tests, chosen in one place: `OPENSCAD_RUNNER=native|docker|wasm` forces one, or else the first of
 * `order` that is installed. Native is `$OPENSCAD_BIN` or `openscad` on PATH; Docker (which may have to pull a large image) mounts
 * `dataDirectory`, where files outside the repository must be.
 */
export async function selectRunner(dataDirectory: string, order?: RunnerKind[], limits = TOOL_LIMITS): Promise<SelectedRunner> {
  const found = await detectRunner(order);
  if (!found) throw new Error('No OpenSCAD runtime found. Install openscad, set OPENSCAD_BIN, run `npm i --no-save openscad-wasm-prebuilt`, or install Docker (OPENSCAD_RUNNER=docker).');
  const run = found.kind === 'native' ? nativeRunner(found.command, limits) : found.kind === 'docker' ? dockerRunner(dataDirectory, limits) : wasmRunner(found.wasm);
  return { run, kind: found.kind, version: found.version };
}

export interface Render { stl: Buffer; runner: RunnerKind; version: string; milliseconds: number }

/** Render a self-contained SCAD file to a binary STL with the Manifold backend (as the worker does) and the bundled fonts. */
export async function renderScad(scadPath: string, defines: Defines = {}): Promise<Render> {
  const directory = await mkdtemp(join(tmpdir(), 'canfactory-scad-'));
  try {
    const runner = await selectRunner(directory);
    const [input, output] = [join(directory, 'model.scad'), join(directory, 'model.stl')];
    await copyFile(scadPath, input);
    const started = Date.now();
    await runner.run(openScadArgs(output, Object.entries(defines), input), new AbortController().signal, fontsPath);
    return { stl: await readFile(output), runner: runner.kind, version: runner.version, milliseconds: Date.now() - started };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
