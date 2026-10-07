import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

/**
 * Where is a commit on its way to the CanFactory preview (or production)? Follows it through the "Kubernetes release" workflow:
 *   1. CI: the run's `validate` and `publish` jobs;
 *   2. images: `ghcr.io/nntin/canfactory-{web,api,worker}:sha-<commit>` published;
 *   3. chart: `oci://ghcr.io/nntin/charts/canfactory` version `0.2.0-<pr|dev>.<run number>` published;
 *   4. live: the site serves the commit (the footer's `__COMMIT_SHA__`, baked into the main bundle), i.e. Flux picked it up.
 * It also says which chart the site serves and whether a newer one of its channel is waiting for Flux. Needs `git`, and `gh`
 * with access to the repository and its packages for stages 1–3. See .claude/skills/preview-deploy/SKILL.md.
 */
const HELP = `Usage: npm run -s preview:check -- [options]

  --expect <rev>     Commit to follow: a SHA (short or full) or any git revision (default: HEAD)
  --url <url>        Site (default: https://canfactory-preview.nntin.xyz; production: https://canfactory.nntin.xyz)
  --wait             Poll until the site serves the commit (else report once)
  --interval <s>     Seconds between polls (default: 30)
  --timeout <min>    Give up after this many minutes (default: 60)
  --json             Print one JSON object per report instead of text

Exit codes: 0 the site serves the commit · 1 not yet (or the wait timed out)
            3 its workflow run failed or was cancelled, so it will never deploy · 2 usage or network error`;

const { values } = parseArgs({
  options: {
    expect: { type: 'string', default: 'HEAD' }, url: { type: 'string', default: 'https://canfactory-preview.nntin.xyz' },
    wait: { type: 'boolean', default: false }, interval: { type: 'string', default: '30' }, timeout: { type: 'string', default: '60' },
    json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  },
});
if (values.help) { console.log(HELP); process.exit(0); }

const REPO = 'NNTin/CanFactory';
const IMAGES = ['web', 'api', 'worker'] as const;

/** A command's trimmed output, or null when it fails. */
function run(command: string, args: string[]): string | null {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16_000_000 }).trim(); }
  catch { return null; }
}
function json(command: string, args: string[]): unknown {
  const out = run(command, args);
  try { return out ? JSON.parse(out) as unknown : null; } catch { return null; }
}

const site = values.url.replace(/\/+$/, '');
/** The preview follows pull-request charts (`0.2.0-pr.N`), production follows develop's (`0.2.0-dev.N`). */
const channel = /preview/.test(site) ? 'pr' : 'dev';
const expected = run('git', ['rev-parse', '--verify', `${values.expect}^{commit}`]) ?? (/^[0-9a-f]{40}$/i.test(values.expect) ? values.expect.toLowerCase() : null);
if (!expected) { console.error(`Cannot resolve ${values.expect} to a commit (fetch it first, or pass the full SHA).`); process.exit(2); }
const intervalMs = Math.max(5, Number(values.interval)) * 1000;
const deadline = Date.now() + Math.max(1, Number(values.timeout)) * 60_000;
const short = (sha: string | null | undefined) => sha ? sha.slice(0, 7) : '—';
const clock = (iso: string | null | undefined) => iso ? new Date(iso).toISOString().slice(11, 16) + 'Z' : '';
const minutesAgo = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 60_000);

/** The commit the site's web build was made from: the footer's __COMMIT_SHA__, baked into the main JS bundle by Vite. */
async function deployedCommit(): Promise<string | null> {
  const headers = { 'cache-control': 'no-cache', pragma: 'no-cache' };
  const html = await (await fetch(`${site}/?_=${Date.now()}`, { headers })).text();
  const bundle = /<script[^>]+src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  if (!bundle) throw new Error(`No /assets/index-*.js in ${site}/ (is the site up?)`);
  const js = await (await fetch(`${site}${bundle}`, { headers })).text();
  // The SHA sits right before the footer's "Built from commit" text; take the 40-hex literal closest to it.
  const near = js.indexOf('Built from commit');
  const candidates = [...js.matchAll(/["'`]([0-9a-f]{40})["'`]/g)].map(match => ({ sha: match[1] ?? '', at: match.index }));
  return candidates.sort((a, b) => Math.abs(a.at - near) - Math.abs(b.at - near))[0]?.sha ?? null;
}

interface Run { databaseId: number; number: number; headSha: string; headBranch: string; event: string; status: string; conclusion: string; url: string; createdAt: string }
interface Job { name: string; status: string; conclusion: string; completedAt: string }
interface PackageVersion { name: string; created_at: string; metadata: { container: { tags: string[] } } }

/** The newest "Kubernetes release" runs (stage 1, and the run behind any chart version). */
function recentRuns(): Run[] {
  return json('gh', ['run', 'list', '--repo', REPO, '--workflow', 'kubernetes.yml', '--limit', '40',
    '--json', 'databaseId,number,headSha,headBranch,event,status,conclusion,url,createdAt']) as Run[] | null ?? [];
}
function jobs(run: Run): Job[] {
  return (json('gh', ['run', 'view', String(run.databaseId), '--repo', REPO, '--json', 'jobs']) as { jobs: Job[] } | null)?.jobs ?? [];
}
/** The newest versions of a GHCR package (stages 2 and 3); null when gh cannot read packages. */
function packageVersions(name: string): PackageVersion[] | null {
  return json('gh', ['api', `/users/NNTin/packages/container/${encodeURIComponent(name)}/versions?per_page=100`]) as PackageVersion[] | null;
}
const chartChannel = (run: Run) => run.event === 'pull_request' ? 'pr' : 'dev';

interface Report {
  site: string; expected: string; branch: string | null;
  ci: { run: number | null; url: string | null; status: string; jobs: Record<string, string> };
  images: Record<string, string | null> | null;
  chart: { version: string | null; publishedAt: string | null } | null;
  live: { commit: string | null; chart: string | null; state: State; newestChart: { version: string; commit: string | null; branch: string | null; publishedAt: string } | null };
}
type State = 'match' | 'older' | 'other-branch' | 'unknown-commit' | 'unknown';
function relation(deployed: string | null): State {
  if (!deployed) return 'unknown';
  if (deployed === expected) return 'match';
  if (run('git', ['merge-base', '--is-ancestor', deployed, expected ?? '']) !== null) return 'older';
  if (run('git', ['cat-file', '-e', `${deployed}^{commit}`]) === null) return 'unknown-commit';
  return 'other-branch';
}

async function report(): Promise<Report> {
  const deployed = await deployedCommit();
  const runs = recentRuns();
  const mine = runs.find(candidate => candidate.headSha === expected) ?? null;
  const jobStates = mine ? Object.fromEntries(jobs(mine).map(job => [job.name, job.conclusion || job.status])) : {};
  const images = Object.fromEntries(IMAGES.map(role => {
    const versions = packageVersions(`canfactory-${role}`);
    return [role, versions === null ? 'unreadable' : versions.find(version => version.metadata.container.tags.includes(`sha-${expected}`))?.created_at ?? null];
  }));
  const charts = packageVersions('charts/canfactory');
  const chartVersion = mine ? `0.2.0-${chartChannel(mine)}.${mine.number}` : null;
  const chartAt = chartVersion && charts ? charts.find(version => version.metadata.container.tags.includes(chartVersion))?.created_at ?? null : null;
  const servedRun = runs.find(candidate => candidate.headSha === deployed && chartChannel(candidate) === channel && candidate.conclusion === 'success');
  // The newest published chart of the site's channel: Flux should deploy it; if the site serves something else, Flux has not (yet).
  const newest = (charts ?? []).flatMap(version => version.metadata.container.tags.map(tag => ({ tag, at: version.created_at })))
    .filter(({ tag }) => tag.startsWith(`0.2.0-${channel}.`)).sort((a, b) => Number(b.tag.split('.').at(-1)) - Number(a.tag.split('.').at(-1)))[0];
  const newestRun = newest ? runs.find(candidate => `0.2.0-${chartChannel(candidate)}.${candidate.number}` === newest.tag) : undefined;
  return {
    site, expected: expected ?? '', branch: mine?.headBranch ?? null,
    ci: { run: mine?.number ?? null, url: mine?.url ?? null, status: mine ? (mine.conclusion || mine.status) : 'not found', jobs: jobStates },
    images: Object.values(images).includes('unreadable') ? null : images,
    chart: charts === null ? null : { version: chartVersion, publishedAt: chartAt },
    live: { commit: deployed, chart: servedRun ? `0.2.0-${channel}.${servedRun.number}` : null, state: relation(deployed),
      newestChart: newest ? { version: newest.tag, commit: newestRun?.headSha ?? null, branch: newestRun?.headBranch ?? null, publishedAt: newest.at } : null },
  };
}

const LIVE: Record<State, string> = {
  match: 'serves this commit ✓',
  older: 'serves an older commit of this history: not deployed yet',
  'other-branch': 'serves another branch’s build (the preview follows the NEWEST pull-request chart)',
  'unknown-commit': 'serves a commit this clone does not have (git fetch)',
  unknown: 'serves no recognisable commit',
};
function print(r: Report): void {
  const mark = (value: string | null | undefined) => value ? `✓ ${clock(value)}` : '… not yet';
  const lines = [`[${new Date().toISOString().slice(11, 19)}Z] ${short(r.expected)}${r.branch ? ` (${r.branch})` : ''} → ${r.site}`];
  lines.push(`  1. CI      ${r.ci.run ? `run #${r.ci.run} ${r.ci.status}` : 'no "Kubernetes release" run for this commit (pushed? a same-repository PR into develop?)'}${
    Object.keys(r.ci.jobs).length ? ` · ${Object.entries(r.ci.jobs).map(([name, state]) => `${name} ${state}`).join(' · ')}` : ''}${r.ci.url ? `  ${r.ci.url}` : ''}`);
  lines.push(`  2. Images  ${r.images ? IMAGES.map(role => `${role} ${mark(r.images?.[role])}`).join(' · ') : 'cannot read GHCR packages (gh needs read:packages)'}`);
  lines.push(`  3. Chart   ${r.chart === null ? 'cannot read GHCR packages' : r.chart.version ? `${r.chart.version} ${mark(r.chart.publishedAt)}` : '—'}`);
  lines.push(`  4. Live    ${short(r.live.commit)}${r.live.chart ? ` (chart ${r.live.chart})` : ''}: ${LIVE[r.live.state]}`);
  const newest = r.live.newestChart;
  if (newest && newest.version !== r.live.chart && r.live.state !== 'match') {
    lines.push(`             newest ${channel} chart is ${newest.version} (${short(newest.commit)}${newest.branch ? `, ${newest.branch}` : ''}), published ${minutesAgo(newest.publishedAt)} min ago and not served yet${
      minutesAgo(newest.publishedAt) > 20 ? ': Flux has not deployed it (the release may have failed and been rolled back, or Flux is stuck): check the cluster' : ''}`);
  }
  console.log(lines.join('\n'));
}

for (;;) {
  let current: Report | null = null;
  try { current = await report(); }
  catch (error) {
    console.error(`Cannot read ${site}: ${error instanceof Error ? error.message : String(error)}`);
    if (!values.wait || Date.now() > deadline) process.exit(2);
  }
  if (current) {
    if (values.json) console.log(JSON.stringify(current)); else print(current);
    if (current.live.state === 'match') process.exit(0);
    if (['failure', 'cancelled', 'timed_out', 'startup_failure'].includes(current.ci.status)) {
      if (!values.json) console.log(current.ci.status === 'cancelled' ? 'The run was cancelled (usually by a newer push to the same PR): follow the newer commit.' : 'The run failed, so this commit will not deploy. Read it (gh run view <id> --log-failed), fix it, push again.');
      process.exit(3);
    }
  }
  if (!values.wait || Date.now() + intervalMs > deadline) {
    if (values.wait && !values.json) console.log('Timed out.');
    process.exit(1);
  }
  await new Promise(resolve => setTimeout(resolve, intervalMs));
}
