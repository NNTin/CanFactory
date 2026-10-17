# Interface contracts

## Public API

The authoritative contracts are TypeBox schemas in `packages/contracts`.
`docs/openapi.json` and `packages/client/src/schema.d.ts` are generated artifacts;
the web app uses `openapi-fetch` against these generated types. Generate and check
them offline using `npm run contracts:generate` and `npm run contracts:check`.

The catalogue is not served: the web app bundles `@canfactory/contracts` and reads the models (`models`, `findModel`,
`artifactFormat`) and the parts library (`partFamilies`, `partsOfFamily`, `findPartSource`, `partUsage`) from it, so the
browser and the API validate against the same definitions. A render request's `modelVersion` is the bundled
definition's `version`.

| Method and path | Behavior |
| --- | --- |
| `GET /api/v1/models/{id}/reference.stl` | Stream the original supplied reference bytes. 404 if the model has none. |
| `GET /api/v1/market` | The visitor's market from Cloudflare's `CF-IPCountry` (DE/AT/CH → `DE`, else `US`) and which affiliate networks link in each market. `private, no-store`. |
| `GET /api/v1/offers?market=DE&parts=<id>[:<qty>],…` | Where to buy parts: ranked affiliate offers per part in packs that cover each quantity, and the buy list grouped by shop. 404 for an unknown part. See [affiliate-offers.md](affiliate-offers.md). |
| `POST /api/v1/renders` | Submit complete settings; return an existing successful render (200) or pending job (202). |
| `GET /api/v1/renders/{id}` | Poll status, expiry, derived slot count, and available artifact metadata. |
| `GET /api/v1/renders/{id}/stl` | Stream generated binary STL; `?download=true` changes only content disposition. |
| `GET /api/v1/renders/{id}/zip` | Same, but for a multi-part assembly model's ZIP of STL parts (`application/zip`). |

All dimensions are mm; volume is mm³; timestamps are Unix milliseconds. Render
requests include `modelId`, `modelVersion`, and the complete `parameters` object.
Model IDs discriminate parameter types. Unknown keys, numeric strings, invalid
ranges, and invalid combinations are rejected, not silently coerced or clamped.

A model's `artifactFormat(model)` (`stl` or `zip`) says which of the two render-artifact routes to use. A `zip`-formatted model's artifact has no top-level
`dimensions` (a bounding box across independently placed parts isn't meaningful) but a `parts` array, one entry
per part, each with its own dimensions/volume/triangle count; a single-part model's artifact has `dimensions` and
no `parts`. The definition's `parts` lists an assembly's parts regardless of render state.

Errors have `{ code, message, issues: [{ field, message }] }`, and optionally `detail` (technical, for whoever
fixes the fault), `reference` (an identifier to quote; a failed render's job id) and `retryable` (false when the
same request will fail again). Field values are parameter keys, or empty for an object-level issue. Relevant status codes:

- 404: model or endpoint is unavailable.
- 409: model version changed, or STL requested before successful generation.
- 410: temporary render/file has expired or is no longer available; resubmit.
- 422: request/schema or dependent-parameter validation failed.
- 429: queue is full; `Retry-After: 5` is supplied.
- 500: unexpected server failure, with a sanitized message.

Jobs transition `queued → running → succeeded | failed`. A failed render returns
its error in the job response, classified by `code`:

| Code | Meaning | `retryable` |
| --- | --- | --- |
| `RENDER_TIMEOUT` | OpenSCAD ran past the 120-second limit | yes |
| `RENDERER_INTERNAL` | an unexpected fault in the worker | yes |
| `OPENSCAD_FAILED` | OpenSCAD failed on these settings (a model defect; `detail` has its output) | no |
| `GEOMETRY_INVALID` | the generated mesh is not one valid solid (a model defect; `detail` names the part and the check) | no |
| `MODEL_CHANGED` | the model or renderer changed since the job was queued; refresh the catalogue | no |
| `SETTINGS_INVALID` | the queued settings no longer validate | no |

The worker logs every failure at error level with the job id, model, version, full settings and `detail`, and the
internal `/metrics` endpoint counts unexpired failures as `canfactory_render_failures{model,code}`. Binary STL
stores float32 coordinates, which can flatten a sliver thinner than float32 resolves into a zero-area triangle: the
worker repairs exactly those (`repairFloat32Slivers`: a collapsed edge's triangles removed, a collinear sliver's
neighbour split, no vertex moved) and still requires one valid solid. A repaired part is logged as a warning and
reported as `meshRepairs` in the artifact metadata and `canfactory_mesh_repairs{model}`; the renderer tests and the
geometry sweep (`npm run test:sweep`) fail on any repair, since it marks fragile geometry to fix in the SCAD source.

Successful results include a URL, SHA-256, byte
and triangle counts, axis-aligned print dimensions, and material volume. No
artifact is exposed for pending or failed jobs. Polling and artifacts use
`Cache-Control: no-store` so expiry remains controlled by the API.

## Queue and artifact boundaries

`PostgresStorage` (`packages/server/src/postgres.ts`) is the only queue and
catalogue: atomic claim, lease renewal, successful publication, and failure
operations. Claims have 30-second leases renewed every five seconds. A fencing
token makes a late result from an abandoned worker ineffective. Abandoned work
retries once; a second interruption becomes a visible failure. Clients may
explicitly retry failures. At most 16 jobs may be queued; a further submission
gets 429 `QUEUE_FULL` (`QUEUE_LIMIT` in `packages/server/src/config.ts`).

`ObjectStorage` (`objects.ts`) keeps reference STLs in the catalogue bucket and
generated files in the generated bucket of Garage S3. Worker source paths and
SCAD variable names come from trusted definitions, never from client input.
OpenSCAD runs through `execFile` with argument arrays in a local scratch
directory. Successful files are validated and uploaded under the job's lease
token before the job is marked successful, and only while that lease is live.
Orphan and expired objects are removed by maintenance. Reads in progress can
finish even if a file expires.

Cache keys combine the model identifier, source/schema/mapping fingerprint,
renderer/export fingerprint, and sorted parameters. Model or renderer changes
cannot reuse old geometry accidentally. Original assets survive cache cleanup.

Versioned SQL migrations (`packages/server/migrations/`) and idempotent
catalogue seeding belong to the release job (`tools/maintenance.ts release`);
lease recovery and expiry cleanup to the maintenance job. Compose and the chart
run both.

## Editor behavior

The editor validates before submission, waits 500 ms after edits, and polls once
per second. It allows one outstanding job per mounted editor. Pending edits are
coalesced to the newest valid configuration. A result is applied only if its
configuration still matches the current editor, and download is enabled only
after the corresponding STL has loaded into the viewer.

The old mesh remains visible during generation. Invalid settings and render
failures cannot enable downloading that old mesh. Unmount aborts browser
requests; already accepted jobs remain temporary cache entries. Local storage
is optional and stores only the last valid settings per model/version.

## Operational configuration

| Variable | Native default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | none | PostgreSQL queue and catalogue (required). |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_CATALOGUE_BUCKET`, `S3_GENERATED_BUCKET` | none | Garage S3 (required); `S3_REGION` defaults to `garage`. |
| `SCRATCH_DIR` | `/tmp/canfactory` | Local render scratch. |
| `PROJECT_ROOT` | current directory | Trusted model/source root; Docker uses `/app`. |
| `PORT` | `3001` | API listener port. |
| `HOST` | `127.0.0.1` | API bind address; Docker uses `0.0.0.0` internally. |
| `WEB_PORT` | `5173` | Compose's localhost web port. |
| `BASE_URL` | `http://127.0.0.1:5173` | Browser-test target. |

`GET /api/health` reports API readiness and recent worker heartbeat state. Worker
logs record job ID, attempts, duration, and failures, without logging parameter
payloads. Compose supplies process initialization, health checks, and restart
policies. Generated files and dependencies are excluded from Git.

Nginx resolves the API service through Docker DNS every five seconds, so API
container address changes do not require restarting the frontend. Web health
checks exercise both the static page and the proxied API health endpoint.
