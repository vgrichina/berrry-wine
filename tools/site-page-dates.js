'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Keep Git's per-path history simplification: a global --name-only walk can
// assign different dates after merges. One path walk supplies BOTH endpoints.
// Cache only history, never page content. Linear additions invalidate every
// touched path (including reverted edits); merges/history rewrites rebuild it.
function createGitDates(root, { cacheFile = path.join(root, 'build/site-page-dates.json'), progress = () => {} } = {}) {
  const git = (args, trim = true) => { const out = execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  }); return trim ? out.trim() : out; };
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
          const parents = git(['log', '--format=%P', range]).split('\n');
          if (parents.every(p => p.split(' ').length <= 1)) {
            const changed = git(['log', '--format=', '--name-only', '-z', '--no-renames', range], false);
            entries = old.entries;
            for (const rel of changed.split('\0')) delete entries[rel];
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
    save() {
      persist();
      progress(`page dates complete: ${walks} history queries, ${hits} cached`);
    },
  };
}

module.exports = { createGitDates };
