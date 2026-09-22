# Containers and communication

The first two diagrams describe the running Docker Compose application, including
the public route verified on 2026-09-21. The Kubernetes view describes the agreed
migration direction, with implementation details under review; it is not deployed.
Service names and ports match [compose.yaml](../compose.yaml).

## Current Docker containers

```mermaid
flowchart TB
    browser["Browser<br/>React editor + Three.js STL viewer"]
    edge["Cloudflare edge<br/>HTTPS: canfactory.nntin.xyz"]
    browser <-->|"Public HTTPS"| edge

    subgraph host["Local Docker host"]
        tunnel["Existing lair cloudflared<br/>Outbound tunnel connection"]
        traefik["Shared Docker Traefik :443<br/>DNS-01 certificate + security headers<br/>No CanFactory forward-auth"]
        other["Unrelated applications"]
        subgraph network["Docker network: canfactory-network"]
            web["web container<br/>Nginx :80<br/>Static frontend + API reverse proxy"]
            api["api container<br/>Fastify :3001<br/>Catalogue, validation, render jobs, STL downloads"]
            worker["worker container<br/>TypeScript worker + OpenSCAD subprocess<br/>One render at a time; no HTTP listener"]
        end
        subgraph volume["Shared named volume: canfactory_data — mounted at /data"]
            db[("SQLite<br/>Catalogue, job queue, leases, worker heartbeats")]
            files[("Files<br/>Original STLs + temporary generated STLs")]
        end
    end

    edge <-->|"Encrypted tunnel"| tunnel
    tunnel <-->|"HTTPS origin, noTLSVerify=true<br/>Verified remote CanFactory rule"| traefik
    traefik <-->|"HTTP — canfactory-web:80"| web
    traefik <--> other
    browser <-->|"Alternative local access: HTTP 127.0.0.1:5173"| web
    web <-->|"HTTP — api:3001<br/>Proxy /api/* requests and responses"| api
    api <-->|"Local SQL reads and writes"| db
    worker <-->|"Local SQL: claim jobs, renew leases, publish status"| db
    api <-->|"Seed originals, read STL files, remove expired files"| files
    worker -->|"Write and validate STL; publish by atomic rename"| files
```

React and Three.js run in the browser; the web container serves their static
build. Only `web` publishes a host port. `api` listens inside the Docker network,
and `worker` has no listening port. OpenSCAD runs inside the worker container.

The API and worker communicate through shared SQLite state and files. There is
no API-to-worker HTTP call, message broker, or separate database container. Both
containers mount the same local volume. Trusted model definitions and SCAD
sources are packaged in their images, outside that writable volume.

| Connection | Purpose | Current protocol or access |
| --- | --- | --- |
| Browser ↔ Cloudflare ↔ cloudflared ↔ Traefik ↔ web | Public editor/API/STL access | Edge HTTPS, encrypted tunnel, origin HTTPS with verification disabled, then HTTP to web |
| Browser ↔ web | Alternative local editor/API/STL access | HTTP on localhost port 5173 (configurable with `WEB_PORT`) |
| web ↔ api | Forward every `/api/*` request and its response | HTTP to Docker service DNS `api:3001` |
| api ↔ SQLite | Catalogue, cached results, queued jobs, maintenance | SQLite file access on `/data`; no database TCP port |
| worker ↔ SQLite | Claim jobs, heartbeat, renew leases, record completion/failure | SQLite file access on the same volume |
| api ↔ files | Preserve originals, stream STL bytes, clean expired artifacts | Local filesystem on `/data` |
| worker → files | Render in a temporary directory, validate, publish artifact | Local filesystem on `/data` |

Compose starts `web` and `worker` after the API health check passes. This is a
startup dependency, not another communication channel. Nginx refreshes Docker
DNS so API address changes do not require a web restart.

## Render request and STL delivery

This sequence shows a cache miss. A matching unexpired successful render returns
immediately from the API without another OpenSCAD run.

```mermaid
sequenceDiagram
    actor User
    participant Browser as Browser / React
    participant Web as web / Nginx
    participant API as api / Fastify
    participant DB as SQLite queue
    participant Worker as worker / TypeScript + OpenSCAD
    participant Files as Shared STL files

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
    Worker->>Files: Write temporary STL and validate mesh
    Worker->>DB: Verify lease in completion transaction
    Worker->>Files: Atomically rename STL to final path
    Worker->>DB: Commit success and artifact metadata

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
    API->>Files: Read published STL
    Files-->>API: STL bytes
    API-->>Web: Stream STL
    Web-->>Browser: Load into Three.js viewer
    User->>Browser: Download STL
    Note over Browser,Files: Download uses the same artifact via this HTTP path
```

Status polling overlaps rendering; it is drawn afterward to keep the sequence
readable. Failed renders return a terminal error without an artifact. Abandoned
leases allow one retry, while fencing tokens prevent stale workers from
publishing. The API refuses expired jobs/files; maintenance removes them.

## Kubernetes deployment — preview verified, production cutover pending

The user selected one WSL2/NUC host, RKE2, Flux, an application Helm chart,
PostgreSQL-backed jobs, local Garage, a dedicated tunnel, and independent manual
web/API/worker scaling. Short interruption and discarding old temporary renders
are acceptable. Detailed behavior is in the implemented [tech plan](kubernetes-tech-plan.md).

```mermaid
flowchart TB
    browser["Browser: preview hostname; same editor"]
    cloud["Cloudflare: public HTTPS"]
    browser <-->|"HTTPS"| cloud

    subgraph cluster["New single-node RKE2 on existing WSL2/NUC"]
        tunnel["Dedicated CanFactory cloudflared"]
        ingress["Internal Traefik ClusterIP + Gateway API"]
        web["web Service + Deployment<br/>Initially 2 replicas; static assets"]
        api["api Service + Deployment<br/>Initially 2 replicas; async storage"]
        workers["worker Deployment<br/>Initially 1, manual maximum 2<br/>One render per pod; local scratch"]
        release["Release migration/seeding Job"]
        maintenance["Maintenance CronJob"]
        pg[("PostgreSQL<br/>Catalogue, jobs, leases, heartbeats<br/>One instance, local PV")]
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

    shared["Existing lair tunnel + Docker Traefik<br/>Production CanFactory + unrelated apps until cutover"]
    cloud <--> shared
```

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
    Note over Worker: Render/validate in local scratch; renew lease
    Worker->>S3: Upload immutable attempt object
    S3-->>Worker: Upload complete
    Worker->>DB: Publish metadata only with live token and unexpired job
    alt Winning live claim
        DB-->>Worker: Commit success
        API->>DB: Check success, expiry and object metadata
        API->>S3: Stream the recorded object for preview/download
    else Lost claim or failed commit
        Note over Worker,S3: Unreferenced upload is collected; stale result stays invisible
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
The existing Compose deployment remains operational during implementation and
validation. Production DNS switching requires a separate cutover agreement.
