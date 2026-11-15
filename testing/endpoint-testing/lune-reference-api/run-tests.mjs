#!/usr/bin/env node
// Runs the Lune reference collection with the Bruno CLI in `seq` order:
// folders by the seq in their folder.yml, then requests by the seq in their info block.
// Everything runs in ONE `bru run`, so runtime variables (test users, auth token) carry
// from Auth into Favorites and Teardown.
//
// Usage (from anywhere):
//   node run-tests.mjs                     # Development environment, HTML + JUnit reports in reports/
//   node run-tests.mjs --env Development   # explicit environment
//   node run-tests.mjs --no-report         # skip the report files
//   node run-tests.mjs --dry-run           # print the order, don't run
//   node run-tests.mjs -- --bail           # extra args after -- go to bru
//
// Requires the Bruno CLI: npm install -g @usebruno/cli

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));

// ---- arguments
const args = process.argv.slice(2);
const passthroughAt = args.indexOf('--');
const ownArgs = passthroughAt === -1 ? args : args.slice(0, passthroughAt);
const bruArgs = passthroughAt === -1 ? [] : args.slice(passthroughAt + 1);
const envIndex = ownArgs.indexOf('--env');
const env = envIndex !== -1 ? ownArgs[envIndex + 1] : 'Development';
const dryRun = ownArgs.includes('--dry-run');
const report = !ownArgs.includes('--no-report');

// Reports go to reports/results-<timestamp>.html (and .xml), so earlier runs are kept.
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const reportArgs = report
  ? ['--reporter-html', `reports/results-${stamp}.html`, '--reporter-junit', `reports/results-${stamp}.xml`]
  : [];

// ---- ordering
// The first `seq:` in a file is the one in its info block (examples don't have one).
function seqOf(file) {
  const match = readFileSync(file, 'utf8').match(/^\s+seq:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

const bySeqThenName = (a, b) => a.seq - b.seq || a.name.localeCompare(b.name);

const folders = readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(root, d.name, 'folder.yml')))
  .map(d => ({ name: d.name, seq: seqOf(join(root, d.name, 'folder.yml')) }))
  .sort(bySeqThenName);

const files = [];
for (const folder of folders) {
  const requests = readdirSync(join(root, folder.name))
    .filter(f => f.endsWith('.yml') && f !== 'folder.yml')
    .map(f => ({ name: f, seq: seqOf(join(root, folder.name, f)) }))
    .sort(bySeqThenName);
  for (const r of requests) files.push(join(folder.name, r.name));
}

if (files.length === 0) {
  console.error('No requests found next to run-tests.mjs.');
  process.exit(1);
}

// ---- run
if (dryRun) {
  files.forEach((f, i) => console.log(String(i + 1).padStart(3), f));
  process.exit(0);
}

console.log(`Running ${files.length} requests from ${folders.length} folders (env: ${env})\n`);
if (report) mkdirSync(join(root, 'reports'), { recursive: true });
const result = spawnSync('bru', ['run', ...files, '--env', env, ...reportArgs, ...bruArgs], {
  cwd: root,
  stdio: 'inherit',
});
if (report) console.log(`\nReport: ${join('reports', `results-${stamp}.html`)} (open it in a browser)`);

if (result.error) {
  console.error(result.error.code === 'ENOENT'
    ? 'Bruno CLI not found. Install it with: npm install -g @usebruno/cli'
    : result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
