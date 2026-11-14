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

The `offers` CronJob ingests Awin product feeds for the curated affiliate offers
hourly (`docs/affiliate-offers.md`). It is suspended by default: before setting
`offers.suspend=false`, create the Secret named by `offers.secret` with
`AWIN_DATAFEED_KEY` (Awin's product feed key) and allow the pods egress to
`productdata.awin.com` and `datafeed.api.productserve.com` on 443. It uses the
maintenance Secret for its database connection.

Web listens on 8080 internally, API on 3001. Route `/api/*` directly to the API
Service and all other requests to web. API probes/metrics listen on a private
3002 port which is intentionally absent from the public Service. The web image's
Compose proxy configuration is replaced with a chart-owned static-only config.

`web.assistant` configures the embedded assistant (#152), served to the browser as `/config.json` from the web ConfigMap. It
is off by default. Enabling it requires `edgeBaseUrl` (the tinytinkerer edge: `https://api.tiny.nntin.xyz` for production,
`https://api.dev.tiny.nntin.xyz` for the preview) and takes `githubClientId` (tinytinkerer's OAuth App client id, a public
value). The web server's Content Security Policy then allows that edge's origin and `https://api.github.com` in `connect-src`;
with the assistant off it allows only same-origin connections.

`kiprint` deploys KiPrint's MCP server (#152 §6, `templates/kiprint.yaml`), the image `ghcr.io/nntin/kiprint` that the
KiPrint repository publishes. It is off by default, and then nothing of it renders. Enabling it requires
`images.kiprint.digest` and `kiprint.hostname` (`kiprint.nntin.xyz` for production, `kiprint-preview.nntin.xyz` for the
preview), and renders:

- a one-replica Deployment with the `Recreate` strategy (its volume is ReadWriteOnce), the chart's pod security settings
  (uid 1000, read-only root, `/tmp` an `emptyDir`), 1 CPU / 1.5 GiB limits and `/healthz` probes;
- a `kiprint.persistence.size` (5 GiB) PersistentVolumeClaim at `KIPRINT_DATA_DIR=/data`, kept on uninstall. On a cluster
  without a dynamic provisioner, set `storageClassName` and `volumeName` to a pre-created PersistentVolume;
- a Service on 8080, and an HTTPRoute on `kiprint.gateway` for the hostname with only `/mcp`, `/healthz` and `/downloads/*`.
  It adds no middleware, so Traefik doesn't buffer `/mcp`'s server-sent events, and no CORS. `/healthz` and the signed
  download links need no token; KiPrint itself answers `/mcp` without the bearer token with 401;
- with `kiprint.networkPolicy.enabled`, two ingress allowances for namespaces that deny unspecified ingress: the Gateway's
  pods to KiPrint on 8080, and KiPrint to the API on 3001 (`CANFACTORY_API_URL` is the API Service).

Its environment is `KIPRINT_BEARER_TOKEN` from the existing Secret `kiprint.bearerToken` (`kiprint-mcp`, key
`KIPRINT_BEARER_TOKEN`), `CANFACTORY_API_URL`, `KIPRINT_DATA_DIR`, `KIPRINT_PUBLIC_URL` (`https://` + the hostname) and
`KIPRINT_PROJECT_TTL` (`kiprint.projectTtl`, 7d). The chart never holds the token. The image is private: the pod pulls with
the chart-wide `imagePullSecrets` plus `kiprint.imagePullSecrets` (`ghcr-kiprint`). Before enabling it, the owner creates
both Secrets in the release namespace (`canfactory`, and `canfactory-validation` for the preview) without printing either
value:

```sh
# A GitHub classic PAT with read:packages only, read without echoing it.
read -rsp 'PAT: ' pat; echo
kubectl -n canfactory create secret docker-registry ghcr-kiprint \
  --docker-server=ghcr.io --docker-username=<github user> --docker-password="$pat"
unset pat
# The environment's MCP token, straight from the token file (the preview's key is kiprint-preview.nntin.xyz).
jq -j '."kiprint.nntin.xyz"' ~/.secrets/kiprint-mcp-tokens.json |
  kubectl -n canfactory create secret generic kiprint-mcp --from-file=KIPRINT_BEARER_TOKEN=/dev/stdin
```

The same token is the hostname's entry in the tinytinkerer edge's `MCP_HOST_TOKENS`; rotating it means updating both.

Use `tools/check-chart.sh` to validate representative replica configurations and the worker bound. See
`docs/kubernetes-tech-plan.md` for fencing, expiry and upgrade behavior.
