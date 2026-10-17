# Containers and communication

Production moved to Kubernetes on 2026-09-22 after explicit cutover approval.
The Kubernetes diagrams below describe the live production and preview endpoints.
The first two diagrams show Docker Compose, which now serves local development
and CI only; service names and ports match [compose.yaml](../compose.yaml). It
runs the same storage as Kubernetes (PostgreSQL and Garage S3). The former
SQLite Compose deployment was deleted, and with it the Compose rollback path
(#90).

## Local Docker Compose (development and CI)

```mermaid
flowchart TB
    browser["Browser<br/>React editor + Three.js STL viewer"]

    subgraph host["Local Docker host"]
        subgraph network["Docker network: canfactory-network"]
            web["web container<br/>Nginx :80<br/>Static frontend + API reverse proxy"]
            api["api container<br/>Fastify :3001<br/>Catalogue, validation, render jobs, STL downloads"]
            worker["worker container<br/>TypeScript worker + OpenSCAD subprocess<br/>One render at a time; no HTTP listener"]
            release["release (one-shot)<br/>tools/maintenance.ts buckets release"]
            maintenance["maintenance<br/>tools/maintenance.ts cleanup, every minute"]
            pg[("postgres :5432<br/>Catalogue, job queue, leases, worker heartbeats, Awin rows")]
            garage[("garage S3 :3900<br/>Catalogue bucket: original STLs<br/>Generated bucket: temporary STLs and ZIPs")]
        end
    end

    browser <-->|"HTTP 127.0.0.1:5173"| web
    web <-->|"HTTP — api:3001<br/>Proxy /api/* requests and responses"| api
    api <-->|"SQL: enqueue, read status"| pg
    worker <-->|"SQL: claim jobs, renew leases, publish status"| pg
    api -->|"S3: stream reference and generated files"| garage
    worker -->|"S3: upload validated attempt object"| garage
    release --> pg
    release --> garage
    maintenance --> pg
    maintenance --> garage
```

React and Three.js run in the browser; the web container serves their static
build. Only `web` publishes a host port. `api`, `postgres` and `garage` listen
inside the Docker network, and `worker` has no listening port. OpenSCAD runs
inside the worker container, in local scratch under `/tmp`.

The API and worker communicate through PostgreSQL and Garage, as in Kubernetes.
There is no API-to-worker HTTP call or message broker. Trusted model definitions
and SCAD sources are packaged in their images. The API, worker, release and
maintenance containers share one set of local-only credentials from
`compose.yaml`.

| Connection | Purpose | Current protocol or access |
| --- | --- | --- |
| Browser ↔ web | Editor/API/STL access | HTTP on localhost port 5173 (configurable with `WEB_PORT`) |
| web ↔ api | Forward every `/api/*` request and its response | HTTP to Docker service DNS `api:3001` |
| api ↔ postgres | Catalogue, cached results, queued jobs, offers | PostgreSQL protocol to `postgres:5432` |
| worker ↔ postgres | Claim jobs, heartbeat, renew leases, record completion/failure | PostgreSQL protocol to `postgres:5432` |
| api → garage | Stream original and generated STL/ZIP bytes | S3 HTTP to `garage:3900` |
| worker → garage | Upload a validated attempt object before publishing it | S3 HTTP to `garage:3900` |
| release → postgres, garage | Create buckets, migrate, seed the catalogue and references, once per `up` | PostgreSQL and S3 |
| maintenance → postgres, garage | Recover leases, delete expired jobs and objects, every minute | PostgreSQL and S3 |

Compose starts `api` and `maintenance` after `release` completes, and `web` and
`worker` after the API health check passes. These are startup dependencies, not
other communication channels. Nginx refreshes Docker DNS so API address changes
do not require a web restart.

## Render request and STL delivery

This sequence shows a cache miss. A matching unexpired successful render returns
immediately from the API without another OpenSCAD run.

```mermaid
sequenceDiagram
    actor User
    participant Browser as Browser / React
    participant Web as web / Nginx
    participant API as api / Fastify
    participant DB as PostgreSQL queue
    participant Worker as worker / TypeScript + OpenSCAD
    participant Files as Garage S3 (generated bucket)

    User->>Browser: Change model dimensions or slots
    Note over Browser: Validate, debounce 500 ms, keep newest pending settings
    Browser->>Web: POST /api/v1/renders
    Web->>API: Forward request
    API->>DB: Validate cache key and enqueue job
    DB-->>API: Job ID and queued status
    API-->>Web: 202 Accepted + job ID
    Web-->>Browser: Queued render

    Worker->>DB: Poll and atomically claim a job
    DB-->>Worker: Parameters + lease token
    Note over Worker: Run OpenSCAD subprocess, timeout 120 seconds
    loop While rendering, every 5 seconds
        Worker->>DB: Renew 30-second lease and worker heartbeat
    end
    Note over Worker,Files: An assembly model (e.g. moss-planter) repeats this render+validate step once per<br/>part, with only the parameter overrides that part's own mapping names, then packages every part's STL into one ZIP instead of writing one STL.
    Note over Worker: Write the STL in local scratch and validate the mesh
    Worker->>DB: Verify the lease is still live
    Worker->>Files: Upload the attempt object (keyed by job and lease token)
    Worker->>DB: Commit success and artifact metadata only with the live token

    loop Browser polls every second until terminal status
        Browser->>Web: GET /api/v1/renders/{id}
        Web->>API: Forward status request
        API->>DB: Read current job state
        DB-->>API: Status and available artifact metadata
        API-->>Web: Job response
        Web-->>Browser: Job response
    end

    Browser->>Web: GET /api/v1/renders/{id}/stl
    Web->>API: Forward STL request
    API->>DB: Check success and expiry
    API->>Files: Read the recorded object
    Files-->>API: STL bytes
    API-->>Web: Stream STL
    Web-->>Browser: Load into Three.js viewer
    User->>Browser: Download STL
    Note over Browser,Files: Download uses the same artifact via this HTTP path.<br/>An assembly model uses /renders/{id}/zip instead, and the<br/>viewer loads every part it contains onto one auto-sized grid.
```

Status polling overlaps rendering; it is drawn afterward to keep the sequence
readable. Failed renders return a terminal error without an artifact. Abandoned
leases allow one retry, while fencing tokens prevent stale workers from
publishing. The API refuses expired jobs/files; maintenance removes them.

## Live Kubernetes deployment — production and preview

The user selected one WSL2/NUC host, RKE2, Flux, an application Helm chart,
PostgreSQL-backed jobs, local Garage, a dedicated tunnel, and independent manual
web/API/worker scaling. Short interruption and discarding old temporary renders
are acceptable. Detailed behavior is in the implemented [tech plan](kubernetes-tech-plan.md).

```mermaid
flowchart TB
    browser["Browser: same editor on every hostname"]
    cloud["Cloudflare: public HTTPS<br/>production canfactory.nntin.xyz<br/>preview canfactory-preview.nntin.xyz"]
    vercel["Vercel preview deployments<br/>static apps/web build (vercel.json)"]
    awin(("Awin product feeds<br/>productdata.awin.com<br/>datafeed.api.productserve.com"))
    browser <-->|"HTTPS"| cloud
    browser <-->|"HTTPS: / and static assets"| vercel
    vercel <-->|"Rewrite /api/* to production<br/>https://canfactory.nntin.xyz"| cloud

    subgraph cluster["New single-node RKE2 on existing WSL2/NUC"]
        tunnel["Dedicated CanFactory cloudflared"]
        ingress["Internal Traefik ClusterIP + Gateway API"]
        web["web Service + Deployment<br/>Initially 2 replicas; static assets"]
        api["api Service + Deployment<br/>Initially 2 replicas; async storage"]
        workers["worker Deployment<br/>Initially 1, manual maximum 2<br/>One render per pod; local scratch"]
        release["Release migration/seeding Job"]
        maintenance["Maintenance CronJob"]
        offers["Offers CronJob, hourly (api image)<br/>tools/offers.ts ingest-awin<br/>Suspended until the Awin key is set"]
        pg[("PostgreSQL<br/>Catalogue, jobs, leases, heartbeats,<br/>awin_feeds + awin_offers<br/>One instance, local PV")]
        garage[("Garage S3<br/>Persistent references + temporary artifacts<br/>One instance, local PV")]
    end

    cloud <-->|"Encrypted outbound tunnel"| tunnel
    tunnel <-->|"Internal HTTP"| ingress
    ingress <-->|"/ and static assets"| web
    ingress <-->|"/api/* JSON and STL bytes"| api
    api <-->|"SQL"| pg
    workers <-->|"SQL: claim, renew, fenced publication"| pg
    api <-->|"S3: stream reference/generated bytes"| garage
    workers -->|"S3: immutable attempt upload"| garage
    release --> pg
    release --> garage
    maintenance --> pg
    maintenance --> garage
    offers -->|"Outbound HTTPS: feed list + feed CSVs"| awin
    offers -->|"SQL: write awin_feeds, awin_offers"| pg

    shared["Existing lair tunnel + Docker Traefik<br/>Unrelated apps"]
    cloud <--> shared
```

Production (`canfactory.nntin.xyz`) follows `develop`'s chart releases, and the
preview (`canfactory-preview.nntin.xyz`) follows the newest pull-request chart;
`npm run preview:check` (`tools/check-preview.ts`) reports which commit each
serves. Both hostnames reach the cluster through the same tunnel. Vercel preview
deployments are separate: `vercel.json` builds only `apps/web` and rewrites
`/api/:path*` to production, so a Vercel preview calls the production API,
queue and storage.

The offers CronJob (`charts/canfactory/templates/offers.yaml`) runs
`node --import tsx tools/offers.ts ingest-awin` in the api image. It downloads
Awin's feed list and the curated offers' feeds over HTTPS and writes the
`awin_feeds` and `awin_offers` tables, which `GET /api/v1/offers` reads. It is
suspended until the `offers.secret` Secret holds `AWIN_DATAFEED_KEY` and the
network policy allows egress to both Awin hosts on 443. See
[affiliate-offers.md](affiliate-offers.md).

Preview and download still pass through the API and reference the same immutable
artifact. API reads enforce expiry regardless of object cleanup timing. There is
no worker HTTP Service or API-to-worker RPC. PostgreSQL is also the job queue;
no broker is introduced. Generated settings/files expire after one hour and
catalogue reference objects persist.

Both data services use network APIs even though their local volumes reside on
one node. Replicating application pods does not replicate these volumes or provide
availability after losing the NUC. Local copies support rollback; machine-loss
recovery rebuilds from Git/images and reseeds references with an empty render queue.

## Publication and failure boundaries

```mermaid
sequenceDiagram
    participant API
    participant DB as PostgreSQL
    participant Worker
    participant S3 as Garage
    API->>DB: Validate/fingerprint, deduplicate and enqueue transaction
    Worker->>DB: Atomic compatible claim + fencing token
    Note over Worker: Render/validate in local scratch, renew lease
    Worker->>S3: Upload immutable attempt object
    S3-->>Worker: Upload complete
    Worker->>DB: Publish metadata only with live token and unexpired job
    alt Winning live claim
        DB-->>Worker: Commit success
        API->>DB: Check success, expiry and object metadata
        API->>S3: Stream the recorded object for preview/download
    else Lost claim or failed commit
        Note over Worker,S3: Unreferenced upload is collected, stale result stays invisible
    end
```

There is no atomic transaction spanning PostgreSQL and Garage. The adapter must
handle upload/commit failures, durable deletion retries and abandoned uploads.
API processes no longer own migrations, seeding or cleanup. Release Jobs serialize
schema/catalogue changes; maintenance is independently coordinated. Fingerprint-
changing releases pause submissions and drain old work before catalogue activation.

Resource budgets, HTTP draining, lease recovery, immutable publication, expiry and
rolling upgrades have passed real multi-replica tests. The infrastructure repository
records exact evidence and remaining limits in `docs/canfactory/validation.md`.
Production cutover was separately authorized and executed. Browser customization,
inspection and downloads passed on the production hostname after routing converged.
Shared Compose infrastructure remains operational for unrelated applications. The
legacy SQLite CanFactory deployment is no longer a rollback target: its storage
backend was deleted (#90), so a rollback means an earlier chart release. See the
infrastructure validation record for one-hour observation results and remaining
recovery limits.
