#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rendered=$(mktemp --suffix=.yaml)
trap 'rm -f "$rendered"' EXIT
schemas="${KUBECONFORM_SCHEMAS:-$HOME/.local/share/canfactory/kubeconform}"
# Kubernetes' own kinds from kubeconform's default location; the Gateway API's from tools/install-ci-tools.sh.
validate() {
  local result
  result=$(kubeconform -strict -summary -output json -kubernetes-version 1.36.4 -schema-location default \
    -schema-location "$schemas/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json" "$rendered")
  VALIDATION_RESULT="$result" MINIMUM="$1" node --input-type=module -e '
    const { summary } = JSON.parse(process.env.VALIDATION_RESULT);
    if (summary.valid < Number(process.env.MINIMUM) || summary.invalid || summary.errors || summary.skipped) {
      throw new Error(`Incomplete chart validation: ${JSON.stringify(summary)}`);
    }
    console.log(`PASS ${summary.valid} rendered resources; none skipped`);
  '
}
helm lint charts/canfactory --strict --kube-version 1.36.4 -f charts/canfactory/ci/values.json
for replicas in 1 2; do
  helm template canfactory charts/canfactory --namespace canfactory --kube-version 1.36.4 \
    -f charts/canfactory/ci/values.json --set "web.replicas=$replicas,api.replicas=$replicas,worker.replicas=$replicas" > "$rendered"
  validate 9
done
if helm template canfactory charts/canfactory --kube-version 1.36.4 \
  -f charts/canfactory/ci/values.json --set worker.replicas=3 > /dev/null 2>&1; then
  echo 'Worker concurrency bound was not enforced.' >&2
  exit 1
fi
# The assistant (#152): off by default, so the CSP allows no other origin; on, connect-src allows exactly its edge's origin
# and api.github.com, and /config.json carries the values. On without an edge must not render.
web_config() { helm template canfactory charts/canfactory --kube-version 1.36.4 -f charts/canfactory/ci/values.json --show-only templates/web-config.yaml "$@"; }
web_config | grep -q "connect-src 'self'; " || { echo 'Default CSP must allow only same-origin connections.' >&2; exit 1; }
enabled=$(web_config --set web.assistant.enabled=true,web.assistant.edgeBaseUrl=https://api.dev.tiny.nntin.xyz/,web.assistant.githubClientId=client)
grep -q "connect-src 'self' https://api.dev.tiny.nntin.xyz https://api.github.com; " <<<"$enabled" || { echo 'CSP does not allow the assistant edge.' >&2; exit 1; }
grep -q '"enabled\\":true' <<<"$enabled" || { echo 'config.json does not enable the assistant.' >&2; exit 1; }
if web_config --set web.assistant.enabled=true > /dev/null 2>&1; then
  echo 'An enabled assistant without an edge was accepted.' >&2
  exit 1
fi
# Host MCP servers reach /config.json as configured, and stay off the CSP: the browser calls them only through the edge.
servers=$(web_config --set web.assistant.enabled=true,web.assistant.edgeBaseUrl=https://api.dev.tiny.nntin.xyz \
  --set-json 'web.assistant.mcpServers=[{"id":"kiprint","name":"KiPrint","url":"https://kiprint-preview.nntin.xyz/mcp"}]')
grep -qF '\"mcpServers\":[{\"id\":\"kiprint\",\"name\":\"KiPrint\",\"url\":\"https://kiprint-preview.nntin.xyz/mcp\"}]' <<<"$servers" \
  || { echo 'config.json does not list the host MCP server.' >&2; exit 1; }
! grep -q "connect-src[^;]*kiprint" <<<"$servers" || { echo 'The CSP must not allow host MCP servers.' >&2; exit 1; }
web_config | grep -qF '\"mcpServers\":[]' || { echo 'config.json must list no host MCP servers by default.' >&2; exit 1; }
echo 'PASS assistant runtime config and CSP'
# KiPrint (#152 §6): off by default, so nothing of it renders and the assistant lists no host server; on, it needs a digest and
# its hostname, takes its token from the named Secret only, joins the assistant's config.json, and its route exposes only
# the diagnostic homepage, /mcp, /healthz and /downloads.
helm template canfactory charts/canfactory --kube-version 1.36.4 -f charts/canfactory/ci/values.json > "$rendered"
! grep -qi kiprint "$rendered" || { echo 'KiPrint rendered while disabled.' >&2; exit 1; }
for values in kiprint.enabled=true images.kiprint.digest=,kiprint.enabled=true,kiprint.hostname=kiprint-preview.nntin.xyz; do
  if helm template canfactory charts/canfactory --kube-version 1.36.4 -f charts/canfactory/ci/values.json --set "$values" > /dev/null 2>&1; then
    echo "KiPrint was accepted with only $values." >&2
    exit 1
  fi
done
kiprint=kiprint.enabled=true,kiprint.hostname=kiprint-preview.nntin.xyz,web.assistant.enabled=true,web.assistant.edgeBaseUrl=https://api.dev.tiny.nntin.xyz
helm template canfactory charts/canfactory --namespace canfactory-validation --kube-version 1.36.4 -f charts/canfactory/ci/values.json \
  --set "$kiprint" > "$rendered"
validate 14
expect() { grep -qF -- "$1" "$rendered" || { echo "KiPrint: missing $1" >&2; exit 1; }; }
digest=$(sed -nE '/^  kiprint:$/,/digest/{s/^    digest: "(sha256:[a-f0-9]{64})"$/\1/p}' charts/canfactory/values.yaml)
[ -n "$digest" ] || { echo 'images.kiprint.digest is not pinned in values.yaml.' >&2; exit 1; }
expect "image: \"ghcr.io/nntin/kiprint@$digest\""
expect 'app.kubernetes.io/name: kiprint'
expect '- name: ghcr-kiprint'
expect 'type: Recreate'
expect 'name: kiprint-token'
expect 'key: token'
expect 'value: "http://canfactory-api.canfactory-validation.svc.cluster.local:3001"'
expect 'value: "https://kiprint-preview.nntin.xyz"'
expect '- "kiprint-preview.nntin.xyz"'
expect 'storage: 5Gi'
expect 'httpGet: {path: /healthz, port: http}'
expect '\"mcpServers\":[{\"id\":\"kiprint\",\"name\":\"KiPrint\",\"url\":\"https://kiprint-preview.nntin.xyz/mcp\"}]'
paths=$(grep -oE 'path: \{type: [A-Za-z]+, value: [^}]+\}' "$rendered" | sort | tr '\n' ' ')
[ "$paths" = 'path: {type: Exact, value: /healthz} path: {type: Exact, value: /mcp} path: {type: Exact, value: /} path: {type: PathPrefix, value: /downloads} ' ] \
  || { echo "KiPrint route paths: $paths" >&2; exit 1; }
# No CORS headers, and no Traefik middleware (an ExtensionRef filter), so nothing buffers /mcp's server-sent events.
! grep -qiE 'access-control|extensionref' "$rendered" || { echo 'KiPrint route must add no CORS or middleware.' >&2; exit 1; }
# The chart owns no network policy or namespace; the infrastructure repository does.
! grep -qE 'kind: (NetworkPolicy|Namespace)' "$rendered" || { echo 'The chart must not render network policies or namespaces.' >&2; exit 1; }
helm template canfactory charts/canfactory --kube-version 1.36.4 -f charts/canfactory/ci/values.json --show-only templates/web-config.yaml \
  --set "$kiprint,kiprint.assistant=false" | grep -qF '\"mcpServers\":[]' || { echo 'kiprint.assistant=false still lists KiPrint.' >&2; exit 1; }
echo 'PASS KiPrint deployment and route'
