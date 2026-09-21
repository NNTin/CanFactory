#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rendered=$(mktemp --suffix=.yaml)
trap 'rm -f "$rendered"' EXIT
helm lint charts/canfactory --strict --kube-version 1.36.4 -f charts/canfactory/ci/values.json
for replicas in 1 2; do
  helm template canfactory charts/canfactory --namespace canfactory --kube-version 1.36.4 \
    -f charts/canfactory/ci/values.json --set "web.replicas=$replicas,api.replicas=$replicas,worker.replicas=$replicas" > "$rendered"
  kubeconform -strict -summary -kubernetes-version 1.36.4 "$rendered"
done
if helm template canfactory charts/canfactory --kube-version 1.36.4 \
  -f charts/canfactory/ci/values.json --set worker.replicas=3 > /dev/null 2>&1; then
  echo 'Worker concurrency bound was not enforced.' >&2
  exit 1
fi
