import { type Assembly, type PhysicsSpec } from '@canfactory/contracts';
import * as THREE from 'three';

/** A top-down map of the actual switchable magnets, not a visibility switch or imaginary populated sockets. */
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
  const extent = Math.max(20, ...magnets.flatMap(magnet => [Math.abs(magnet.point.x), Math.abs(magnet.point.y)])) * 1.4;
  const ready = magnets.every(magnet => enabled[magnet.id] !== undefined);
  return <div className="magnet-controls" role="group" aria-label="Magnet controls">
    <div className="magnet-map" role="group" aria-label="Grid magnets, top view">
      <span className="magnet-map-axis">+Y ↑ · +X →</span>
      {magnets.map((magnet, index) => {
        const label = `${magnet.title} at X ${magnet.point.x.toFixed(1)}, Y ${magnet.point.y.toFixed(1)} mm`;
        return <button key={magnet.id} type="button" disabled={!ready} aria-label={label} aria-pressed={enabled[magnet.id] ?? false}
          title={`${label}: ${enabled[magnet.id] ? 'on' : 'off'}`} style={{ left: `${50 + magnet.point.x / extent * 45}%`, top: `${50 - magnet.point.y / extent * 40}%` }}
          onClick={() => onChange(magnet.id, !enabled[magnet.id])}>{index + 1}<small>{enabled[magnet.id] ? 'ON' : 'OFF'}</small></button>;
      })}
    </div>
    <div className="magnet-controls-caption">
      <strong>Grid magnets</strong>
      <p>Toggle a numbered location while dragging the ball. The sealed ball magnet stays on.</p>
      <div><button type="button" disabled={!ready} onClick={() => magnets.forEach(magnet => onChange(magnet.id, true))}>All on</button>
        <button type="button" disabled={!ready} onClick={() => magnets.forEach(magnet => onChange(magnet.id, false))}>All off</button></div>
      <small>Approximate magnetic forces · virtual switches, not switchable hardware. Restart keeps these settings; reopening resets them. Hide the cover to inspect inside; its collisions remain active.</small>
    </div>
  </div>;
}
