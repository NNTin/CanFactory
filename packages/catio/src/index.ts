/**
 * The catio's pure domain: layouts, parts lists, assembly steps and checks of the enclosure, the window insert, the tunnel and
 * their couplings. Every function takes its inputs explicitly; nothing here reads saved settings, draws (three.js) or touches the
 * DOM, so that the planner's evaluation depends on the project alone. The web app's scenes and pages draw and store them.
 */
export * from './catioDesign.ts';
export * from './catioSubassembly.ts';
export * from './catioMesh.ts';
export * from './catioPrintedLatch.ts';
export * from './catioPort.ts';
export * from './catioDoor.ts';
export * from './catioWindow.ts';
export * from './catioWindowInsert.ts';
export * from './catioTunnelJoint.ts';
export * from './catioTunnel.ts';
export * from './catioCoupling.ts';
export * from './catioTunnelCoupling.ts';
export * from './catioModularDesign.ts';
// Names two modules export alike: the window insert's under its own name, the others' prefixed.
export type { Box, Fastener, MeshPanel } from './catioWindowInsert.ts';
export type { Fastener as TunnelFastener, MeshPanel as TunnelMeshPanel } from './catioTunnel.ts';
export type { Box as CouplingBox, Fastener as CouplingFastener } from './catioCoupling.ts';
