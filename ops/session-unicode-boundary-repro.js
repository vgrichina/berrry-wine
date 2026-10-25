'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createReader,scanGoal}=require('./readers');
(async()=>{
 const dir=await fs.mkdtemp(path.join(process.env.TMPDIR,'unicode-repro-'));
 try {
  await fs.mkdir(path.join(dir,'logs'));
  const file=path.join(dir,'logs/worker.jsonl'),MB=1024*1024;
  const line=e=>JSON.stringify(e)+'\n';
  const head={type:'assistant',cwd:dir,sessionId:'worker',timestamp:'2026-10-25T12:00:00Z',message:{content:[{type:'text',text:'hello'}],usage:{input_tokens:10,cache_read_input_tokens:20,cache_creation_input_tokens:30,output_tokens:5}}};
  const prefix=Buffer.from(line(head)+line({type:'image',data:'x'.repeat(300*1024)}));
  const expected='goal é漢😀 complete';
  const g=Buffer.from(line({type:'attachment',timestamp:'2026-10-25T12:00:00Z',attachment:{type:'goal_status',condition:expected,met:true}}));
  const cut=g.indexOf(Buffer.from('😀'))+1;
  const target=MB-(g.length-cut),suffix=Buffer.from(line({type:'image',data:'x'.repeat(target-27)}));
  const bytes=Buffer.concat([prefix,g,suffix,Buffer.alloc(target-suffix.length,32)]);
  assert.equal(bytes.length-MB,prefix.length+cut);await fs.writeFile(file,bytes);
  // Prove the source bytes encode the exact condition before testing readers.
  assert.equal(JSON.parse(bytes.toString('utf8').split('\n')[2]).attachment.condition,expected);
  const scanned=await scanGoal(file,bytes.length,0);
  const r=createReader({root:dir,claudeRoot:path.join(dir,'logs'),codexRoot:false,processes:false});
  const a=(await r.analyticsSnapshot()).agents[0];
  console.log(JSON.stringify({fixtureBytes:bytes.length,windowStart:bytes.length-MB,cutWithinEmojiByte:1,expected,scanGoal:scanned.condition,analyticsGoal:a.goal.condition,usage:{input:a.inputTokens,output:a.outputTokens},repeatedSnapshotGoal:(await r.analyticsSnapshot()).agents[0].goal.condition},null,2));
  assert.equal(a.goal.condition,expected);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
