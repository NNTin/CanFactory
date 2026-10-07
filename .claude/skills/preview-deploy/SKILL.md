---
name: preview-deploy
description: Check which commit the CanFactory preview (https://canfactory-preview.nntin.xyz) or production site is serving, wait until a pushed commit is deployed there, then verify the change on the live preview. Use after pushing to a pull request when the change should be seen or tested on the preview, or when asked whether the preview/production is up to date.
---

# Preview deploy

Every push to a same-repository pull request is built and deployed to Kubernetes. Pushes to `develop` go to production.

| Site | Serves |
|---|---|
| `https://canfactory-preview.nntin.xyz` | the **newest** pull-request build (chart `0.2.0-pr.N`), whichever PR it came from |
| `https://canfactory.nntin.xyz` | `develop` (chart `0.2.0-dev.N`) |

The pipeline is `.github/workflows/kubernetes.yml` ("Kubernetes release"):
1. **validate**: `npm run check`, build, `check-chart.sh`, the storage test and the renderer test.
2. **publish**: the images and the chart, with the commit baked in.
3. **Flux**: in the infrastructure cluster, it picks up the new chart version and rolls web, API and worker.

Expect roughly 15–30 minutes from push to live. A newer push to the same PR cancels the running build. **Another PR pushed
after yours takes the preview over**, so check the commit before trusting what you see.

The site tells you its commit: the footer's build link (`BuildCommit` in `apps/web/src/App.tsx`) shows `__COMMIT_SHA__`,
which Vite bakes into the main bundle (`/assets/index-*.js`). The API has no commit endpoint, but it ships in the same chart
release, so the web commit stands for the release. Pods roll one by one, so allow a minute after the web flips before
judging API behaviour.

## Tool: `tools/check-preview.ts`

Run it from the repository root (`npm ci` first, as for any script). It needs `git`, and uses `gh` (optional) to look up
the workflow run.

```sh
# Once: which commit is live, compared with HEAD
npm run -s preview:check

# Wait until the pushed commit is live (polls every 30 s, gives up after 45 min)
git push && npm run -s preview:check -- --wait

# A specific commit or ref, production, machine-readable
npm run -s preview:check -- --expect origin/develop --url https://canfactory.nntin.xyz --json
```

Each check prints the served commit and how it relates to the expected one:

| State | Meaning | What to do |
|---|---|---|
| `match` (exit 0) | The site serves the expected commit | Verify the change (below) |
| `older` | An earlier commit of your history: the new build is still in the pipeline | Keep waiting (`--wait` does) |
| `other-branch` | A commit outside your history: another PR's build took the preview | Wait for your next push to deploy, or ask before re-running your workflow, which would take the preview from the other PR |
| `unknown-commit` | A commit this clone lacks | `git fetch`, then check again |
| exit 3 | The workflow run for your commit failed or was cancelled, so it will never deploy | Read the run (`gh run view <id> --log-failed`), fix it, push again |

Long waits: run it in the background (`run_in_background`), so that you are notified when it exits, instead of polling
yourself.

## Verify on the preview

Once it matches:
- **Browser tests against the preview:** `BASE_URL=https://canfactory-preview.nntin.xyz npx playwright test tests/browser/<spec>.ts`
  (needs `npm ci`). Prefer the specs your change touches. The preview is shared and renders on a real worker, so do not run
  the whole suite in a loop.
- **API:** `curl -s https://canfactory-preview.nntin.xyz/api/v1/...`. The OpenAPI document is at `/api/openapi.json` and
  the docs at `/api/docs`.
- **Look at it:** take screenshots with a small Playwright script inside the repository (scripts that `import 'playwright'`
  must sit inside the repository to resolve it). Then give the owner the preview URL with the route, e.g.
  `https://canfactory-preview.nntin.xyz/#/parts/threaded-insert/ruthex-rx-m3x5-7`.
- Vercel previews (`*.vercel.app`) are different: they rewrite `/api` to **production** (`vercel.json`), so they show new
  web code against the production API. Use the Kubernetes preview for anything that needs the new API.
