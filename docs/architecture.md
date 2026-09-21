# Architecture decisions

CanFactory is a localhost catalogue of provided, parametric models. Users adjust
settings, inspect the generated STL, and download exactly that artifact. There
are no accounts, uploads, or saved backend designs.

## Application boundaries

- React, Vite, Three.js, and strict TypeScript serve the browser editor.
- Fastify and TypeBox provide a schema-driven API and generated OpenAPI contract.
- A separate TypeScript worker invokes a pinned OpenSCAD Manifold renderer.
- SQLite stores the catalogue and temporary render jobs; files use a shared
  Docker volume. Drizzle defines database tables and typed access.
- Docker Compose runs web, API, and worker services. Only the web port binds to
  localhost; web proxies `/api` to the API.

Separating the worker allows its lifecycle to evolve independently. Kubernetes
is a future migration target; the current deployment remains localhost Docker
Compose. Deployment across machines would require replacing the SQLite queue
and local file store, not mounting SQLite over network storage. The
[container and communication diagrams](container-architecture.md) show the
implemented topology and a proposed migration path with independent scaling.

## Contracts and models

TypeBox schemas are the source of truth for API validation, TypeScript types,
parameter forms, and OpenAPI. A generated OpenAPI client is checked for drift.
Model definitions include defaults, control groups, descriptions, units, source
mapping, validation, version, and attribution. Adding a model must not require a
new React editor. Unknown fields and invalid combinations are rejected.

The supplied fruit fly trap source and STL remain untouched in the model's
reference directory. An adapted SCAD generator adds the slots toggle and keeps
the existing automatic slot distribution. Dimensions are millimetres. Diameter
means the wide end of the funnel, and brim width is radial width on each side.

## Rendering and retention

The editor debounces changes by 500 ms and polls every second. It permits one
outstanding render per editor and retains only the newest pending settings.
Stale results cannot enable downloads or replace a newer preview.

A render cache key includes normalized parameters, source fingerprint, model
version, renderer version, and export settings. Jobs and artifacts expire one
hour after creation. Cleanup runs periodically and on startup. Original catalogue
assets persist. Browser settings use local storage keyed by model version.

Atomic job claims and leases protect the queue; abandoned jobs retry once.
The initial worker runs one job at a time, with 16 pending jobs maximum and a
120-second render timeout. Parameters are passed as allowlisted argument-array
values, never shell commands. Files become visible only after mesh validation
and atomic publication. Preview and download use the same artifact.

## Quality and delivery

Strict TypeScript includes unchecked-index and exact-optional-property checks.
Lint rejects explicit `any`, unsafe operations, and ignored type errors. Public
contracts document units, examples, error behavior, and interface responsibilities.
Type checks, lint, contract drift, behavior tests, real renderer tests, browser
tests, and Docker smoke tests form the verification path.

Implementation proceeds in coherent Conventional Commits: preserve assets,
bootstrap tooling, define contracts, implement API/storage, implement renderer,
build editor, and verify integration. Physical print quality still requires an
actual printer and material-specific assessment.
