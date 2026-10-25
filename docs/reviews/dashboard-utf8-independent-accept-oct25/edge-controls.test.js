'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {scanGoal}=require('../../../ops/readers');
const MB=1024*1024;
const goal=condition=>({type:'attachment',attachment:{type:'goal_status',condition,met:false}});
const command=text=>({type:'user',message:{content:`<local-command-stdout>${text}</local-command-stdout>`}});
const line=x=>JSON.stringify(x)+'\n';
async function fixture(t){const d=await fs.mkdtemp(path.join(process.env.TMPDIR,'accept-edge-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));return path.join(d,'history.jsonl');}
test('latest goal or clear wins after oversized irrelevant record, including unterminated final records',async t=>{
 const f=await fixture(t);
 const head=line(goal('older é漢😀'))+line({type:'image',data:'x'.repeat(2*MB)});
 for(const [entry,expected] of [[goal('newest 漢😀'), 'newest 漢😀'],[command('Goal set: command é😀'),'command é😀'],[command('Goal cleared'),null]]){
  const bytes=Buffer.from(head+JSON.stringify(entry));await fs.writeFile(f,bytes);
  const out=await scanGoal(f,bytes.length,0);
  assert.equal(out===null?null:out.condition,expected);
 }
});
test('reverse scan honors byte stop/end and closes handle without reading later appended goal',async t=>{
 const f=await fixture(t);const before=Buffer.from(line(goal('excluded 😀')));const inside=Buffer.from(line({type:'image',data:'x'.repeat(MB+37)}));
 const bytes=Buffer.concat([before,inside]);await fs.writeFile(f,Buffer.concat([bytes,Buffer.from(line(goal('after snapshot 漢')))]));
 const open=fs.open.bind(fs);let reads=0,total=0,closed=0;
 t.mock.method(fs,'open',async(...args)=>{const h=await open(...args);const read=h.read.bind(h),close=h.close.bind(h);h.read=async(b,o,n,p)=>{assert.ok(n<=MB);assert.ok(p>=before.length);assert.ok(p+n<=bytes.length);reads++;total+=n;return read(b,o,n,p);};h.close=async()=>{closed++;return close();};return h;});
 assert.equal(await scanGoal(f,bytes.length,before.length),undefined);
 assert.equal(reads,2);assert.equal(total,inside.length);assert.equal(closed,1);
});
