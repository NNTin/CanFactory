#!/usr/bin/env bash
set -euo pipefail
destination="${1:-$HOME/.local/bin}"
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
mkdir -p "$destination"
cd "$temporary"
curl -fsSLO https://get.helm.sh/helm-v4.2.4-linux-amd64.tar.gz
curl -fsSLO https://get.helm.sh/helm-v4.2.4-linux-amd64.tar.gz.sha256sum
sha256sum -c helm-v4.2.4-linux-amd64.tar.gz.sha256sum
tar -xzf helm-v4.2.4-linux-amd64.tar.gz linux-amd64/helm
install -m 755 linux-amd64/helm "$destination/helm"
curl -fsSLO https://github.com/yannh/kubeconform/releases/download/v0.8.0/kubeconform-linux-amd64.tar.gz
curl -fsSLO https://github.com/yannh/kubeconform/releases/download/v0.8.0/CHECKSUMS
awk '$2 == "kubeconform-linux-amd64.tar.gz" {print}' CHECKSUMS > selected.sha256
test -s selected.sha256
sha256sum -c selected.sha256
tar -xzf kubeconform-linux-amd64.tar.gz kubeconform
install -m 755 kubeconform "$destination/kubeconform"
# The chart's KiPrint HTTPRoute (#152): kubeconform has no Gateway API schema of its own. Gateway API v1.6.1, the version the
# cluster installs, from the CRDs catalog at a pinned commit; tools/check-chart.sh reads it from here.
schemas="${KUBECONFORM_SCHEMAS:-$HOME/.local/share/canfactory/kubeconform}"
mkdir -p "$schemas/gateway.networking.k8s.io"
curl -fsSL -o httproute_v1.json https://raw.githubusercontent.com/datreeio/CRDs-catalog/89c736bdde38b5fecd0f8436ec5f3aa3679a3b86/gateway.networking.k8s.io/httproute_v1.json
echo 'e5692e62edd9b8a14bd2527d0a732e174a649131aa4d47159737dc6527c59ca5  httproute_v1.json' | sha256sum -c -
install -m 644 httproute_v1.json "$schemas/gateway.networking.k8s.io/httproute_v1.json"
