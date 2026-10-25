'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createReader,parseSession,scanGoal}=require('./readers');
const MB=1024*1024;
const stamp='2026-10-25T12:00:00Z';
const normal=(s,n)=>s.replace(/\s+/g,' ').slice(0,n);
async function fixture(t){const dir=await fs.mkdtemp(path.join(process.env.TMPDIR,'independent-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
const record=(root,id='worker')=>({type:'assistant',cwd:root,sessionId:id,timestamp:stamp,message:{model:'model',content:[{type:'text',text:'summary'}],usage:{input_tokens:10,cache_read_input_tokens:20,cache_creation_input_tokens:30,output_tokens:5}}});
const goal=condition=>({type:'attachment',timestamp:stamp,attachment:{type:'goal_status',condition,met:true}});
const line=e=>JSON.stringify(e)+'\n';
const pad=n=>line({type:'image',data:'x'.repeat(n)});
function reader(dir){return createReader({root:dir,claudeRoot:path.join(dir,'logs'),codexRoot:false,processes:false});}

test('UTF-16 clipping preserves whitespace, astral characters and isolated/split surrogates in both providers',()=>{
 for(const value of ['é漢😀\ud800\udfff\t\n '+ 'a'.repeat(1100),'a'.repeat(239)+'😀','a'.repeat(999)+'😀','a'.repeat(159)+'😀']){
  const records=JSON.parse(JSON.stringify([{type:'user',cwd:'/project',message:{content:value}},record('/project'),goal(value)]));
  records[1].message.content[0].text=value;records[1].message.model=value;
  const c=parseSession('claude',records,'/logs/a.jsonl',false,'/project');
  assert.equal(c.title,normal(value,160));assert.equal(c.summary,normal(value,240));assert.equal(c.model,normal(value,220));assert.equal(c.goal.condition,normal(value,1000));
  const x=parseSession('codex',JSON.parse(JSON.stringify([{type:'session_meta',payload:{id:'x',cwd:'/project'}},{type:'event_msg',payload:{type:'user_message',message:value}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:value}]}}])),'/logs/x.jsonl',false,'/project');
  assert.equal(x.title,normal(value,160));assert.equal(x.summary,normal(value,240));
 }
});

test('unchanged snapshots reuse cached logs; middle goals survive append and reset on same-size rewrite, truncate, replace and deletion',async t=>{
 const dir=await fixture(t);await fs.mkdir(path.join(dir,'logs'));const file=path.join(dir,'logs/a.jsonl');
 const original=line(record(dir))+pad(300*1024)+line(goal('old'))+pad(1200*1024);
 await fs.writeFile(file,original);const r=reader(dir);let agents=(await r.analyticsSnapshot()).agents;
 assert.equal(agents[0].goal.condition,'old');assert.equal(agents[0].inputTokens,60);assert.equal(agents[0].cacheReadTokens,20);assert.equal(agents[0].cacheWriteTokens,30);assert.equal(agents[0].outputTokens,5);
 const open=fs.open.bind(fs);let opened=0;t.mock.method(fs,'open',async (...args)=>{if(args[0]===file)opened++;return open(...args);});
 for(let i=0;i<4;i++)assert.deepEqual((await r.analyticsSnapshot()).agents,agents);assert.equal(opened,0);
 await fs.appendFile(file,line(goal('new'))+pad(1200*1024));agents=(await r.analyticsSnapshot()).agents;assert.equal(agents[0].goal.condition,'new');
 await fs.appendFile(file,line({type:'user',timestamp:stamp,message:{content:'<local-command-stdout>gOaL removed</local-command-stdout>'}})+pad(1200*1024));
 assert.equal((await r.analyticsSnapshot()).agents[0].goal,null);
 await fs.writeFile(file,original);assert.equal((await r.analyticsSnapshot()).agents[0].goal.condition,'old');
 await fs.writeFile(file,original.replace('"condition":"old"','"condition":"alt"'));assert.equal((await r.analyticsSnapshot()).agents[0].goal.condition,'alt');
 await fs.writeFile(file,line(record(dir,'short')));assert.equal((await r.analyticsSnapshot()).agents[0].goal,null);
 const tmp=path.join(dir,'replace');await fs.writeFile(tmp,line(record(dir,'replacement'))+pad(1500*1024));await fs.rename(tmp,file);agents=(await r.analyticsSnapshot()).agents;assert.equal(agents[0].id,'claude:replacement');assert.equal(agents[0].goal,null);
 await fs.unlink(file);assert.deepEqual((await r.analyticsSnapshot()).agents,[]);
 await fs.writeFile(file,line(record(dir,'recreated'))+pad(1500*1024));agents=(await r.analyticsSnapshot()).agents;assert.equal(agents[0].id,'claude:recreated');assert.equal(agents[0].goal,null);
});

test('snapshot text handles short reads and stops at the checked size despite file growth',async t=>{
 const dir=await fixture(t);await fs.mkdir(path.join(dir,'ops'));const file=path.join(dir,'ops/STATUS.md');const text='status é漢😀\n';await fs.writeFile(file,text);
 const open=fs.open.bind(fs);let requested=0,read=0,closed=0;
 t.mock.method(fs,'open',async(...args)=>{const h=await open(...args);if(args[0]===file){const stat=h.stat.bind(h),rawRead=h.read.bind(h),close=h.close.bind(h);h.stat=async()=>{const s=await stat();await fs.appendFile(file,'z'.repeat(32768));return s;};h.read=async(b,o,n,p)=>{requested=Math.max(requested,p+n);const out=await rawRead(b,o,Math.min(n,2),p);read+=out.bytesRead;return out;};h.close=async()=>{closed++;return close();};}return h;});
 const r=createReader({root:dir,claudeRoot:false,codexRoot:false,processes:false});const s=await r.snapshot();assert.equal(s.projectStatus.body,text.trim());assert.equal(requested,Buffer.byteLength(text));assert.equal(read,Buffer.byteLength(text));assert.equal(closed,1);
});

test('backward goal scan preserves a multibyte condition crossing its byte-window boundary',async t=>{
 const dir=await fixture(t);await fs.mkdir(path.join(dir,'logs'));const file=path.join(dir,'logs/unicode.jsonl');
 const prefix=Buffer.from(line(record(dir))+pad(300*1024));const expected='goal é漢😀 complete';const g=Buffer.from(line(goal(expected)));
 // The final 1 MiB window starts at the second byte of the emoji inside the
 // goal. This is a valid UTF-8 JSONL file; its head/tail windows omit this goal.
 const cut=g.indexOf(Buffer.from('😀'))+1;assert.ok(cut>0);
 const suffix=Buffer.from(pad(MB-(g.length-cut)-27));
 // Use ASCII whitespace after a valid JSON record to select the boundary exactly.
 const target=MB-(g.length-cut);assert.ok(suffix.length<=target);
 const bytes=Buffer.concat([prefix,g,suffix,Buffer.alloc(target-suffix.length,32)]);
 assert.equal(bytes.length-MB,prefix.length+cut);await fs.writeFile(file,bytes);
 const scanned=await scanGoal(file,bytes.length,0);assert.equal(scanned.condition,expected);
 const agents=(await reader(dir).analyticsSnapshot()).agents;assert.equal(agents[0].goal.condition,expected);
});
