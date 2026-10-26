'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const repo=process.argv[2],m=require(repo+'/ops/blocker-model'),{browserApp}=require(repo+'/ops/test-app-vm'),{blockersText}=require(repo+'/ops/telegram-blockers');
const base={tasks:[],agents:[],terminals:[],approvals:{items:[]}};
const row=(id,status='blocked',extra={})=>({id,status,line:1,title:'fixture',...extra});
const fixture=[row('__proto__'),row('__proto__','done',{blocker:'fixed claim'}),row('__proto__','blocked',{blocker:'automated review denied',waitingOn:'automated review resolution',editable:false,replyAllowed:false}),row('constructor'),row(' A '),row('A'),row('a'),row(''),row(' '),row(null),row(undefined),row('CHILD','blocked',{dependencies:['__proto__','A']}),row('A','done',{dependencies:['constructor']})];
function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;}
let permutations=0;
for(let k=0;k<fixture.length;k++)for(const reverse of [false,true]){
 let tasks=fixture.slice(k).concat(fixture.slice(0,k));if(reverse)tasks.reverse();
 const s=freeze({...base,tasks}),before=JSON.stringify(s),summary=m.blockerSummary(s);
 const blocked=tasks.filter(r=>r.status==='blocked'),ids=[];let anon=0;
 for(const r of blocked){if(r.id==null||String(r.id).trim()===''){anon++;continue;}if(!ids.some(id=>id===r.id))ids.push(r.id);}
 assert.deepEqual(summary.counts,{distinctBlockedTaskIds:ids.length,rawBlockedRows:blocked.length,duplicateBlockedRows:blocked.length-anon-ids.length,anonymousBlockedRows:anon});
 assert.equal(summary.blocked.length,blocked.length);assert(blocked.every(r=>summary.blocked.includes(r)));
 assert.equal(summary.roots.length+summary.dependentCount,blocked.length);
 for(const group of summary.repeatedIds){assert.deepEqual(group.rows,tasks.filter(r=>r.id===group.id));for(const field of ['status','blocker','dependencies'])if(new Set(group.rows.map(r=>JSON.stringify(r[field]??null))).size>1)assert(group.conflictingFields.includes(field));}
 const ctx=browserApp(s),html=vm.runInContext('blockersView()',ctx),text=blockersText(s);
 assert.equal(JSON.stringify(ctx.BlockerModel.blockerSummary(s)),JSON.stringify(summary));
 assert(html.includes(m.countSummaryText(summary.counts)));assert(text.startsWith(m.countSummaryText(summary.counts)));
 assert(html.includes('No dashboard override.'));assert(text.includes('No dashboard override.'));
 const denied=tasks.find(r=>r.blocker==='automated review denied');assert.equal(m.actor(s,denied)[0],'user');
 ctx.__denied=denied;assert.equal(vm.runInContext('taskControls(__denied)',ctx),'');
 vm.runInContext('query="impossible-search"',ctx);const filtered=vm.runInContext('blockersView()',ctx);
 assert(filtered.includes('fixed claim'));assert(filtered.includes('automated review denied'));
 assert.equal(JSON.stringify(s),before);permutations++;
}
// HTML injection through every newly rendered evidence channel must be escaped.
const hostile='</pre><img src=x onerror=alert(1)>';
const h={...base,tasks:[row(hostile,'blocked',{blocker:hostile,dependencies:[hostile]}),row(hostile,'done',{waitingOn:hostile})]};
const html=vm.runInContext('blockersView()',browserApp(h));assert(!html.includes(hostile));assert(html.includes('&lt;/pre&gt;'));
const snapshotPath='/home/user/wine-assembly/scratch/telegram/blocker-state-121-122.json';
const bytes=fs.readFileSync(snapshotPath),hash=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(hash,'2956d87a3e730bb3c94dce672fff4846f230b1d2a4524ee3baf1eb5619709ac2');
const saved=freeze(JSON.parse(bytes)),summary=m.blockerSummary(saved),before=JSON.stringify(saved);
assert.deepEqual(summary.counts,{distinctBlockedTaskIds:77,rawBlockedRows:91,duplicateBlockedRows:14,anonymousBlockedRows:0});
const ctx=browserApp(saved),render=vm.runInContext('blockersView()',ctx),text=blockersText(saved);
assert.equal(JSON.stringify(ctx.BlockerModel.blockerSummary(saved)),JSON.stringify(summary));
assert(render.includes(m.countSummaryText(summary.counts)));assert(text.startsWith(m.countSummaryText(summary.counts)));
// Assert raw evidence remains available without persisting any private text.
const notes=m.repeatedIdNotes(summary.repeatedIds);
for(let i=0;i<summary.repeatedIds.length;i++)for(const row of summary.repeatedIds[i].rows)for(const f of ['status','blocker','waitingOn','dependencies'])assert(notes[i].includes(`${f}: ${JSON.stringify(row[f]??null)}`));
assert.equal(JSON.stringify(saved),before);assert(bytes.equals(fs.readFileSync(snapshotPath)));
console.log(JSON.stringify({result:'PASS',permutationCases:permutations,hostileEvidenceEscaped:true,snapshotSha256:hash,counts:summary.counts,repeatedGroups:summary.repeatedIds.length,conflictingGroups:summary.repeatedIds.filter(g=>g.conflictingFields.length).length,statusConflictGroups:summary.repeatedIds.filter(g=>g.conflictingFields.includes('status')).length,roots:summary.roots.length,dependents:summary.dependentCount,privateInputUnchanged:true,privateTextPersisted:false,browser:'inert DOM VM only; live browser untested'},null,2));
