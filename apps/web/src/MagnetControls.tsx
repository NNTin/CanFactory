import { type Assembly, type PhysicsSpec } from '@canfactory/contracts';
import * as THREE from 'three';

/** A dimension-derived top-down map of switchable magnetic locations, including optional empty sockets. */
export function MagnetControls({ spec, poses, enabled, onChange }: {
  spec: PhysicsSpec; poses: Assembly['poses']; enabled: Record<string, boolean>; onChange: (id: string, enabled: boolean) => void;
}) {
  const starts = { ...poses, ...spec.poses };
  const magnets = (spec.magnets ?? []).filter(magnet => magnet.switchable).map(magnet => {
    const pose = starts[magnet.body];
    const point = new THREE.Vector3().fromArray(magnet.position);
    if (pose) {
      const [x = 0, y = 0, z = 0] = (pose.rotation ?? []).map(THREE.MathUtils.degToRad);
      point.applyEuler(new THREE.Euler(x, y, z, 'ZYX')).add(new THREE.Vector3().fromArray(pose.position));
    }
    return { ...magnet, point };
  });
  const xs = [...new Set(magnets.map(m => m.point.x))].sort((a, b) => a - b);
  const ys = [...new Set(magnets.map(m => m.point.y))].sort((a, b) => a - b);
  const gaps = [xs, ys].flatMap(values => values.slice(1).map((v, i) => v - (values[i] ?? 0))).filter(gap => gap > 1e-6);
  const scale = 48 / Math.min(...gaps, 60); // >= 48 px between neighbours, including dense grids
  const minX = xs[0] ?? 0, maxY = ys.at(-1) ?? 0;
  const width = Math.max(144, 48 + ((xs.at(-1) ?? 0) - minX) * scale);
  const height = Math.max(144, 66 + (maxY - (ys[0] ?? 0)) * scale);
  const optional = magnets.some(m => m.hideWhenDisabled);
  const ready = magnets.every(magnet => enabled[magnet.id] !== undefined);
  return <div className="magnet-controls" role="group" aria-label="Magnet controls">
    <div className="magnet-map-scroll"><div className="magnet-map" role="group" aria-label="Grid magnets, top view" style={{ width, height }}>
      <span className="magnet-map-axis">+Y ↑ · +X →</span>
      {magnets.map((magnet, index) => {
        const label = `${magnet.title} at X ${magnet.point.x.toFixed(1)}, Y ${magnet.point.y.toFixed(1)} mm`;
        return <button key={magnet.id} type="button" disabled={!ready} aria-label={label} aria-pressed={enabled[magnet.id] ?? false}
          title={`${label}: ${enabled[magnet.id] ? 'on' : 'off'}`} style={{ left: 24 + (magnet.point.x - minX) * scale, top: 24 + (maxY - magnet.point.y) * scale }}
          onClick={() => onChange(magnet.id, !enabled[magnet.id])}>{index + 1}<small>{enabled[magnet.id] ? 'ON' : 'OFF'}</small></button>;
      })}
    </div></div>
    <div className="magnet-controls-caption">
      <strong>Grid magnets</strong>
      <p>{optional ? 'Every socket is available: on places a virtual magnet, off leaves it empty.' : 'Toggle a numbered location while dragging the ball.'} The ball closure magnets stay on.</p>
      <div><button type="button" disabled={!ready} onClick={() => magnets.forEach(magnet => onChange(magnet.id, true))}>All on</button>
        <button type="button" disabled={!ready} onClick={() => magnets.forEach(magnet => onChange(magnet.id, false))}>All off</button></div>
      <small>Approximate magnetic forces · virtual switches, not switchable hardware. Restart keeps these settings; reopening restores the initial states. Hide the cover to inspect inside; its collisions remain active.</small>
    </div>
  </div>;
}
