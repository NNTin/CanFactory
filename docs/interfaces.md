# Interface contracts

## Public API

The authoritative contracts are TypeBox schemas in `packages/contracts`.
`docs/openapi.json` and `packages/client/src/schema.d.ts` are generated artifacts;
the web app uses `openapi-fetch` against these generated types. Generate and check
them offline using `npm run contracts:generate` and `npm run contracts:check`.

| Method and path | Behavior |
| --- | --- |
| `GET /api/v1/models` | List supplied model summaries and attribution. |
| `GET /api/v1/models/{id}` | Get a versioned model, defaults, JSON Schema, and control descriptors. |
| `GET /api/v1/models/{id}/reference.stl` | Stream the original supplied reference bytes. |
| `POST /api/v1/renders` | Submit complete settings; return an existing successful render (200) or pending job (202). |
| `GET /api/v1/renders/{id}` | Poll status, expiry, derived slot count, and available artifact metadata. |
| `GET /api/v1/renders/{id}/stl` | Stream generated binary STL; `?download=true` changes only content disposition. |

All dimensions are mm; volume is mm³; timestamps are Unix milliseconds. Render
requests include `modelId`, `modelVersion`, and the complete `parameters` object.
Model IDs discriminate parameter types. Unknown keys, numeric strings, invalid
ranges, and invalid combinations are rejected, not silently coerced or clamped.

Errors have `{ code, message, issues: [{ field, message }] }`. Field values are
parameter keys, or empty for an object-level issue. Relevant status codes:

- 404: model or endpoint is unavailable.
- 409: model version changed, or STL requested before successful generation.
- 410: temporary render/file has expired or is no longer available; resubmit.
- 422: request/schema or dependent-parameter validation failed.
- 429: queue is full; `Retry-After: 5` is supplied.
- 500: unexpected server failure, with a sanitized message.

Jobs transition `queued → running → succeeded | failed`. A failed render returns
its error in the job response. Successful results include a URL, SHA-256, byte
and triangle counts, axis-aligned print dimensions, and material volume. No
artifact is exposed for pending or failed jobs. Polling and artifacts use
`Cache-Control: no-store` so expiry remains controlled by the API.

## Queue and artifact boundaries

`RenderQueue` declares atomic claim, lease renewal, successful publication, and
failure operations. The SQLite adapter lives in `packages/server`. Claims have
30-second leases renewed every five seconds. A fencing token makes a late result
from an abandoned worker ineffective. Abandoned work retries once; a second
interruption becomes a visible failure. Clients may explicitly retry failures.

`ArtifactStore` owns catalogue, temporary, and generated file locations. Worker
source paths and SCAD variable names come from trusted definitions, never from
client input. OpenSCAD runs through `execFile` with argument arrays. Successful
files are validated and renamed into their final location before the job is
marked successful inside the claim transaction. Orphan and expired files are
removed by maintenance. Reads in progress can finish even if a file expires.

Cache keys combine the model identifier, source/schema/mapping fingerprint,
renderer/export fingerprint, and sorted parameters. Model or renderer changes
cannot reuse old geometry accidentally. Original assets survive cache cleanup.

SQLite uses WAL and a busy timeout. The API owns versioned SQL migrations and
idempotent catalogue seeding. The worker starts after API readiness. These
interfaces separate geometry execution from HTTP, but the local adapters are
not a multi-machine queue or object store.

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
| `DATA_DIR` | `.data` | SQLite and artifact root; Docker uses `/data`. |
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
