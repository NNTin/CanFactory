import { Type, type Static } from 'typebox';

/**
 * A model's mechanism, for the physics subsystem (packages/physics, docs/physics-plan.md): which parts move, how they are jointed,
 * what they are made of, where their collision shapes come from, and the scenarios CI runs. It is engine-neutral: nothing here
 * knows the engine (MuJoCo) or how it is driven. Units: millimetres, grams, degrees, newtons and seconds, in the assembled frame
 * of the model's `Assembly` (Z up, parts at their `poses`). Dipole moments are already SI (A·m²).
 */

const Vec3 = (description: string) => Type.Array(Type.Number(), { minItems: 3, maxItems: 3, description });

/** A part's pose, as the assembly's (`Assembly['poses']`): its STL turned (degrees, about X, then Y, then Z), then moved (mm). */
const PhysicsPoseSchema = Type.Object({
  position: Vec3('mm.'),
  rotation: Type.Optional(Vec3('Degrees about X, then Y, then Z.')),
}, { additionalProperties: false });

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
  Type.Object({
    kind: Type.Literal('pieces'),
    pieces: Type.Optional(Type.Array(Type.Array(Type.Number(), { minItems: 12 }), { description: 'Each piece’s vertices (x, y, z, ...), mm, in the part’s own frame; the physics side collides their convex hull. Computed from the values the part’s SCAD file is built from (physicsPieces.ts). Without them, the geometry side renders the pieces.' })),
  }, { additionalProperties: false, description: 'Convex pieces the geometry side gives for it, exact where a decomposition of its mesh is not (e.g. a bore the ball slides in, each tooth of a gear).' }),
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
  inertia: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: 'Rotational inertia added to its hinge, g·mm² (e.g. what is geared to it but not modelled, or quasi-static inertia that keeps a light part from rattling). Changes nothing at rest.' })),
  frictionless: Type.Optional(Type.Boolean({ description: 'Its contacts have no friction. Gear teeth: with friction on their flanks two gears that both turn freely made the engine unstable (docs/physics-plan.md, "Motors and loose items").' })),
}, { additionalProperties: false, description: 'A rigid body. Without a joint and not fixed it moves freely.' });
export type PhysicsBody = Static<typeof PhysicsBodySchema>;

/** A permanent point dipole attached to a body; its vector rotates with the body. */
export const PhysicsMagnetSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  body: Type.String(),
  position: Vec3('Dipole centre in mm, in the body’s own frame.'),
  moment: Vec3('Magnetic moment in A·m², in the body’s own frame; its direction sets polarity.'),
  softening: Type.Number({ exclusiveMinimum: 0, description: 'Regularisation length in mm (typically the magnet radius). Pair lengths combine in quadrature; prevents the point approximation diverging at contact.' }),
  enabled: Type.Optional(Type.Boolean({ description: 'Initially enabled, true by default.' })),
  switchable: Type.Optional(Type.Boolean({ description: 'Offer a virtual on/off control in the viewer. Does not imply a real permanent magnet can be switched.' })),
  hideWhenDisabled: Type.Optional(Type.Boolean({ description: 'Hide this optional magnet body while all its dipoles are disabled, representing an empty socket. Fixed body mass/geometry stay in the engine; dynamic bodies should use force-only switches instead.' })),
}, { additionalProperties: false });
export type PhysicsMagnet = Static<typeof PhysicsMagnetSchema>;


/**
 * A loose rigid object that the mechanism handles but that is neither a printed part nor library hardware, e.g. a pet treat: one
 * convex shape, given by its vertices about its own centre. The viewer draws its hull; it is never printed.
 */
export const PhysicsItemSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String(),
  group: Type.Optional(Type.String({ description: 'Items counted together (`PhysicsCounter.group`).' })),
  vertices: Type.Array(Type.Number(), { minItems: 12, description: 'x, y, z, ... in mm about its centre; the engine collides their convex hull.' }),
  mass: Type.Number({ exclusiveMinimum: 0, description: 'g; its inertia is that of its hull at uniform density.' }),
  friction: Type.Number({ minimum: 0, description: 'Its coefficient of sliding friction; a pair of bodies uses the larger of their two.' }),
  pose: PhysicsPoseSchema,
}, { additionalProperties: false });
export type PhysicsItem = Static<typeof PhysicsItemSchema>;

/**
 * A torque-limited motor on a body's hinge, such as a geared stepper: a stiff spring pulls the hinge towards the commanded angle,
 * with at most `torque`; when the hinge lags the command by more than `slip` it slips, as a stepper loses steps, and the lost travel
 * is reported. It never drives a hinge through an obstruction harder than its torque.
 */
export const PhysicsMotorSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String(),
  body: Type.String({ description: 'The body whose hinge it turns.' }),
  torque: Type.Number({ exclusiveMinimum: 0, description: 'The most torque it exerts, N·mm.' }),
  stiffness: Type.Number({ exclusiveMinimum: 0, description: 'N·mm per degree of lag.' }),
  damping: Type.Number({ minimum: 0, description: 'N·mm·s per degree.' }),
  inertia: Type.Number({ exclusiveMinimum: 0, description: 'Inertia it adds to the hinge (its rotor as seen through its gearbox), g·mm².' }),
  speed: Type.Number({ exclusiveMinimum: 0, description: 'Commanded speed, degrees per second.' }),
  acceleration: Type.Number({ exclusiveMinimum: 0, description: 'Commanded acceleration and deceleration, degrees per second².' }),
  slip: Type.Number({ exclusiveMinimum: 0, description: 'The lag, in degrees, beyond which it slips.' }),
}, { additionalProperties: false });
export type PhysicsMotor = Static<typeof PhysicsMotorSchema>;

/**
 * Counts items of a group: `crossing` counts each item once, the first time its centre passes the plane through `point` in the
 * direction `along` while inside the box (`min`..`max`, assembled frame); `inside` counts each item once, the first time its centre is
 * inside the box. Moving back and forth over the plane counts once.
 */
export const PhysicsCounterSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String(),
  group: Type.String(),
  kind: Type.Union([Type.Literal('crossing'), Type.Literal('inside')]),
  point: Type.Optional(Vec3('A point on the plane (crossing), mm.')),
  along: Type.Optional(Vec3('The direction an item crosses in (crossing).')),
  min: Vec3('The box’s lower corner, mm.'),
  max: Vec3('The box’s upper corner, mm.'),
  frame: Type.Optional(PhysicsPoseSchema),
}, { additionalProperties: false, description: 'Its point, direction and box are in `frame` (a pose in the assembled frame) when given, e.g. a chute’s own axes.' });
export type PhysicsCounter = Static<typeof PhysicsCounterSchema>;

/** A button of the controller: where it is (on a body, mm in its part's frame) and what it does. */
export const PhysicsControlSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String(),
  label: Type.String({ maxLength: 3, description: 'The short mark on the button, e.g. B.' }),
  action: Type.Union([Type.Literal('dispense'), Type.Literal('reset'), Type.Literal('prime'), Type.Literal('jog'), Type.Literal('aligned')]),
  body: Type.Optional(Type.String({ description: 'The body it sits on, for the viewer to place it.' })),
  point: Type.Optional(Vec3('Where it is on that body, mm in the part’s own frame.')),
}, { additionalProperties: false });
export type PhysicsControl = Static<typeof PhysicsControlSchema>;

/**
 * A firmware-like controller of one motor: one press runs one cycle (its `moves`, with `pause` between them), debounced, and at most
 * `queue` presses wait while a cycle runs (more are rejected, and counted). It commands motion only; whether an item actually left
 * is what `counter` observes, which a real device without a sensor does not know. A reset stops the motor and reboots: nothing moves
 * on boot, and if a cycle was interrupted the rotor must be re-aligned (jog, then aligned) before it dispenses again.
 */
export const PhysicsControllerSchema = Type.Object({
  motor: Type.String(),
  moves: Type.Array(Type.Number(), { minItems: 1, description: 'One cycle: relative moves of the motor, degrees, in turn.' }),
  pause: Type.Number({ minimum: 0, description: 's between moves.' }),
  settle: Type.Number({ minimum: 0, description: 's after the last move before the cycle is reported done.' }),
  debounce: Type.Number({ minimum: 0, description: 's a press must last to count (as a GPIO filter’s delayed_on).' }),
  queue: Type.Integer({ minimum: 0, description: 'Presses that may wait while a cycle runs.' }),
  boot: Type.Number({ minimum: 0, description: 's from reset until presses are accepted.' }),
  prime: Type.Integer({ minimum: 0, description: 'Cycles a prime runs.' }),
  jog: Type.Number({ description: 'Degrees a jog moves the motor.' }),
  stall: Type.Number({ exclusiveMinimum: 0, description: 'Lost travel (degrees at the motor) beyond which the cycle is a fault.' }),
  counter: Type.String({ description: 'The counter that observes items leaving.' }),
  controls: Type.Array(PhysicsControlSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type PhysicsController = Static<typeof PhysicsControllerSchema>;

/** A scripted input of a scenario. Joint/push timelines are interpolated linearly and held after the last; magnet switches are discrete. */
export const PhysicsDriveSchema = Type.Union([
  Type.Object({
    kind: Type.Literal('magnet'), id: Type.String(),
    timeline: Type.Array(Type.Tuple([Type.Number({ minimum: 0 }), Type.Union([Type.Literal(0), Type.Literal(1)])]), { minItems: 1, description: '[s, enabled (0/1)]; discrete changes, not interpolated. Before the first entry the initial state is retained.' }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('joint'),
    body: Type.String({ description: 'The body whose joint is driven.' }),
    timeline: Type.Array(Type.Array(Type.Number(), { minItems: 2, maxItems: 2 }), { minItems: 1, description: '[s, mm or degrees from the assembled pose].' }),
  }, { additionalProperties: false, description: 'The joint is moved along the timeline, as by a stiff servo.' }),
  Type.Object({
    kind: Type.Literal('push'),
    body: Type.String(),
    point: Vec3('The point of the body that is pushed, in mm, assembled frame (at the start).'),
    timeline: Type.Array(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 }), { minItems: 2, description: '[s, x, y, z]: where the fingertip has moved from the point, in mm. It pushes in the direction of its first move.' }),
    until: Type.Optional(Type.Number({ minimum: 0, description: 'When the finger is taken away, in s; it stays to the end by default.' })),
  }, { additionalProperties: false, description: 'A fingertip (a 1 mm ball) touching the point from outside is moved along the timeline, pushing whatever it meets.' }),
  Type.Object({
    kind: Type.Literal('press'),
    control: Type.String(),
    at: Type.Number({ minimum: 0 }),
    hold: Type.Number({ exclusiveMinimum: 0, description: 'How long it is held down, s.' }),
  }, { additionalProperties: false, description: 'A controller button pressed at `at` and let go after `hold`.' }),
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
    point: Type.Optional(Vec3('Optional body-local point in mm; otherwise measures the body origin. Useful for the geometric centre of a rolling ball.')),
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
    kind: Type.Literal('force'),
    at: Type.Number({ minimum: 0 }),
    body: Type.String(),
    min: Type.Optional(Type.Number()), max: Type.Optional(Type.Number()),
  }, { additionalProperties: false, description: 'The constraint force on the body’s joint along or about its axis (N for a slide, N·mm for a hinge): what its drive, contacts and limits exert together. With only the drive acting, the force it takes to hold the joint where it is (e.g. against a spring).' }),
  Type.Object({
    kind: Type.Literal('contact'),
    at: Type.Number({ minimum: 0 }),
    bodies: Type.Array(Type.String(), { minItems: 2, maxItems: 2 }),
    touching: Type.Boolean(),
  }, { additionalProperties: false, description: 'Whether two bodies touch.' }),
  Type.Object({
    kind: Type.Literal('counter'),
    at: Type.Number({ minimum: 0 }),
    counter: Type.String(),
    min: Type.Optional(Type.Number()), max: Type.Optional(Type.Number()),
  }, { additionalProperties: false, description: 'How many items a counter has counted so far.' }),
  Type.Object({
    kind: Type.Literal('controller'),
    at: Type.Number({ minimum: 0 }),
    field: Type.Union([Type.Literal('cycles'), Type.Literal('rejected'), Type.Literal('lost'), Type.Literal('state')]),
    min: Type.Optional(Type.Number()), max: Type.Optional(Type.Number()),
    state: Type.Optional(Type.String({ description: 'The state it must be in (field state).' })),
  }, { additionalProperties: false, description: 'The controller’s commanded cycles, rejected presses, lost motor travel (degrees) or state.' }),
]);
export type PhysicsCheck = Static<typeof PhysicsCheckSchema>;

export const PhysicsScenarioSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  title: Type.String({ description: 'What it shows, e.g. “Upright, the lighter rests on the tab”.' }),
  gravity: Type.Optional(Vec3('The direction gravity pulls in, in the assembled frame; [0, 0, −1] by default. [0, 0, 1] turns the assembly upside down.')),
  poses: Type.Optional(Type.Record(Type.String(), PhysicsPoseSchema, { description: 'Where free bodies start, instead of their pose in `PhysicsSpec.poses` or the assembly (e.g. a lighter turned over above its bay).' })),
  magnets: Type.Optional(Type.Record(Type.String(), Type.Boolean(), { description: 'Initial enabled states by magnet id, overriding the spec for this scenario.' })),
  items: Type.Optional(Type.Array(Type.String(), { description: 'The loose items present (all by default); e.g. none for an empty hopper.' })),
  duration: Type.Number({ exclusiveMinimum: 0, description: 's.' }),
  drives: Type.Optional(Type.Array(PhysicsDriveSchema)),
  checks: Type.Array(PhysicsCheckSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type PhysicsScenario = Static<typeof PhysicsScenarioSchema>;

export const PhysicsSpecSchema = Type.Object({
  magnets: Type.Optional(Type.Array(PhysicsMagnetSchema)),
  bodies: Type.Array(PhysicsBodySchema, { minItems: 1 }),
  poses: Type.Optional(Type.Record(Type.String(), PhysicsPoseSchema, { description: 'The poses the mechanism starts from (and its joints are measured from), where they differ from the assembly’s: e.g. a latch closed, where the assembly shows it open.' })),
  exclude: Type.Optional(Type.Array(Type.Array(Type.String(), { minItems: 2, maxItems: 2 }), { description: 'Pairs of bodies that never collide.' })),
  maxStep: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: 'The longest time step (s) the mechanism simulates faithfully with, where it needs a shorter one than the default 0.5 ms: e.g. gears meshing by their teeth (0.1 ms; with longer steps their teeth skip).' })),
  precise: Type.Optional(Type.Boolean({ description: 'Solve contacts to a tight tolerance: many loose items pressed against parts that a motor turns through gear teeth (docs/physics-plan.md, "Motors and loose items").' })),
  items: Type.Optional(Type.Array(PhysicsItemSchema)),
  motors: Type.Optional(Type.Array(PhysicsMotorSchema)),
  counters: Type.Optional(Type.Array(PhysicsCounterSchema)),
  controller: Type.Optional(PhysicsControllerSchema),
  scenarios: Type.Optional(Type.Array(PhysicsScenarioSchema)),
}, { additionalProperties: false });
export type PhysicsSpec = Static<typeof PhysicsSpecSchema>;

/**
 * The time constant (s) a sprung joint is damped to, as damping = stiffness × QUASI_STATIC. The physics is quasi-static: printed
 * mechanisms are judged at rest and in slow motion, and the engine's soft contacts stop a part over about its speed times their
 * 2 ms time constant, so a steel ball snapping back at metres per second would sink millimetres into its lip. Damped, the parts
 * arrive at tens of millimetres per second and the forces at rest are unchanged. docs/physics-plan.md, "Quasi-static".
 */
export const QUASI_STATIC = 0.05;

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
