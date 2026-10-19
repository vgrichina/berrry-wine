'use strict';
const assert=require('assert/strict'),{PathWatchHandoff,PROMPT}=require('./army-men-debugger-handoff');
const object=0x1234000,pointer=0x2234000;
const regs=' EIP=0x0043c7ee EAX=0x00000000 ECX=0x00000000 EDX=0x00000000 EBX=0x01234000 ESP=0x074ff000\n';
function dump(addr,b){let s=`Hexdump 0x${addr.toString(16).padStart(8,'0')} (${b.length} bytes):\n`;for(let i=0;i<b.length;i+=16)s+=`  0x${(addr+i).toString(16).padStart(8,'0')}  `+[...b.subarray(i,i+16)].map(v=>v.toString(16).padStart(2,'0')+' ').join('')+'\n';return s;}
const ptr=Buffer.alloc(4);ptr.writeUInt32LE(pointer);const clean=Buffer.alloc(64);clean.write('C:/program files/the 3do company/army men demo/');
const stages=[regs+PROMPT,dump(object,ptr)+regs+PROMPT,dump(pointer,clean)+regs+PROMPT,` Watchpoint set: 0x02234000 (current: 0x00000043)\n`+regs+PROMPT];
const h=new PathWatchHandoff(),commands=[];for(const s of stages)for(const char of s)commands.push(...h.feed(char));
assert.deepEqual(commands,['d 0x1234000:4\n','d 0x2234000:64\n','w 0x2234000\n','c\n']);assert.equal(h.phase,'done');
const bad=new PathWatchHandoff();assert.throws(()=>bad.feed(regs.replace('0043c7ee','0043c7ef')+PROMPT),/boundary/);
const nul=new PathWatchHandoff();nul.feed(stages[0]);nul.feed(stages[1]);const corrupt=Buffer.from(clean);corrupt[0]=0;assert.throws(()=>nul.feed(dump(pointer,corrupt)+PROMPT),/path proof/);
const wrongAck=new PathWatchHandoff();for(const s of stages.slice(0,3))wrongAck.feed(s);assert.throws(()=>wrongAck.feed(' Watchpoint set: 0x02234000 (current: 0x00000000)\n'+PROMPT));
assert.throws(()=>h.feed(PROMPT),/unexpected/);
console.log('PASS chunked debugger handoff, current pointer/path qualification, wrong EIP/NUL/ack fail closed; no guest');
const {DebuggerPromptQuit}=require('./army-men-debugger-handoff');
const quit=new DebuggerPromptQuit();
assert.equal(quit.feed(PROMPT,false),null,'ordinary handoff prompt must not quit');
assert.equal(quit.feed('WATCHPOINT hit; HTTP quit requested\n',true),null,'no stale prompt');
const sent=[];for(const char of PROMPT){const cmd=quit.feed(char,true);if(cmd)sent.push(cmd);}
assert.deepEqual(sent,['q\n'],'completed handoff/watch prompt must receive ordinary quit');
assert.equal(quit.feed(PROMPT,true),null,'quit once');
const sameChunk=new DebuggerPromptQuit();assert.equal(sameChunk.feed('WATCHPOINT hit\n'+PROMPT,true),'q\n');
console.log('PASS post-handoff stop at chunked watch prompt, no stale prompt or duplicate quit');
