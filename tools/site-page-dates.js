'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// A path's dates are the newest and oldest commit `git log HEAD -- path`
// prints, with Git's per-path history simplification. One path walk supplies
// BOTH endpoints. Cache only history, never page content. New commits since
// the cached HEAD -- merges included, each diffed against every parent --
// invalidate every path they touch (including reverted edits); a path no new
// commit touches has an unchanged history. History rewrites rebuild it.
//
// A cold cache used to cost one full-history walk per page (~1100 walks,
// several minutes). bulkGitDates answers every path from ONE walk instead.
// It is not per-path simplification, so it is only trusted for a path whose
// answer the simplification cannot change; tools/site-page-dates-compare.js
// measures that against per-path results.
//
// Which paths it can answer: per-path simplification only ever hides commits
// that are off HEAD's first-parent line (a side branch whose change a merge
// did not take). A path touched solely by first-parent commits -- including a
// merge that differs from ALL its parents, which `-c` lists and the per-path
// walk shows too -- has the same commit list either way. Any path a side
// commit touched is returned in `uncertain` and keeps its per-path walk.
function bulkGitDates(git, head) {
  const mainline = new Set(git(['rev-list', '--first-parent', head]).split('\n'));
  const out = git(['log', '--format=@@%H %cI', '--name-only', '-z', '--no-renames', '-c', head], false);
  const dates = new Map(), uncertain = new Set(), loose = new Map();
  let date = null, onMain = true;
  for (let tok of out.split('\0')) {
    if (tok.startsWith('\n')) tok = tok.slice(1);
    if (!tok) continue;
    if (tok.startsWith('@@')) {
      const [hash, when] = tok.slice(2).split(' ');
      date = when.slice(0, 10);
      onMain = mainline.has(hash);
      continue;
    }
    if (!onMain) uncertain.add(tok);
    // Log order is newest first: the first sighting is `modified`, the last
    // one `published` -- the same endpoints the per-path walk takes. `loose`
    // also records side commits, for measuring uncertain paths.
    for (const map of onMain ? [dates, loose] : [loose]) {
      const d = map.get(tok);
      if (d) d.published = date; else map.set(tok, { published: date, modified: date });
    }
  }
  return { dates, uncertain, loose };
}

function createGitDates(root, { cacheFile = path.join(root, 'build/site-page-dates.json'), progress = () => {}, bulk = true } = {}) {
  const git = (args, trim = true) => { const out = execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  }); return trim ? out.trim() : out; };
  let bulkResult;   // built on the first cache miss, never when the cache answers everything
  let bulkHits = 0;
  let head, shallow, entries = {}, reusable = false;
  let walks = 0, hits = 0;
  try {
    head = git(['rev-parse', 'HEAD']);
    const shallowPath = path.resolve(root, git(['rev-parse', '--git-path', 'shallow']));
    shallow = fs.existsSync(shallowPath) ? fs.readFileSync(shallowPath, 'utf8') : '';
    // Replacement/graft history can change without changing HEAD. Don't cache
    // that unusual mode; the direct query still honors it.
    const graftPath = path.resolve(root, git(['rev-parse', '--git-path', 'info/grafts']));
    reusable = !git(['for-each-ref', '--format=%(objectname)', 'refs/replace/']) && !fs.existsSync(graftPath);
    if (reusable && fs.existsSync(cacheFile)) {
      const old = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const validDate = value => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
      if (old.version === 1 && /^[0-9a-f]{40,64}$/.test(old.head) && old.shallow === shallow &&
          old.entries && typeof old.entries === 'object' && Object.values(old.entries).every(d =>
            d && validDate(d.published) && validDate(d.modified))) {
        if (old.head === head) entries = old.entries;
        else {
          git(['merge-base', '--is-ancestor', old.head, head]);
          const range = `${old.head}..${head}`;
          // -m diffs a merge against each parent, so a merge drops every path
          // its side branch brought in; side commits are in the range too.
          const changed = git(['log', '--format=', '--name-only', '-z', '--no-renames', '-m', range], false);
          entries = old.entries;
          for (let rel of changed.split('\0')) {
            if (rel.startsWith('\n')) rel = rel.slice(1);
            delete entries[rel];
          }
        }
      }
    }
  } catch (_) { /* Missing/corrupt caches and non-Git trees need no dates. */ }
  const persist = () => {
    if (!reusable) return;
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      const temp = `${cacheFile}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ version: 1, head, shallow, entries }));
      fs.renameSync(temp, cacheFile);
    } catch (_) { /* The cache is optional, including on read-only trees. */ }
  };
  return {
    get(rel) {
      if (Object.hasOwn(entries, rel)) { hits++; return entries[rel]; }
      if (bulk && head && bulkResult === undefined) {
        try { bulkResult = bulkGitDates(git, head); } catch (_) { bulkResult = null; }
        if (bulkResult) progress(`page dates: one history walk, ${bulkResult.uncertain.size} side-branch path(s) keep per-path walks`);
      }
      if (bulkResult && !bulkResult.uncertain.has(rel)) {
        bulkHits++;
        const d = bulkResult.dates.get(rel);
        return entries[rel] = d ? { ...d } : { published: null, modified: null };
      }
      walks++;
      if (walks === 1 || walks % 25 === 0) progress(`page dates: ${walks} history queries, ${hits} cached`);
      try {
        const dates = git(['log', '--format=%cI', ...(head ? [head] : []), '--', rel]).split('\n').filter(Boolean);
        const result = entries[rel] = { published: dates.length ? dates.at(-1).slice(0, 10) : null,
          modified: dates.length ? dates[0].slice(0, 10) : null };
        // An interrupted preparation can resume its history work too.
        if (walks % 25 === 0) persist();
        return result;
      } catch (_) { return { published: null, modified: null }; }
    },
    // Answer many paths ahead of get(): bulk where it is exact, and the
    // per-path walks it cannot replace run concurrently in one child process
    // (get() is synchronous, so the concurrency lives in that child).
    prefetch(rels) {
      if (!head) return;
      const need = [];
      for (const rel of new Set(rels)) {
        if (Object.hasOwn(entries, rel)) continue;
        if (bulk && bulkResult === undefined) this.get(rel);   // builds bulkResult
        else if (bulkResult && !bulkResult.uncertain.has(rel)) this.get(rel);
        else need.push(rel);
      }
      const walk = need.filter(rel => !Object.hasOwn(entries, rel));
      if (!walk.length) return;
      progress(`page dates: ${walk.length} per-path history walks in parallel`);
      try {
        const out = execFileSync(process.execPath, [__filename, '--walk', head], {
          cwd: root, input: walk.join('\0'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        for (const [rel, d] of Object.entries(JSON.parse(out))) { entries[rel] = d; walks++; }
        persist();
      } catch (_) { /* get() falls back to one walk per path */ }
    },
    save() {
      persist();
      progress(`page dates complete: ${walks} history queries, ${bulkHits} from one walk, ${hits} cached`);
    },
  };
}

module.exports = { createGitDates, bulkGitDates };

// Child mode for prefetch(): NUL-separated paths on stdin, one
// `git log --format=%cI HEAD -- path` each, JOBS at a time; JSON on stdout.
if (require.main === module && process.argv[2] === '--walk') {
  const { execFile } = require('child_process');
  const head = process.argv[3];
  const rels = fs.readFileSync(0, 'utf8').split('\0').filter(Boolean);
  const JOBS = Math.max(2, Math.min(8, require('os').cpus().length));
  const result = {};
  let next = 0;
  const one = () => {
    if (next >= rels.length) return Promise.resolve();
    const rel = rels[next++];
    return new Promise(resolve => execFile('git', ['log', '--format=%cI', head, '--', rel],
      { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024 }, (err, out) => {
        if (!err) {
          const dates = out.split('\n').filter(Boolean);
          result[rel] = { published: dates.length ? dates.at(-1).slice(0, 10) : null,
            modified: dates.length ? dates[0].slice(0, 10) : null };
        }
        resolve();
      })).then(one);
  };
  Promise.all(Array.from({ length: JOBS }, one))
    .then(() => process.stdout.write(JSON.stringify(result)));
}
