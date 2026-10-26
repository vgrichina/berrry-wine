'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('./blocker-model');
const task = (id, line, extra = {}) => ({id, line, status:'blocked', ...extra});

test('dependency identities are exact, blocked-only, and self excluded', () => {
  const a = task('ROOT', 1), done = task('DONE', 2, {status:'done'});
  const child = task('CHILD', 3, {dependencies:['DONE', 'CHILD'], waitingOn:'Wait ROOT; ROOT-other'});
  const snapshot = {tasks:[a, done, child]};
  assert.deepEqual(model.dependencies(snapshot,child),[a]);
  assert.deepEqual(model.kind(snapshot,child),['Dependency','neutral','View dependency']);
  const summary = model.blockerSummary(snapshot);
  assert.deepEqual(summary.roots,[a]); assert.equal(summary.dependentCount,1);
  assert.deepEqual(summary.blocked,[a,child]);
});

test('review blockers sort last, capacity classification and unsent approval order match web', () => {
  const review = task('REVIEW',1,{blocker:'automated safety review'});
  const plain = task('PLAIN',9);
  const capacity = task('CPU',4,{needs:'CPU host capacity'});
  const snapshot = {tasks:[review,plain,capacity], approvals:{items:[{id:'a',sent:false},{id:'b',sent:true},{id:'c'}]}};
  const summary = model.blockerSummary(snapshot);
  assert.deepEqual(summary.roots.map(t=>t.id),['CPU','PLAIN','REVIEW']);
  assert.deepEqual(summary.blocked,summary.roots);
  assert.deepEqual(summary.approvals.map(p=>p.id),['a','c']);
  assert.equal(model.kind(snapshot,capacity)[0],'Capacity needed');
  assert.deepEqual(snapshot.tasks,[review,plain,capacity]);
});

test('all-cycle fallback and filtered roots preserve dashboard behavior', () => {
  const a = task('A',2,{dependencies:['B']}), b = task('B',1,{dependencies:['A']});
  const snapshot = {tasks:[a,b]};
  assert.deepEqual(model.blockerSummary(snapshot).roots,[b,a]);
  assert.equal(model.blockerSummary(snapshot).dependentCount,0);
  assert.deepEqual(model.primaryRoots(snapshot,[a]),[a]);
  const root = task('INDEPENDENT',3);
  snapshot.tasks.push(root);
  // Existing UI lists primary roots if any; it does not invent a cycle root.
  assert.deepEqual(model.blockerSummary(snapshot).roots,[root]);
  assert.equal(model.blockerSummary(snapshot).dependentCount,2);
});

test('browser and CommonJS expose identical model and HTML loads it first', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./blocker-model'),'utf8'),ctx);
  const snapshot = {tasks:[task('R',1),task('D',2,{waitingOn:'R'})]};
  assert.equal(JSON.stringify(ctx.BlockerModel.blockerSummary(snapshot)),JSON.stringify(model.blockerSummary(snapshot)));
  assert.deepEqual(model.blockerSummary({}),{blocked:[],roots:[],dependentCount:0,approvals:[],needsUser:[],agentResolvable:[],
    counts:{distinctBlockedTaskIds:0,rawBlockedRows:0,duplicateBlockedRows:0,anonymousBlockedRows:0},repeatedIds:[]});
  const html = fs.readFileSync(require.resolve('./index.html'),'utf8');
  assert(html.indexOf('/blocker-model.js') < html.indexOf('/app.js'));
});

test('exact duplicate records count once by ID; anonymous records stay separate without mutation', () => {
  const original = task('SAME', 1, {blocker:'recorded blocker'});
  const snapshot = {tasks:[original, {...original}, task(undefined, 3), task('',4), task(null,5), task('  ',6), task('same',7)]};
  const before = JSON.stringify(snapshot);
  const summary = model.blockerSummary(snapshot);
  assert.deepEqual(summary.counts, {distinctBlockedTaskIds:2,rawBlockedRows:7,duplicateBlockedRows:1,anonymousBlockedRows:4});
  assert.equal(summary.blocked.length,7);
  assert.equal(summary.roots.length,7);
  assert.equal(summary.repeatedIds.length,1);
  assert.deepEqual(summary.repeatedIds[0].conflictingFields,[]);
  assert.equal(summary.repeatedIds[0].rows[0],original);
  assert.match(model.repeatedIdNotes(summary.repeatedIds)[0],/repeated records/);
  assert.equal(JSON.stringify(snapshot),before);
});

test('conflicting blocked and nonblocked rows expose statuses, reasons and ownership without selecting a winner', () => {
  const a = task('CONFLICT',1,{blocker:'denied automated review',waitingOn:'automated review resolution',owner:'first'});
  const b = task('CONFLICT',2,{blocker:'host unavailable',needs:'CPU capacity',owner:'second'});
  const done = task('CONFLICT',3,{status:'done',blocker:'owner reports fixed',next:'verify evidence'});
  const snapshot = {tasks:[a,b,done,task('DONE',4,{status:'done'})]};
  const summary = model.blockerSummary(snapshot);
  assert.deepEqual(summary.counts,{distinctBlockedTaskIds:1,rawBlockedRows:2,duplicateBlockedRows:1,anonymousBlockedRows:0});
  assert.deepEqual(summary.repeatedIds[0].rows,[a,b,done]);
  assert(summary.repeatedIds[0].conflictingFields.includes('status'));
  assert(summary.repeatedIds[0].conflictingFields.includes('blocker'));
  assert(summary.repeatedIds[0].conflictingFields.includes('owner'));
  assert.deepEqual(summary.needsUser,[b,a]);
  assert.equal(model.actor(snapshot,a)[0],'user');
  const note = model.repeatedIdNotes(summary.repeatedIds).join('\n');
  for (const text of ['AMBIGUOUS','denied automated review','host unavailable','owner reports fixed','status: "done"','verify evidence']) assert(note.includes(text),text);
});

test('dependency duplicates and status conflicts do not change blocked graph or all-cycle fallback', () => {
  const root=task('ROOT',1), child=task('CHILD',2,{dependencies:['ROOT']});
  const summary=model.blockerSummary({tasks:[root,{...root,line:3},child,{...child,line:4},{...root,status:'done',line:5}]});
  assert.deepEqual(summary.counts,{distinctBlockedTaskIds:2,rawBlockedRows:4,duplicateBlockedRows:2,anonymousBlockedRows:0});
  assert.equal(summary.roots.length,2);
  assert.equal(summary.dependentCount,2);
  assert.equal(summary.repeatedIds.length,2);
  assert.deepEqual(model.dependencies({tasks:[root,child]},child),[root]);
  const cycle={tasks:[task('A',1,{dependencies:['B']}),task('B',2,{dependencies:['A']}),task('A',3,{dependencies:['B']})]};
  assert.equal(model.blockerSummary(cycle).roots.length,3);
  assert.equal(model.blockerSummary(cycle).counts.distinctBlockedTaskIds,2);
});

test('a blocked/done ID remains blocked evidence and classification never grants editing or retry permission', () => {
  const denied=task('REVIEW',1,{waitingOn:'automated review resolution',blocker:'automated review denied',editable:false,replyAllowed:false});
  const agent=task('REVIEW',2,{waitingOn:'coordinator evidence review; no user decision',editable:false,replyAllowed:false});
  const done=task('REVIEW',3,{status:'done',editable:false,replyAllowed:false});
  const snapshot={tasks:[denied,agent,done],agents:[],terminals:[]};
  const summary=model.blockerSummary(snapshot);
  assert.deepEqual(summary.needsUser,[denied]);
  assert.deepEqual(summary.agentResolvable,[agent]);
  const onlyOneBlocked=model.blockerSummary({tasks:[denied,done]});
  assert.deepEqual(onlyOneBlocked.counts,{distinctBlockedTaskIds:1,rawBlockedRows:1,duplicateBlockedRows:0,anonymousBlockedRows:0});
  assert.deepEqual(onlyOneBlocked.repeatedIds[0].conflictingFields,['status','blocker','waitingOn']);
  const ctx=require('./test-app-vm').browserApp(snapshot);
  assert.equal(vm.runInContext('taskControls(state.tasks[0])',ctx),'');
  assert.equal(vm.runInContext('taskControls(state.tasks[1])',ctx),'');
  for(const row of snapshot.tasks) {
    assert.equal(row.editable,false);
    assert.equal(row.replyAllowed,false);
  }
  assert.match(model.repeatedIdNotes(summary.repeatedIds)[0],/automated review denied/);
});

test('browser, CommonJS, dashboard heading and Telegram share counts and conflict evidence', () => {
  const snapshot={tasks:[task('DUP',1,{title:'<script>bad</script>',blocker:'automated review denied'}),
    task('DUP',2,{status:'done',blocker:'different reason'}),task('DUP',3,{blocker:'third reason'}),
    task(undefined,4),task('',5),task('DEPENDENT',6,{dependencies:['DUP']})],agents:[],terminals:[],approvals:{items:[]}};
  const before=JSON.stringify(snapshot);
  const {browserApp}=require('./test-app-vm');
  const ctx=browserApp(snapshot);
  const summary=model.blockerSummary(snapshot);
  assert.equal(JSON.stringify(ctx.BlockerModel.blockerSummary(snapshot)),JSON.stringify(summary));
  const heading='2 distinct blocked task IDs · 5 blocked rows · 1 duplicate-ID blocked rows · 2 anonymous blocked rows (counted separately)';
  assert.equal(model.countSummaryText(summary.counts),heading);
  const html=vm.runInContext('blockersView()',ctx);
  const text=require('./telegram-blockers').blockersText(snapshot);
  for(const output of [html,text]) {
    assert(output.includes(heading));
    assert(output.includes('AMBIGUOUS'));
    assert(output.includes('different reason'));
    assert(output.includes('third reason'));
    assert(output.includes('No dashboard override.'));
    assert(output.includes('not current eligibility'));
  }
  assert(!html.includes('<script>bad</script>'));
  assert(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert(text.includes('status: "done"'));
  // Even a filtered dashboard heading describes the whole snapshot; rows are
  // explicitly labelled filtered. Conflicts never disappear behind a search.
  vm.runInContext('query = "no-fixture-matches-this-query"',ctx);
  const filtered=vm.runInContext('blockersView()',ctx);
  assert(filtered.includes(heading));
  assert(filtered.includes('different reason'));
  assert.equal(JSON.stringify(snapshot),before);
});

test('user vs agent split uses recorded fields only and is shared by web and Telegram', () => {
  const t = {
    user: task('USER', 1, {waitingOn:'user decision on shortcuts', blocker:'Keep installer icons?'}),
    review: task('REVIEW', 2, {waitingOn:'automated review resolution', blocker:'Worker stopped by automated review'}),
    capacity: task('CPU', 3, {needs:'GPU host time'}),
    noUser: task('NOUSER', 4, {waitingOn:'coordinator source/evidence review; no user decision'}),
    root: task('ROOT', 5, {waitingOn:'root'}),
    silent: task('SILENT', 6),
    dep: task('DEP', 7, {dependencies:['USER']}),
  };
  const snapshot = {tasks:Object.values(t)};
  assert.deepEqual(Object.fromEntries(Object.entries(t).map(([k,v])=>[k,model.actor(snapshot,v)[0]])),
    {user:'user',review:'user',capacity:'user',noUser:'agent',root:'agent',silent:'agent',dep:'agent'});
  assert.match(model.actor(snapshot,t.silent)[1],/No waitingOn recorded/);
  assert.match(model.actor(snapshot,t.noUser)[1],/no user decision/);
  const summary = model.blockerSummary(snapshot);
  assert.deepEqual(summary.needsUser.map(x=>x.id),['USER','CPU','REVIEW']);
  assert.deepEqual(summary.agentResolvable.map(x=>x.id),['NOUSER','ROOT','SILENT']);
  assert.equal(summary.roots.length, summary.needsUser.length + summary.agentResolvable.length);
  // Parity: the web Blockers view and Telegram /blockers list the same tasks in the same groups and order.
  const {browserApp} = require('./test-app-vm');
  const ctx = browserApp({...snapshot, agents:[], terminals:[], approvals:{items:[]}, candidates:[], runs:[], warnings:[]});
  const html = vm.runInContext('blockersView()', ctx);
  const [userHtml, agentHtml] = html.split('Agent-resolvable</h2>');
  const ids = part => [...part.matchAll(/<article class="blocker panel"><div class="blocker-heading"><button data-task="([^"]+)"/g)].map(m=>m[1]);
  const text = require('./telegram-blockers').blockersText(snapshot);
  const [userText, agentText] = text.split('AGENT-RESOLVABLE');
  // Untitled fixture tasks render their Telegram title line as " [ID]".
  const tids = part => [...part.matchAll(/^ ?\[([A-Z]+)\]$/gm)].map(m=>m[1]);
  assert.deepEqual(ids(userHtml), ['USER','CPU','REVIEW']);
  assert.deepEqual(ids(agentHtml), ['NOUSER','ROOT','SILENT']);
  assert.deepEqual(tids(userText), ids(userHtml));
  assert.deepEqual(tids(agentText), ids(agentHtml));
  assert.match(text, /3 need your input · 3 agent-resolvable/);
  assert.match(html, /3 need your input · 3 agent-resolvable/);
});
