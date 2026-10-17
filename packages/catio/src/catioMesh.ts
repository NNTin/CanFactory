import { catioMesh, type BomLine, type CatioMesh, type CatioMeshSpec } from '@canfactory/contracts';

/** The catio pages' mesh choices, as their settings name them. */
export const MESH_LABELS: Record<CatioMesh, string> = (() => {
  const net = catioMesh('netting'); const welded = catioMesh('welded');
  return { netting: `Soft cat netting, ${net.opening / 10} cm meshes`, welded: `Welded wire mesh, ${welded.opening} mm meshes of ${welded.strand} mm wire` };
})();

const metres = (mm: number) => `${Number((Math.round(mm / 100) / 10).toFixed(1))}`;

/** How a panel's line of a parts list names the mesh it is cut from. */
export function meshCut(mesh: CatioMeshSpec): string {
  return mesh.soft ? `net, ${mesh.opening / 10} cm meshes` : `${mesh.opening} mm meshes of ${mesh.strand} mm wire`;
}

/**
 * The roll a page's mesh panels are cut from: one, as a part of the library, so that it links to a shop and reaches the buy list. The
 * pages do not plan the cuts, so more rolls may be needed, as the line says.
 */
export function meshRollLine(mesh: CatioMeshSpec): BomLine {
  return {
    id: 'mesh-roll', group: 'Mesh', name: mesh.part.title, quantity: 1, partId: mesh.part.id,
    size: `Roll ${metres(mesh.rollLength)} × ${metres(mesh.rollWidth)} m · ${meshCut(mesh)}`,
    use: 'Every mesh panel below is cut from it. One roll is listed: add up the panels, and those of the other catio pages, as more rolls may be needed',
  };
}
