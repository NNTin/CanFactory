import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Box, CircleAlert, Copy, CornerUpLeft, CornerUpRight, Focus, Link, Magnet, Maximize, Minus, Move, Plus, RotateCw, Scaling, Trash2, Unlink } from 'lucide-react';
import {
  addEnclosure, addPlatform, addTunnel, configureSubassembly, connect, CONNECT_REACH, connectTargets, deleteDependents, deleteInstance, detach, DOOR_SEAT_LABELS, DOOR_SEAT_SETTING, DOOR_SEATS,
  duplicateInstance, elementTitle, ENCLOSURE_DEFAULT, extendTunnel, moveInstance, ORIENTATION_YAW, platformOrientation, platformRangeOf, PLATFORM_ORIENTATIONS, PLATFORM_RECIPES,
  PORT_CLOSURE_LABELS, PORT_CLOSURE_SETTING, PORT_CLOSURES, portTitle, raiseElements, rangeText, resizeGarden, resizeInstance, resizeWindow, rotateInstance, routeElements, setCatPorts,
  hasSubject, SUBASSEMBLY_CONTROLS, turnTunnel, worldTransforms, type CatioSubassembly, type DoorSeat, type PortClosure, type SubassemblyControl,
  type CommandResult, type EvaluatedElement, type EvaluatedInstance, type EvaluatedTunnel, type Instance, type Port, type Project, type ProjectEvaluation, type ProjectIssue, type TunnelEnd,
} from '@canfactory/catio';
import { PlannerStoreContext, usePlannerHistory, usePlannerStore, type PlannerStore } from './catioPlannerStore.ts';
import { CAMERA_VIEWS, createPlannerViewport, tunnelModules, type CameraView, type PlannerViewport, type Readout } from './catioPlannerViewport.ts';
import type { PlannerTool } from './catioPlannerScene.ts';
import { BuildListSlot } from './CatioPlannerBuildList.tsx';
import { ControlFields, HistoryButtons, SharedNote } from './CatioControls.tsx';
import { CATIO_SUBASSEMBLY_DEFINITIONS } from './catioSubassemblies.ts';
import type { SubassemblyDefinition } from './catioSubassembly.ts';
import { formatHash } from './route.ts';

/**
 * The catio planner (#109, FR-01/02): an IKEA-planner-style editor over the project document. The catalogue and object tree on the
 * left, the viewport in the middle, the selection's inspector and the design's issues on the right, the project's name, undo and
 * redo and the build list along the top. Every edit is a command of @canfactory/catio committed to the store as one undo step.
 */
export function CatioPlanner({ store }: { store: PlannerStore }) {
  return <PlannerStoreContext.Provider value={store}><PlannerPage /></PlannerStoreContext.Provider>;
}

/** What a problem marks on its instances: an error with the design's numbers, geometry or connections. */
const flags = (issue: ProjectIssue) => issue.severity === 'error' && (issue.kind === 'geometry' || issue.kind === 'connection' || issue.kind === 'input');
const KIND_TITLES: Record<string, string> = { window: 'Window', tunnel: 'Tunnel', enclosure: 'Enclosure', platform: 'Platform' };
/** Page Up / Page Down's step, and with Shift (FR-02.6). */
const ELEVATION_STEP = { fine: 10, coarse: 100 } as const;
const TOOLS: { tool: PlannerTool; label: string; title: string; icon: ReactNode }[] = [
  { tool: 'move', label: 'Move', title: 'Move: drag the object to move it, its ring to turn it; a platform slides by its double arrow and rises by its upright one', icon: <Move size={13} aria-hidden="true" /> },
  { tool: 'rotate', label: 'Rotate', title: 'Rotate: drag the object or its ring to turn it', icon: <RotateCw size={13} aria-hidden="true" /> },
  { tool: 'resize', label: 'Resize', title: 'Resize: drag a handle on a face to change the size; the opposite face stays put', icon: <Scaling size={13} aria-hidden="true" /> },
];
/** Whether a key press is meant for a field rather than the planner. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function PlannerPage() {
  const store = usePlannerStore();
  const history = usePlannerHistory();
  const project = history.present;
  const evaluation = store.evaluation();
  const selection = project.view.selection;
  const [snap, setSnap] = useState(true);
  const [tool, setTool] = useState<PlannerTool>('move');
  const [view, setView] = useState<CameraView>('3D');
  /** The last edit's refusal (an alert) or what it did other than asked (a note). */
  const [status, setStatus] = useState<{ text: string; alert: boolean } | null>(null);
  const [focusedIssue, setFocusedIssue] = useState<string | null>(null);
  const flagged = useMemo(() => [...new Set(evaluation.issues.filter(flags).flatMap(i => i.instanceIds))], [evaluation]);

  /** Runs a command on the present project: one undo step, or its errors shown; its notes (where a platform stopped) are shown too. */
  const run = (result: CommandResult, select?: string | null) => {
    if (result.errors.length) { setStatus({ text: result.errors.join(' '), alert: true }); return result.errors; }
    setStatus(result.notes?.length ? { text: result.notes.join(' '), alert: false } : null); store.apply(result.project);
    if (select) store.select([select]);
    return [];
  };

  const container = useRef<HTMLDivElement>(null);
  const viewport = useRef<PlannerViewport | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const created = createPlannerViewport(element, {
      select: ids => store.select(ids),
      readout: setReadout,
      commit(id, { how, to, size }) {
        const present = store.get().present;
        if (how === 'rotate') { run(rotateInstance(present, id, to.yaw)); return; }
        if (how !== 'resize' || !size) { run(moveInstance(present, id, { x: to.x, y: to.y, z: to.z })); return; }
        // a face dragged: the new size, and where it then stands so that the opposite face stays, as one edit
        const resized = resizeInstance(present, id, size);
        run(resized.errors.length ? resized : moveInstance(resized.project, id, { x: to.x, y: to.y }));
      },
      raise(ids, delta) { run(raiseElements(store.get().present, ids, delta)); },
      grow(port, modules) { const result = addTunnel(store.get().present, port, modules); run(result, result.id); },
      extend(end, modules) { run(extendTunnel(store.get().present, end, modules)); },
      turn(end, side) { run(turnTunnel(store.get().present, end, side)); },
    });
    if (!created) { setUnsupported(true); return; }
    viewport.current = created;
    return () => { created.dispose(); viewport.current = null; };
    // the store is the page's for its whole life
  }, []);
  useEffect(() => { viewport.current?.update({ project, evaluation, selection, flagged, snap, tool }); }, [project, evaluation, selection, flagged, snap, tool]);

  // Keys: never while a field has the focus. Esc abandons the edit in progress.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target)) return;
      if (event.key === 'Escape') { if (!viewport.current?.cancel()) store.cancel(); return; }
      if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); elevateRef.current(event.key === 'PageUp' ? 1 : -1, event.shiftKey); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); store.undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); store.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const selected = selection.length === 1 ? project.instances.find(i => i.id === selection[0]) : undefined;
  /** The selection when it is tunnel elements only (one or several): what rises and falls as `raiseElements` raises them. */
  const elementIds = useMemo(() => { const known = routeElements(project); return selection.length && selection.every(id => known.has(id)) ? selection : []; }, [project, selection]);
  /** Raises (`direction` 1) or lowers the selection one step, 100 mm with Shift: tunnel elements, or a platform; an enclosure stands on the ground. */
  const elevate = (direction: 1 | -1, coarse: boolean) => {
    const present = store.get().present;
    const step = direction * (coarse ? ELEVATION_STEP.coarse : ELEVATION_STEP.fine);
    const known = routeElements(present);
    if (present.view.selection.length && present.view.selection.every(id => known.has(id))) { run(raiseElements(present, present.view.selection, step)); return; }
    const [id] = present.view.selection; const instance = present.view.selection.length === 1 ? present.instances.find(i => i.id === id) : undefined;
    if (instance?.kind !== 'platform') { setStatus({ text: instance?.kind === 'enclosure' ? 'An enclosure stands on the ground: raise or lower a platform in it.' : 'Select a platform, or tunnel elements, to raise or lower them.', alert: true }); return; }
    run(moveInstance(present, instance.id, { z: instance.transform.z + step }));
  };
  const elevateRef = useRef(elevate); elevateRef.current = elevate;
  const movable = selected?.kind === 'enclosure' || selected?.kind === 'platform';
  const enclosureFor = (instance: Instance | undefined) => instance?.kind === 'enclosure' ? instance.id
    : instance?.kind === 'platform' ? instance.parent : project.instances.find(i => i.kind === 'enclosure')?.id ?? null;
  const addAnEnclosure = () => { const result = addEnclosure(project, freeSpot(project)); run(result, result.id); };
  /** The selected cat port, when it is one a tunnel can start from: a window's or an enclosure's, coupled to nothing. */
  const freePort = selection.length === 1 ? startable(project, selection[0] ?? '') : undefined;
  const addATunnel = () => {
    if (!freePort) { setStatus({ text: 'Select a free cat port first: click a green port marker in the viewport, or a port in an enclosure’s inspector.', alert: true }); return; }
    const result = addTunnel(project, freePort.id); run(result, result.id);
  };
  const addAPlatform = () => {
    const enclosure = enclosureFor(selected);
    if (!enclosure) { setStatus({ text: 'Add an enclosure first: a platform stands in one.', alert: true }); return; }
    const result = addPlatform(project, enclosure); run(result, result.id);
  };

  return <div className="planner">
    <div className="planner-bar">
      <label className="planner-name"><span className="eyebrow">PROJECT</span>
        <TextField label="Project name" value={project.name} maxLength={200} onCommit={name => { if (name !== project.name) store.apply({ ...project, name }); }} /></label>
      <HistoryButtons />
      <BuildListSlot />
    </div>
    {status && <p className={`planner-status${status.alert ? '' : ' note'}`} role={status.alert ? 'alert' : 'status'}>{status.text}</p>}
    <div className="planner-layout">
      <aside className="planner-left">
        <section aria-label="Catalogue"><h2 className="eyebrow">CATALOGUE</h2>
          <div className="planner-catalogue">
            <button type="button" onClick={addAnEnclosure}><Plus size={14} aria-hidden="true" /> Enclosure<small>{ENCLOSURE_DEFAULT.width / 10} × {ENCLOSURE_DEFAULT.depth / 10} × {ENCLOSURE_DEFAULT.height / 10} cm</small></button>
            <button type="button" onClick={addAPlatform}><Plus size={14} aria-hidden="true" /> Platform<small>in {enclosureFor(selected) ? nameOf(project, enclosureFor(selected) ?? '') : 'an enclosure'}</small></button>
            <button type="button" onClick={addATunnel}><Plus size={14} aria-hidden="true" /> Tunnel<small>{freePort ? `from ${portTitle(project, freePort.id)}` : 'select a free cat port, then Add'}</small></button>
          </div>
        </section>
        <section aria-label="Objects"><h2 className="eyebrow">OBJECTS</h2>
          <ObjectTree project={project} evaluation={evaluation} selection={selection} select={(id, add) => store.select(add ? (selection.includes(id) ? selection.filter(s => s !== id) : [...selection, id]) : [id])} />
        </section>
      </aside>
      <section className="planner-centre" aria-label="Viewport">
        <div className="planner-tools">
          <div className="catio-cameras" role="group" aria-label="Camera views">
            {CAMERA_VIEWS.map(name => <button key={name} type="button" disabled={unsupported} aria-pressed={view === name} title={name === '3D' ? 'Perspective: drag empty space to orbit' : `${name}: orthographic, drag empty space to pan`}
              onClick={() => { setView(name); viewport.current?.view(name); }}>{name}</button>)}
            <button type="button" disabled={unsupported} onClick={() => viewport.current?.fitAll()}><Maximize size={13} aria-hidden="true" /> Fit all</button>
            <button type="button" disabled={unsupported || !selection.length} onClick={() => viewport.current?.fitSelection()}><Focus size={13} aria-hidden="true" /> Fit selection</button>
          </div>
          <div className="planner-selection-tools" role="group" aria-label="Selection tools">
            {TOOLS.map(t => <button key={t.tool} type="button" aria-pressed={tool === t.tool} disabled={unsupported || !movable} title={t.title} onClick={() => setTool(t.tool)}>{t.icon} {t.label}</button>)}
            <button type="button" disabled={selected?.kind !== 'platform' && !elementIds.length} title="Raise by 10 mm (Page Up; Shift: 100 mm)" onClick={event => elevate(1, event.shiftKey)}><ArrowUp size={13} aria-hidden="true" /> Raise</button>
            <button type="button" disabled={selected?.kind !== 'platform' && !elementIds.length} title="Lower by 10 mm (Page Down; Shift: 100 mm)" onClick={event => elevate(-1, event.shiftKey)}><ArrowDown size={13} aria-hidden="true" /> Lower</button>
          </div>
          <button type="button" className="planner-snap" aria-pressed={snap} onClick={() => setSnap(on => !on)} title="Snap moves to 10 mm (tunnels to whole modules) and turns to 15°"><Magnet size={13} aria-hidden="true" /> Snap {snap ? 'on' : 'off'} · 10 mm · 15°</button>
        </div>
        <div className="planner-canvas" ref={container} data-testid="planner-viewport" data-selection={JSON.stringify(selection)} data-revision={project.revision} data-dragging={readout ? 'true' : 'false'}>
          {unsupported && <div className="catio-fallback" role="status"><Box size={32} /><strong>3D is unavailable</strong><p>This browser has no WebGL. The object tree, the inspector and the issues still work.</p></div>}
          {readout && <div className={`planner-readout${readout.ok ? '' : ' invalid'}`} role="status" style={{ left: readout.x + 18, top: readout.y + 18 }}><strong>{readout.title}</strong>{readout.lines.map(line => <span key={line}>{line}</span>)}</div>}
        </div>
        <p className="planner-hint">Drag an object to move it, its ring to turn it · Shift- or Ctrl-click adds to the selection · a click on a tunnel picks one of its elements: its upright arrow (or Page Up / Page Down) raises the selected elements, and the cat port at either end rises with them · drag from a green cat port to draw a tunnel; a free end’s arrow lengthens or shortens it in whole modules, its round buttons turn it, and the inspector connects it to a port nearby · a platform stays in its enclosure: its double arrow slides it, its upright arrow raises it, its ring turns it West–East or North–South · Resize: drag a face’s handle · empty space: orbit in 3D, pan in Top, Front and Side · middle button pans · scroll zooms · Esc cancels a drag</p>
      </section>
      <aside className="planner-right">
        <Inspector project={project} evaluation={evaluation} selected={selected} elements={elementIds} run={run} remove={id => {
          const removed = deleteDependents(project, id);
          const others = removed.instances.filter(i => i !== id).map(i => nameOf(project, i));
          const connections = removed.connections.length;
          if (others.length || connections) {
            const message = `Deleting ${nameOf(project, id)} also removes ${[...(others.length ? [others.join(', ')] : []), ...(connections ? [`${connections} connection${connections > 1 ? 's' : ''}`] : [])].join(' and ')}.`;
            if (!window.confirm(`${message} Delete them all?`)) return;
          }
          run(deleteInstance(project, id));
        }} />
        <Issues issues={evaluation.issues} project={project} focused={focusedIssue} pick={issue => {
          setFocusedIssue(issue.id);
          // a problem on tunnel elements selects them; otherwise the instances it is on
          const known = routeElements(project);
          const elements = issue.instanceIds.filter(id => known.has(id));
          store.select(elements.length ? elements : issue.instanceIds.filter(id => project.instances.some(i => i.id === id)));
        }} />
      </aside>
    </div>
  </div>;
}

const nameOf = (project: Project, id: string) => project.instances.find(i => i.id === id)?.name ?? elementTitle(project, id) ?? id;

/** A spot on the lawn for a new enclosure, clear of the others (as far as their outlines go), nearest the garden's middle. */
function freeSpot(project: Project) {
  const { width: gw, depth: gd } = project.garden; const { width: w, depth: d } = ENCLOSURE_DEFAULT; const door = 1000; const margin = 200;
  const world = worldTransforms(project);
  const taken = project.instances.flatMap(i => {
    if (i.kind !== 'enclosure') return [];
    const t = world.get(i.id) ?? i.transform; const r = Math.hypot(i.params.width / 2, i.params.depth + door);
    return [{ x0: t.x - r, x1: t.x + r, y0: t.y - r, y1: t.y + r }];
  });
  const candidates: { x: number; y: number }[] = [];
  for (let x = w / 2 + margin; x <= gw - w / 2 - margin; x += 250) for (let y = margin; y <= gd - d - door - margin; y += 250) candidates.push({ x, y });
  candidates.sort((a, b) => Math.hypot(a.x - gw / 2, a.y - gd / 2) - Math.hypot(b.x - gw / 2, b.y - gd / 2));
  return candidates.find(c => taken.every(t => c.x + w / 2 < t.x0 || c.x - w / 2 > t.x1 || c.y + d + door < t.y0 || c.y > t.y1)) ?? { x: gw / 2, y: Math.max(0, gd / 2 - d / 2) };
}

/** Shift, Ctrl or ⌘ held: a click adds to the selection (or takes out). */
const adding = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => event.shiftKey || event.ctrlKey || event.metaKey;

function ObjectTree({ project, evaluation, selection, select }: { project: Project; evaluation: ProjectEvaluation; selection: string[]; select: (id: string, add: boolean) => void }) {
  const errors = (id: string) => evaluation.issues.filter(i => flags(i) && i.instanceIds.includes(id)).length;
  const badge = (count: number) => count > 0 && <span className="planner-badge" title={`${count} problem${count > 1 ? 's' : ''}`}><CircleAlert size={12} aria-hidden="true" /> {count}</span>;
  // a tunnel's route elements under it, in the chain's order
  const elements = (id: string): ReactNode => {
    const tunnel = evaluation.instances.find(e => e.kind === 'tunnel' && e.id === id);
    if (tunnel?.kind !== 'tunnel' || !tunnel.elements.length) return null;
    return <ul className="planner-elements">{tunnel.elements.map(e => <li key={e.id}><button type="button" aria-pressed={selection.includes(e.id)} onClick={event => select(e.id, adding(event))} data-element={e.id}>
      <span>{e.name}</span><small>{Math.abs(e.slope) > 0.05 ? `${e.slope > 0 ? '↗' : '↘'} ${Math.abs(e.slope).toFixed(1)}°` : `${cm(e.floor[0])} cm`}</small>{badge(errors(e.id))}
    </button></li>)}</ul>;
  };
  const children = (parent: string | null): ReactNode => {
    const list = project.instances.filter(i => i.parent === parent);
    if (!list.length) return null;
    return <ul>{list.map(i => <li key={i.id}><button type="button" aria-pressed={selection.includes(i.id)} onClick={event => select(i.id, adding(event))} data-instance={i.id}>
        <span>{i.name ?? i.id}</span><small>{KIND_TITLES[i.kind] ?? i.kind}</small>{badge(errors(i.id))}
      </button>{elements(i.id)}{children(i.id)}</li>)}</ul>;
  };
  return <nav className="planner-tree" aria-label="Object tree">{children(null)}</nav>;
}

function Issues({ issues, project, focused, pick }: { issues: ProjectIssue[]; project: Project; focused: string | null; pick: (issue: ProjectIssue) => void }) {
  const shown = issues.filter(i => i.severity !== 'info');
  const errors = shown.filter(i => i.severity === 'error').length;
  return <section className="planner-issues" aria-label="Issues"><h2 className="eyebrow">ISSUES · {errors} {errors === 1 ? 'ERROR' : 'ERRORS'}, {shown.length - errors} {shown.length - errors === 1 ? 'WARNING' : 'WARNINGS'}</h2>
    {shown.length ? <ul>{shown.map(i => <li key={i.id}><button type="button" className={i.severity} aria-pressed={focused === i.id} onClick={() => pick(i)}>
      <strong>{i.instanceIds.map(id => nameOf(project, id)).join(', ')}</strong><span>{i.message}</span></button></li>)}</ul> : <p>No problems.</p>}
  </section>;
}

interface InspectorProps {
  project: Project; evaluation: ProjectEvaluation; selected: Instance | undefined;
  /** The selected tunnel elements, when the selection is only those. */
  elements: string[];
  run: (result: CommandResult, select?: string | null) => string[]; remove: (id: string) => void;
}
function Inspector({ project, evaluation, selected, elements, run, remove }: InspectorProps) {
  const evaluated = selected && evaluation.instances.find(e => e.id === selected.id);
  const issues = selected ? evaluation.issues.filter(i => i.severity !== 'info' && i.instanceIds.includes(selected.id)) : [];
  const { garden } = project;
  if (elements.length) return <section className="planner-inspector" aria-label="Inspector"><ElementFields project={project} evaluation={evaluation} ids={elements} run={run} /></section>;
  const port = !selected && project.view.selection.length === 1 ? project.ports.find(p => p.id === project.view.selection[0]) : undefined;
  if (port) return <section className="planner-inspector" aria-label="Inspector"><PortFields project={project} port={port} run={run} /></section>;
  return <section className="planner-inspector" aria-label="Inspector">
    {!selected ? <><h2 className="eyebrow">GARDEN</h2>
      <p className="planner-note">Select an object in the viewport or the tree. Everything outside the garden is flagged, never moved or deleted.</p>
      <NumberField label="Width" unit="m" value={garden.width} scale={1000} digits={2} positive onCommit={v => run(resizeGarden(project, { ...garden, width: v }))} />
      <NumberField label="Depth" unit="m" value={garden.depth} scale={1000} digits={2} positive onCommit={v => run(resizeGarden(project, { ...garden, depth: v }))} />
    </> : <>
      <h2 className="eyebrow">{(KIND_TITLES[selected.kind] ?? selected.kind).toUpperCase()}</h2>
      <TextField label="Name" value={selected.name ?? selected.id} maxLength={200} onCommit={name => { if (name !== selected.name) run({ project: { ...project, instances: project.instances.map(i => i.id === selected.id ? { ...i, name } : i) }, errors: [] }); }} />
      {evaluated && <InstanceFields project={project} evaluation={evaluation} instance={selected} evaluated={evaluated} run={run} />}
      {(selected.kind === 'enclosure' || selected.kind === 'platform' || selected.kind === 'tunnel') && <div className="planner-actions">
        {selected.kind !== 'tunnel' && <button type="button" onClick={() => { const result = duplicateInstance(project, selected.id); run(result, result.id); }}><Copy size={14} aria-hidden="true" /> Duplicate</button>}
        <button type="button" onClick={() => remove(selected.id)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
      </div>}
      {issues.length > 0 && <ul className="planner-object-issues" aria-label="Problems with this object">{issues.map(i => <li key={i.id} className={i.severity}>{i.message}</li>)}</ul>}
    </>}
  </section>;
}

function InstanceFields({ project, evaluation, instance, evaluated, run }: { project: Project; evaluation: ProjectEvaluation; instance: Instance; evaluated: EvaluatedInstance; run: InspectorProps['run'] }) {
  const t = instance.transform;
  const move = (patch: { x?: number; y?: number; z?: number }) => run(moveInstance(project, instance.id, patch));
  const resize = (patch: Record<string, number>) => run(resizeInstance(project, instance.id, patch));
  const yaw = <NumberField label="Yaw" unit="°" value={t.yaw} scale={1} digits={0} step={15} onCommit={v => run(rotateInstance(project, instance.id, v))} />;
  if (instance.kind === 'enclosure' && evaluated.kind === 'enclosure') {
    const inside = evaluated.inside;
    return <>
      <fieldset><legend>Position in the garden</legend>
        <NumberField label="X" unit="m" value={t.x} scale={1000} digits={2} onCommit={v => move({ x: v })} />
        <NumberField label="Y" unit="m" value={t.y} scale={1000} digits={2} onCommit={v => move({ y: v })} />
        {yaw}</fieldset>
      <fieldset><legend>Outside</legend>
        <NumberField label="Width" unit="cm" value={instance.params.width} scale={10} digits={1} positive onCommit={v => resize({ width: v })} />
        <NumberField label="Depth" unit="cm" value={instance.params.depth} scale={10} digits={1} positive onCommit={v => resize({ depth: v })} />
        <NumberField label="Height" unit="cm" value={instance.params.height} scale={10} digits={1} positive onCommit={v => resize({ height: v })} /></fieldset>
      <dl className="planner-readonly"><div><dt>Usable inside · W × D × H</dt><dd>{cm(inside.width)} × {cm(inside.depth)} × {cm(inside.height)} <small>cm</small></dd></div>
        <div><dt>Cat port sills · {evaluated.layout.ports.map(q => q.side).join(', ')}</dt><dd data-sills={JSON.stringify(evaluated.layout.ports.map(q => q.face.at[2]))}>{evaluated.layout.ports.map(q => cm(q.face.at[2])).join(' · ')} <small>cm</small></dd></div></dl>
      <ul className="planner-ports" aria-label="Cat ports">{project.ports.filter(q => q.owner === instance.id).map(q => <li key={q.id}>
        <span>{q.name}</span><small>{portState(project, q)}</small>
        {q.state !== 'connected' && <button type="button" onClick={() => { const result = addTunnel(project, q.id); run(result, result.id); }} title="A tunnel of one module from this port: lengthen it by its arrow"><Plus size={13} aria-hidden="true" /> Tunnel</button>}
      </li>)}</ul>
    </>;
  }
  if (instance.kind === 'platform') {
    // where its recipe holds: it spans its frames (that axis is fixed), slides along the other and rises between its limits
    const range = platformRangeOf(project, instance.id);
    const orientation = platformOrientation(t.yaw);
    const axis = (key: 'x' | 'y') => range?.fixed === key
      ? { disabled: true, hint: `Fixed: it spans the enclosure ${range.orientation === 'west-east' ? 'from side to side' : 'from rear to front'}` }
      : { hint: range ? `${AXIS_TITLES[key]} · ${rangeText([range.along])}` : undefined };
    return <>
      <div className="planner-orientation" role="group" aria-label="Orientation">
        {PLATFORM_ORIENTATIONS.map(o => <button key={o} type="button" aria-pressed={orientation === o}
          title={o === 'west-east' ? 'From one side frame to the other, on a batten along each' : 'From the rear posts to the front posts, on a cross bearer at each end'}
          onClick={() => { if (orientation !== o) run(rotateInstance(project, instance.id, ORIENTATION_YAW[o])); }}>{PLATFORM_RECIPES[o].title}</button>)}
      </div>
      <fieldset><legend>Position in {nameOf(project, instance.parent ?? '')}</legend>
        <NumberField label="X" unit="cm" value={t.x} scale={10} digits={1} {...axis('x')} onCommit={v => move({ x: v })} />
        <NumberField label="Y" unit="cm" value={t.y} scale={10} digits={1} {...axis('y')} onCommit={v => move({ y: v })} />
        <NumberField label="Elevation" unit="cm" value={t.z} scale={10} digits={1} hint={range ? rangeText(range.heights) : undefined} onCommit={v => move({ z: v })} />
        <NumberField label="Yaw" unit="°" value={t.yaw} scale={1} digits={0} step={90} hint="Quarter turns" onCommit={v => run(rotateInstance(project, instance.id, v))} /></fieldset>
      <fieldset><legend>Board</legend>
        <NumberField label="Width" unit="cm" value={instance.params.width} scale={10} digits={1} positive hint={range ? `Its span · up to ${cm(range.span)} cm` : undefined} onCommit={v => resize({ width: v })} />
        <NumberField label="Depth" unit="cm" value={instance.params.depth} scale={10} digits={1} positive hint={range ? `Up to ${cm(range.room)} cm` : undefined} onCommit={v => resize({ depth: v })} />
        <NumberField label="Thickness" unit="mm" value={instance.params.thickness} scale={1} digits={0} positive onCommit={v => resize({ thickness: v })} /></fieldset>
    </>;
  }
  if (evaluated.kind === 'tunnel') return <><TunnelFields project={project} tunnel={evaluated} run={run} />
    <Construction project={project} evaluation={evaluation} instance={instance.id} parts={['tunnel', 'tunnel-tunnel-coupling']} run={run} /></>;
  if (instance.kind === 'window' && evaluated.kind === 'window') {
    const w = evaluated.site.window; const p = instance.params; const { portClosure, doorSeat } = project.settings;
    const size = (patch: Partial<typeof p>) => run(resizeWindow(project, instance.id, patch));
    const field = (label: string, key: keyof typeof p, hint?: string) => <NumberField label={label} unit="cm" value={p[key]} scale={10} digits={1} positive hint={hint} onCommit={v => size({ [key]: v })} />;
    return <>
      <fieldset><legend>Existing window</legend>
        {field('Glass width', 'glassWidth')}{field('Glass height', 'glassHeight')}{field('Sash width', 'sashWidth')}{field('Sash height', 'sashHeight')}</fieldset>
      <fieldset><legend>Cat ports</legend>
        {field('Clear size', 'tunnelSize', 'Every port, both ways: the tunnels follow')}
        <label className="planner-field"><span>{PORT_CLOSURE_SETTING}</span><select aria-label={PORT_CLOSURE_SETTING} value={portClosure}
          onChange={event => run(setCatPorts(project, { portClosure: event.target.value as PortClosure }))}>{PORT_CLOSURES.map(o => <option key={o} value={o}>{PORT_CLOSURE_LABELS[o]}</option>)}</select></label>
        <label className="planner-field"><span>{DOOR_SEAT_SETTING}</span><select aria-label={DOOR_SEAT_SETTING} value={doorSeat}
          onChange={event => run(setCatPorts(project, { doorSeat: event.target.value as DoorSeat }))}>{DOOR_SEATS.map(o => <option key={o} value={o}>{DOOR_SEAT_LABELS[o]}</option>)}</select></label>
        <p className="planner-note">The window’s and every enclosure’s cat port, and the tunnels’ doors.</p></fieldset>
      <Construction project={project} evaluation={evaluation} instance={instance.id} parts={['window-insert', 'insert-tunnel-coupling']} run={run} />
      <dl className="planner-readonly">
        <div><dt>Window opening · W × H</dt><dd>{cm(w.openingWidth)} × {cm(w.openingHeight)} <small>cm</small></dd></div>
        <div><dt>Cat port</dt><dd>{cm(evaluated.site.w)} × {cm(evaluated.site.h)} <small>cm</small></dd></div>
        <p className="planner-note">Site context: the existing wall and window are not in the build list.</p>
      </dl>
    </>;
  }
  return null;
}
/**
 * An instance's construction choices (FR-02.10, #117): each of its sub-assemblies in a section of its own, edited as on that
 * sub-assembly's view (the same project settings, each change one undo step), with a link to the view's pieces, steps and parts list.
 */
function Construction({ project, evaluation, instance, parts, run }: { project: Project; evaluation: ProjectEvaluation; instance: string; parts: CatioSubassembly[]; run: InspectorProps['run'] }) {
  return <>{parts.map(id => <SubassemblySettings key={id} definition={CATIO_SUBASSEMBLY_DEFINITIONS[id] as unknown as SubassemblyDefinition<object, unknown>}
    project={project} evaluation={evaluation} instance={instance} run={run} />)}</>;
}
function SubassemblySettings<C extends object, S>({ definition, project, evaluation, instance, run }: {
  definition: SubassemblyDefinition<C, S>; project: Project; evaluation: ProjectEvaluation; instance: string; run: InspectorProps['run'];
}) {
  const subject = definition.subject(project, evaluation, instance);
  const id = definition.id;
  return <details className="planner-construction" data-subassembly={id}><summary>{definition.title}</summary>
    {hasSubject(subject) ? <ControlFields compact controls={SUBASSEMBLY_CONTROLS[id] as unknown as SubassemblyControl<C>[]} config={subject.config}
      change={(key, value) => run(configureSubassembly(project, id, instance, { [key]: value }))} note={key => <SharedNote id={id} setting={key} />} />
      : <p className="planner-note">{subject.problem}</p>}
    <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: id, instance })}>Its pieces, steps and parts list</a>
  </details>;
}
const cm = (mm: number) => (Math.round(mm) / 10).toLocaleString('en', { maximumFractionDigits: 1 });

/** `id` when it is a port a tunnel can start from: a window's or an enclosure's, coupled to nothing. */
function startable(project: Project, id: string): Port | undefined {
  const port = project.ports.find(p => p.id === id);
  return port && port.state !== 'connected' && project.instances.find(i => i.id === port.owner)?.kind !== 'tunnel' ? port : undefined;
}
/** A port's state, for the owner: what it is coupled to, or how it is closed. */
function portState(project: Project, port: Port): string {
  const connection = project.connections.find(c => c.ports.includes(port.id));
  const mate = connection?.ports.find(id => id !== port.id);
  if (mate) return `coupled to ${portTitle(project, mate)}`;
  return port.state === 'open' ? 'free: an unfinished end' : 'shut by its closure';
}

/** A selected cat port: its state, a tunnel started from it, or its connection detached. */
function PortFields({ project, port, run }: { project: Project; port: Port; run: InspectorProps['run'] }) {
  const connection = project.connections.find(c => c.ports.includes(port.id));
  return <>
    <h2 className="eyebrow">CAT PORT</h2>
    <dl className="planner-readonly"><div><dt>{portTitle(project, port.id)}</dt><dd data-port-state={port.state}>{portState(project, port)}</dd></div>
      <div><dt>Opening</dt><dd>{cm(port.interface.size)} × {cm(port.interface.size)} <small>cm, the standard port</small></dd></div></dl>
    <div className="planner-actions">
      {startable(project, port.id) && <button type="button" onClick={() => { const result = addTunnel(project, port.id); run(result, result.id); }}><Plus size={14} aria-hidden="true" /> Start a tunnel here</button>}
      {connection && <button type="button" onClick={() => run(detach(project, connection.id))}><Unlink size={14} aria-hidden="true" /> Detach</button>}
    </div>
    <p className="planner-note">A port coupled to nothing keeps its closure. Drag from its marker in the viewport to draw a tunnel out of it in whole modules.</p>
  </>;
}

/**
 * A tunnel (FR-04): its modules and length, its two ends (what each is coupled to, or free), and the edits at them: a free far end
 * lengthened or shortened by a module, turned, or connected to a port near it (`connectTargets`); a coupled end detached.
 */
function TunnelFields({ project, tunnel, run }: { project: Project; tunnel: EvaluatedTunnel; run: InspectorProps['run'] }) {
  const layout = tunnel.layout;
  const connectionOf = (end: TunnelEnd) => end.port ? project.connections.find(c => c.ports.includes(end.port ?? '')) : undefined;
  const free = tunnel.ends.end.port && !tunnel.ends.end.mate ? tunnel.ends.end.port : null;
  const near = free ? connectTargets(project, free).filter(t => t.distance <= CONNECT_REACH) : [];
  const end = (title: string, e: TunnelEnd, reaches = true) => {
    const connection = connectionOf(e);
    return <div data-tunnel-end={e.port ?? ''}><dt>{title}</dt><dd>{e.mate ? `Coupled to ${portTitle(project, e.mate)}${reaches ? '' : ' · its modules do not reach it'}` : 'Free: an unfinished end'}
      {connection && <button type="button" className="planner-inline" onClick={() => run(detach(project, connection.id))} title="Uncouple it: the port is shut again, the tunnel’s end left free"><Unlink size={12} aria-hidden="true" /> Detach</button>}</dd></div>;
  };
  return <>
    <dl className="planner-readonly">
      <div><dt>Modules</dt><dd data-modules={layout ? tunnelModules(layout) : 0}>{layout ? tunnelModules(layout) : '–'} <small>× {layout ? cm(layout.pitch) : '–'} cm</small></dd></div>
      <div><dt>Length</dt><dd>{layout ? cm(layout.totalLength) : '–'} <small>cm</small></dd></div>
      {end('Start', tunnel.ends.start)}
      {end('End', tunnel.ends.end, tunnel.reaches)}
    </dl>
    {free && <div className="planner-actions" role="group" aria-label="Free end">
      <button type="button" onClick={() => run(extendTunnel(project, free, 1))}><Plus size={14} aria-hidden="true" /> Module</button>
      <button type="button" onClick={() => run(extendTunnel(project, free, -1))}><Minus size={14} aria-hidden="true" /> Module</button>
      <button type="button" onClick={() => run(turnTunnel(project, free, 'left'))}><CornerUpLeft size={14} aria-hidden="true" /> Turn left</button>
      <button type="button" onClick={() => run(turnTunnel(project, free, 'right'))}><CornerUpRight size={14} aria-hidden="true" /> Turn right</button>
      {near.map(t => <button key={t.port} type="button" onClick={() => run(connect(project, free, t.port))}><Link size={14} aria-hidden="true" /> Connect to {portTitle(project, t.port)}</button>)}
    </div>}
    <p className="planner-note">{free ? 'Drag its end’s arrow to lengthen or shorten it in whole modules; bring the end near a free cat port to connect it there.' : 'The tunnel follows the enclosures it couples to.'} Click one of its elements (Shift or Ctrl for more) to raise or lower it.</p>
  </>;
}

/**
 * The selected tunnel elements (FR-04.2): each one's floor where it starts and ends, its length and its slope; a single one's floor
 * as a field. Raising or lowering them is one edit (`raiseElements`): their neighbours slope to them, and the cat port at either end
 * of their tunnel moves with them.
 */
function ElementFields({ project, evaluation, ids, run }: { project: Project; evaluation: ProjectEvaluation; ids: string[]; run: InspectorProps['run'] }) {
  const laid = new Map(evaluation.instances.flatMap(e => e.kind === 'tunnel' ? e.elements.map(x => [x.id, x] as const) : []));
  const shown = ids.map(id => laid.get(id)).filter((x): x is EvaluatedElement => !!x);
  const sloped = (x: EvaluatedElement) => Math.abs(x.floor[1] - x.floor[0]) > 0.5;
  const issues = evaluation.issues.filter(i => i.severity !== 'info' && i.instanceIds.some(id => ids.includes(id)));
  const [only] = shown;
  return <>
    <h2 className="eyebrow">{ids.length === 1 ? 'TUNNEL ELEMENT' : `TUNNEL ELEMENTS · ${ids.length}`}</h2>
    {shown.map(x => <dl className="planner-readonly" key={x.id} data-element-fields={x.id}>
      <div><dt>{elementTitle(project, x.id)}</dt><dd>{x.kind === 'turn' ? 'Side-port turn' : 'Straight'} · {x.modules} {x.modules === 1 ? 'module' : 'modules'}</dd></div>
      <div><dt>Floor · above the grass</dt><dd data-floor={x.floor[0]}>{cm(x.floor[0])}{sloped(x) ? ` → ${cm(x.floor[1])}` : ''} <small>cm</small></dd></div>
      <div><dt>Length</dt><dd>{cm(x.length)} <small>cm</small></dd></div>
      <div><dt>Slope</dt><dd>{sloped(x) ? `${x.slope >= 0 ? 'up' : 'down'} ${Math.abs(x.slope).toFixed(1)}°` : 'level'}</dd></div>
    </dl>)}
    {ids.length === 1 && only && <NumberField label="Floor" unit="mm" value={only.floor[0]} scale={1} digits={0} step={10} hint="Where it starts; its neighbours slope to it"
      onCommit={v => run(raiseElements(project, ids, v - only.floor[0]))} />}
    <p className="planner-note">Raise or lower {ids.length === 1 ? 'it' : 'them'} with Page Up / Page Down (Shift: 10 cm), the Raise and Lower buttons or the upright arrow. The cat port at an end of the tunnel moves with {ids.length === 1 ? 'it' : 'them'}.</p>
    {issues.length > 0 && <ul className="planner-object-issues" aria-label="Problems with the selection">{issues.map(i => <li key={i.id} className={i.severity}>{i.message}</li>)}</ul>}
  </>;
}
const AXIS_TITLES = { x: 'West–East', y: 'North–South' } as const;

/**
 * A number with its unit. It is committed (as one edit) on Enter or when the field loses the focus; a value that is not a number,
 * or not above zero where it must be, is not: the project keeps its last valid value and the field says what is wrong. Esc puts
 * the field back. `hint` says what it accepts (a platform's range); a command that keeps the value within it says so in the status.
 */
function NumberField({ label, unit, value, scale, digits, step, positive = false, hint, disabled = false, onCommit }: {
  label: string; unit: string; value: number; scale: number; digits: number; step?: number; positive?: boolean; hint?: string | undefined; disabled?: boolean; onCommit: (mm: number) => string[];
}) {
  const shown = (value / scale).toFixed(digits).replace(/\.0+$/, '');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const check = (raw: string) => {
    const n = Number(raw.trim().replace(',', '.'));
    if (!raw.trim() || !Number.isFinite(n)) return { n, error: 'Enter a number.' };
    if (positive && n <= 0) return { n, error: `Must be more than 0 ${unit}.` };
    return { n, error: null };
  };
  const commit = () => {
    if (text === null) return;
    const { n, error: problem } = check(text);
    if (problem) { setError(problem); return; }
    if (n.toFixed(digits) === Number(shown).toFixed(digits)) { setText(null); setError(null); return; }
    const errors = onCommit(n * scale);
    if (errors.length) { setError(errors[0] ?? null); return; }
    setText(null); setError(null);
  };
  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    else if (event.key === 'Escape') { setText(null); setError(null); }
    else if (step && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const base = check(text ?? shown).n; const next = (Number.isFinite(base) ? base : value / scale) + (event.key === 'ArrowUp' ? step : -step);
      const errors = onCommit(next * scale); if (!errors.length) { setText(null); setError(null); }
    }
  };
  return <label className={`planner-field${error ? ' invalid' : ''}`}><span>{label}</span>
    <span className="planner-input"><input type="text" inputMode="decimal" value={text ?? shown} aria-invalid={error ? true : undefined} aria-label={`${label} (${unit})`}
 disabled={disabled}
      onChange={event => { setText(event.target.value); setError(check(event.target.value).error); }} onBlur={commit} onKeyDown={onKey} /><small>{unit}</small></span>
    {hint && <small className="planner-range">{hint}</small>}
    {error && <em className="planner-error" role="alert">{error} Keeping {shown} {unit}.</em>}
  </label>;
}

function TextField({ label, value, maxLength, onCommit }: { label: string; value: string; maxLength: number; onCommit: (value: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text !== null && text.trim()) onCommit(text.trim()); setText(null); };
  return <input className="planner-text" type="text" aria-label={label} value={text ?? value} maxLength={maxLength} onChange={event => setText(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') commit(); else if (event.key === 'Escape') setText(null); }} />;
}
