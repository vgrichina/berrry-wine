'use strict';
// The dashboard's DOS / ToyVM corpus: the reader (ops/dos-corpus.js) over a
// temporary repository and over the real committed corpus, and the rendered
// view (ops/dos-view.js) in the dashboard's vm harness. No browser, no ToyVM.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDosCorpus } = require('./dos-corpus');
const { browserApp } = require('./test-app-vm');

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dos-corpus-'));
  const w = (rel, v) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), typeof v === 'string' ? v : JSON.stringify(v)); };
  w('test/toyvm-dos-corpus/manifest.json', { about: 'about', toyvmFacts: { 'no-dpmi': { text: 'No DPMI host.', cite: 'tools/toyvm/dos.js' } }, titles: [
    { id: 'u4', title: 'Ultima <IV>', candidateId: 'cand-u4', dosboxAppIds: ['u4_gog'], entry: { program: 'ULTIMA.COM', args: '' }, entrySource: 'conf', payload: { present: true, files: 3, bytes: 3000 }, load: { policy: 'preload-all', preloadBytes: 3000, lazyFiles: 0 }, programs: [{ name: 'ULTIMA.COM', mode: 'real' }], toyvm: { status: 'untested', verdict: 'Untested.', blockers: [], cautions: [], evidence: [{ run: 'scratch/runs/u4probe', at: '2026-10-05T22:20:04Z', reached: 'title-screen', summary: 'Title shown.' }, { run: '/abs/escape', reached: 'x' }] }, fileList: 'test/toyvm-dos-corpus/files/u4.json', notes: 'docs/re-notes/u4.md' },
    { id: 'df', title: 'Daggerfall', candidateId: 'cand-df', dosboxAppIds: ['df_gog'], entry: { program: 'FALL.EXE', args: 'Z.CFG' }, payload: { present: true, files: 9, bytes: 9e8 }, programs: [{ name: 'FALL.EXE', mode: 'protected (DOS extender)', extender: { id: 'causeway', binding: 'bound' } }], toyvm: { status: 'blocked', verdict: 'Not expected to run.', blockers: [{ id: 'extender', text: 'Needs DPMI. More.', facts: ['no-dpmi', 'not-a-fact'] }], cautions: [] } },
    { id: 'sw', title: 'Shadow Warrior', candidateId: 'cand-sw', dosboxAppIds: [], entry: { program: 'Sw.exe' }, payload: { present: true, files: 1, bytes: 1 }, toyvm: { status: 'blocked', verdict: 'No.', blockers: [{ id: 'cdrom', text: 'Needs a CD.', facts: [] }], cautions: [] } },
  ] });
  w('ops/dos-corpus.json', { about: 'dosbox', reviewedAt: '2026-10-05T21:00:00Z', dosbox: {
    u4: { level: 'gameplay-reviewed', label: 'Overworld reviewed', summary: 'Moves.', asOf: '2026-10-05T19:00:00Z', basis: ['scratch/runs/u4/result.json'] },
    df: { level: 'in-progress', label: 'No control yet', summary: 'Cinematics.', asOf: '2026-10-05T23:00:00Z', basis: ['docs/re-notes/df.md'] } },
    extraRows: [{ id: 'gallery', title: 'Demos', engine: 'toyvm', gallery: 'docs/dos-corpus/demos.html', label: 'Runs in its gallery', summary: 'Static site.', basis: [] }] });
  w('test/candidate-corpus/manifest.json', { candidates: [{ id: 'cand-u4', version: 'GOG 1.0', sourcePage: 'https://www.gog.com/x', license: 'proprietary', packages: [{ url: 'https://archive.org/u4.rar', sha1: 'a'.repeat(40) }] }] });
  w('docs/re-notes/u4.md', '# u4'); w('scratch/runs/u4/result.json', '{}');
  return root;
}
const candidates = [
  { id: 'cand-u4', taskIds: ['T-U4'], performance: { fps: 30, metric: 'guest-presents', scene: 'overworld', runKey: 'r1' }, launch: { routes: [{ appId: 'u4_gog', available: true, url: '/emulator/?app=u4_gog&build=' + 'b'.repeat(64) }, { appId: 'other', available: true, url: '/emulator/?app=other' }] } },
  { id: 'cand-df', taskIds: [], launch: { routes: [{ appId: 'df_gog', available: false, url: null, reason: 'Registered files are missing.', missingPaths: ['x'] }] } },
  { id: 'cand-sw', taskIds: [], launch: { routes: [] } },
];
const runs = [
  { key: 'r2', id: 'u4-latest', candidateId: 'cand-u4', outcome: 'passed', verification: 'reviewed', startedAt: '2026-10-05T20:00:00Z', route: 'gameplay: overworld', gameplayScreenshots: [{ url: '/artifact?key=a', name: 'move.png' }], screenshots: [] },
  { key: 'r3', id: 'df-run', candidateId: 'cand-df', outcome: 'timeout', verification: 'reviewed', startedAt: '2026-10-05T20:40:00Z', route: 'creator', screenshots: [{ url: 'javascript:alert(1)', name: 'bad' }] },
];
const tasks = [{ id: 'T-U4', title: 'Ultima task', status: 'active', candidateIds: [] }];

test('rows: ToyVM launch only for an untested title, DOSBox route only from the catalog', async () => {
  const c = await buildDosCorpus({ root: repo(), candidates, runs, tasks });
  assert.equal(c.available, true);
  const [u4, df, sw, gallery] = c.rows;
  assert.equal(u4.toyvm.launch.url, '/toyvm/?title=u4');
  assert.equal(df.toyvm.launch, null); assert.match(df.toyvm.reason, /static assessment/);
  assert.deepEqual(u4.dosbox.routes.map((r) => r.appId), ['u4_gog'], 'only this title\'s app ids');
  assert.match(u4.dosbox.routes[0].url, /^\/emulator\/\?app=u4_gog&build=/);
  assert.equal(df.dosbox.routes[0].url, null);
  assert.match(sw.dosbox.reason, /No browser registration/);
  assert.equal(gallery.engine, 'toyvm-gallery');
});
test('flags drive the filters truthfully', async () => {
  const [u4, df, sw] = (await buildDosCorpus({ root: repo(), candidates, runs, tasks })).rows;
  assert.deepEqual(u4.flags, { available: true, launchable: true, gameplayReviewed: true, performanceMeasured: true, blocked: false });
  assert.deepEqual(df.flags, { available: true, launchable: false, gameplayReviewed: false, performanceMeasured: false, blocked: true });
  assert.equal(sw.flags.blocked, true);
});
test('blockers carry their cited ToyVM facts; unknown fact ids are dropped', async () => {
  const df = (await buildDosCorpus({ root: repo(), candidates, runs, tasks })).rows[1];
  assert.deepEqual(df.toyvm.blockers[0].facts, [{ id: 'no-dpmi', text: 'No DPMI host.', cite: 'tools/toyvm/dos.js' }]);
});
test('a remotely scanned blocked title reports its missing local entry without clearing compatibility blockers', async () => {
  const root = repo(), manifestPath = path.join(root, 'test/toyvm-dos-corpus/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.titles[1].gameDir = 'test/binaries/remote-demo';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  try {
    const absent = (await buildDosCorpus({ root })).rows[1];
    assert.equal(absent.payload.present, false);
    assert.equal(absent.flags.available, false);
    assert.match(absent.toyvm.reason, /Payload entry is missing on this machine.*remote-demo\/FALL.EXE/);
    assert.equal(absent.toyvm.status, 'blocked');
    assert.equal(absent.toyvm.blockers[0].id, 'extender');
    assert.equal(absent.flags.launchable, false);
    assert.equal(absent.toyvm.launch, null);
    fs.mkdirSync(path.join(root, manifest.titles[1].gameDir), { recursive: true });
    fs.writeFileSync(path.join(root, manifest.titles[1].gameDir, 'FALL.EXE'), 'fixture');
    const present = (await buildDosCorpus({ root })).rows[1];
    assert.equal(present.payload.present, true);
    assert.equal(present.flags.available, true);
    assert.match(present.toyvm.reason, /static assessment/);
    assert.equal(present.toyvm.launch, null);
    assert.equal(present.flags.launchable, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('a DOSBox summary older than the latest run is flagged stale; a newer one is not', async () => {
  const [u4, df] = (await buildDosCorpus({ root: repo(), candidates, runs, tasks })).rows;
  assert.equal(u4.dosbox.status.stale, true); assert.equal(df.dosbox.status.stale, false);
  assert.deepEqual(u4.dosbox.status.basis, [{ path: 'scratch/runs/u4/result.json', present: true, source: null, github: null }]);
});
test('provenance, tasks, screenshots; unsafe screenshot URLs are dropped', async () => {
  const [u4, df] = (await buildDosCorpus({ root: repo(), candidates, runs, tasks })).rows;
  assert.equal(u4.provenance.packages[0].url, 'https://archive.org/u4.rar'); assert.equal(u4.provenance.release, 'GOG 1.0');
  assert.deepEqual(u4.tasks.map((t) => t.id), ['T-U4']);
  assert.deepEqual(u4.screenshots, [{ url: '/artifact?key=a', name: 'move.png' }]);
  assert.deepEqual(df.screenshots, []);
  assert.equal(u4.notes.source, '/source?path=docs%2Fre-notes%2Fu4.md');
  assert.equal(u4.notes.github, null, 'no GitHub link without a known repository');
});
test('ToyVM run evidence is passed through with an existence check; unsafe run paths are dropped', async () => {
  const u4 = (await buildDosCorpus({ root: repo(), candidates, runs, tasks })).rows[0];
  assert.deepEqual(u4.toyvm.evidence, [{ run: 'scratch/runs/u4probe', at: '2026-10-05T22:20:04.000Z', reached: 'title-screen', summary: 'Title shown.', present: false }]);
  assert.equal(u4.toyvm.status, 'untested', 'evidence never changes the status');
});
test('a missing corpus manifest is reported, not thrown', async () => {
  const c = await buildDosCorpus({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'dos-empty-')) });
  assert.equal(c.available, false); assert.match(c.reason, /manifest/);
});

async function rendered(filter) {
  const dosCorpus = await buildDosCorpus({ root: repo(), candidates, runs, tasks });
  const vm = browserApp({ dosCorpus, runs, tasks, candidates: [], agents: [], activity: [] });
  if (filter) require('node:vm').runInContext(`dosFilter = ${JSON.stringify(filter)}`, vm);
  return { html: require('node:vm').runInContext('dosView()', vm), vm };
}
test('view: filter counts, real launch links only, escaped titles', async () => {
  const { html } = await rendered();
  assert.match(html, /data-dos-filter="launchable" aria-pressed="false"><strong>1<\/strong> Launchable/);
  assert.match(html, /data-dos-filter="blocked" aria-pressed="false"><strong>2<\/strong> Blocked/);
  assert.match(html, /href="\/toyvm\/\?title=u4"[^>]*>Try in ToyVM \(untested\) ↗/);
  assert.match(html, /href="\/emulator\/\?app=u4_gog&amp;build=b{64}"/);
  assert.equal((html.match(/href="\/toyvm\//g) || []).length, 1, 'no ToyVM link for blocked titles');
  assert.match(html, /Ultima &lt;IV&gt;/); assert.doesNotMatch(html, /Ultima <IV>/);
  assert.match(html, /Untested on ToyVM/); assert.match(html, /Blocked on ToyVM/);
  assert.match(html, /“Untested” is not a claim that it works/);
  assert.match(html, /Reached: title screen \(probe\)/);
  assert.match(html, /Blocked by: an unqualified 32-bit DOS extender\. Details has the sources\./);
  assert.match(html, /Blocked by: Needs a CD|Blocked by: needs a CD-ROM drive\./);
});
test('view: the blocked filter shows only blocked titles', async () => {
  const { html } = await rendered('blocked');
  assert.match(html, /Daggerfall/); assert.match(html, /Shadow Warrior/); assert.doesNotMatch(html, /Ultima/);
});
test('view: a launch URL outside its route prefix is not rendered as a link', async () => {
  const dosCorpus = await buildDosCorpus({ root: repo(), candidates, runs, tasks });
  dosCorpus.rows[0].toyvm.launch.url = 'javascript:alert(1)';
  dosCorpus.rows[0].dosbox.routes[0].url = 'https://elsewhere.example/';
  const html = require('node:vm').runInContext('dosView()', browserApp({ dosCorpus, runs, tasks, candidates: [], agents: [], activity: [] }));
  assert.doesNotMatch(html, /javascript:/); assert.doesNotMatch(html, /elsewhere\.example/);
});

test('the real committed corpus: DOS payload entries, never the DOSBox wrapper; Daggerfall blocked', async () => {
  const root = path.join(__dirname, '..');
  if (!fs.existsSync(path.join(root, 'test/toyvm-dos-corpus/manifest.json'))) return;
  const c = await buildDosCorpus({ root, candidates: [], runs: [], tasks: [] });
  const df = c.rows.find((r) => r.id === 'daggerfall');
  assert.equal(df.entry.program, 'FALL.EXE'); assert.equal(df.toyvm.status, 'blocked');
  for (const r of c.rows.filter((x) => x.engine === 'dos')) assert.doesNotMatch(r.entry.program, /dosbox/i);
  assert.ok(c.rows.some((r) => r.engine === 'toyvm-gallery'));
});

test('explicit historical null-ID ToyVM flight stays separate from DOSBox and unrelated runs', async () => {
  const root = repo(), p = path.join(root, 'test/toyvm-dos-corpus/manifest.json');
  const m = JSON.parse(fs.readFileSync(p));
  m.titles.push({ id: 'c3', title: 'Comanche', candidateId: null, dosboxAppIds: ['c3_dosbox'], entry: { program: 'C3.EXE' }, payload: { present: true }, toyvm: { status: 'reviewed-gameplay', verdict: 'FPS unknown; audio disabled.', blockers: [], cautions: [], evidence: [{ run: 'scratch/runs/c3-flight', reached: 'controlled-flight', reviewedGameplay: { build: { commit: 'reference-build' }, limits: ['FPS unknown'], taskIds: ['C3'] } }] } });
  fs.writeFileSync(p, JSON.stringify(m));
  const curated = path.join(root, 'ops/dos-corpus.json'), c = JSON.parse(fs.readFileSync(curated));
  c.dosbox.c3 = { label: 'Untested DOSBox', asOf: '2026-10-08', level: 'in-progress', basis: [] }; fs.writeFileSync(curated, JSON.stringify(c));
  const run = { key: 'scratch/runs/c3-flight', id: 'c3-flight', candidateId: null, outcome: 'passed', verification: 'reviewed', startedAt: '2026-10-09', route: 'gameplay', screenshots: [{url:'/artifact?key=c3',name:'flight.png'}] };
  const row = (await buildDosCorpus({root, runs:[run, {...run,key:'unrelated'}],tasks:[{id:'C3',candidateIds:[]},{id:'bad',candidateIds:[null]}]})).rows.find(r=>r.id==='c3');
  assert.equal(row.toyvm.launch.label,'Launch in ToyVM (reviewed route)');
  assert.equal(row.toyvm.reviewedRun.id,'c3-flight'); assert.equal(row.toyvm.screenshots.length,1);
  assert.equal(row.latestRun,null); assert.equal(row.gameplayRun,null); assert.deepEqual(row.screenshots,[]);
  assert.equal(row.dosbox.status.stale,false); assert.equal(row.flags.gameplayReviewed,true); assert.equal(row.performance,null);
  assert.deepEqual(row.tasks.map(t=>t.id),['C3']);
  const vm = browserApp({dosCorpus:{available:true,rows:[row]},runs:[],tasks:[],candidates:[],agents:[],activity:[]});
  assert.match(require('node:vm').runInContext('dosView()',vm),/Reviewed ToyVM flight route/);
  m.titles.at(-1).payload.present=false;fs.writeFileSync(p,JSON.stringify(m));
  assert.equal((await buildDosCorpus({root})).rows.find(r=>r.id==='c3').toyvm.launch,null);
});

test('reader imports registered historical null-ID evidence and serves its images without changing the result', async () => {
  const root=repo(),p=path.join(root,'test/toyvm-dos-corpus/manifest.json'),m=JSON.parse(fs.readFileSync(p));
  const key='scratch/runs/historical';m.titles[0].toyvm.evidence=[{run:key,reviewedGameplay:{reviewer:'root'}}];fs.writeFileSync(p,JSON.stringify(m));
  fs.mkdirSync(path.join(root,key),{recursive:true});const original=JSON.stringify({candidateId:null,startedAt:'2026-10-08T10:00:00Z',outcome:'passed',verification:'reviewed',screenshots:['flight.png']});
  fs.writeFileSync(path.join(root,key,'result.json'),original);fs.writeFileSync(path.join(root,key,'flight.png'),'image');
  fs.mkdirSync(path.join(root,'scratch/runs/unrelated'),{recursive:true});fs.writeFileSync(path.join(root,'scratch/runs/unrelated/result.json'),original);
  const reader=require('./readers').createReader({root,codexRoot:false,claudeRoot:false});
  const snapshot=await reader.snapshot();assert.equal(snapshot.runs.length,1);assert.equal(snapshot.runs[0].candidateId,null);
  assert.equal(snapshot.runs[0].key,key);assert(await reader.artifact(key+'/flight.png'));
  assert.equal(fs.readFileSync(path.join(root,key,'result.json'),'utf8'),original);
});
