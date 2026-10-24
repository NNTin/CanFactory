import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { PhysicsController } from '@canfactory/contracts';
import type { ControllerReport } from '@canfactory/physics';

const STATES: Record<ControllerReport['state'], string> = {
  booting: 'Booting',
  ready: 'Ready',
  running: 'Running',
  fault: 'Fault',
  unaligned: 'Needs re-alignment',
};

/**
 * A press-and-hold button for a controller control: down on pointer or key down, up on release, as a real button is. An activation
 * without a pointer or key (a screen reader's click) presses it for 0.15 s, longer than the debounce.
 */
function useHold(onPress: (pressed: boolean) => void) {
  const down = useRef(false);
  const press = (pressed: boolean) => { if (down.current === pressed) return; down.current = pressed; onPress(pressed); };
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); press(true); },
    onPointerUp: () => { press(false); },
    onPointerCancel: () => { press(false); },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); press(true); } },
    onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); press(false); } },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      // a click with no pointer and no key (detail 0): press and let go
      if (event.detail === 0 && !down.current) { press(true); window.setTimeout(() => { press(false); }, 150); }
    },
  };
}

/** A control on the model itself (B and R on the case's lid), drawn where its point is on the screen. */
function Hotspot({ control, at, onPress }: { control: PhysicsController['controls'][number]; at: [number, number]; onPress: (pressed: boolean) => void }) {
  const hold = useHold(onPress);
  return <button type="button" className={`controller-hotspot controller-${control.action}`} style={{ left: at[0], top: at[1] }} aria-label={control.title} title={control.title} data-control={control.id} {...hold}>
    {control.label}
  </button>;
}

function PanelButton({ control, onPress }: { control: PhysicsController['controls'][number]; onPress: (pressed: boolean) => void }) {
  const hold = useHold(onPress);
  return <button type="button" title={control.title} data-control={control.id} {...hold}>{control.label} · {control.title.split(':')[0]}</button>;
}

/** The B and R buttons on the model, at their screen positions (`positions`, px inside the viewer). */
export function ControllerHotspots({ controller, positions, onPress }: { controller: PhysicsController; positions: Record<string, [number, number]>; onPress: (id: string, pressed: boolean) => void }) {
  return <div className="controller-overlay">
    {controller.controls.flatMap(control => {
      const at = positions[control.id];
      return at ? [<Hotspot key={control.id} control={control} at={at} onPress={pressed => { onPress(control.id, pressed); }} />] : [];
    })}
  </div>;
}

/**
 * The simulated device's state and every control as an accessible button, under the viewer. It shows what the firmware knows (cycles
 * it commanded) apart from what the simulation observed (treats that crossed the outlet): the real device has no sensor.
 */
export function ControllerPanel({ controller, report, onPress }: { controller: PhysicsController; report: ControllerReport | undefined; onPress: (id: string, pressed: boolean) => void }) {
  const last = report?.last;
  return <div className="controller-panel" role="group" aria-label="Dispenser controller">
    <div className="controller-state">
      <strong data-state={report?.state ?? 'starting'}>{report ? STATES[report.state] : 'Starting'}</strong>
      <span role="status" aria-live="polite">{report?.message ?? 'Waiting for the physics'}</span>
    </div>
    <dl className="controller-figures">
      <div><dt>Cycles commanded</dt><dd data-figure="cycles">{report?.cycles ?? 0}</dd></div>
      <div><dt>Treats seen leaving</dt><dd data-figure="exits">{report?.exits ?? 0}</dd></div>
      <div><dt>Left outside a cycle</dt><dd data-figure="idle">{report?.idleExits ?? 0}</dd></div>
      <div><dt>Last cycle</dt><dd data-figure="last">{last ? `${last.kind} ${last.index}: ${last.exits} out${last.interrupted ? ', interrupted' : ''}${last.lost > 0.05 ? `, lost ${last.lost.toFixed(1)}°` : ''}` : '—'}</dd></div>
      <div><dt>Motor travel</dt><dd data-figure="travel">{report ? `${report.commanded.toFixed(0)}° commanded, ${report.actual.toFixed(0)}° actual` : '—'}</dd></div>
      <div><dt>Lost travel (stall)</dt><dd data-figure="lost">{report ? `${report.lost.toFixed(1)}°` : '—'}</dd></div>
      <div><dt>Queued · rejected</dt><dd data-figure="queue">{report ? `${report.queued} · ${report.rejected}` : '—'}</dd></div>
    </dl>
    <div className="controller-buttons">
      {controller.controls.map(control => <PanelButton key={control.id} control={control} onPress={pressed => { onPress(control.id, pressed); }} />)}
    </div>
    <small>Commanded cycles are what the firmware knows; “seen leaving” is the simulation’s outlet counter, which the real device does not have. Refill restarts the scene and the device; R only reboots the device.</small>
  </div>;
}
