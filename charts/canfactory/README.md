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
`web.assistant.mcpServers` lists further host MCP servers for the assistant, empty by default; a deployed KiPrint adds itself
(below). The edge proxies them and adds their token from its `MCP_HOST_TOKENS`, so they are not in the CSP. The app marks each
one required: while its tools are missing, the model is told the server is unavailable.

`kiprint` deploys KiPrint's MCP server (#152 §6, `templates/kiprint.yaml`), the private image `ghcr.io/nntin/kiprint` that
the KiPrint repository publishes. Its digest is one value, `images.kiprint.digest`, pinned in `values.yaml`: a new KiPrint
image is a one-line bump. `kiprint.enabled` is off by default, and then nothing of it renders. Enabling it requires
`kiprint.hostname` (`kiprint.nntin.xyz` for production, `kiprint-preview.nntin.xyz` for the preview) and renders, labelled
`app.kubernetes.io/name: kiprint`:

- a one-replica Deployment with the `Recreate` strategy (its volume is ReadWriteOnce), the chart's pod security settings
  (uid/gid 1000 with `fsGroup`, read-only root, `/tmp` an `emptyDir`), 1 CPU / 1.5 GiB limits and `/healthz` probes;
- a `kiprint.persistence.size` (5 GiB) PersistentVolumeClaim at `KIPRINT_DATA_DIR=/data`, kept on uninstall. On a cluster
  without a default StorageClass, set `storageClassName`, and `volumeName` for a pre-created PersistentVolume;
- a Service on 8080, and an HTTPRoute on `kiprint.gateway` for the hostname with only `/mcp`, `/healthz` and `/downloads/*`.
  It adds no middleware, so Traefik doesn't buffer `/mcp`'s server-sent events, and no CORS. `/healthz` and the signed
  download links need no token; KiPrint itself answers `/mcp` without the bearer token with 401;
- with `kiprint.assistant` (the default), `{id: kiprint, name: KiPrint, url: https://<hostname>/mcp}` in the web assistant's
  `/config.json`, so disabling KiPrint also takes it out of the assistant.

Its environment is `KIPRINT_BEARER_TOKEN` from the existing Secret `kiprint.bearerToken` (`kiprint-token`, key `token`),
`CANFACTORY_API_URL` (the API Service), `KIPRINT_DATA_DIR`, `KIPRINT_PUBLIC_URL` (`https://` + the hostname) and
`KIPRINT_PROJECT_TTL` (`kiprint.projectTtl`, 7d). The chart never holds the token. The pod pulls with the chart-wide
`imagePullSecrets` plus `kiprint.imagePullSecrets` (`ghcr-kiprint`). Before enabling it, the owner creates both Secrets in the
release namespace without printing either value:

```sh
# A GitHub classic PAT with read:packages only, read without echoing it.
read -rs PAT
kubectl -n <namespace> create secret docker-registry ghcr-kiprint \
  --docker-server=ghcr.io --docker-username=<github user> --docker-password="$PAT"
unset PAT
# The environment's MCP token, straight from the token file (production's key is kiprint.nntin.xyz).
jq -r '."kiprint-preview.nntin.xyz"' /home/ao/.secrets/kiprint-mcp-tokens.json |
  kubectl -n <namespace> create secret generic kiprint-token --from-file=token=/dev/stdin
```

The same token is the hostname's entry in the tinytinkerer edge's `MCP_HOST_TOKENS`; rotating it means updating both.

The chart owns no network policy. In a namespace that denies unspecified ingress, the infrastructure repository allows:

- the Gateway's Traefik pods to pods labelled `app.kubernetes.io/name: kiprint` on TCP 8080;
- those pods to the API pods (`app.kubernetes.io/component: api`) on TCP 3001, for `GET /api/v1/parts/{id}` and `/layout`;
- if egress is restricted too, KiPrint's DNS. It needs no other egress.

The preview's HelmRelease enables it with:

```yaml
kiprint:
  enabled: true
  hostname: kiprint-preview.nntin.xyz
```

Use `tools/check-chart.sh` to validate representative replica configurations and the worker bound. See
`docs/kubernetes-tech-plan.md` for fencing, expiry and upgrade behavior.
