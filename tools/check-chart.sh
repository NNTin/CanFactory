#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rendered=$(mktemp --suffix=.yaml)
trap 'rm -f "$rendered"' EXIT
helm lint charts/canfactory --strict --kube-version 1.36.4 -f charts/canfactory/ci/values.json
for replicas in 1 2; do
  helm template canfactory charts/canfactory --namespace canfactory --kube-version 1.36.4 \
    -f charts/canfactory/ci/values.json --set "web.replicas=$replicas,api.replicas=$replicas,worker.replicas=$replicas" > "$rendered"
  result=$(kubeconform -strict -summary -output json -kubernetes-version 1.36.4 "$rendered")
  VALIDATION_RESULT="$result" node --input-type=module -e '
    const { summary } = JSON.parse(process.env.VALIDATION_RESULT);
    if (summary.valid < 9 || summary.invalid || summary.errors || summary.skipped) {
      throw new Error(`Incomplete chart validation: ${JSON.stringify(summary)}`);
    }
    console.log(`PASS ${summary.valid} rendered resources; none skipped`);
  '

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
echo 'PASS assistant runtime config and CSP'
