// What the assistant's activity panel says about each CanFactory tool result (#169). Without a summarizer, the panel shows a
// completed app tool as “Unknown” (tinytinkerer's neutral fallback, which this leaves alone), however good the result was.
//
// Each summary keeps three facts apart:
// - Execution: a tool that threw is the panel's own “failed” entry; a summarizer only ever sees a result that came back.
// - The domain: no matching parts or a `connected: false` pair is a successful read (`ok`); a design that is `valid: false`, or a
//   parameter change or design the editor rejected (`ok: false`), is `error` and names its issues; a read that is partly
//   unanswerable (a pair naming an undrilled hole) is `warn`.
// - Rendering: a summary states what the result observed when it came back. Opening a design or changing parameters only
//   requests a render, so it says the render is not ready yet; canfactory_get_editor_state's summary reports the render status it
//   read (queued, rendering, updating, invalid, failed or ready). A summary never promises a later render: read the state again.
//
// The collapsed line is one sentence; the expanded entry adds the details and the raw result (the panel bounds its size), so a
// board's layout is never dumped by default. A result that doesn't match the tool's output schema (or is absent) is not
// relabelled: it stays `unknown`, with whatever came back.
//
// Adding a tool (#170: e.g. reference-based validate/open tools): give it an output schema, write a `describe…` function over its
// result type here, and pass `summarize(label, outputSchema, describe…)` to `tool()` in tools.ts, or as the stage method's
// `summarizeActivity`. Keep the same rules: a rejection is `error` with its issues, a requested render is “not ready yet”.
import type { ActivityStatus, ActivitySummarizer, ActivityViewSection, z } from '@nntin/tinytinkerer-embed';
import type { boardLayoutResult, boardQueryResult, editorStateResult, modelSchemaResult, modelsResult, openDesignResult, partResult, searchResult, setParametersResult, validationResult } from './results.ts';

/** A result's summary: one line for the collapsed entry, and the lines its expanded entry adds above the raw result. */
export interface Summary {
  title: string;
  status: Exclude<ActivityStatus, 'unknown'>;
  details?: string[];
}
type Input = Record<string, unknown> | undefined;

/**
 * A summarizer that checks the result against the tool's own output schema (results.ts) before describing it. The runtime has already
 * checked it, so a mismatch here means the record is not this tool's result (absent, or restored from elsewhere): `unknown`.
 */
export function summarize<O extends z.ZodType>(label: string, output: O, describe: (result: z.output<O>, input: Input) => Summary): ActivitySummarizer {
  return (raw, input) => {
    const parsed = output.safeParse(raw);
    if (!parsed.success) {
      const absent = raw === undefined || raw === null;
      const sections: ActivityViewSection[] = [{ kind: 'text', label: '', value: absent ? 'No result was recorded.' : 'This result does not match the tool’s output schema; it is shown as received.' }];
      if (!absent) sections.push({ kind: 'json', label: 'Output', value: raw });
      return { title: `${label}: unrecognized result`, status: 'unknown', sections };
    }
    const { title, status, details = [] } = describe(parsed.data, input);
    return {
      title: `${label}: ${title}`, status,
      sections: [...details.map((value): ActivityViewSection => ({ kind: 'text', label: '', value })), { kind: 'json', label: 'Output', value: raw }],
    };
  };
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const text = (input: Input, key: string) => { const value = input?.[key]; return typeof value === 'string' && value.trim() !== '' ? value : null; };
const hole = ([column, row]: readonly [number, number]) => `[${column}, ${row}]`;
const clip = (value: string, length = 140) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const mm = (value: number) => String(Math.round(value * 10) / 10);

/** A rejection's issues: the count and the first one for the title, every one for the details. */
function issues<T>(list: readonly T[], show: (issue: T) => string): { title: string; details: string[] } {
  const [first] = list;
  if (first === undefined) return { title: 'no issues listed', details: [] };
  return { title: `${plural(list.length, 'issue')}: ${clip(show(first))}`, details: list.map(issue => `• ${show(issue)}`) };
}
const designIssue = (issue: { path: string; message: string }) => `${issue.path === '' ? '(design)' : issue.path}: ${issue.message}`;
const fieldIssue = (issue: { field: string; message: string }) => `${issue.field}: ${issue.message}`;

export function describeSearch(result: z.output<typeof searchResult>, input: Input): Summary {
  const query = text(input, 'query');
  const family = text(input, 'family');
  const asked = [query ? `“${query}”` : null, family ? `in ${family}` : null].filter(Boolean).join(' ') || 'all parts';
  if (result.total === 0) return { status: 'ok', title: `no parts match ${asked}`, details: [`${plural(result.families.length, 'family', 'families')} available: ${result.families.map(item => item.id).join(', ')}`] };
  const shown = result.parts.length < result.total ? `, showing ${result.parts.length}` : '';
  return { status: 'ok', title: `${plural(result.total, 'part')} ${result.total === 1 ? 'matches' : 'match'} ${asked}${shown}`, details: result.parts.map(part => `${part.id}: ${part.title} (${part.designation})`) };
}

export function describePart(result: z.output<typeof partResult>): Summary {
  const estimated = result.dimensions.filter(dimension => dimension.basis === 'estimated').length;
  return {
    status: 'ok',
    title: `${result.title} (${result.id}), ${plural(result.dimensions.length, 'dimension')} from ${plural(result.sources.length, 'source')}`,
    details: [`Family: ${result.family}${result.prototypeBoard ? ' (a prototype board: read its layout for the holes)' : ''}`, ...(estimated > 0 ? [`${estimated} of the dimensions are estimated`] : [])],
  };
}

export function describeBoardLayout(result: z.output<typeof boardLayoutResult>): Summary {
  const { grid, outline } = result;
  const kinds = (['strip', 'rail', 'linked'] as const).map(kind => [kind, result.nets.filter(net => net.kind === kind).length] as const).filter(([, count]) => count > 0);
  return {
    status: 'ok',
    title: `${result.partId}, ${grid.columns} × ${grid.rows} grid at ${mm(grid.pitch)} mm, ${plural(result.holeCount, 'hole')}, ${plural(result.nets.length, 'net')}`,
    details: [
      `Outline ${mm(outline.L)} × ${mm(outline.W)} × ${mm(outline.t)} mm; drill ${mm(result.drill)} mm${result.plated ? ', plated' : ''}`,
      `Nets: ${kinds.map(([kind, count]) => plural(count, kind)).join(', ') || 'none'}`,
      `${plural(result.mountingHoles.length, 'mounting hole')}; ${plural(result.emptyGridPositions, 'empty grid position')}`,
    ],
  };
}

export function describeBoardQuery(result: z.output<typeof boardQueryResult>, input: Input): Summary {
  const parts: string[] = [];
  const details: string[] = [];
  if (result.holes.length > 0) {
    parts.push(`${plural(result.holes.length, 'hole')} (${result.holes.filter(item => item.drilled).length} drilled)`);
    details.push(...result.holes.map(item => item.drilled ? `${hole(item.hole)}: ${item.label ?? 'unlabelled'}, ${item.net ?? 'no net'}` : `${hole(item.hole)}: not drilled`));
  }
  if (result.labels.length > 0) {
    parts.push(`${plural(result.labels.length, 'label')} (${result.labels.filter(item => item.found).length} found)`);
    details.push(...result.labels.map(item => item.found ? `${item.query} → ${hole(item.hole)}, ${item.net ?? 'no net'}` : `${item.query}: no such label`));
  }
  const problems = result.connected.filter(pair => pair.problem !== undefined).length;
  if (result.connected.length > 0) {
    const linked = result.connected.filter(pair => pair.connected).length;
    parts.push(`${plural(result.connected.length, 'pair')}: ${linked} connected, ${result.connected.length - linked} not connected${problems > 0 ? `, ${problems} naming an undrilled hole` : ''}`);
    details.push(...result.connected.map(pair => `${hole(pair.a)}–${hole(pair.b)}: ${pair.connected ? `connected${pair.net ? ` (${pair.net})` : ''}` : 'not connected'}${pair.problem ? `; ${pair.problem}` : ''}`));
  }
  const board = text(input, 'partId');
  return { status: problems > 0 ? 'warn' : 'ok', title: `${board ? `${board}, ` : ''}${parts.join('; ') || 'nothing queried'}`, details };
}

export function describeValidation(result: z.output<typeof validationResult>): Summary {
  if (result.valid && result.issues.length === 0) return { status: 'ok', title: 'design valid, no issues' };
  const found = issues(result.issues, designIssue);
  // `valid` with issues contradicts the validation's own rule; say so rather than pick one.
  if (result.valid) return { status: 'warn', title: `reported valid, but with ${found.title}`, details: found.details };
  return { status: 'error', title: `design invalid, ${found.title}`, details: found.details };
}

export function describeModels(result: z.output<typeof modelsResult>): Summary {
  return { status: 'ok', title: `${plural(result.models.length, 'model')}, ${result.models.filter(model => model.adjustable).length} adjustable`, details: result.models.map(model => `${model.id}: ${model.title} (${model.format})`) };
}

export function describeModelSchema(result: z.output<typeof modelSchemaResult>): Summary {
  const advanced = result.parameters.filter(parameter => parameter.group === 'advanced').length;
  return { status: 'ok', title: `${result.title} (${result.id}), ${plural(result.parameters.length, 'parameter')}${advanced > 0 ? ` (${advanced} advanced)` : ''}`, details: result.parameters.map(parameter => `${parameter.key}: ${parameter.label} (${parameter.kind})`) };
}

/** The last finished render's size, as the editor reports it. */
function size(render: z.output<typeof editorStateResult>['render']): string | null {
  if (render.dimensions) return `${mm(render.dimensions.x)} × ${mm(render.dimensions.y)} × ${mm(render.dimensions.z)} mm`;
  if (render.parts !== null) return `${plural(render.parts, 'part')}${render.volumeMm3 !== null ? `, ${mm(render.volumeMm3)} mm³` : ''}`;
  return null;
}

const PENDING = { queued: 'render queued', rendering: 'rendering', updating: 'render pending for new settings' } as const;

export function describeEditorState(result: z.output<typeof editorStateResult>): Summary {
  const { render } = result;
  const finished = size(render);
  const details = [`${result.modelId} v${result.modelVersion}, ${plural(Object.keys(result.parameters).length, 'parameter')}`];
  switch (render.status) {
    case 'ready': return { status: 'ok', title: `${result.title}, render ready${finished ? ` (${finished})` : ''}`, details };
    case 'failed': return { status: 'error', title: `${result.title}, render failed: ${clip(render.error ?? 'no reason given')}`, details };
    case 'invalid': {
      const found = issues(result.issues, fieldIssue);
      return { status: 'error', title: `${result.title}, settings invalid so nothing renders, ${found.title}`, details: [...details, ...found.details] };
    }
    default:
      // Pending is not a problem, and not ready either: the summary is this read's observation, never a promise.
      return { status: 'ok', title: `${result.title}, ${PENDING[render.status]} when read, not ready`, details: finished ? [...details, `Last finished render (older settings): ${finished}`] : details };
  }
}

const NOT_READY = 'render requested, not ready yet';

export function describeSetParameters(result: z.output<typeof setParametersResult>, input: Input): Summary {
  if (!result.ok) {
    const found = issues(result.issues, fieldIssue);
    return { status: 'error', title: `rejected, nothing changed, ${found.title}`, details: found.details };
  }
  const changed = input?.['parameters'];
  const keys = changed && typeof changed === 'object' ? Object.keys(changed) : [];
  return {
    status: 'ok',
    title: `${result.modelId}, set ${keys.length > 0 ? clip(keys.join(', '), 80) : 'parameters'}${result.opened ? ', opened its editor' : ''}; ${NOT_READY}`,
    details: [`${plural(Object.keys(result.parameters).length, 'parameter')} in effect`, 'Read canfactory_get_editor_state for the render status.'],
  };
}

export function describeOpenDesign(result: z.output<typeof openDesignResult>): Summary {
  if (!result.ok) {
    const found = issues(result.issues, designIssue);
    return { status: 'error', title: `design rejected, nothing opened, ${found.title}`, details: found.details };
  }
  const { summary } = result;
  return {
    status: 'ok',
    title: `${result.opened ? 'opened the design' : 'replaced the open design'} on ${summary.board}, ${plural(summary.wires, 'wire')}, ${plural(summary.prints.length, 'print')}; ${NOT_READY}`,
    details: [`Wire ${summary.wire}; ${plural(summary.levels, 'level')}`, ...summary.prints.map(print => `${print.id}: ${plural(print.wires, 'wire')}`), 'Read canfactory_get_editor_state for the render status.'],
  };
}
