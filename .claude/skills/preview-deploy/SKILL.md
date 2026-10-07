---
name: preview-deploy
description: Follow a pushed commit to the CanFactory preview (https://canfactory-preview.nntin.xyz) or production: whether CI passed, whether its images and chart were published to GHCR, and whether the site serves it yet (Flux picked it up); wait for it, then verify the change on the live preview. Use after pushing to a pull request when the change should be seen or tested on the preview, or when asked whether the preview/production is up to date.
---

# Preview deploy

Every push to a same-repository pull request is built and deployed to Kubernetes. Pushes to `develop` go to production.

| Site | Serves |
|---|---|
| `https://canfactory-preview.nntin.xyz` | the **newest** pull-request chart (`0.2.0-pr.N`), whichever PR it came from |
| `https://canfactory.nntin.xyz` | `develop`'s newest chart (`0.2.0-dev.N`) |

A commit travels through four stages. The tool reports each one:

| Stage | What happens | Where the tool looks |
|---|---|---|
| 1. CI | `.github/workflows/kubernetes.yml` ("Kubernetes release"). Job `validate` runs `npm run check`, the build, `check-chart.sh`, the storage test and the renderer test. Then job `publish` runs | `gh run list --commit`, `gh run view --json jobs` |
| 2. Images | `publish` pushes `ghcr.io/nntin/canfactory-{web,api,worker}:sha-<commit>` | GHCR package versions (`gh api /users/NNTin/packages/container/…/versions`) |
| 3. Chart | `publish` pushes chart `oci://ghcr.io/nntin/charts/canfactory` version `0.2.0-<pr\|dev>.<run number>`, with the image digests embedded | GHCR package `charts/canfactory` |
| 4. Live | Flux, in the infrastructure cluster, deploys the newest chart of its channel and rolls web, API and worker | the site's main bundle: the footer's `__COMMIT_SHA__` (`BuildCommit` in `apps/web/src/App.tsx`) |

Typical timing: `validate` takes about 15 min, `publish` a few minutes, then Flux. A newer push to the same PR cancels the
running build. **A later build of another PR takes the preview over.** The API has no commit endpoint, but it ships in the
same chart, so the web commit stands for the release. Pods roll one at a time: allow a minute after the web flips before
judging API behaviour.

## Tool: `tools/check-preview.ts`

Run from the repository root (`npm ci` first). Stage 4 needs only `git`. Stages 1–3 need `gh`, logged in with access to
the repository and its packages (`read:packages`); without it they read “cannot read”.

```sh
npm run -s preview:check                      # report once for HEAD
git push && npm run -s preview:check -- --wait   # poll every 30 s until live (gives up after 60 min)
npm run -s preview:check -- --expect origin/develop --url https://canfactory.nntin.xyz --json
```

Sample report:

```
[09:08:17Z] 8b92c15 (session/can-40) → https://canfactory-preview.nntin.xyz
  1. CI      run #167 in_progress · validate success · publish in_progress  https://github.com/NNTin/CanFactory/actions/runs/…
  2. Images  web … not yet · api … not yet · worker … not yet
  3. Chart   0.2.0-pr.167 … not yet
  4. Live    860b83c (chart 0.2.0-pr.164): serves an older commit of this history: not deployed yet
             newest pr chart is 0.2.0-pr.165 (28bfa7a, feat/printed-corner-bracket-screen-hook), published 710 min ago and not served yet: Flux may be stuck, check the cluster
```

Reading it:
- **Exit 0**: stage 4 says “serves this commit ✓”. Verify the change (below).
- **Exit 1**: not live yet. The stages show where the commit is. CI running → wait. Images and chart ✓ but not live →
  waiting for Flux.
- **Exit 3**: the run failed or was cancelled, so this commit never deploys. Cancelled usually means a newer push replaced
  it: follow the newer commit. Failed: `gh run view <id> --log-failed`, fix, push again.
- **“serves another branch’s build”**: another PR's newer chart took the preview. Your commit shows again only after your
  next push builds. Ask before re-running your workflow just to take the preview back.
- **“newest … chart … not served yet: Flux may be stuck”**: a published chart has waited over 20 min. That is the cluster,
  not your change: tell the owner instead of waiting.

For long waits, run it in the background (`run_in_background`), so that you are notified when it exits, instead of
polling yourself.

## Verify on the preview

Once it is live:
- **Browser tests against the preview:** `BASE_URL=https://canfactory-preview.nntin.xyz npx playwright test tests/browser/<spec>.ts`.
  Prefer the specs your change touches. The preview is shared and renders on a real worker, so do not run the whole
  suite in a loop.
- **API:** `curl -s https://canfactory-preview.nntin.xyz/api/v1/...`. The OpenAPI document is at `/api/openapi.json` and
  the docs at `/api/docs`.
- **Look at it:** take screenshots with a small Playwright script inside the repository (scripts that `import 'playwright'`
  must sit inside the repository to resolve it). Then give the owner the preview URL with the route, e.g.
  `https://canfactory-preview.nntin.xyz/#/parts/threaded-insert/ruthex-rx-m3x5-7`.
- Vercel previews (`*.vercel.app`) are different: they rewrite `/api` to **production** (`vercel.json`), so they show new
  web code against the production API. Use the Kubernetes preview for anything that needs the new API.
