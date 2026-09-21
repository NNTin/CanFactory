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
