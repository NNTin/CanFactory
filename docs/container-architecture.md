# Containers and communication

The first two diagrams describe the running Docker Compose application. The
Kubernetes view below describes a future target; it is not deployed today.
Service names and ports match [compose.yaml](../compose.yaml).

## Current Docker containers

```mermaid
flowchart TB
    browser["Browser<br/>React editor + Three.js STL viewer"]

    subgraph host["Local Docker host"]
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

    browser <-->|"HTTP — 127.0.0.1:5173 to web:80<br/>HTML, JS, JSON, STL bytes"| web
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
| Browser ↔ web | Load the editor; submit settings; poll; preview/download STL | HTTP on localhost port 5173 (configurable with `WEB_PORT`) |
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

## Proposed Kubernetes target

This is a planning option, not an approved technology decision or an implemented
deployment. It uses PostgreSQL for both metadata and the render queue, and an
object store for STL files. Keeping queued work in the metadata database avoids
introducing a separate broker initially. Queue technology, storage provider,
cluster entry point, and replica limits remain architectural decisions.

```mermaid
flowchart TB
    browser["Browser<br/>Same editor and public API paths"]

    subgraph cluster["Future Kubernetes cluster — application workloads"]
        entry["HTTP entry point<br/>Ingress or Gateway controller"]
        webService["web Service<br/>ClusterIP :80"]
        web["web Deployment — 1..N pods<br/>Nginx static frontend"]
        apiService["api Service<br/>ClusterIP :3001"]
        api["api Deployment — 1..N pods<br/>Stateless Fastify API"]
        worker["worker Deployment — 1..N pods<br/>One OpenSCAD render per pod<br/>Ephemeral local scratch space"]
        migrate["Migration and catalogue-seeding Job<br/>Run before application rollout"]
        cleanup["Maintenance CronJob<br/>Expired records and orphan artifacts"]
        metrics["Queue metrics + autoscaling controller<br/>Pending work and oldest-job age"]
    end

    subgraph state["Durable services — placement and provider to be decided"]
        db[("Proposed PostgreSQL<br/>Catalogue, jobs, leases, artifact metadata")]
        objects[("Object storage<br/>Persistent originals + expiring generated STL files")]
    end

    browser <-->|"HTTP or HTTPS"| entry
    entry <-->|"/ and static assets"| webService
    webService <--> web
    entry <-->|"/api/* — JSON and STL responses"| apiService
    apiService <--> api
    api <-->|"SQL over TCP<br/>Catalogue, submit jobs, read status"| db
    worker <-->|"SQL over TCP<br/>Claim jobs, renew leases, complete jobs"| db
    api <-->|"HTTPS object API<br/>Read and stream STL files"| objects
    worker -->|"HTTPS object API<br/>Upload validated STL"| objects
    migrate -->|"Schema and catalogue updates"| db
    migrate -->|"Seed original STL objects"| objects
    cleanup -->|"Expire records"| db
    cleanup -->|"Delete expired and orphan objects"| objects
    db -.->|"Queue observations via metrics adapter"| metrics
    metrics -.->|"Adjust worker replica count"| worker
```

Solid arrows show application traffic or storage access; dotted arrows show
observability and scaling control. Durable services may be managed externally
or operated in the cluster. They are drawn separately because replicating the
application pods does not replicate or scale the database and object store.

The entry point routes `/api/*` directly to the API Service in this proposal.
That removes the web container from the API traffic path; Nginx would serve only
static assets. STL bytes still travel through the API, preserving the current
expiry checks and same-origin viewer/download behavior. Direct object-store
downloads with short-lived URLs are a separate future optimization.

Each Deployment can have an independent replica count. Kubernetes Services
provide stable endpoints for the HTTP workloads. Workers pull jobs from the
queue and do not need an inbound application Service. These roles follow the
Kubernetes [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
and [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
models.

## Scaling boundaries and migration work

| Component | Current constraint | Change before scaling across nodes |
| --- | --- | --- |
| web | One published localhost port; Nginx also proxies the API | Put replicas behind a Service and entry point; update routing and remove Docker-specific DNS configuration |
| api | SQLite and filesystem access; migrations, seeding, and cleanup run in each API process | Use networked storage adapters; run migrations/seeding once per rollout; coordinate maintenance independently of API replicas |
| worker | One render per process; shared local SQLite and artifact paths | Use a concurrent networked queue and object store; keep render scratch space local to each pod |
| Database / queue | SQLite is a file inside the Docker volume | Proposed PostgreSQL adapter with atomic claims, leases, deduplication, and fencing; size connection pools across all replicas |
| STL storage | Publication uses a filesystem rename into a shared directory | Upload to an immutable object key per attempt, then conditionally publish its metadata while holding the valid lease; collect abandoned uploads |
| Maintenance | API timer performs expiry and recovery; workers also recover leases | Make recovery safe under concurrent callers; use coordinated scheduled cleanup while enforcing expiry on every API read |

SQLite on a shared network filesystem is not the cross-node scaling path; its
locking and filesystem requirements need care over networks. See the
[SQLite network-storage guidance](https://www.sqlite.org/useovernet.html).

Preserve the existing worker contract during migration: only one live claim may
publish a result, retries must tolerate duplicate execution, and successful
metadata must reference a complete validated STL. Object upload and database
commit cannot share the current filesystem transaction; failed attempts must
leave only collectible, unreferenced objects. The current `Store` and
`ArtifactStore` still use synchronous SQLite/filesystem operations, so networked
adapters require asynchronous interfaces and changes at their call sites.

Scale the API using measured HTTP load and latency. Scale workers using queue
depth and waiting time, bounded by node CPU/memory and database capacity. Queue
metrics require an exporter/adapter and configured autoscaling; Kubernetes does
not infer queue demand from the database. Its
[Horizontal Pod Autoscaler](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
supports custom/external metrics with the appropriate metrics APIs installed.
The current two-CPU, 2 GB worker limit is a starting point for measurement, not
a proven Kubernetes resource allocation.

Before enabling multiple replicas, verify concurrent claims and cache
deduplication, pod termination during renders, abandoned-upload cleanup,
one-hour expiry, and a preview/download handled by different API replicas.
During rolling upgrades, API and worker model/renderer fingerprints must remain
compatible with queued jobs; drain old work or route jobs to compatible workers.
Kubernetes probes and shutdown handling also need explicit configuration;
Compose startup ordering does not become a Kubernetes rollout dependency.

The diagrams leave these decisions open: PostgreSQL queue versus a dedicated
broker, database/object-storage hosting, entry controller, autoscaling limits,
and whether the migrated installation remains local or becomes externally
accessible. See [architecture decisions](architecture.md) and
[interface contracts](interfaces.md) for the implemented behavior.
