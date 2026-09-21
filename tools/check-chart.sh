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
