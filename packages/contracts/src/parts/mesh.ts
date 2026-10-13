import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Mesh sold by the roll or piece and cut to size: soft cat netting (knotted cord with a woven-in wire) and welded wire mesh. The
 * window catio's panels are cut from them. One part is one roll: models and concept pages ask for rolls, not for cut pieces.
 */
export const meshFamily: PartFamily = {
  id: 'mesh', title: 'Mesh and netting',
  description: 'Cat netting and welded wire mesh, by the roll: cut to size with scissors or side cutters and fixed along every edge.',
  attributes: [{ key: 'kind', label: 'Kind' }, { key: 'material', label: 'Material' }, { key: 'roll', label: 'Roll' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'a', label: 'Mesh opening (square)', symbol: 'a', required: true },
    { key: 'd', label: 'Wire thickness', symbol: 'd', required: false },
    { key: 'w', label: 'Roll width', symbol: 'w', required: true },
    { key: 'l', label: 'Roll length', symbol: 'l', required: true },
  ],
};

// TRIXIE's wire-reinforced protective net: one page for articles 44291–44295, which gives the mesh (3 × 3 cm), the material
// (nylon with a woven-in wire) and each article's size. The cord's thickness is not published, so the net has no `d`.
const TRIXIE_NETS = [
  { sku: '44291', l: 2000, w: 1500, size: '2 × 1.5 m' },
  { sku: '44292', l: 3000, w: 2000, size: '3 × 2 m' },
  { sku: '44293', l: 4000, w: 3000, size: '4 × 3 m' },
  { sku: '44294', l: 6000, w: 3000, size: '6 × 3 m' },
  { sku: '44295', l: 8000, w: 3000, size: '8 × 3 m' },
] as const;

const trixie = TRIXIE_NETS.map((net): Part => {
  const maker = measured('manufacturer', 'trixie-44291-44295');
  return {
    id: `trixie-${net.sku}`, family: 'mesh', title: `Cat net, wire-reinforced, ${net.size} (TRIXIE ${net.sku})`,
    designation: `TRIXIE ${net.sku}`, aliases: ['Katzenschutznetz, drahtverstärkt', 'Protective net, woven-in wire'],
    description: `TRIXIE’s olive green protective net for cats, ${net.size}: knotted nylon cord with a wire woven in against biting, 3 × 3 cm meshes.`,
    standard: null, product: { manufacturer: 'TRIXIE', sku: net.sku, url: 'https://www.trixie.de/de/katze/katzenklappen-sicherheit/katzennetze-schutzgitter/katzenschutznetz-drahtverstaerkt-1001435861-1001449597' },
    attributes: { kind: 'Soft netting', material: 'Nylon with woven-in wire', roll: net.size, manufacturer: 'TRIXIE' },
    dimensions: { a: maker(30), w: maker(net.w), l: maker(net.l) },
    sources: ['trixie-44291-44295'],
    notes: 'UV-resistant, and sold with hooks, wall plugs and a fixing line (the maker’s page). The maker gives no cord thickness. A net is soft: it holds a cat only where its edge is held at every mesh, clamped under a batten or stapled mesh by mesh, and it needs a rail under it wherever it would sag. The preview shows a small piece, not the roll.',
    preview: { kind: 'procedural' },
  };
});

// KrapTrap's hot-dip galvanised, spot-welded aviary mesh, 19 × 19 mm with 1.45 mm wire: the maker's page gives the mesh, the wire,
// the width (101 cm) and the lengths offered (5, 12 and 20 m).
const KRAPTRAP_ROLLS = [5, 12, 20] as const;

const kraptrap = KRAPTRAP_ROLLS.map((metres): Part => {
  const maker = measured('manufacturer', 'kraptrap-19x19x1-45');
  return {
    id: `kraptrap-19x19x1-45-${metres}m`, family: 'mesh', title: `Welded wire mesh 19 × 19 × 1.45, 1 × ${metres} m (KrapTrap)`,
    designation: `KrapTrap Drahtgitter 19 x 19 mm, 1,45 mm, 1 x ${metres} m`, aliases: ['Volierendraht 19 × 19 × 1,45', 'Aviary wire mesh'],
    description: `KrapTrap’s hot-dip galvanised, spot-welded steel mesh in a ${metres} m roll about 1 m wide: 19 mm square meshes of 1.45 mm wire.`,
    standard: null, product: { manufacturer: 'KrapTrap', sku: `Drahtgitter 19 x 19 mm 1,45 mm 1 x ${metres} m`, url: 'https://drahtexpress.de/products/kraptrap-volierendraht-drahtgitter-19-mm-masche-100-cm-breit-1-45mm-starke' },
    attributes: { kind: 'Welded wire mesh', material: 'Steel, hot-dip galvanised', roll: `1 × ${metres} m`, manufacturer: 'KrapTrap' },
    dimensions: { a: maker(19), d: maker(1.45), w: maker(1010), l: maker(metres * 1000) },
    sources: ['kraptrap-19x19x1-45'],
    notes: 'The maker’s page gives the width as 101 cm, and sells the roll as 1 m wide. Rigid enough to span a panel between its fixed edges; cut with side cutters, and cover the cut ends. The preview shows a small piece, not the roll.',
    preview: { kind: 'procedural' },
  };
});

export const meshParts: Part[] = [...trixie, ...kraptrap];
