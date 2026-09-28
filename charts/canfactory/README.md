# CanFactory application chart

Requires Kubernetes 1.36, PostgreSQL 18, a compatible private S3 service and
pre-existing credentials. This chart owns only application resources. Ingress,
tunnel, namespaces, policies, PostgreSQL, Garage and their volumes are managed
separately. Uninstalling this chart does not delete persistent data.

Set immutable image digests for `images.web`, `images.api` and `images.worker`.
The defaults intentionally cannot be installed without these values. Set
`imagePullSecrets` when using private registry packages.

Charts published by `.github/workflows/kubernetes.yml` already embed the digests of
the images built in the same run (`tools/stamp-chart-digests.py`), so they install
without image values. Versions form two channels: `0.2.0-dev.N` from `develop`
(production) and `0.2.0-pr.N` from same-repository pull requests (preview). `N` is
the workflow run number, so the highest version in a channel is the newest build.

Each named Secret under `secrets` must contain `DATABASE_URL`, `S3_ACCESS_KEY_ID`
and `S3_SECRET_ACCESS_KEY`. Supply credentials outside Git. The release role owns
schema migrations; runtime database accounts should have only the permissions
their operations require. S3 API credentials read both buckets; worker credentials
write generated objects; release credentials write references; maintenance deletes
generated objects. Garage's bucket-level permissions are the minimum granularity.

The pre-install/pre-upgrade Job serializes SQL migrations and seeds reference
objects before workloads start. Required Secrets/data services and network policy
must already exist. It uses the namespace's default ServiceAccount without an API
token, avoiding a dependency on ordinary chart resources during the hook.
Helm rollback never reverses SQL migrations.

Configure `web.replicas`, `api.replicas`, and `worker.replicas` independently.
The initial worker maximum is two; each pod renders one job at a time, with no
rollout surge. Maintenance runs independently each minute. No HPA is installed.

Web listens on 8080 internally, API on 3001. Route `/api/*` directly to the API
Service and all other requests to web. API probes/metrics listen on a private
3002 port which is intentionally absent from the public Service. The web image's
Compose proxy configuration is replaced with a chart-owned static-only config.

Use `tools/check-chart.sh` to validate representative replica configurations and the worker bound. See
`docs/kubernetes-tech-plan.md` for fencing, expiry and upgrade behavior.
