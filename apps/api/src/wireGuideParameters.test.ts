import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WIRE_GUIDE_DESIGN, prototypeWireGuide, validateParameters, validateWireGuideDesign, type ParameterValues } from '@canfactory/contracts';
import { RENDERER_FINGERPRINT, RenderFailure, renderJob, repositoryRoot, sourceFingerprint, type PostgresStorage, type RenderJob } from '@canfactory/server';
import { createApp } from './app.ts';

// The wire-guide design is a document parameter: the API and the worker check it with the same function, so an invalid design is
// rejected with the same field-level issues by both. Neither path reaches storage: the API rejects it before enqueueing, and the
// worker before rendering.
let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
afterAll(() => app.close());

const invalid = () => {
  const design = structuredClone(DEFAULT_WIRE_GUIDE_DESIGN);
  const [wire, print] = [design.wires[1], design.prints[0]];
  if (!wire || !print) throw new Error('Expected the default design’s wires and print.');
  wire.from = [2, 2]; // where W1 already ends
  print.wireIds.push('W9'); // not in the design
  return design;
};
const post = (parameters: unknown) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: prototypeWireGuide.id, modelVersion: prototypeWireGuide.version, parameters } });

/** What the worker says of these queued parameters: renderJob revalidates them before it renders anything. */
async function workerIssues(parameters: ParameterValues): Promise<string> {
  const store = { projectRoot: repositoryRoot, temporaryDir: '/nonexistent' } as unknown as PostgresStorage;
  const job: RenderJob = {
    id: 'job', cacheKey: 'key', modelId: prototypeWireGuide.id, modelVersion: prototypeWireGuide.version, sourceHash: sourceFingerprint(repositoryRoot, prototypeWireGuide),
    rendererFingerprint: RENDERER_FINGERPRINT, parameters, status: 'running', createdAt: 0, expiresAt: 0, attempts: 1, leaseToken: 'lease', leaseUntil: null,
    slotCount: null, artifact: null, error: null,
  };
  try { await renderJob(store, job, new AbortController().signal, () => Promise.reject(new Error('OpenSCAD must not run.'))); }
  catch (error) {
    if (error instanceof RenderFailure && error.code === 'SETTINGS_INVALID') return error.detail;
    throw error;
  }
  throw new Error('The worker accepted an invalid design.');
}

describe('the wire-guide design parameter', () => {
  it('is rejected with validateWireGuideDesign’s field-level issues, identically by the API and the worker', async () => {
    const design = invalid();
    const expected = validateWireGuideDesign(design).map(issue => ({ field: `design${issue.path}`, message: issue.message }));
    expect(expected.map(issue => issue.field)).toEqual(expect.arrayContaining(['design/prints/0/wireIds/4', 'design/wires/1/from']));
    expect(validateParameters(prototypeWireGuide, { design })).toEqual(expected);
    const response = await post({ design });
    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string; issues: unknown }>()).toMatchObject({ code: 'INVALID_PARAMETERS', issues: expected });
    expect(await workerIssues({ design })).toBe(expected.map(issue => `${issue.field}: ${issue.message}`).join(' '));
  });
  it('reports a schema mismatch inside the design with the contract’s paths, also in the worker', async () => {
    const design = { ...structuredClone(DEFAULT_WIRE_GUIDE_DESIGN), guide: { ...DEFAULT_WIRE_GUIDE_DESIGN.guide, coverThickness: 9 } };
    const response = await post({ design });
    expect(response.statusCode).toBe(422);
    const { issues } = response.json<{ issues: { field: string }[] }>();
    expect(issues.map(issue => issue.field)).toContain('design/guide/coverThickness');
    expect(await workerIssues({ design })).toContain('design/guide/coverThickness');
  });
  it('takes a design up to its size bound in one request', async () => {
    // a long KiPrint project id brings the body near 200 kB, past the 32 kB the API used to take
    const design = { ...structuredClone(DEFAULT_WIRE_GUIDE_DESIGN), components: Array.from({ length: 100 }, (_, i) => ({ ref: `R${i}`, footprint: 'x'.repeat(64), pins: Array.from({ length: 2 }, (_, k) => [i % 20, k] as [number, number]), body: { kind: 'box' as const, x: 0, y: 0, w: 0.1, h: 0.1, height: 0.1 } })) };
    const response = await post({ design });
    // too many shared pins to be valid, but read and checked, not refused for its size
    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('INVALID_PARAMETERS');
  });
});
