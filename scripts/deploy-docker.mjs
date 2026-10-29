import { execSync } from 'node:child_process';

// Triggers .github/workflows/docker-build.yml, which only builds & pushes the
// image on a `docker-v*` tag push (not on every push to main) — this script
// is just "create that tag and push it" so you don't have to remember the
// exact tag format or commands each time.

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`deploy: ${message}`);
  process.exit(1);
}

const status = run('git status --porcelain');
if (status) {
  fail('working tree has uncommitted changes — commit or stash before deploying, so the tag points at exactly what you intend to ship.');
}

const branch = run('git rev-parse --abbrev-ref HEAD');
if (branch === 'HEAD') {
  fail('in detached HEAD — check out the branch you want to deploy first.');
}

run('git fetch --tags -q');
const existingTags = run('git tag -l "docker-v*"').split('\n').filter(Boolean);
const versions = existingTags
  .map((t) => t.match(/^docker-v(\d+)\.(\d+)\.(\d+)$/))
  .filter(Boolean)
  .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
const [major, minor, patch] = versions.length
  ? versions.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).at(-1)
  : [0, 1, 0];
const tag = `docker-v${major}.${minor}.${patch + 1}`;

console.log(`deploy: pushing ${branch}...`);
run(`git push origin ${branch}`);

console.log(`deploy: tagging ${tag} and pushing...`);
run(`git tag ${tag}`);
run(`git push origin ${tag}`);

let actionsUrl = null;
try {
  const remote = run('git remote get-url origin');
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (match) actionsUrl = `https://github.com/${match[1]}/actions`;
} catch {
  // Non-GitHub remote or no remote configured — just skip the convenience link.
}

console.log(`deploy: pushed ${tag}. Image build is running in GitHub Actions${actionsUrl ? ` — ${actionsUrl}` : ''}.`);
console.log('deploy: once it finishes, on the server run: docker compose pull app && docker compose up -d app');
