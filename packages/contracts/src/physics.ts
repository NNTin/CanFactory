import { Type, type Static } from 'typebox';

/**
 * A model's mechanism, for the physics subsystem (packages/physics, docs/physics-plan.md): which parts move, how they are jointed,
 * what they are made of, where their collision shapes come from, and the scenarios CI runs. It is engine-neutral: nothing here
 * knows the engine (MuJoCo) or how it is driven. Units: millimetres, grams, degrees, newtons and seconds, in the assembled frame
 * of the model's `Assembly` (Z up, parts at their `poses`).
 */

const Vec3 = (description: string) => Type.Array(Type.Number(), { minItems: 3, maxItems: 3, description });

/** What a body is made of: its density and friction (`PHYSICS_MATERIALS`). */
export const PHYSICS_MATERIAL_IDS = ['petg', 'pla', 'steel', 'pom'] as const;
export type PhysicsMaterialId = typeof PHYSICS_MATERIAL_IDS[number];

export const PhysicsJointSchema = Type.Object({
  type: Type.Union([Type.Literal('hinge'), Type.Literal('slide'), Type.Literal('ball')], { description: 'hinge: turns about `axis`; slide: moves along `axis`; ball: turns freely about `anchor`.' }),
  parent: Type.Optional(Type.String({ description: 'The body it is jointed to; the world (fixed) when omitted.' })),
  anchor: Vec3('A point on the joint’s axis (hinge), or its centre (ball), in mm, assembled frame.'),
  axis: Type.Optional(Vec3('The joint’s axis in the assembled frame (hinge, slide). Positive values turn right-handed about it, or move along it.')),
  range: Type.Optional(Type.Array(Type.Number(), { minItems: 2, maxItems: 2, description: 'The joint’s limits, in degrees (hinge) or mm (slide), from the assembled pose (0).' })),
  spring: Type.Optional(Type.Object({
    stiffness: Type.Number({ exclusiveMinimum: 0, description: 'N/mm (slide) or N·mm per degree (hinge).' }),
    rest: Type.Number({ description: 'The joint value at which the spring is relaxed, in mm or degrees from the assembled pose.' }),
  }, { additionalProperties: false })),
  damping: Type.Optional(Type.Number({ minimum: 0, description: 'N·s/mm (slide) or N·mm·s per degree (hinge).' })),
  friction: Type.Optional(Type.Number({ minimum: 0, description: 'Dry friction in the joint: N (slide) or N·mm (hinge). E.g. how firmly a snap or a press fit holds.' })),
  initial: Type.Optional(Type.Number({ description: 'The joint’s value at the start, in mm or degrees from the assembled pose; 0 by default.' })),
  model: Type.Optional(Type.Union([Type.Literal('ideal'), Type.Literal('contact')], { description: 'ideal (default): the joint holds exactly. contact: there is no joint; the body’s pins and holes hold it by contact, with their real clearance.' })),
  collideWithParent: Type.Optional(Type.Boolean({ description: 'Whether the body also collides with its parent; by default jointed bodies do not.' })),
}, { additionalProperties: false });
export type PhysicsJoint = Static<typeof PhysicsJointSchema>;

export const PhysicsCollisionSchema = Type.Union([
  Type.Object({ kind: Type.Literal('decompose') }, { additionalProperties: false, description: 'Its rendered mesh, split into convex pieces (the default).' }),
  Type.Object({ kind: Type.Literal('pieces') }, { additionalProperties: false, description: 'Convex pieces the geometry side renders for it (e.g. each tooth of a gear).' }),
  Type.Object({ kind: Type.Literal('sphere'), centre: Vec3('mm, in the part’s own frame.'), diameter: Type.Number({ exclusiveMinimum: 0 }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('cylinder'), centre: Vec3('mm, in the part’s own frame.'), axis: Vec3('In the part’s own frame.'), diameter: Type.Number({ exclusiveMinimum: 0 }), length: Type.Number({ exclusiveMinimum: 0 }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('box'), centre: Vec3('mm, in the part’s own frame.'), size: Vec3('mm, along the part’s own axes.') }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('none') }, { additionalProperties: false, description: 'It collides with nothing.' }),
]);
export type PhysicsCollision = Static<typeof PhysicsCollisionSchema>;

export const PhysicsBodySchema = Type.Object({
  id: Type.String({ description: 'The part or reference object, by its key in the assembly’s `poses`.' }),
  material: Type.Union([Type.Literal('petg'), Type.Literal('pla'), Type.Literal('steel'), Type.Literal('pom')], { description: 'One of PHYSICS_MATERIAL_IDS.' }),
  fixed: Type.Optional(Type.Boolean({ description: 'Welded where it is: to its joint’s parent, or to the world.' })),
  mass: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: 'Its mass in g, when known better than from its volume and material (e.g. a bought object); the centre of mass and inertia stay those of its mesh.' })),
  joint: Type.Optional(PhysicsJointSchema),
  collision: Type.Optional(PhysicsCollisionSchema),
}, { additionalProperties: false, description: 'A rigid body. Without a joint and not fixed it moves freely.' });
export type PhysicsBody = Static<typeof PhysicsBodySchema>;

/** A scripted input of a scenario. Timelines are [time in s, value] pairs, interpolated linearly and held after the last. */
export const PhysicsDriveSchema = Type.Union([
  Type.Object({
    kind: Type.Literal('joint'),
    body: Type.String({ description: 'The body whose joint is driven.' }),
    timeline: Type.Array(Type.Array(Type.Number(), { minItems: 2, maxItems: 2 }), { minItems: 1, description: '[s, mm or degrees from the assembled pose].' }),
  }, { additionalProperties: false, description: 'The joint is moved along the timeline, as by a stiff servo.' }),
  Type.Object({
    kind: Type.Literal('push'),
    body: Type.String(),
    point: Vec3('The point of the body that is pushed, in mm, assembled frame (at the start).'),
    timeline: Type.Array(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 }), { minItems: 1, description: '[s, x, y, z]: the point’s displacement from where it starts, in mm.' }),
    maxForce: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: 'The most the push can exert, in N (as a finger: 30 N by default).' })),
  }, { additionalProperties: false, description: 'A point of the body is led along the timeline by a stiff spring, as a finger would.' }),
  Type.Object({
    kind: Type.Literal('force'),
    body: Type.String(),
    point: Vec3('Where the force acts, in mm, on the body (assembled frame, at the start).'),
    force: Vec3('N, world frame.'),
    from: Type.Number({ minimum: 0 }),
    to: Type.Number({ minimum: 0 }),
  }, { additionalProperties: false, description: 'A constant force between two times.' }),
]);
export type PhysicsDrive = Static<typeof PhysicsDriveSchema>;

/** What a scenario checks at a time. */
export const PhysicsCheckSchema = Type.Union([
  Type.Object({
    kind: Type.Literal('position'),
    at: Type.Number({ minimum: 0 }),
    body: Type.String(),
    axis: Type.Union([Type.Literal(0), Type.Literal(1), Type.Literal(2)]),
    min: Type.Optional(Type.Number()), max: Type.Optional(Type.Number()),
  }, { additionalProperties: false, description: 'How far the body has moved from its assembled pose along a world axis, in mm.' }),
  Type.Object({
    kind: Type.Literal('joint'),
    at: Type.Number({ minimum: 0 }),
    body: Type.String(),
    min: Type.Optional(Type.Number()), max: Type.Optional(Type.Number()),
  }, { additionalProperties: false, description: 'The body’s joint value, in mm or degrees from the assembled pose.' }),
  Type.Object({
    kind: Type.Literal('contact'),
    at: Type.Number({ minimum: 0 }),
    bodies: Type.Array(Type.String(), { minItems: 2, maxItems: 2 }),
    touching: Type.Boolean(),
  }, { additionalProperties: false, description: 'Whether two bodies touch.' }),
]);
export type PhysicsCheck = Static<typeof PhysicsCheckSchema>;

export const PhysicsScenarioSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String({ description: 'What it shows, e.g. “Upright, the lighter rests on the tab”.' }),
  gravity: Type.Optional(Vec3('The direction gravity pulls in, in the assembled frame; [0, 0, −1] by default. [0, 0, 1] turns the assembly upside down.')),
  duration: Type.Number({ exclusiveMinimum: 0, description: 's.' }),
  drives: Type.Optional(Type.Array(PhysicsDriveSchema)),
  checks: Type.Array(PhysicsCheckSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type PhysicsScenario = Static<typeof PhysicsScenarioSchema>;

export const PhysicsSpecSchema = Type.Object({
  bodies: Type.Array(PhysicsBodySchema, { minItems: 1 }),
  exclude: Type.Optional(Type.Array(Type.Array(Type.String(), { minItems: 2, maxItems: 2 }), { description: 'Pairs of bodies that never collide.' })),
  scenarios: Type.Optional(Type.Array(PhysicsScenarioSchema)),
}, { additionalProperties: false });
export type PhysicsSpec = Static<typeof PhysicsSpecSchema>;

export interface PhysicsSource { title: string; publisher: string; url: string; accessed: string; read: string }

export interface PhysicsMaterial {
  title: string;
  /** g/cm³. Printed parts are taken as solid (100 % infill); a body whose real mass is known gives it (`PhysicsBody.mass`). */
  density: number;
  /** Coefficient of sliding friction against plastic. A pair of bodies uses the larger of their two. */
  friction: number;
  sources: PhysicsSource[];
}

const ACCESSED = '2026-10-09';

/**
 * The materials, with where each value was read. Friction of printed plastic on printed plastic has no published measurement
 * that we found; the nearest is printed parts sliding on acrylic (PMMA), whose natural (unsanded) surfaces gave 0.28–0.30 for
 * both PETG and PLA, whatever the print orientation. Printed PETG and PLA on ground steel gave about 0.27 and 0.30 (static, 30 N).
 * The lighter's acetal has no friction figure of its own here: it takes the printed plastic's, which it slides against.
 */
export const PHYSICS_MATERIALS: Record<PhysicsMaterialId, PhysicsMaterial> = {
  petg: {
    title: 'PETG', density: 1.27, friction: 0.29,
    sources: [
      { title: 'Prusament PETG technical data sheet v1.1', publisher: 'Prusa Polymers', url: 'https://www.3dprintergear.com.au/assets/files/technical-data-sheet%20(1).pdf', accessed: ACCESSED, read: 'Density 1.27 g/cm³ (ISO 1183).' },
      { title: 'Coeficiente de fricción de piezas poliméricas construidas aditivamente (AJEA, UTN FRBB, 2024), Table 4', publisher: 'Bories Otondo, Montes de Oca, Piovan', url: 'https://rtyc.utn.edu.ar/index.php/ajea/article/view/1851', accessed: ACCESSED, read: 'Dynamic friction of printed PETG on acrylic, natural surface: 0.293 (UP), 0.292 (FLAT).' },
    ],
  },
  pla: {
    title: 'PLA', density: 1.24, friction: 0.29,
    sources: [
      { title: 'Prusament PLA technical data sheet v1.1', publisher: 'Prusa Polymers', url: 'https://www.matterhackers.com/r/xFvGl8', accessed: ACCESSED, read: 'Density 1.24 g/cm³ (ISO 1183).' },
      { title: 'Coeficiente de fricción de piezas poliméricas construidas aditivamente (AJEA, UTN FRBB, 2024), Table 4', publisher: 'Bories Otondo, Montes de Oca, Piovan', url: 'https://rtyc.utn.edu.ar/index.php/ajea/article/view/1851', accessed: ACCESSED, read: 'Dynamic friction of printed PLA on acrylic, natural surface: 0.295 (UP), 0.281 (FLAT).' },
    ],
  },
  steel: {
    title: 'Chromium steel (1.3505, 100Cr6)', density: 7.80, friction: 0.27,
    sources: [
      { title: 'Data sheet chrome steel ball 1.3505 V1-01', publisher: 'Kugel Pompel GmbH', url: 'https://www.kugelpompel.at/img/cms/Datenbl%C3%A4tter%20Eisen%20und%20Stahl/Data%20sheet%20chrome%20steel%20ball%201-3505%20V1-01.pdf', accessed: ACCESSED, read: 'Density 7.80 g/cm³.' },
      { title: 'Static and Kinetic Friction of 3D Printed Polymers and Composites, Tribology in Industry 46(1) 97–106 (2024)', publisher: 'Stoimenov, Kandeva, Zagorski, Panev', url: 'https://tribology.rs/journals/2024/2024-1/9-1546.pdf', accessed: ACCESSED, read: 'Dry, against steel at 30 N: static friction force 9 N (PLA) and 8 N (PETG), i.e. 0.30 and 0.27.' },
    ],
  },
  pom: {
    title: 'Acetal (POM, Delrin)', density: 1.42, friction: 0.29,
    sources: [
      { title: 'BIC J25 lighter (product 3460002360)', publisher: 'BIC Graphic', url: 'https://www.bicgraphic.com/gb/bic-j25-lighter-3460002360.html', accessed: ACCESSED, read: '“Made of Delrin® technical resin”; weight 13 g.' },
      { title: 'Delrin® 100 NC010 (POM homopolymer, unfilled)', publisher: 'Entec Polymers (distributor listing)', url: 'https://entecpolymers.com/en-US/products/104103-delrin-100-nc010', accessed: ACCESSED, read: 'Density 1.42 g/cm³ (ISO 1183).' },
    ],
  },
};

/** The density (g/cm³) and friction of a material. */
export const physicsMaterial = (id: PhysicsMaterialId): PhysicsMaterial => PHYSICS_MATERIALS[id];
