/**
 * Geometry sweep: renders every catalogue model at the edges of its parameter space and at seeded random settings, through the
 * worker's own pipeline (renderJob), and fails on any render failure or float32 sliver repair. The renderer tests pin chosen
 * cases; this looks where nobody chose to, which is where geometry that is only valid by coincidence breaks.
 *
 *   SWEEP_SAMPLES=5          random valid settings per model (seeded)
 *   SWEEP_SEED=1             the seed; CI's nightly run rotates it, so every night looks somewhere new
 *   SWEEP_BOUNDARIES=1       also each numeric parameter at its minimum, one step above and its maximum, and every option
 *   SWEEP_CONCURRENCY=2      renders at once
 *   SWEEP_REPORT=path.md     also write the results as Markdown (and to $GITHUB_STEP_SUMMARY when set)
 *   TEST_ONLY=litter-shovel  one model
 *   OPENSCAD_TEST_MODE       the renderer (tools/renderers.ts): Docker by default, `native` or `wasm`
 *
 * Every failure prints the settings that differ from the model's defaults, which is all it takes to reproduce it in the editor.
 */
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { models, validateParameters, type ModelDefinition, type ParameterValues } from '@canfactory/contracts';
import { repositoryRoot, Store } from '@canfactory/server';
import { classifyRenderError, renderJob, type MeshRepair } from '../apps/worker/src/render.ts';
import { selectRunner } from './renderers.ts';

const env = (name: string, fallback: string) => process.env[name] ?? fallback;
const samples = Number(env('SWEEP_SAMPLES', '5'));
const seed = Number(env('SWEEP_SEED', '1'));
const boundaries = env('SWEEP_BOUNDARIES', '1') !== '0';
const concurrency = Math.max(1, Number(env('SWEEP_CONCURRENCY', '2')));
const only = process.env['TEST_ONLY'];

/** mulberry32: small, seedable, and the same everywhere. */
function random(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Property { type?: string; minimum?: number; maximum?: number; multipleOf?: number; anyOf?: { const?: unknown }[]; enum?: unknown[] }
/** What a parameter may be, from the model's JSON schema: a stepped range, a set of options, a switch, or (text, logos) fixed. */
type Domain = { kind: 'range'; min: number; max: number; step: number } | { kind: 'options'; values: (string | number | boolean)[] } | { kind: 'fixed' };
function domain(property: Property): Domain {
  const options = property.enum ?? property.anyOf?.map(option => option.const).filter(value => value !== undefined);
  if (options?.length) return { kind: 'options', values: options as (string | number | boolean)[] };
  if (property.type === 'boolean') return { kind: 'options', values: [false, true] };
  if ((property.type === 'number' || property.type === 'integer') && property.minimum !== undefined && property.maximum !== undefined)
    return { kind: 'range', min: property.minimum, max: property.maximum, step: property.multipleOf ?? (property.type === 'integer' ? 1 : 0.1) };
  return { kind: 'fixed' };
}
/** A value on the range's grid, without float noise (0.1 × 3 is 0.30000000000000004). */
const onGrid = (min: number, step: number, steps: number) => {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number((min + step * steps).toFixed(decimals));
};

function domains(model: ModelDefinition): [string, Domain][] {
  const properties = (model.parameterSchema as { properties?: Record<string, Property> }).properties ?? {};
  return Object.entries(properties).map(([key, property]) => [key, domain(property)]);
}

/** Each parameter at the edges of its range and in each of its options, the others at their defaults. */
function boundarySettings(model: ModelDefinition): ParameterValues[] {
  return domains(model).flatMap(([key, found]): ParameterValues[] => {
    const values = found.kind === 'range' ? [found.min, onGrid(found.min, found.step, 1), found.max] : found.kind === 'options' ? found.values : [];
    return values.filter(value => value !== model.defaults[key]).map(value => ({ ...model.defaults, [key]: value }));
  });
}

/** `count` random valid settings: every parameter drawn at once, so that combinations nobody chose come up. */
function randomSettings(model: ModelDefinition, count: number, next: () => number): { settings: ParameterValues[]; rejected: number } {
  const settings: ParameterValues[] = [];
  let rejected = 0;
  const all = domains(model);
  for (let attempt = 0; settings.length < count && attempt < count * 200; attempt++) {
    const candidate: ParameterValues = { ...model.defaults };
    for (const [key, found] of all) {
      if (found.kind === 'range') candidate[key] = onGrid(found.min, found.step, Math.floor(next() * (Math.floor((found.max - found.min) / found.step + 1e-9) + 1)));
      else if (found.kind === 'options') candidate[key] = found.values[Math.floor(next() * found.values.length)] ?? model.defaults[key] ?? '';
    }
    if (validateParameters(model, candidate).length) rejected++;
    else settings.push(candidate);
  }
  return { settings, rejected };
}

/** The settings that differ from the defaults: the reproduction. */
const changed = (model: ModelDefinition, parameters: ParameterValues) =>
  Object.fromEntries(Object.entries(parameters).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(model.defaults[key])));

interface Result { model: string; kind: 'boundary' | 'random'; settings: Record<string, unknown>; outcome: 'pass' | 'repaired' | 'failed'; code?: string; detail?: string; seconds: number }

const directory = await mkdtemp(join(tmpdir(), 'canfactory-sweep-'));
const store = new Store(directory, repositoryRoot);
store.migrate(); store.seed();
const runner = selectRunner(directory);
const results: Result[] = [];
let invalidBoundaries = 0;
try {
  const work: { model: ModelDefinition; kind: Result['kind']; parameters: ParameterValues }[] = [];
  models.forEach((model, index) => {
    if (only && model.id !== only) return;
    const seen = new Set<string>();
    const add = (kind: Result['kind'], parameters: ParameterValues) => {
      const key = JSON.stringify(parameters);
      if (!seen.has(key)) { seen.add(key); work.push({ model, kind, parameters }); }
    };
    if (boundaries) for (const parameters of boundarySettings(model)) {
      if (validateParameters(model, parameters).length) invalidBoundaries++;
      else add('boundary', parameters);
    }
    const drawn = randomSettings(model, samples, random(seed * 1000 + index));
    if (drawn.settings.length < samples) console.warn(`WARN ${model.id}: only ${drawn.settings.length} of ${samples} random settings were valid (${drawn.rejected} rejected)`);
    for (const parameters of drawn.settings) add('random', parameters);
  });
  console.log(`Sweeping ${work.length} settings (seed ${seed}, ${samples} random per model${boundaries ? ', with boundaries' : ''}), ${concurrency} at a time`);

  let cursor = 0;
  const lane = async () => {
    for (let item = work[cursor++]; item; item = work[cursor++]) {
      const { model, kind, parameters } = item;
      // enqueue and claim are synchronous, so no other lane's job comes between them: this claims the job just queued.
      const queued = store.enqueue(model, parameters);
      const claimed = store.claim();
      if (!claimed?.leaseToken || claimed.id !== queued.id) throw new Error(`Could not claim the sweep's job for ${model.id}`);
      const started = Date.now();
      const settings = changed(model, parameters);
      const repairs: MeshRepair[] = [];
      let result: Result;
      const token = claimed.leaseToken;
      const heartbeat = setInterval(() => store.renew(claimed.id, token), 5000);
      try {
        await renderJob(store, claimed, new AbortController().signal, runner, repair => repairs.push(repair));
        result = { model: model.id, kind, settings, outcome: repairs.length ? 'repaired' : 'pass', seconds: (Date.now() - started) / 1000,
          ...repairs.length ? { detail: repairs.map(repair => `${repair.part}: ${repair.repaired} repaired`).join(', ') } : {} };
      } catch (error) {
        const failure = classifyRenderError(error);
        result = { model: model.id, kind, settings, outcome: 'failed', code: failure.code, detail: failure.detail, seconds: (Date.now() - started) / 1000 };
      } finally { clearInterval(heartbeat); }
      results.push(result);
      const label = result.outcome === 'pass' ? 'PASS' : result.outcome === 'repaired' ? 'REPAIRED' : `FAIL ${result.code ?? ''}`;
      console.log(`${label} ${model.id} ${kind} ${JSON.stringify(settings)} ${result.seconds.toFixed(1)} s${result.detail ? `\n    ${result.detail}` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, lane));
} finally {
  store.close(); await rm(directory, { recursive: true, force: true });
}

const bad = results.filter(result => result.outcome !== 'pass');
const summary = [
  `## Geometry sweep (seed ${seed})`, '',
  `${results.length} renders: ${results.length - bad.length} passed, ${bad.filter(result => result.outcome === 'repaired').length} needed float32 sliver repairs, ${bad.filter(result => result.outcome === 'failed').length} failed.${invalidBoundaries ? ` ${invalidBoundaries} boundary settings were invalid on their own and skipped.` : ''}`,
  ...bad.length ? ['', '| Model | Settings (changed from defaults) | Outcome | Detail |', '| --- | --- | --- | --- |',
    ...bad.map(result => `| ${result.model} | \`${JSON.stringify(result.settings)}\` | ${result.outcome === 'failed' ? `failed: ${result.code ?? ''}` : 'repaired'} | ${(result.detail ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`)] : [],
  '',
].join('\n');
console.log(`\n${summary}`);
const report = process.env['SWEEP_REPORT'];
if (report) await writeFile(report, summary);
const stepSummary = process.env['GITHUB_STEP_SUMMARY'];
if (stepSummary) await appendFile(stepSummary, summary);
if (bad.length) process.exitCode = 1;
