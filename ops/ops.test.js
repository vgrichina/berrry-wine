'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { parseTasks, parseSession, createReader, logWindows, scanGoal } = require('./readers');
const { createServer } = require('./server');
const { parseProcesses, parseOpenFiles, associate } = require('./processes');

test('Claude persistent launch requires explicit identity and explicit permission bypass',()=>{
  const {options}=require('./claude-tmux');
  const args=['--session-id','1863d2b5-bc58-4c0b-9c15-00fc951f0256','--id','claude-launch-ux','--tmux','wine-claude-launch-ux'];
  assert.equal(options(args).bypass,false);
  assert.equal(options([...args,'--dangerously-skip-permissions']).bypass,true);
  assert.throws(()=>options(['--session-id','bad']));
});

test('Claude fresh launch starts a new session id with an optional first prompt, never a resume',()=>{
  const {options,claudeArgs}=require('./claude-tmux');
  const ids=['--id','claude-new','--tmux','wine-claude-new'];
  assert.throws(()=>options(ids),/session-id/,'resume still requires an explicit session');
  const generated=options(['--new',...ids]);
  assert.match(generated.sessionId,/^[a-f0-9-]{36}$/);
  assert.notEqual(options(['--new',...ids]).sessionId,generated.sessionId);
  const sid='1863d2b5-bc58-4c0b-9c15-00fc951f0256';
  const o=options(['--new','--session-id',sid,...ids,'--prompt','brief.md','--dangerously-skip-permissions']);
  assert.equal(o.prompt,'brief.md');
  assert.deepEqual(claudeArgs(o,"Read the lane's brief"),['claude','--session-id',sid,'--dangerously-skip-permissions',"Read the lane's brief"]);
  assert.deepEqual(claudeArgs(options(['--session-id',sid,...ids]),null),['claude','--resume',sid]);
  assert.throws(()=>options(['--session-id',sid,...ids,'--prompt','brief.md']),/requires --new/);
});

test('Claude Linux registry proves machine, namespace, start ticks and wall start before matching PID',()=>{
  const {registryMatchesProcess,linuxStartTicks}=require('./processes');
  const started=new Date(Date.now()-3600000).toUTCString().replace(/^[^,]+, (\d+) (\w+) (\d+) (\S+) GMT$/,(_m,day,month,year,time)=>`Sat ${month} ${day} ${time} ${year}`),startedAt=Date.parse(started+' UTC')+434;
  const p={pid:123,name:'claude',started,startTicks:'9114166',pidDomain:'linux:machine:pid:[4026531836]'};
  const r={pid:123,sessionId:'linux-session',procStart:'9114166',pidDomain:p.pidDomain,startedAt};
  assert.equal(registryMatchesProcess(r,p),true);
  assert.equal(registryMatchesProcess({...r,startedAt:startedAt+15*60000},p),true,'trust setup can delay session registration');
  assert.equal(registryMatchesProcess({...r,startedAt:Date.now()+60000},p),false);
  for(const change of [{pidDomain:'linux:other:pid:[4026531836]'},{pidDomain:'linux:machine:pid:[99]'},{procStart:'9114167'},{startedAt:startedAt-86400000},{startedAt:undefined}])assert.equal(registryMatchesProcess({...r,...change},p),false);
  const a={id:'claude:linux-session',provider:'claude',logFile:'/logs/claude.jsonl'};
  assert.equal(associate([a],[p],new Map(),[r],null).get(a).matches[0].pid,123);
  const fields=['S',...Array(18).fill('0'),'9114166','0'];
  assert.equal(linuxStartTicks('123 (claude (worker)) '+fields.join(' ')),'9114166');
});
const { identify } = require('./backfill');
const { classifyCandidate, groups } = require('./corpus-categories');

test('corpus category assignments cover the manifest without guessing unknown titles', () => {
  const candidates = require('../test/candidate-corpus/manifest.json').candidates;
  assert.equal(new Set(groups.flatMap(g => g[2])).size, candidates.length);
  for (const c of candidates) assert.notEqual(classifyCandidate(c).id, 'unclassified', c.id);
  assert.equal(classifyCandidate({id:'unknown',name:'Need for Speed',kind:'game'}).id, 'unclassified');
  assert.equal(classifyCandidate({id:'generally-track-editor'}).id, 'tools');
  assert.equal(classifyCandidate({id:'quake-2-demo-installer'}).id, 'shooters');
  assert.equal(classifyCandidate({id:'best-of-moorhuhn'}).id, 'collections');
  assert.equal(classifyCandidate({id:'bricks'}).id, 'puzzle-board');
  assert.equal(classifyCandidate({id:'winarc'}).id, 'collections');
  assert.equal(classifyCandidate({id:'claass'}).id, 'tools');
});

test('registry-only corpus rows remain visible and exact app aliases share run evidence', async t => {
  const f = await fixture(); t.after(() => fs.rm(f.root, {recursive:true,force:true}));
  await f.write('lib/apps.js', `module.exports={APPS:{demo_alias:{exe:'binaries/candidates/demo/game.exe'},freecell:{exe:'binaries/freecell.exe'},unknown:{exe:'binaries/missing.exe'}},DESKTOP_APPS:[['freecell','FreeCell']]};`);
  await f.write('test/binaries/freecell.exe','fixture');
  // The emulator's app picker names apps the launcher arrays do not.
  await f.write('index.html','<select><option value="unknown">Unknown &amp; Friends (demo)</option><option value="freecell">Picker FreeCell</option></select>');
  await f.write('scratch/runs/alias/result.json',JSON.stringify({candidateId:'demo_alias',startedAt:'2026-10-03T01:00:00Z',outcome:'unknown'}));
  const snapshot = await createReader({root:f.root,codexRoot:false,claudeRoot:false}).snapshot();
  assert.equal(snapshot.candidates.length,3);
  const demo = snapshot.candidates.find(c=>c.id==='demo');
  assert.equal(demo.latestRun.candidateId,'demo_alias');
  assert.equal(demo.registryOnly,false);
  assert.deepEqual(demo.appIds,['demo_alias']);
  const freecell = snapshot.candidates.find(c=>c.id==='freecell');
  assert.equal(freecell.name,'FreeCell');
  assert.equal(freecell.category.id,'puzzle-board');
  assert.equal(freecell.sourceGroup,'Registry only');
  assert.equal(freecell.fixtureStatus,'present');
  const unknown = snapshot.candidates.find(c=>c.id==='unknown');
  assert.equal(unknown.fixtureStatus,'missing');
  assert.equal(unknown.name,'Unknown & Friends (demo)');
  assert.equal(freecell.name,'FreeCell','a launcher-array label is kept over the picker');
  assert.equal(unknown.category.id,'unclassified');
  assert.ok(!snapshot.warnings.some(w=>w.includes('demo_alias')));
});

test('historical image association never treats prose as a candidate ID', () => {
  assert.equal(identify('This generally works; open build/caesar3-gameplay.png'), null);
  assert.equal(identify('/project/build/caesar3-gameplay.png'), null);
  assert.equal(identify('/project/build/generally/menu.png'), 'generally');
  assert.equal(identify('/project/build/pirates_2004/menu.png'), 'pirates-2004');
  assert.equal(identify('/project/build/notepad/menu.png'), 'notepad');
  assert.equal(identify('/project/build/calc.png'), 'calc');
  assert.equal(identify('/project/build/mspaint98/menu.png'), 'mspaint98');
  assert.equal(identify('/project/build/notepad/calc.png'), null);
  assert.equal(identify('/project/pirates-2004/serious-sam-demo/menu.png'), null);
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wine-ops-'));
  async function write(relative, data) { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data); }
  await write('TODOS.md', '## Current work\n- [~] Fix startup\n  id: T-1\n  candidate: demo\n  owner: codex:one\n  started: 2026-10-01T12:00:00Z\n  progress: 2026-10-01T12:05:00Z\n\n## Legacy investigation\nHistorical prose; no current status.\n');
  await write('test/candidate-corpus/manifest.json', JSON.stringify({ assetRoot: 'test/binaries/candidates', candidates: [{ id: 'demo', name: 'Demo <app>', version: '1', executables: ['game.exe'], notes: 'See docs/re-notes/demo.md' }] }));
  await write('test/binaries/candidates/demo/game.exe', 'fixture');
  await write('docs/re-notes/demo.md', '# Findings');
  await write('messageboard.txt', '2026-10-01 agent CLAIM demo\n2026-10-01 agent PROGRESS found bug\n');
  await write('scratch/runs/R-1/result.json', JSON.stringify({ candidateId: 'demo', startedAt: '2026-10-01T12:00:00Z', outcome: 'passed', route: 'menu', verification: 'reviewed', screenshot: 'screen.png' }));
  await write('scratch/runs/R-1/screen.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=', 'base64'));
  return { root, write, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}

test('task queue metadata distinguishes deferred work from blockers and keeps the next step', () => {
  const tasks = parseTasks('- [!] Old agent\n  status: deferred\n  Next: Resume only when requested\n- [ ] Later idea\n  status: backlog\n');
  assert.equal(tasks[0].status, 'deferred');
  assert.equal(tasks[0].next, 'Resume only when requested');
  assert.equal(tasks[1].status, 'backlog');
});

test('task parser preserves legacy uncertainty, links exact candidates, ignores fenced examples', () => {
  const text = '## Legacy\nStill historical\n\n## Current\n- [!] Startup\n  candidate: demo\n  owner: claude:abc\n- [x] Fixed\n  candidate: demo-extra\n```md\n- [ ] example\n```';
  const tasks = parseTasks(text, [{ id: 'demo' }]);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].status, 'unknown');
  assert.equal(tasks[1].status, 'blocked');
  assert.equal(tasks[1].owner, 'claude:abc');
  assert.deepEqual(tasks[1].candidateIds, ['demo']);
  assert.deepEqual(tasks[2].candidateIds, []);
});

test('subagent summaries preserve explicit lineage without confusing shared process identity', () => {
  const root = '/project', timestamp = '2026-10-04T12:00:00Z';
  const records = [{type:'assistant', cwd:root, sessionId:'parent', timestamp,
    message:{content:[{type:'text',text:'Found the rendering bottleneck.'}],stop_reason:'end_turn'}}];
  const child = parseSession('claude', records, '/logs/parent/subagents/agent-child.jsonl', false, root);
  assert.equal(child.id, 'claude:agent-child');
  assert.equal(child.parentAgentId, 'claude:parent');
  assert.equal(child.summary, 'Found the rendering bottleneck.');
  assert.equal(child.state, 'idle');
  assert.equal(parseSession('claude', records, '/logs/parent.jsonl', false, root).parentAgentId, null);
  const codex = parseSession('codex', [
    {type:'session_meta', payload:{id:'child',cwd:root,source:{subagent:{thread_spawn:{parent_thread_id:'parent'}}}}},
    {type:'response_item',timestamp,payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'x'.repeat(400)}]}},
  ], '/logs/child.jsonl', true, root);
  assert.equal(codex.parentAgentId, 'codex:parent');
  assert(codex.summary.length <= 240);
});

test('PID association requires exact open log or live Claude registry with matching process start', () => {
  const processes = parseProcesses('101 1 S+ 01:02 Thu Oct 1 12:00:00 2026 /opt/bin/codex\n102 101 S 00:30 Thu Oct 1 12:00:32 2026 /bin/zsh\n103 102 R 00:15 Thu Oct 1 12:00:47 2026 node\n201 1 S 02:00 Thu Oct 1 11:59:02 2026 claude\n301 1 S 02:00 Thu Oct 1 11:59:02 2026 unrelated\n');
  const agents = [
    { id: 'codex:a', provider: 'codex', logFile: '/logs/a.jsonl' },
    { id: 'codex:b', provider: 'codex', logFile: '/logs/b.jsonl' },
    { id: 'codex:c', provider: 'codex', logFile: '/logs/c.jsonl' },
    { id: 'claude:parent', provider: 'claude', logFile: '/logs/parent.jsonl' },
    { id: 'claude:agent-child', provider: 'claude', logFile: '/logs/parent/subagents/agent-child.jsonl' },
  ];
  const files = parseOpenFiles('p101\nn/logs/a.jsonl\np301\nn/logs/c.jsonl\n');
  const registry = [{ pid: 201, sessionId: 'parent', procStart: 'Thu Oct  1 11:59:02 2026', pidDomain: process.platform }];
  const linked = associate(agents, processes, files, registry, '2026-10-01T12:01:02Z');
  assert.deepEqual(linked.get(agents[0]).matches.map(p => p.pid), [101]);
  assert.deepEqual(linked.get(agents[0]).children.map(p => p.pid), [102, 103]);
  assert.equal(linked.get(agents[1]).status, 'unmatched');
  assert.equal(linked.get(agents[2]).status, 'unmatched');
  assert.equal(linked.get(agents[3]).matches[0].pid, 201);
  assert.equal(linked.get(agents[4]).matches[0].shared, true);
  assert.equal(linked.get(agents[3]).matches[0].shared, true);
  registry[0].procStart = 'Wed Sep 30 11:59:02 2026';
  assert.equal(associate(agents, processes, files, registry, null).get(agents[3]).status, 'unmatched');
  assert.equal(associate(agents, [], new Map(), [], null, 'Permission denied').get(agents[0]).status, 'unavailable');
  assert.equal(associate(agents, [], files, registry, null).get(agents[0]).status, 'unmatched');
});

test('process CPU and RSS preserve zero, multicore usage and totals beyond the visible child limit', () => {
  const processes = parseProcesses('101 1 S 01:02 0.0 2048 Thu Oct 1 12:00:00 2026 /opt/bin/codex\n' + Array.from({length:45},(_,i)=>`${200+i} 101 R 00:30 ${i === 44 ? '125.5' : '1.0'} 1024 Thu Oct 1 12:00:32 2026 node`).join('\n'));
  assert.equal(processes[0].cpuPercent, 0);
  assert.equal(processes[0].rssBytes, 2 * 1024 ** 2);
  const a = {id:'codex:a',provider:'codex',logFile:'/logs/a.jsonl'};
  const p = associate([a],processes,parseOpenFiles('p101\nn/logs/a.jsonl\n'),[],null).get(a);
  assert.equal(p.childCount,45); assert.equal(p.children.length,40);
  assert.equal(p.children[0].pid,244);
  assert.equal(p.childCpuPercent,169.5);
  assert.equal(p.childRssBytes,45 * 1024 ** 2);
  const legacy = parseProcesses('101 1 S 01:02 Thu Oct 1 12:00:00 2026 codex')[0];
  assert.equal(legacy.cpuPercent,null); assert.equal(legacy.rssBytes,null);
});

test('provider usage distinguishes cached input, totals and context limits', () => {
  const root = '/project';
  const time = '2026-10-01T12:00:00Z';
  const codex = parseSession('codex', [
    { type: 'session_meta', timestamp: time, payload: { cwd: root, id: 'one' } },
    { type: 'response_item', timestamp: time, payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Fix the startup fault' }] } },
    { type: 'response_item', timestamp: time, payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>not the task</environment_context>' }] } },
    { type: 'event_msg', timestamp: time, payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 10 }, total_token_usage: { total_tokens: 9000 }, model_context_window: 200 } } },
    { type: 'event_msg', timestamp: time, payload: { type: 'task_complete' } },
  ], '/logs/one.jsonl', false, root);
  assert.equal(codex.cachePercent, 80); assert.equal(codex.totalTokens, 9000); assert.equal(codex.contextEstimate, 100); assert.equal(codex.state, 'idle');
  assert.equal(codex.title, 'Fix the startup fault');
  const claudeRecords = [{ type: 'assistant', cwd: root, sessionId: 'two', timestamp: time, message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'Bash' }], usage: { input_tokens: 10, cache_read_input_tokens: 80, cache_creation_input_tokens: 10, output_tokens: 15 } } }];
  const claude = parseSession('claude', claudeRecords, '/logs/two.jsonl', true, root);
  assert.equal(claude.cachePercent, 80); assert.equal(claude.inputTokens, 100); assert.equal(claude.totalTokens, null); assert.equal(claude.contextLimit, null);
  const compacted = parseSession('claude', [...claudeRecords, { type: 'system', subtype: 'compact_boundary', timestamp: time }], '/logs/two.jsonl', true, root);
  assert.equal(compacted.contextEstimate, null);
  assert.equal(parseSession('claude', claudeRecords, '/logs/two.jsonl', false, '/project-other'), null);
  const incomplete = parseSession('claude', [{ ...claudeRecords[0], message: { usage: { input_tokens: 10 } } }], '/logs/two.jsonl', false, root);
  assert.equal(incomplete.cachePercent, null); assert.equal(incomplete.inputTokens, null);
});

test('bounded logs ignore incomplete records and do not carry an old turn across a gap', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const head = JSON.stringify({ type: 'session_meta', timestamp: '2026-10-01T12:00:00Z', payload: { cwd: f.root } }) + '\n' + JSON.stringify({ type: 'event_msg', timestamp: '2026-10-01T12:00:00Z', payload: { type: 'task_started' } }) + '\n';
  await f.write('large.jsonl', head + (JSON.stringify({ type: 'ignored', padding: 'x'.repeat(1000) }) + '\n').repeat(1500) + JSON.stringify({ type: 'response_item', timestamp: '2026-10-01T13:00:00Z', payload: { type: 'function_call', name: 'shell' } }) + '\n{"type":');
  const file = path.join(f.root, 'large.jsonl');
  const data = await logWindows(file, (await fs.stat(file)).size);
  assert.equal(data.partial, true);
  const s = parseSession('codex', data.records, file, data.partial, f.root);
  assert.equal(s.turnStartedAt, null); assert.equal(s.state, 'tool');
  assert.equal(s.lastActivityAt, '2026-10-01T13:00:00.000Z');
});

test('file ingestion updates tasks, tolerates malformed runs and preserves last verified result', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const reader = createReader({ root: f.root, codexRoot: false, claudeRoot: false });
  await f.write('scratch/runs/R-2/result.json', JSON.stringify({ candidateId: 'demo', startedAt: '2026-10-01T13:00:00Z', outcome: 'failed', screenshot: 'missing.png' }));
  await f.write('scratch/runs/bad/result.json', '{');
  const s = await reader.snapshot();
  assert.equal(s.tasks.length, 2); assert.equal(s.activity[0].text.includes('PROGRESS'), true);
  assert.equal(s.candidates[0].latestRun.id, 'R-2'); assert.equal(s.candidates[0].lastVerifiedRun.id, 'R-1');
  assert.equal(s.candidates[0].fixtureStatus, 'present'); assert.equal(s.candidates[0].noteLinks.length, 1);
  assert.ok(s.warnings.some(w => w.includes('missing.png'))); assert.ok(s.warnings.some(w => w.includes('bad/result.json')));
  await f.write('TODOS.md', '## Current\n- [x] Done\n');
  assert.equal((await reader.snapshot()).tasks[0].status, 'done');
});

test('corpus assessments distinguish readiness from run outcome and flag newer evidence', async t => {
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const initial=await reader.snapshot(),r=initial.candidates[0].latestRun;
  await f.write('ops/corpus-status.json',JSON.stringify({reviewedAt:'2026-10-02T00:00:00Z',entries:[{id:'demo',status:'Startup only',summary:'Intro diagnostic only',next:'Verify gameplay',basedOnLatestRun:r.key,basedOnLatestStartedAt:r.startedAt}]}));
  const reviewed=(await reader.snapshot()).candidates[0];
  assert.equal(reviewed.assessment.status,'Startup only');
  assert.equal(reviewed.latestRun.outcome,r.outcome);
  assert.equal(reviewed.assessment.needsReview,false);
  await f.write('scratch/runs/new/result.json',JSON.stringify({candidateId:'demo',startedAt:'2026-10-03T00:00:00Z',outcome:'failed'}));
  assert.equal((await reader.snapshot()).candidates[0].assessment.needsReview,true);
});

test('FPS uses counted guest frames and wall duration, preserves zero, and rejects invalid samples', async t => {
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const result={candidateId:'demo',startedAt:'2026-10-03T00:00:00Z',outcome:'unknown',performance:{metric:'guest-presents',measuredAt:'2026-10-03T00:00:00Z',renderer:'WebGL / SwiftShader',scene:'gameplay',host:'fixture',historical:true,samples:[{frames:60,durationMs:1000},{frames:0,durationMs:2000}]}};
  const save=()=>f.write('scratch/runs/FPS/result.json',JSON.stringify(result));
  await save();assert.equal((await reader.snapshot()).candidates[0].performance.fps,20);
  result.performance.samples=[{frames:0,durationMs:1000}];await save();assert.equal((await reader.snapshot()).candidates[0].performance.fps,0);
  result.performance.samples[0].durationMs=0;await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);
  result.performance={fps:60};await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);
});

test('Flip-event performance preserves historical arithmetic and labels without certifying game FPS', async t => {
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const performance={metric:'guest-presents',counterKind:'guest-flip-events',measuredAt:'2026-10-03T00:00:00Z',
    renderer:'Legacy WebGL / SwiftShader',scene:'historical race',host:'fixture',historical:true,
    samples:[{frames:515,durationMs:15020.85498046875,p95FrameMs:54.219970703125},
      {frames:504,durationMs:15029.994873046875,p95FrameMs:55.195068359375}]};
  const save=()=>f.write('scratch/runs/FLIP/result.json',JSON.stringify({candidateId:'demo',startedAt:performance.measuredAt,outcome:'unknown',performance}));
  await save();let normalized=(await reader.snapshot()).candidates[0].performance;
  assert.equal(normalized.counterKind,'guest-flip-events');
  assert.equal(normalized.fps,1019*1000/(15020.85498046875+15029.994873046875));
  assert.deepEqual(normalized.samples.map(s=>s.p95FrameMs),[54.219970703125,55.195068359375]);
  // Execute only the actual pure HTML renderer, without DOM, timers or HTTP.
  const app=await fs.readFile(path.join(__dirname,'app.js'),'utf8');
  const renderSource=app.match(/function corpusFps\([\s\S]*?(?=\nfunction corpusView\()/)?.[0];
  assert(renderSource,'corpusFps renderer found');
  const render=require('node:vm').runInNewContext(renderSource+'\ncorpusFps',{
    escape:value=>String(value ?? ''),age:()=>'<1m',when:value=>value});
  const card=render({performance:normalized}),details=render({performance:normalized},true);
  assert.match(card,/33\.9 guest Flip events\/s/);assert.doesNotMatch(card,/33\.9 FPS/);
  assert.match(card,/Historical/);assert.match(card,/SwiftShader/);
  assert.match(details,/<th>guest Flip events\/s<\/th>/);assert.match(details,/<th>p95 Flip interval<\/th>/);
  assert.doesNotMatch(details,/p95 frame/);
  performance.samples=[{frames:300,durationMs:10044.909912109375,p95FrameMs:40.340087890625}];
  await save();normalized=(await reader.snapshot()).candidates[0].performance;
  assert.equal(normalized.fps,300*1000/10044.909912109375);
  assert.equal(normalized.samples[0].p95FrameMs,40.340087890625);
  assert.match(render({performance:normalized}),/29\.9 guest Flip events\/s/);
  performance.samples=[{frames:0,durationMs:1000}];await save();
  assert.equal((await reader.snapshot()).candidates[0].performance.fps,0);
  performance.counterKind='unproven-fps';await save();
  assert.equal((await reader.snapshot()).candidates[0].performance,null);
  delete performance.counterKind;await save();normalized=(await reader.snapshot()).candidates[0].performance;
  assert.doesNotMatch(render({performance:normalized}),/0\.0 FPS/);
  assert.equal(normalized.counterKind,undefined);assert.match(render({performance:normalized},true),/0\.0 guest presentation events\/s/);
  assert.match(render({performance:normalized},true),/<th>p95 presentation interval<\/th>/);
});

test('logical gameplay submissions require review receipts and retain a distinct display label', async t => {
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const performance={metric:'guest-logical-frame-submissions',counterKind:'guest-logical-frame-submissions',measuredAt:'2026-10-03T00:00:00Z',renderer:'instrumented GDI',scene:'active gameplay',host:'fixture',samples:[{frames:157,durationMs:5120.1,p95FrameMs:null},{frames:155,durationMs:5104.28,p95FrameMs:null}]};
  const save=()=>f.write('scratch/runs/LOGICAL/result.json',JSON.stringify({candidateId:'demo',startedAt:performance.measuredAt,outcome:'passed',performance}));
  await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);
  performance.qualification={accepted:true,sceneReview:'root',counterReview:'independent reviewer',evidence:'qualification.json'};
  await save();const normalized=(await reader.snapshot()).candidates[0].performance;
  assert.ok(Math.abs(normalized.fps-312000/10224.38)<1e-10);assert.equal(normalized.samples[0].p95FrameMs,null);
  const app=await fs.readFile(path.join(__dirname,'app.js'),'utf8');
  const source=app.match(/function corpusFps\([\s\S]*?(?=\nfunction corpusView\()/)[0];
  const render=require('node:vm').runInNewContext(source+'\ncorpusFps',{escape:String,age:()=>'<1m',when:String});
  assert.match(render({performance:normalized},true),/logical gameplay frames\/s/);
  assert.doesNotMatch(render({performance:normalized}),/30\.5 FPS/);
  for(const key of ['sceneReview','counterReview','evidence']){const old=performance.qualification[key];delete performance.qualification[key];await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);performance.qualification[key]=old;}
  performance.qualification.accepted='true';await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);
  performance.qualification.accepted=true;performance.counterKind='guest-flip-events';await save();assert.equal((await reader.snapshot()).candidates[0].performance,null);
});

test('session collection scopes to project, updates changed logs, and attaches explicit task ownership', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const file = 'codex/one.jsonl';
  const records = [{ type: 'session_meta', timestamp: '2026-10-01T12:00:00Z', payload: { id: 'one', cwd: f.root } }, { type: 'event_msg', timestamp: '2026-10-01T12:01:00Z', payload: { type: 'task_started' } }];
  await f.write(file, records.map(JSON.stringify).join('\n') + '\n');
  await f.write('codex/duplicate.jsonl', records.map(JSON.stringify).join('\n') + '\n');
  await f.write('codex/other.jsonl', JSON.stringify({ type: 'session_meta', payload: { cwd: '/unrelated', id: 'private' } }) + '\n');
  const reader = createReader({ root: f.root, codexRoot: path.join(f.root, 'codex'), claudeRoot: false, processes: false });
  const first = await reader.snapshot();
  assert.equal(first.agents.length, 1); assert.equal(first.agents[0].taskId, 'T-1'); assert.equal(first.agents[0].progressAt, '2026-10-01T12:05:00.000Z');
  await fs.appendFile(path.join(f.root, file), JSON.stringify({ type: 'event_msg', timestamp: '2026-10-01T12:02:00Z', payload: { type: 'task_complete' } }) + '\n');
  assert.equal((await reader.snapshot()).agents[0].state, 'idle');
});

test('forked Codex logs keep the first worker identity instead of inherited parent metadata',()=>{
  const root='/project';
  const session=parseSession('codex',[
    {type:'session_meta',payload:{id:'worker',session_id:'parent',cwd:root}},
    {type:'session_meta',payload:{id:'parent',cwd:root}},
  ],'/logs/worker.jsonl',false,root);
  assert.equal(session.id,'codex:worker');
});

test('gameplay images require an explicit reviewed allowlist and remain distinct from newer diagnostics', async t => {
  const f=await fixture();t.after(f.cleanup);
  const png=await fs.readFile(path.join(f.root,'scratch/runs/R-1/screen.png'));
  for(const name of ['menu.png','board.png','diagram.png']) await f.write('scratch/runs/R-1/'+name,png);
  const raw={candidateId:'demo',startedAt:'2026-10-01T12:00:00Z',outcome:'unknown',verification:'reviewed',route:'gameplay',screenshots:['menu.png','board.png'],diagrams:['diagram.png'],gameplaySceneReview:{reviewer:'scene reviewer'},gameplayScreenshots:['board.png','diagram.png','missing.png','../../../secret.png']};
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const save=()=>f.write('scratch/runs/R-1/result.json',JSON.stringify(raw));
  await save();let state=await reader.snapshot();
  assert.deepEqual(state.runs[0].gameplayScreenshots.map(x=>x.name),['board.png']);
  const app=await fs.readFile(path.join(__dirname,'app.js'),'utf8');
  const source=app.match(/function candidateCapture\([\s\S]*?(?=\nfunction corpusAssessment\()/)[0];
  const newer={candidateId:'demo',key:'newer',screenshots:[{name:'error.png'}],gameplayScreenshots:[]};
  state={runs:[newer,...state.runs]};
  const capture=require('node:vm').runInNewContext(source+'\ncandidateCapture',{state});
  const selected=capture({id:'demo',latestRun:newer});
  assert.equal(selected.shot.name,'board.png');assert.equal(selected.gameplay,true);assert.equal(selected.older,true);
  delete raw.gameplaySceneReview;await save();assert.equal((await reader.snapshot()).runs[0].gameplayScreenshots.length,0);
  raw.gameplaySceneReview={reviewer:'reviewer'};raw.verification='unreviewed';await save();assert.equal((await reader.snapshot()).runs[0].gameplayScreenshots.length,0);
  raw.verification='reviewed';raw.gameplayScreenshots=[];await save();assert.equal((await reader.snapshot()).runs[0].gameplayScreenshots.length,0,'route text cannot promote a menu');
});

test('visuals preserve explicit session attribution and keep diagrams out of candidate screenshots', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const png = await fs.readFile(path.join(f.root, 'scratch/runs/R-1/screen.png'));
  await f.write('scratch/runs/R-1/flow.png', png);
  await f.write('scratch/runs/R-1/result.json', JSON.stringify({ candidateId: 'demo', agentId: 'claude:agent-child', startedAt: '2026-10-01T12:00:00Z', outcome: 'unknown', screenshot: 'screen.png', diagrams: ['flow.png', '../../../secret.png', 'missing.png'] }));
  await f.write('secret.png', png);
  const reader = createReader({ root: f.root, codexRoot: false, claudeRoot: false });
  const s = await reader.snapshot();
  const r = s.runs[0];
  assert.equal(r.agentId, 'claude:agent-child');
  assert.deepEqual(r.visuals.map(v => [v.name, v.kind]), [['screen.png', 'screenshot'], ['flow.png', 'diagram']]);
  assert.deepEqual(r.screenshots.map(v => v.name), ['screen.png']);
  assert.equal(s.candidates[0].latestRun.screenshots[0].name, 'screen.png');
  assert.ok(s.warnings.some(w => w.includes('secret.png')));
  assert.ok(s.warnings.some(w => w.includes('missing.png')));
  assert.ok(await reader.artifact('scratch/runs/R-1/flow.png'));
  assert.equal(await reader.artifact('scratch/runs/R-1/../../../secret.png'), null);
});

test('HTTP is read-only, origin-checked, and serves only allowlisted files and contained artifacts', async t => {
  const f = await fixture(); t.after(f.cleanup);
  await f.write('secret.txt', 'not a served source');
  await fs.symlink(path.join(f.root, 'secret.txt'), path.join(f.root, 'scratch/runs/R-1/leak.log'));
  await f.write('scratch/runs/R-2/result.json', JSON.stringify({ candidateId: 'demo', startedAt: '2026-10-01T13:00:00Z', outcome: 'failed', artifacts: ['../../../secret.txt', '../R-1/leak.log'] }));
  const server = createServer({ root: f.root, codexRoot: false, claudeRoot: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (route, options) => fetch(base + route, options);
  assert.equal((await get('/')).status, 200);
  const state = await (await get('/api/state')).json();
  assert.equal(state.runs.find(r => r.id === 'R-2').artifacts.length, 1);
  const shot = state.runs.find(r => r.id === 'R-1').screenshots[0];
  assert.equal((await get(shot.url)).headers.get('content-type'), 'image/png');
  assert.equal((await get('/api/state', { method: 'POST' })).status, 405);
  assert.equal((await get('/api/state', { headers: { Origin: 'http://evil.invalid' } })).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    http.get(base + '/api/state', { headers: { Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
  for (const route of ['/source?path=secret.txt', '/source?path=../../secret.txt', '/artifact?key=secret.txt', '/readers.js']) assert.equal((await get(route)).status, 404);
  assert.equal((await get('/source?path=TODOS.md')).headers.get('content-type'), 'text/plain; charset=utf-8');
});

test('blocker replies append one line, require same origin and a stable blocked task, and never unblock', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const todo = '- [!] Fix startup\n  id: B-1\n  owner: codex:one\n  blocker: Missing test fixture\n  needs: Copy the original installer\n  waiting-on: maintainer\n  blocked-since: 2026-10-01T12:00:00Z\n';
  await f.write('TODOS.md', todo);
  await f.write('messageboard.txt', 'keep this exact prefix');
  const server = createServer({ root: f.root, codexRoot: false, claudeRoot: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (value, origin = base) => fetch(base + '/api/blocker-reply', {method:'POST', headers:{'Content-Type':'application/json', ...(origin ? {Origin:origin} : {})}, body:JSON.stringify(value)});
  assert.equal((await post({taskId:'B-1',message:'ok'}, null)).status,403);
  assert.equal((await post({taskId:'B-1',message:'ok'}, 'http://evil.invalid')).status,403);
  assert.equal((await post({taskId:'B-1',message:''})).status,400);
  assert.equal((await post({taskId:'B-1',message:'x'.repeat(9000)})).status,413);
  assert.equal((await post({taskId:'missing',message:'ok'})).status,409);
  const response = await post({taskId:'B-1',message:'Use fixture A.\nThen verify <script>.'});
  assert.equal(response.status,201);
  const board = await fs.readFile(path.join(f.root,'messageboard.txt'),'utf8');
  assert.match(board,/^keep this exact prefix\n\S+ dashboard-user \[OPS-REPLY B-1\] Use fixture A\. Then verify <script>\.\n$/);
  assert.equal(await fs.readFile(path.join(f.root,'TODOS.md'),'utf8'),todo);
  const state = await (await fetch(base+'/api/state')).json();
  assert.equal(state.tasks[0].status,'blocked');
  assert.equal(state.tasks[0].needs,'Copy the original installer');
  assert.equal(state.tasks[0].replies.length,1);
  // TCP chunks may split a multibyte character; the stored reply must retain it.
  const unicodeReply = 'Use café 日本語 😀';
  const bytes = Buffer.from(JSON.stringify({taskId:'B-1',message:unicodeReply}));
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  const unicodeStatus = await new Promise((resolve, reject) => {
    const request = http.request(base + '/api/blocker-reply', {method:'POST', headers:{'Content-Type':'application/json', Origin:base}}, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.write(bytes.subarray(0, split));
    setTimeout(() => request.end(bytes.subarray(split)), 25);
  });
  assert.equal(unicodeStatus,201);
  const unicodeBoard = await fs.readFile(path.join(f.root,'messageboard.txt'),'utf8');
  assert.ok(unicodeBoard.startsWith(board));
  assert.ok(unicodeBoard.endsWith(`[OPS-REPLY B-1] ${unicodeReply}\n`));
  await f.write('TODOS.md',todo.replace('[!]','[~]'));
  assert.equal((await post({taskId:'B-1',message:'stale'})).status,409);
  assert.equal(await fs.readFile(path.join(f.root,'messageboard.txt'),'utf8'),unicodeBoard);
});

module.exports = { fixture };

test('agent TLDR uses explicit review metadata, refreshes from disk and bounds file reads',async t=>{
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  assert.equal((await reader.snapshot()).projectStatus.available,false);
  await f.write('ops/STATUS.md','updated: 2026-10-01T12:00:00Z\nauthor: codex:one\n\n# Startup verified\n\n## Needs attention\n- Gameplay unknown.\n');
  let snapshot=await reader.snapshot();
  assert.equal(snapshot.projectStatus.author,'codex:one');
  assert.equal(snapshot.projectStatus.updatedAt,'2026-10-01T12:00:00.000Z');
  assert.match(snapshot.projectStatus.body,/^# Startup verified/);
  await f.write('ops/STATUS.md','# Changed without review timestamp\n\n<script>inert</script>');
  snapshot=await reader.snapshot();
  assert.equal(snapshot.projectStatus.updatedAt,null);
  assert.match(snapshot.projectStatus.body,/Changed without review/);
  await f.write('ops/STATUS.md','x'.repeat(17000));
  snapshot=await reader.snapshot();
  assert.equal(snapshot.projectStatus.available,false);
  assert.ok(snapshot.warnings.some(w=>w.startsWith('ops/STATUS.md:')));
});

test('task writes preserve source, reject stale/conflicting changes, and deduplicate retries',async t=>{
  const f=await fixture();t.after(f.cleanup);
  const {createTaskStore,revision}=require('./task-store');
  const store=createTaskStore(f.root),uuid=()=>require('node:crypto').randomUUID();
  const file=path.join(f.root,'TODOS.md'),read=()=>fs.readFile(file,'utf8');
  const original=await read();
  const input={action:'create',requestId:uuid(),revision:revision(original),fields:{title:'Literal $& <task> id: fake',done:'Race starts and input works',candidates:['demo'],dependencies:['T-1'],status:'ready'}};
  const result=await store.mutate(input),created=await read();
  assert.ok(created.startsWith(original));
  assert.equal(parseTasks(created).find(t=>t.id===result.taskId).title,input.fields.title);
  assert.equal(parseTasks(created).find(t=>t.id===result.taskId).owner,null);
  assert.equal((await store.mutate(input)).replayed,true);assert.equal(await read(),created);
  await assert.rejects(store.mutate({...input,requestId:uuid()}),e=>e.status===409);
  const block=parseTasks(created).find(t=>t.id==='T-1');
  const edit={action:'edit',taskId:'T-1',requestId:uuid(),revision:revision(created),fields:{title:'Changed',done:'Pass checks',candidates:['demo'],dependencies:[],notes:'Keep <markup> inert'}};
  await store.mutate(edit);
  const updated=await read(),changed=parseTasks(updated).find(t=>t.id==='T-1');
  assert.equal(changed.owner,block.owner);assert.equal(changed.startedAt,block.startedAt);assert.equal(changed.status,block.status);
  assert.ok(updated.includes('## Legacy investigation\nHistorical prose; no current status.'));
  await fs.mkdir(path.join(f.root,'scratch/ops-task-write.lock'));
  await assert.rejects(store.mutate({...edit,requestId:uuid(),revision:revision(updated)}),e=>e.status===409);
  await fs.rmdir(path.join(f.root,'scratch/ops-task-write.lock'));
  const before=await read();
  await assert.rejects(store.mutate({...edit,requestId:uuid(),revision:revision(before),fields:{...edit.fields,dependencies:[result.taskId]}}),e=>e.status===400);
  await assert.rejects(store.mutate({...edit,requestId:uuid(),revision:revision(before),fields:{...edit.fields,title:'bad\n- [x] injected'}}),e=>e.status===400);
  assert.equal(await read(),before);
});

test('task queue reorder and status preserve unrelated content, CRLF and fenced examples',async t=>{
  const f=await fixture();t.after(f.cleanup);
  const {createTaskStore,revision}=require('./task-store');const store=createTaskStore(f.root);
  const original='## Queue\r\n- [ ] Alpha\r\n  id: A\r\n  owner: codex:one\r\n  Custom: preserve me\r\n  ```md\r\n  done: example only\r\n  - [ ] sample\r\n  ```\r\n\r\n- [ ] Beta\r\n  id: B\r\n\r\n## Legacy\r\nKeep exactly.\r\n';
  await f.write('TODOS.md',original);const read=()=>fs.readFile(path.join(f.root,'TODOS.md'),'utf8');
  const request={action:'move',taskId:'B',direction:'up',requestId:require('node:crypto').randomUUID(),revision:revision(original)};
  await store.mutate(request);const reordered=await read();
  assert.deepEqual(parseTasks(reordered).filter(t=>t.kind==='checkbox').map(t=>t.id),['B','A']);
  assert.ok(reordered.includes('  Custom: preserve me\r\n  ```md\r\n  done: example only\r\n  - [ ] sample\r\n  ```'));
  assert.ok(reordered.endsWith('## Legacy\r\nKeep exactly.\r\n'));
  assert.equal(reordered.replace(/\r\n/g,'').includes('\n'),false);
  await store.mutate(request);assert.equal(await read(),reordered);
  await store.mutate({action:'status',taskId:'A',status:'deferred',requestId:require('node:crypto').randomUUID(),revision:revision(reordered)});
  assert.equal(parseTasks(await read()).find(t=>t.id==='A').status,'deferred');
  assert.equal(parseTasks(await read()).find(t=>t.id==='A').owner,'codex:one');
});

test('task APIs require same origin, retain discussion beyond activity window and surface explicit pickup',async t=>{
  const f=await fixture();t.after(f.cleanup);
  const server=createServer({root:f.root,codexRoot:false,claudeRoot:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(route,input,origin=base)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(input)});
  const state=await(await fetch(base+'/api/state')).json();
  const input={action:'create',requestId:require('node:crypto').randomUUID(),revision:state.todoRevision,fields:{title:'New request',done:'Verified result',candidates:[],dependencies:[],status:'ready'}};
  assert.equal((await post('/api/tasks',input,null)).status,403);
  assert.equal((await post('/api/tasks',input,'http://evil.invalid')).status,403);
  const result=await post('/api/tasks',input);assert.equal(result.status,201);const {taskId}=await result.json();
  const note={taskId,requestId:require('node:crypto').randomUUID(),message:'Please verify café 日本語 <script>.'};
  assert.equal((await post('/api/task-note',note)).status,201);
  assert.equal((await post('/api/task-note',note)).status,201);
  const board=await fs.readFile(path.join(f.root,'messageboard.txt'),'utf8');
  assert.equal(board.split('[OPS-NOTE ').length,2);
  await fs.appendFile(path.join(f.root,'messageboard.txt'),Array.from({length:160},(_,i)=>`2026-10-01 agent unrelated ${i}\n`).join(''));
  let snapshot=await createReader({root:f.root,codexRoot:false,claudeRoot:false}).snapshot();
  assert.equal(snapshot.tasks.find(t=>t.id===taskId).pickup,'awaiting');
  assert.equal(snapshot.tasks.find(t=>t.id===taskId).discussion.filter(d=>d.kind==='NOTE').length,1);
  await fs.appendFile(path.join(f.root,'TODOS.md'),'  accepted: 2026-10-01T12:00:00Z\n  accepted-by: codex:coordinator\n');
  snapshot=await createReader({root:f.root,codexRoot:false,claudeRoot:false}).snapshot();
  assert.equal(snapshot.tasks.find(t=>t.id===taskId).pickup,'accepted');
  assert.equal(snapshot.tasks.find(t=>t.id===taskId).status,'ready');
});

test('selected window presentations retain explicit scope and reject invalid qualification or visibility', async t => {
  const f=await fixture();t.after(f.cleanup);
  const reader=createReader({root:f.root,codexRoot:false,claudeRoot:false});
  const performance={metric:'selected-window-presentations',counterKind:'selected-window-presentations',measuredAt:'2026-10-05T15:51:14Z',renderer:'normal CanvasSurface GDI',scene:'Dredmor Level1',host:'fixture',physicalFps:null,visibility:{client:{x:0,y:10,w:1024,h:758},fraction:758/768},qualification:{accepted:true,sceneReview:'root image review',counterReview:'root source/raw review',evidence:'receipt.json'},samples:[{frames:67,durationMs:5003.51}]};
  const save=()=>f.write('scratch/runs/WINDOW/result.json',JSON.stringify({candidateId:'demo',startedAt:performance.measuredAt,outcome:'passed',performance}));
  await save();let p=(await reader.snapshot()).candidates[0].performance;
  assert.equal(p.fps,67000/5003.51);assert.equal(p.physicalFps,null);assert.deepEqual(p.visibility,performance.visibility);
  const app=await fs.readFile(path.join(__dirname,'app.js'),'utf8');
  const src=app.match(/function corpusFps\([\s\S]*?(?=\nfunction corpusView\()/)[0];
  const render=require('node:vm').runInNewContext(src+'\ncorpusFps',{escape:String,age:()=>'<1m',when:String});
  assert.match(render({performance:p},true),/13\.4 window presentations\/s \(coalesced GDI\)/);
  assert.match(render({performance:p},true),/98\.70% visible/);assert.match(render({performance:p},true),/Physical-display FPS not measured/);
  assert.equal(require('./release-model').rateLabels(p).rate,'window presentations/s (coalesced GDI)');
  for(const [target,key,value] of [[performance,'physicalFps',60],[performance.qualification,'accepted',false],[performance.qualification,'counterReview',''],[performance.visibility,'fraction',0],[performance.visibility,'fraction',1.1],[performance.visibility.client,'w',0],[performance.visibility.client,'x',null]]){
    const prior=target[key];target[key]=value;await save();assert.equal((await reader.snapshot()).candidates[0].performance,null,key);target[key]=prior;
  }
});

test('corpus search matches identity fields and splits games from apps', async () => {
  const app=await fs.readFile(path.join(__dirname,'app.js'),'utf8');
  const source=app.match(/const nonGameCategories=[\s\S]*?(?=\nfunction corpusFps\()/)[0];
  const {matchesCorpusSearch,corpusKind}=require('node:vm').runInNewContext(source+'\n({matchesCorpusSearch,corpusKind})',{corpusQuery:'',corpusType:'all'});
  const myth={id:'myth-demo',name:'Myth: The Fallen Lords',category:{id:'strategy',label:'Strategy / tactics'},executables:['MYTH.EXE'],notes:'mentions notepad'};
  const pad={id:'notepad',name:'Notepad',category:{id:'tools',label:'Applications / tools'},releaseReadiness:{scope:'non-game'}};
  const scoped={id:'x',name:'X',category:{id:'unclassified'},releaseReadiness:{scope:'game'}};
  assert.equal(corpusKind(myth),'games');assert.equal(corpusKind(pad),'apps');assert.equal(corpusKind(scoped),'games');
  assert.ok(matchesCorpusSearch(myth,'fallen MYTH','all'));
  assert.ok(matchesCorpusSearch(myth,'myth.exe','games'));
  assert.ok(!matchesCorpusSearch(myth,'notepad','all'),'notes are not searched');
  assert.ok(!matchesCorpusSearch(myth,'','apps'));
  assert.ok(matchesCorpusSearch(pad,'','apps'));
});

test('the private emulator can serve a checkout other than the dashboard root', () => {
  const a=createReader({root:'/tmp/dash-root',codexRoot:false,claudeRoot:false});
  assert.equal(a.emulatorRoot,'/tmp/dash-root');
  const b=createReader({root:'/tmp/dash-root',emulatorRoot:'/tmp/web-root',codexRoot:false,claudeRoot:false});
  assert.equal(b.root,'/tmp/dash-root');assert.equal(b.emulatorRoot,'/tmp/web-root');
});

test('a Claude /goal is read from its set command and its latest Stop-hook status', () => {
  const root = '/project', at = s => `2026-10-06T00:${s}:00Z`;
  const set = {type:'user', cwd:root, sessionId:'w', timestamp:at('10'), message:{role:'user', content:'<local-command-stdout>Goal set: Finish the Myth lane with evidence</local-command-stdout>'}};
  const status = met => ({type:'attachment', cwd:root, sessionId:'w', timestamp:at('20'), attachment:{type:'goal_status', met, condition:'Finish the Myth lane with evidence'}});
  assert.equal(parseSession('claude', [set], '/logs/w.jsonl', false, root).goal.met, false);
  assert.equal(parseSession('claude', [set], '/logs/w.jsonl', false, root).goal.condition, 'Finish the Myth lane with evidence');
  assert.equal(parseSession('claude', [set, status(true)], '/logs/w.jsonl', false, root).goal.met, true);
  const cleared = {...set, timestamp:at('30'), message:{role:'user', content:'<local-command-stdout>Goal cleared</local-command-stdout>'}};
  assert.equal(parseSession('claude', [set, cleared], '/logs/w.jsonl', false, root).goal, null);
  const plain = {type:'assistant', cwd:root, sessionId:'w', timestamp:at('40'), message:{content:[{type:'text',text:'hi'}],stop_reason:'end_turn'}};
  assert.equal(parseSession('claude', [plain], '/logs/w.jsonl', false, root).goal, null);
});

test('a goal record older than the 1 MiB tail window is found by the backward scan', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wine-goal-'));
  const file = path.join(dir, 'w.jsonl');
  const goal = (met, condition) => JSON.stringify({type:'attachment', timestamp:'2026-10-06T00:10:00Z', attachment:{type:'goal_status', met, condition}});
  const image = JSON.stringify({type:'user', message:{content:[{type:'tool_result', content:[{type:'image', data:'A'.repeat(900 * 1024)}]}]}});
  await fs.writeFile(file, [goal(false, 'old goal'), image, goal(false, 'Keep every worker busy'), image, image, ''].join('\n'));
  const size = (await fs.stat(file)).size;
  assert.ok(size > 2 * 1024 * 1024);
  const found = await scanGoal(file, size, 0);
  assert.equal(found.condition, 'Keep every worker busy');
  assert.equal(found.met, false);
  assert.equal(await scanGoal(file, size, size - 1024), undefined, 'a range without goal records says nothing');
  await fs.rm(dir, {recursive: true});
});

test('/api/state is gzipped, answers If-None-Match with 304 and omits big parts the client already holds', async t => {
  const f = await fixture(); t.after(f.cleanup);
  await f.write('TODOS.md', Array.from({length: 40}, (_, i) => `- [ ] Task number ${i} with enough words to make this part large\n  id: T-${i}\n`).join(''));
  const server = createServer({ root: f.root, codexRoot: false, claudeRoot: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const get = (query, headers = {}) => new Promise((resolve, reject) => http.get(`http://127.0.0.1:${server.address().port}/api/state${query}`, {headers}, r => {
    const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => resolve({r, body: Buffer.concat(chunks)}));
  }).on('error', reject));
  const first = await get('', {'Accept-Encoding': 'gzip'});
  assert.equal(first.r.statusCode, 200);
  assert.equal(first.r.headers['content-encoding'], 'gzip');
  const full = JSON.parse(require('node:zlib').gunzipSync(first.body));
  assert.equal(full.tasks.length, 40);
  const etag = first.r.headers.etag, parts = first.r.headers['x-state-parts'];
  assert.ok(etag);
  assert.match(parts, /(^|,)tasks\.[\w-]{12}(,|$)/);
  assert.equal((await get('', {'If-None-Match': etag})).r.statusCode, 304);
  const delta = JSON.parse((await get('?known=' + encodeURIComponent(parts))).body);
  assert.ok(delta._unchanged.includes('tasks'));
  assert.equal(delta.tasks, undefined);
  assert.ok('terminals' in delta && 'approvals' in delta, 'live parts are always sent');
  const plain = await get('');
  assert.equal(plain.r.headers['content-encoding'], undefined, 'no gzip unless the client accepts it');
  assert.equal(JSON.parse(plain.body).tasks.length, 40);
});
