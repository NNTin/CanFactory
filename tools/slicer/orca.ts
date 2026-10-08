/**
 * OrcaSlicer from the command line, for the slicer check (tools/test-slicer.ts). CI installs a pinned release
 * (tools/install-orca-slicer.sh) and points ORCA_SLICER at it; nothing here runs without it.
 *
 * Orca's command line does not resolve a profile's `inherits`, so the profiles are flattened here from Orca's own bundled ones: its
 * generic Klipper printer, its 0.20 mm Standard process and its Generic PLA, with only the nozzle and the layer height changed. That
 * is what a user who picks a generic printer in Orca gets, with Precise wall off as the tag's print notes ask (writeProfiles).
 */
import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { parseStl, writeBinaryStl } from '../stl-to-scad/stl.ts';

const exec = promisify(execFile);

export interface OrcaInstall { executable: string; resources: string }

/** The installed OrcaSlicer: ORCA_SLICER (the executable or AppRun) and ORCA_RESOURCES (default: `resources` beside AppRun). */
export function orcaInstall(): OrcaInstall | undefined {
  const executable = process.env['ORCA_SLICER'];
  if (!executable) return undefined;
  return { executable, resources: process.env['ORCA_RESOURCES'] ?? join(dirname(executable), 'resources') };
}

/** The bundled presets the check slices with, and the place of the object on Orca's 250 × 250 mm bed. */
export const ORCA_PRESETS = { machine: 'MyKlipper 0.4 nozzle', process: '0.20mm Standard @MyKlipper', filament: 'Generic PLA @System' } as const;
export const BED_CENTRE: [number, number] = [125, 125];

type Profile = Record<string, unknown> & { name?: string; inherits?: string };

let index: Promise<Map<string, Profile>> | undefined;
function profiles(resources: string): Promise<Map<string, Profile>> {
  index ??= (async () => {
    const found = new Map<string, Profile>();
    for (const vendor of ['Custom', 'OrcaFilamentLibrary']) {
      const root = join(resources, 'profiles', vendor);
      for (const entry of await readdir(root, { recursive: true })) {
        if (!entry.endsWith('.json')) continue;
        const profile = JSON.parse(await readFile(join(root, entry), 'utf8')) as Profile;
        if (typeof profile.name === 'string' && !found.has(profile.name)) found.set(profile.name, profile);
      }
    }
    return found;
  })();
  return index;
}

/** A bundled preset with everything it inherits merged in, the nearest last. */
async function flatten(resources: string, name: string): Promise<Profile> {
  const profile = (await profiles(resources)).get(name);
  if (!profile) throw new Error(`OrcaSlicer has no bundled preset "${name}" in ${resources}/profiles.`);
  const base = profile.inherits ? await flatten(resources, profile.inherits) : {};
  return { ...base, ...profile };
}

export interface SliceSettings { nozzle: number; layerHeight: number }

/** Writes the three flattened profiles for this nozzle and layer height into `directory`; returns their paths. */
export async function writeProfiles(install: OrcaInstall, directory: string, settings: SliceSettings): Promise<{ machine: string; process: string; filament: string }> {
  const machineName = ORCA_PRESETS.machine;
  const write = async (kind: string, profile: Profile) => {
    const flat = { ...profile };
    delete flat.inherits;
    const path = join(directory, `${kind}.json`);
    await writeFile(path, JSON.stringify({ ...flat, from: 'system' }, null, 1));
    return path;
  };
  return {
    machine: await write('machine', { ...await flatten(install.resources, machineName), nozzle_diameter: [String(settings.nozzle)] }),
    // Precise wall off, as the print notes ask: with it on, Orca pulls the inner walls away from the outer one, and a small dark
    // island (an isolated module 3 to 4 lines wide) is left as a ring with the light base showing through its middle. Arc fitting
    // off, since it writes G2/G3 arcs the check does not read. Every other setting is Orca's own.
    process: await write('process', {
      ...await flatten(install.resources, ORCA_PRESETS.process), layer_height: String(settings.layerHeight), initial_layer_print_height: String(settings.layerHeight),
      precise_outer_wall: '0', enable_arc_fitting: '0', compatible_printers: [machineName],
      // for investigating a failure: other process settings, as JSON (e.g. '{"wall_loops":"2"}')
      ...JSON.parse(process.env['ORCA_PROCESS_OVERRIDES'] ?? '{}') as Profile,
    }),
    filament: await write('filament', { ...await flatten(install.resources, ORCA_PRESETS.filament), compatible_printers: [] }),
  };
}

/** Orca's result.json: return_code 0 and "Success." when it sliced. */
export interface OrcaResult { return_code: number; error_string: string; [key: string]: unknown }

export interface Sliced { gcode: string; command: string[]; result: OrcaResult }

/**
 * Slices one STL centred on the origin: moves it to the bed's centre (Orca will not slice an object off its bed, and its arrange
 * would move it somewhere unknown), slices it with the profiles, and returns the G-code's path. The G-code's X and Y are then the
 * STL's plus BED_CENTRE. Orca slices on several threads, which can change the order of its moves from run to run, never which lines
 * it prints: the check only looks at where the lines are.
 */
export async function slice(install: OrcaInstall, stl: string, directory: string, settings: SliceSettings): Promise<Sliced> {
  const mesh = parseStl(await readFile(stl));
  for (let i = 0; i < mesh.tris.length; i += 3) { mesh.tris[i] = (mesh.tris[i] ?? 0) + BED_CENTRE[0]; mesh.tris[i + 1] = (mesh.tris[i + 1] ?? 0) + BED_CENTRE[1]; }
  const placed = join(directory, 'placed.stl');
  await writeFile(placed, writeBinaryStl(mesh, 'canfactory slicer check'));
  const files = await writeProfiles(install, directory, settings);
  const command = [install.executable, '--slice', '0', '--arrange', '0', '--load-settings', `${files.machine};${files.process}`, '--load-filaments', files.filament, '--outputdir', directory, placed];
  let failure: unknown;
  try { await exec(command[0] ?? '', command.slice(1), { cwd: directory, timeout: 600_000, maxBuffer: 16 * 1_048_576, env: { ...process.env, LC_ALL: 'C' } }); }
  catch (error) { failure = error; }
  let result: OrcaResult;
  try { result = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')) as OrcaResult; }
  catch { result = { return_code: -1, error_string: `no result.json (${failure instanceof Error ? failure.message.slice(0, 500) : String(failure)})` }; }
  if (result.return_code !== 0 || failure) throw Object.assign(new Error(`OrcaSlicer failed (${result.return_code}): ${result.error_string}`), { command, result });
  return { gcode: join(directory, 'plate_1.gcode'), command, result };
}

/** The installed version, from Orca's first line of help (e.g. "OrcaSlicer-2.4.2:"). */
export async function orcaVersion(install: OrcaInstall): Promise<string> {
  try {
    const { stdout } = await exec(install.executable, ['--help'], { timeout: 60_000, maxBuffer: 4 * 1_048_576, env: { ...process.env, LC_ALL: 'C' } });
    return stdout.split('\n')[0]?.replace(/:$/, '') ?? 'unknown';
  } catch (error) { return `unknown (${error instanceof Error ? error.message.slice(0, 200) : String(error)})`; }
}
