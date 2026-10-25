'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {parseSession, createReader} = require('./readers');

test('compact session summaries do not retain transcript-sized backing strings', t => {
  // Model the reader's <=200 cached summaries. Each input is bounded below its
  // 1.25 MiB window. Natural allocation pressure suffices; never force GC.
  const cached = [];
  for (let i = 0; i < 190; i++) {
    const records = JSON.parse(JSON.stringify([{type:'assistant', cwd:'/project',
      sessionId:String(i), message:{content:[{type:'text', text:`summary ${i} `+'x'.repeat(900*1024)}]}}]));
    cached.push(parseSession('claude', records, `/logs/${i}.jsonl`, false, '/project'));
  }
  assert.equal(cached.length,190);
  assert.equal(cached[189].summary.length,240);
  t.diagnostic(`heapUsed=${process.memoryUsage().heapUsed}; sessions=${cached.length}; inputBytesEach=921600`);
  // Run with NODE_OPTIONS=--max-old-space-size=128. The old parser exhausts
  // that heap; a post-loop heapUsed threshold would depend on GC timing and
  // include dead temporary JSON strings, rather than only retained data.
  assert.ok(Buffer.byteLength(JSON.stringify(cached)) < 192*1024);
  const unicode='😀\ud800 '+ 'z'.repeat(400);
  assert.equal(parseSession('claude', [{type:'assistant',cwd:'/project',message:{content:[{type:'text',text:unicode}]}}], '/logs/unicode.jsonl', false, '/project').summary,unicode.slice(0,240));
});

test('refreshes preserve tokens and goals, invalidate replacements and remove deleted sessions', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ops-retention-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const logs=path.join(dir,'logs'); await fs.mkdir(logs);
  const file=path.join(logs,'worker.jsonl');
  const stamp='2026-10-01T12:00:00Z';
  const goal=condition=>({type:'attachment',timestamp:stamp,attachment:{type:'goal_status',condition,met:true}});
  const head={type:'assistant',cwd:dir,sessionId:'worker',timestamp:stamp,message:{content:[{type:'text',text:'hello'}],usage:{input_tokens:10,cache_read_input_tokens:20,cache_creation_input_tokens:30,output_tokens:5}}};
  await fs.writeFile(file,[head,goal('old'),{type:'image',data:'x'.repeat(1400*1024)},{}].map(JSON.stringify).join('\n'));
  const reader=createReader({root:dir,codexRoot:false,claudeRoot:logs});
  for(let i=0;i<6;i++){
    const {agents}=await reader.analyticsSnapshot();assert.equal(agents.length,1);
    assert.equal(agents[0].inputTokens,60);assert.equal(agents[0].goal.condition,'old');
  }
  // Replace with a partial log that contains no goal: the old inode's goal must
  // never be carried into a different session at the same pathname.
  const replacement=path.join(logs,'new.tmp');
  await fs.writeFile(replacement,[{...head,sessionId:'replacement'},{type:'image',data:'y'.repeat(1400*1024)},{}].map(JSON.stringify).join('\n'));
  await fs.rename(replacement,file);
  let agents=(await reader.analyticsSnapshot()).agents;
  assert.equal(agents[0].id,'claude:replacement');assert.equal(agents[0].goal,null);
  await fs.appendFile(file,'\n'+JSON.stringify(goal('new'))+'\n');
  agents=(await reader.analyticsSnapshot()).agents;assert.equal(agents[0].goal.condition,'new');
  await fs.appendFile(file,'\n'+JSON.stringify({type:'user',timestamp:stamp,message:{content:'<local-command-stdout>Goal removed</local-command-stdout>'}})+'\n');
  agents=(await reader.analyticsSnapshot()).agents;assert.equal(agents[0].goal,null);
  await fs.writeFile(file,JSON.stringify({...head,sessionId:'truncated'})+'\n');
  agents=(await reader.analyticsSnapshot()).agents;assert.equal(agents[0].id,'claude:truncated');assert.equal(agents[0].goal,null);
  await fs.unlink(file);assert.deepEqual((await reader.analyticsSnapshot()).agents,[]);
  await fs.writeFile(file,JSON.stringify({...head,sessionId:'recreated'})+'\n');
  agents=(await reader.analyticsSnapshot()).agents;assert.equal(agents[0].id,'claude:recreated');assert.equal(agents[0].inputTokens,60);
});

test('snapshot text reads remain bounded when a file grows after stat', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ops-read-bound-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'ops'));
  const file=path.join(dir,'ops/STATUS.md');await fs.writeFile(file,'original status');
  const open=fs.open.bind(fs);
  t.mock.method(fs,'open',async (...args)=>{
    const handle=await open(...args);
    if(args[0]===file){
      const stat=handle.stat.bind(handle);
      handle.stat=async()=>{const before=await stat();await fs.appendFile(file,'x'.repeat(32*1024));return before;};
    }
    return handle;
  });
  const snapshot=await createReader({root:dir,codexRoot:false,claudeRoot:false,processes:false}).snapshot();
  assert.equal(snapshot.projectStatus.body,'original status');
});
