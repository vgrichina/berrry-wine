'use strict';

// View model for the dashboard's DOS / ToyVM corpus. One row per original DOS
// title, built from:
//   test/toyvm-dos-corpus/manifest.json  the DOS payload, its file manifest,
//                                         and the static, cited ToyVM verdict
//   ops/dos-corpus.json                   dated summaries for the OTHER route
//                                         (the release's own DOSBox.exe in the
//                                         Win98 emulator) + the gallery row
//   test/candidate-corpus, test/dos-game-corpus   provenance
//   the snapshot's candidates/runs/tasks  launch routes, runs, screenshots,
//                                         measured performance, linked tasks
// Nothing here certifies compatibility: a launch route proves files and build,
// a ToyVM verdict is static, and gameplay is only what a reviewed run shows.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');

const MB = 1024 * 1024;
const clip = (v, n = 400) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '';
const rel = (v) => typeof v === 'string' && v && !path.isAbsolute(v) && !v.includes('\0') && !v.split('/').includes('..') ? v : null;
const httpUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v) ? v : null;
const iso = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const NOTE = /^docs\/re-notes\/[\w.-]+\.md$/;

async function readJson(root, relative, limit = 4 * MB) {
  const r = rel(relative); if (!r) return null;
  try {
    const base = await fs.realpath(root), file = await fs.realpath(path.resolve(base, r));
    if (!file.startsWith(base + path.sep)) return null;
    const st = await fs.stat(file); if (!st.isFile() || st.size > limit) return null;
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch { return null; }
}
async function exists(root, relative) {
  const r = rel(relative); if (!r) return false;
  try { const base = await fs.realpath(root), file = await fs.realpath(path.resolve(base, r)); return file.startsWith(base + path.sep) && (await fs.stat(file)).isFile(); } catch { return false; }
}
function tracked(root, paths) {
  if (!paths.length) return Promise.resolve(new Set());
  return new Promise((resolve) => execFile('git', ['-C', root, 'ls-files', '-z', '--', ...paths], { timeout: 5000, maxBuffer: MB },
    (err, out) => resolve(err ? new Set() : new Set(String(out).split('\0').filter(Boolean)))));
}
const runView = (r) => r ? { key: r.key, id: r.id, outcome: r.outcome, verification: r.verification, startedAt: r.startedAt, route: clip(r.route, 300) } : null;
const shotsOf = (r) => r ? (r.gameplayScreenshots?.length ? r.gameplayScreenshots : r.screenshots || []).slice(0, 3).map((s) => ({ url: s.url, name: clip(s.name, 120) })).filter((s) => typeof s.url === 'string' && s.url.startsWith('/artifact?')) : [];

async function buildDosCorpus({ root, candidates = [], runs = [], tasks = [], githubRepo = null, githubRef = 'main' }) {
  const warnings = [];
  const corpus = await readJson(root, 'test/toyvm-dos-corpus/manifest.json');
  const curated = await readJson(root, 'ops/dos-corpus.json', MB) || {};
  if (!corpus || !Array.isArray(corpus.titles)) return { available: false, reason: 'test/toyvm-dos-corpus/manifest.json is missing or invalid.', rows: [], warnings };
  const candManifest = await readJson(root, 'test/candidate-corpus/manifest.json');
  const dosGames = await readJson(root, 'test/dos-game-corpus/manifest.json', MB);
  const facts = corpus.toyvmFacts || {};
  const withFacts = (list) => (Array.isArray(list) ? list : []).map((b) => ({ id: clip(b.id, 40), text: clip(b.text, 600),
    facts: (b.facts || []).filter((f) => facts[f]).map((f) => ({ id: f, text: clip(facts[f].text, 400), cite: clip(facts[f].cite, 300) })) }));
  const links = new Set(['test/toyvm-dos-corpus/manifest.json', 'ops/dos-corpus.json']);
  const rows = [];
  for (const t of corpus.titles) {
    if (!t || typeof t.id !== 'string') continue;
    const appIds = Array.isArray(t.dosboxAppIds) ? t.dosboxAppIds : [];
    const cand = t.candidateId ? candidates.find((c) => c.id === t.candidateId) : null;
    const cm = t.candidateId ? (candManifest?.candidates || []).find((c) => c?.id === t.candidateId) : null;
    const game = t.dosGameId ? (dosGames?.games || []).find((g) => g?.id === t.dosGameId) : null;
    const pkgs = cm ? (cm.packages || []).map((p) => ({ url: httpUrl(p?.url), sha1: /^[0-9a-f]{40}$/.test(p?.sha1 || '') ? p.sha1 : null }))
      : game?.package ? [{ url: httpUrl(game.package.url), sha1: game.package.sha1 || null, sha256: game.package.sha256 || null }] : [];
    const provenance = { sourcePage: httpUrl(cm?.sourcePage || game?.sourcePage), license: clip(cm?.license || game?.license, 600), release: clip(cm?.version || game?.release, 120),
      packages: pkgs.filter((p) => p.url), manifest: cm ? 'test/candidate-corpus/manifest.json' : game ? 'test/dos-game-corpus/manifest.json' : null };
    if (provenance.manifest) links.add(provenance.manifest);

    // ToyVM: the static verdict and, only for a title with no blocker and a
    // present payload, the gateway route to a live session.
    const tv = t.toyvm || {};
    let toyvmLaunchable = t.payload?.present === true && ['untested', 'reviewed-gameplay'].includes(tv.status) && !(tv.blockers || []).length;
    let availabilityReason = '';
    if (toyvmLaunchable && t.gameDir) {
      const view = await require('./toyvm-server').titleView(root, t.id);
      toyvmLaunchable = view?.launchable === true;
      availabilityReason = view?.reason || '';
    } else if (t.payload?.present === true && t.gameDir) {
      // A static scan may have been generated on another machine. Blocked
      // titles never reach titleView's local-file check; at least verify their
      // entry exists here before advertising the scanned payload as available.
      const dir = rel(t.gameDir), program = rel(t.entry?.program);
      if (!dir || !program || !await exists(root, `${dir}/${program}`)) {
        availabilityReason = 'Payload entry is missing on this machine: ' + clip(`${t.gameDir}/${t.entry?.program}`, 220);
      }
    }
    const evidence = [];
    for (const e of Array.isArray(tv.evidence) ? tv.evidence : []) { const r = rel(e?.run); if (r) evidence.push({ run: r, at: iso(e.at), reached: clip(e.reached, 40), summary: clip(e.summary, 600), ...(e.reviewedGameplay ? { reviewedGameplay: e.reviewedGameplay } : {}), present: await exists(root, r + '/result.json') }); }
    const toyvm = { status: ['blocked', 'untested', 'reviewed-gameplay'].includes(tv.status) ? tv.status : 'unknown', verdict: clip(tv.verdict, 600), blockers: withFacts(tv.blockers), cautions: withFacts(tv.cautions), evidence,
      launch: toyvmLaunchable ? { url: '/toyvm/?title=' + encodeURIComponent(t.id), label: tv.status === 'reviewed-gameplay' ? 'Launch in ToyVM (reviewed route)' : 'Try in ToyVM (untested)' } : null,
      reason: toyvmLaunchable ? '' : availabilityReason || (!t.payload?.present ? 'Payload not on this machine.' : 'Blocked by the static assessment; no session offered.') };

    // The Win98 + DOSBox.exe route: the emulator catalog's own routes for these
    // app ids (build-pinned by launchFor), never a constructed URL.
    const routes = (cand?.launch?.routes || []).filter((r) => appIds.includes(r.appId)).map((r) => ({ appId: r.appId, available: r.available === true,
      url: r.available === true && typeof r.url === 'string' && r.url.startsWith('/emulator/') ? r.url : null, reason: clip(r.reason, 300), missing: (r.missingPaths || []).length }));
    const cs = curated.dosbox?.[t.id] || null;
    const ids = new Set([t.candidateId, ...appIds].filter(Boolean));
    const toyvmKeys = new Set(evidence.map(e => e.run));
    const toyvmRuns = runs.filter(r => toyvmKeys.has(r.key));
    toyvm.reviewedRun = runView(toyvmRuns.find(r => r.outcome === 'passed' && r.verification === 'reviewed' && evidence.some(e => e.run === r.key && e.reviewedGameplay)));
    toyvm.screenshots = shotsOf(toyvmRuns.find(r => r.key === toyvm.reviewedRun?.key));
    const matching = runs.filter((r) => ids.has(r.candidateId) && !toyvmKeys.has(r.key) && !/^toyvm\b/i.test(r.route || ''));
    const latest = matching[0] || null;
    const reviewedPass = matching.find((r) => r.outcome === 'passed' && r.verification === 'reviewed') || null;
    const gameplay = matching.find((r) => r.outcome === 'passed' && r.verification === 'reviewed' && (r.gameplayScreenshots?.length || /^gameplay\b/i.test(r.route || ''))) || null;
    const dosbox = { appIds, routes, reason: !appIds.length ? 'No browser registration for this title.' : !routes.length ? 'The emulator catalog has no route for ' + appIds.join(', ') + '.' : '',
      status: cs ? { level: clip(cs.level, 40), label: clip(cs.label, 160), summary: clip(cs.summary, 1000), asOf: iso(cs.asOf), basis: [] } : null };
    if (dosbox.status) {
      for (const b of cs.basis || []) { const r = rel(b); if (!r) continue; dosbox.status.basis.push({ path: r, present: await exists(root, r), source: NOTE.test(r) ? '/source?path=' + encodeURIComponent(r) : null }); links.add(r); }
      dosbox.status.stale = !!(latest && dosbox.status.asOf && Date.parse(latest.startedAt) > Date.parse(dosbox.status.asOf));
    }
    const notes = rel(t.notes) && await exists(root, t.notes) ? { path: t.notes, source: NOTE.test(t.notes) ? '/source?path=' + encodeURIComponent(t.notes) : null } : null;
    if (notes) links.add(notes.path);
    const taskIds = new Set([...(cand?.taskIds || []), ...evidence.flatMap(e => e.reviewedGameplay?.taskIds || [])]);
    const linked = tasks.filter((x) => taskIds.has(x.id) || (typeof t.candidateId === 'string' && t.candidateId.length > 0 && (x.candidateIds || []).includes(t.candidateId))).map((x) => ({ id: x.id, title: clip(x.title, 200), status: x.status }));
    const performance = cand?.performance ? { fps: Number.isFinite(cand.performance.fps) ? cand.performance.fps : null, metric: clip(cand.performance.metric, 60), scene: clip(cand.performance.scene, 160), runKey: cand.performance.runKey } : null;
    rows.push({ id: t.id, title: clip(t.title, 160), engine: 'dos', entry: { program: clip(t.entry?.program, 80), args: clip(t.entry?.args, 200) }, entrySource: clip(t.entrySource, 400),
      programs: (t.programs || []).slice(0, 8).map((p) => ({ name: clip(p.name, 80), mode: clip(p.mode, 60), extender: p.extender ? `${p.extender.id} (${p.extender.binding})` : null })),
      payload: t.payload?.present && !availabilityReason ? { present: true, files: t.payload.files, bytes: t.payload.bytes, excluded: t.payload.excluded || {} } : { present: false, reason: clip(availabilityReason || t.payload?.reason, 300) },
      load: t.load ? { policy: clip(t.load.policy, 40), preloadBytes: t.load.preloadBytes, lazyFiles: t.load.lazyFiles } : null,
      fileList: rel(t.fileList), provenance, toyvm, dosbox, notes, tasks: linked, performance,
      latestRun: runView(latest), reviewedPass: runView(reviewedPass), gameplayRun: runView(gameplay), screenshots: shotsOf(gameplay || reviewedPass || latest),
      flags: { available: t.payload?.present === true && !availabilityReason, launchable: toyvmLaunchable || routes.some((r) => r.available), gameplayReviewed: !!gameplay || !!toyvm.reviewedRun,
        performanceMeasured: !!performance, blocked: toyvm.status === 'blocked' && !routes.some((r) => r.available) } });
    if (t.fileList) links.add(t.fileList);
  }
  for (const x of Array.isArray(curated.extraRows) ? curated.extraRows : []) {
    if (!x || typeof x.id !== 'string') continue;
    const basis = [];
    for (const b of x.basis || []) { const r = rel(b); if (r) { basis.push({ path: r, present: await exists(root, r) }); links.add(r); } }
    if (rel(x.gallery)) links.add(x.gallery);
    rows.push({ id: x.id, title: clip(x.title, 160), engine: 'toyvm-gallery', gallery: rel(x.gallery), label: clip(x.label, 160), summary: clip(x.summary, 800), basis,
      flags: { available: true, launchable: false, gameplayReviewed: false, performanceMeasured: false, blocked: false } });
  }
  // GitHub links only for files git tracks.
  const known = githubRepo ? await tracked(root, [...links]) : new Set();
  const gh = (p) => githubRepo && p && known.has(p) ? `${githubRepo}/blob/${encodeURIComponent(githubRef)}/${p.split('/').map(encodeURIComponent).join('/')}` : null;
  for (const r of rows) {
    if (r.notes) r.notes.github = gh(r.notes.path);
    if (r.provenance?.manifest) r.provenance.github = gh(r.provenance.manifest);
    if (r.fileList) r.fileListGithub = gh(r.fileList);
    for (const b of r.dosbox?.status?.basis || []) b.github = gh(b.path);
    for (const b of r.basis || []) b.github = gh(b.path);
    if (r.gallery) r.galleryGithub = gh(r.gallery);
  }
  return { available: true, about: clip(corpus.about, 800), dosboxAbout: clip(curated.about, 800), reviewedAt: iso(curated.reviewedAt), rows, github: { manifest: gh('test/toyvm-dos-corpus/manifest.json'), curated: gh('ops/dos-corpus.json') }, warnings };
}

module.exports = { buildDosCorpus };
