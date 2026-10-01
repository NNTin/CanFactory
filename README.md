# CanFactory

A local workshop for customizable, printable models. Adjust a provided model,
inspect its actual STL in 3D, and download the same file for your slicer.

See the [container and communication diagrams](docs/container-architecture.md)
for the current Docker layout, render flow, and proposed Kubernetes scaling path.

The first model is a fruit fly trap with adjustable dimensions, an optional
ventilation pattern, and advanced wall, handle, and slot controls.

The [AI rubber ducks](docs/ai-rubber-duck.md) turn the
[concept gallery](docs/concepts/ai-rubber-ducks/README.md) into eight selectable
Claude, Codex, Anthropic, and OpenAI designs. Print their colored pieces
separately, then assemble them with keyed push-fit joints.

## Run with Docker

Requires Docker Engine/Desktop and Docker Compose.

```sh
docker compose up --build -d --wait
```

- App: <http://localhost:5173>
- Interactive API documentation: <http://localhost:5173/api/docs>
- OpenAPI: <http://localhost:5173/api/openapi.json>

Only the web port is published, bound to `127.0.0.1`. API and worker communicate
inside Docker. Use `WEB_PORT=5180 docker compose up --build -d --wait` to select
another web port. The renderer initially uses at most two CPUs and 2 GB of RAM.
Three.js requires a browser with WebGL support.

```sh
docker compose logs -f api worker
docker compose ps
docker compose down
```

`docker compose down` preserves the named `canfactory_data` volume. It contains
the SQLite catalogue, original reference STLs, and temporary render artifacts.
Generated jobs, parameters, and files expire after one hour and are cleaned up
within the next maintenance cycle (10 seconds), including after startup. The API
never serves expired artifacts. The browser remembers the last valid settings;
Reset restores model defaults. There are no accounts or backend saved designs.

The provided model source and STL are preserved under
[`models/fruit-fly-trap/reference`](models/fruit-fly-trap/reference). The adapted
generator is [`generator.scad`](models/fruit-fly-trap/generator.scad). Attribution
and model licensing are recorded in [ATTRIBUTION.md](models/fruit-fly-trap/ATTRIBUTION.md).

## Development and verification

Use Node.js 22.22 or newer, then install the locked dependencies:

```sh
npm ci
npm run check
npm run build
```

`check` runs strict TypeScript, strict lint, OpenAPI/client drift checks, and the
contract/API/queue tests. Building also requires type checking. Application,
server, browser, configuration, and test code use TypeScript.

With the Compose application running:

```sh
npx playwright install chromium
npm run test:browser
```

On Linux, Playwright may need its documented browser system dependencies:
`npx playwright install --with-deps chromium`. Browser tests cover real STL
downloads, stale responses, validation, retries, persistence of browser settings,
and mobile layout. Screenshots and failure traces go to ignored test directories.

The renderer integration suite runs isolated containers using the pinned
OpenSCAD image; it does not use or modify the application database:

```sh
npm run test:renderer
```

It checks default, smooth, small, dense, and maximum-size geometry, including
closed edges, winding, connectivity, volume, dimensions, and identical
preview/download bytes. It takes roughly a minute on the development machine.
Geometric validation does not replace a physical test print.

`npm run test:restart` exercises recovery against the running Compose app. It
restarts the worker during a render, then restarts the API and worker to verify
catalogue and unexpired-artifact persistence.

To iterate on the frontend without rebuilding images, use native development:
`npm run api`, `npm run worker`, and `npm run dev` in separate terminals. The
native worker requires the same OpenSCAD build with Manifold support; Docker is
the supported reproducible path. Native storage defaults to ignored `.data/`.
Both native servers bind to localhost; Vite proxies `/api` to port 3001.

After changing public schemas or API routes:

```sh
npm run contracts:generate
npm run check
```

Commit both generated contract files. They are generated without a running
server or database. See [architecture decisions](docs/architecture.md),
[interface contracts](docs/interfaces.md), [adding models](docs/adding-models.md), and
[the parts library](docs/adding-parts.md).
Use small Conventional Commits, for example `feat(renderer): add a model option`.

## Model settings

Measurements are millimetres. Funnel diameter excludes the brim. Brim width is
the radial extension on each side; displayed print dimensions also include
handles. Source defaults are 60 mm diameter, 60 mm height, a 10 mm brim, and a
3.5 mm central opening.

Basic limits are 20–200 mm diameter, 10–200 mm height, 1–30 mm brim width, and
1–30 mm central opening. Advanced settings retain the original source ranges.
Dependent constraints prevent an opening wider than its surrounding funnel,
nonpositive internal slot-cutter dimensions, and layouts over 10,000 slots.
Disable slots for a smooth funnel with only the central opening.

The worker allows 120 seconds per render; the queue holds up to 16 pending jobs.
The default model takes approximately 3 seconds and the maximum size roughly
43 seconds in the tested two-CPU environment. Actual times depend on hardware
and parameters. OpenSCAD is pinned to a tested dated development build because
it includes the Manifold engine; upgrades should repeat the renderer suite.
