import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

/**
 * Which commit is the CanFactory preview (or production) serving, and is it the one you expect? Reads the commit the web build
 * bakes into its main bundle (the footer's `__COMMIT_SHA__`), compares it with a git revision, and can wait until they match.
 * See .claude/skills/preview-deploy/SKILL.md. `npm run preview:check -- --help`.
 */
const HELP = `Usage: npm run -s preview:check -- [options]

  --expect <rev>     Commit to wait for: a SHA (short or full) or any git revision (default: HEAD)
  --url <url>        Site to check (default: https://canfactory-preview.nntin.xyz; production: https://canfactory.nntin.xyz)
  --wait             Poll until the site serves the expected commit (else check once)
  --interval <s>     Seconds between polls (default: 30)
  --timeout <min>    Give up after this many minutes (default: 45)
  --no-ci            Do not look up the "Kubernetes release" workflow run with gh
  --json             Print one JSON object per check instead of text

Exit codes: 0 the site serves the expected commit · 1 it does not (yet), or the wait timed out
            3 the workflow run for the commit failed or was cancelled, so it will never deploy · 2 usage or network error`;

const { values } = parseArgs({
  options: {
    expect: { type: 'string', default: 'HEAD' }, url: { type: 'string', default: 'https://canfactory-preview.nntin.xyz' },
    wait: { type: 'boolean', default: false }, interval: { type: 'string', default: '30' }, timeout: { type: 'string', default: '45' },
    'no-ci': { type: 'boolean', default: false }, json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  },
});
if (values.help) { console.log(HELP); process.exit(0); }

/** A command's trimmed output, or null when it fails. */
function run(command: string, args: string[]): string | null {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
const site = values.url.replace(/\/+$/, '');
const expected = run('git', ['rev-parse', '--verify', `${values.expect}^{commit}`]) ?? (/^[0-9a-f]{40}$/i.test(values.expect) ? values.expect.toLowerCase() : null);
if (!expected) { console.error(`Cannot resolve ${values.expect} to a commit (fetch it first, or pass the full SHA).`); process.exit(2); }
const intervalMs = Math.max(5, Number(values.interval)) * 1000;
const deadline = Date.now() + Math.max(1, Number(values.timeout)) * 60_000;

/** The commit the site's web build was made from: the footer's __COMMIT_SHA__, baked into the main JS bundle by Vite. */
async function deployedCommit(): Promise<{ sha: string | null; bundle: string }> {
  const headers = { 'cache-control': 'no-cache', pragma: 'no-cache' };
  const html = await (await fetch(`${site}/?_=${Date.now()}`, { headers })).text();
  const bundle = /<script[^>]+src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  if (!bundle) throw new Error(`No /assets/index-*.js in ${site}/ (is the site up?)`);
  const js = await (await fetch(`${site}${bundle}`, { headers })).text();
  // The SHA sits right before the footer's "Built from commit" text; take the 40-hex literal closest to it.
  const near = js.indexOf('Built from commit');
  const candidates = [...js.matchAll(/["'`]([0-9a-f]{40})["'`]/g)].map(match => ({ sha: match[1] ?? '', at: match.index }));
  const pick = candidates.sort((a, b) => Math.abs(a.at - near) - Math.abs(b.at - near))[0];
  return { sha: pick?.sha ?? null, bundle };
}

interface WorkflowRun { databaseId: number; status: string; conclusion: string; url: string; event: string; headBranch: string }
/** The "Kubernetes release" run for the commit (validate → publish; Flux deploys after publish). */
function workflowRun(sha: string): WorkflowRun | null {
  if (values['no-ci']) return null;
  const out = run('gh', ['run', 'list', '--repo', 'NNTin/CanFactory', '--workflow', 'kubernetes.yml', '--commit', sha, '--limit', '1',
    '--json', 'databaseId,status,conclusion,url,event,headBranch']);
  try { return out ? (JSON.parse(out) as WorkflowRun[])[0] ?? null : null; } catch { return null; }
}

type State = 'match' | 'older' | 'other-branch' | 'unknown-commit' | 'unknown';
function relation(deployed: string | null, wanted: string): State {
  if (!deployed) return 'unknown';
  if (deployed === wanted) return 'match';
  if (run('git', ['merge-base', '--is-ancestor', deployed, wanted]) !== null) return 'older';
  if (run('git', ['cat-file', '-e', `${deployed}^{commit}`]) === null) return 'unknown-commit';
  return 'other-branch';
}

const TEXT: Record<State, string> = {
  match: 'serves the expected commit.',
  older: 'serves an older commit of this history: the new build is not deployed yet.',
  'other-branch': 'serves a commit that is not in this history: the preview follows the NEWEST pull-request build, so another PR (or a later push) took it over.',
  'unknown-commit': 'serves a commit this clone does not have (git fetch, then check again).',
  unknown: 'serves no recognisable commit (a dev build, or the page changed).',
};
const short = (sha: string | null | undefined) => sha ? sha.slice(0, 7) : '—';

const started = Date.now();
for (;;) {
  let deployed: { sha: string | null; bundle: string } | null = null;
  try { deployed = await deployedCommit(); }
  catch (error) {
    console.error(`Cannot read ${site}: ${error instanceof Error ? error.message : String(error)}`);
    if (!values.wait || Date.now() > deadline) process.exit(2);
  }
  const state = relation(deployed?.sha ?? null, expected);
  const ci = state === 'match' ? null : workflowRun(expected);
  const ciFailed = ci !== null && ci.status === 'completed' && ci.conclusion !== 'success';
  if (values.json) {
    console.log(JSON.stringify({ site, expected, deployed: deployed?.sha ?? null, bundle: deployed?.bundle ?? null, state, workflow: ci, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
  } else {
    const ciText = ci ? ` · workflow ${ci.status}${ci.conclusion ? `/${ci.conclusion}` : ''} ${ci.url}` : '';
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${site} ${short(deployed?.sha)} (expected ${short(expected)}): ${TEXT[state]}${ciText}`);
  }
  if (state === 'match') process.exit(0);
  if (ciFailed) {
    if (!values.json) console.log('The workflow run for this commit did not succeed, so it will not deploy. Fix it and push again.');
    process.exit(3);
  }
  if (!values.wait || Date.now() + intervalMs > deadline) {
    if (values.wait && !values.json) console.log('Timed out.');
    process.exit(1);
  }
  await new Promise(resolve => setTimeout(resolve, intervalMs));
}
