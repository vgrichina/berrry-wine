'use strict';

// Offline, read-only transition validator. This deliberately does not install a
// instruction driver: the caller must own continuous instruction stepping,
// module/load epochs and the object's complete lifetime. The production callback
// context feed can bridge supported context changes, but does not authenticate
// writers or object lifetimes. Native fixture results are not game diagnosis.
const crypto = require('node:crypto');
const MEDIA = Object.freeze([
  {path:'test/binaries/gltron-0.70/gltron.exe',sha256:'85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec'},
  {path:'test/binaries/gltron-0.70/sdl_sound.dll',sha256:'31babd4f1e8ed6dfd412aeea8a6bbd48bf01aa24a9fe7c08a78944b0dee9142a'}
]);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function original(file,rva,n) {
  const pe=file.readUInt32LE(60), sections=pe+24+file.readUInt16LE(pe+20);
  for(let i=0;i<file.readUInt16LE(pe+6);i++) {
    const s=sections+40*i,va=file.readUInt32LE(s+12),len=file.readUInt32LE(s+16);
    if(rva>=va&&rva+n<=va+len) return file.subarray(file.readUInt32LE(s+20)+rva-va,file.readUInt32LE(s+20)+rva-va+n);
  }
  throw Error('unbacked PE range');
}
function pinMedia(files) {
  if(files.length!==2||files.some((b,i)=>hash(b)!==MEDIA[i].sha256)) throw Error('original PATHHASH mismatch');
  return Object.freeze({refill:original(files[0],0x13258,0x186).toString('hex'),
    thunk:original(files[0],0x23f22,6).toString('hex'),
    decode:original(files[1],0x1b6b,0xce).toString('hex'),
    adapter:original(files[1],0x492a,0x56).toString('hex')});
}
function loadedPins(files,base,read) {
  pinMedia(files);
  const ranges=[[0x413258,Buffer.from(original(files[0],0x13258,0x186))],
    [0x423f22,Buffer.from(original(files[0],0x23f22,6))],
    [base+0x1b6b,Buffer.from(original(files[1],0x1b6b,0xce))],
    [base+0x492a,Buffer.from(original(files[1],0x492a,0x56))]];
  // Apply the DLL's actual PE HIGHLOW relocation records, including operands
  // in Sound_Decode. No hand-masked signature may hide changed live bytes.
  const dll=files[1],pe=dll.readUInt32LE(60),opt=pe+24;
  const rva=dll.readUInt32LE(opt+136),size=dll.readUInt32LE(opt+140);
  const reloc=original(dll,rva,size),delta=base-dll.readUInt32LE(opt+28);
  for(let p=0;p<reloc.length;) {
    const page=reloc.readUInt32LE(p),n=reloc.readUInt32LE(p+4);
    if(n<8||p+n>reloc.length)throw Error('invalid relocation block');
    for(let q=p+8;q<p+n;q+=2){const v=reloc.readUInt16LE(q),type=v>>>12,a=base+page+(v&4095);
      if(type!==0&&type!==3)throw Error('unsupported relocation');
      if(type===3)for(const [start,b] of ranges)if(a>=start&&a+4<=start+b.length)b.writeUInt32LE((b.readUInt32LE(a-start)+delta)>>>0,a-start);
    }p+=n;
  }
  return ()=>{for(const [a,b]of ranges)if(!b.equals(Buffer.from(read(a,b.length))))throw Error('loaded original bytes changed');return true;};
}
const integer=(v,n='u32')=>{if(!Number.isInteger(v)||v<0||v>0xffffffff)throw Error('invalid '+n);return v;};
function createValidator({owner,epoch,lifetime,verify,callbackSession=null,soundBase=0x765000,maxInstructions=20000,maxRecords=256}={}) {
  if(!owner||!epoch||!lifetime)throw Error('owning identity/epoch/lifetime required');
  if(typeof verify!=='function'||verify()!==true)throw Error('loaded original verification required');
  integer(soundBase);if(soundBase>0xfff00000)throw Error('base overflow');
  for(const [n,v,max] of [['instructions',maxInstructions,1000000],['records',maxRecords,4096]])
    if(!Number.isInteger(v)||v<1||v>max)throw Error('invalid '+n+' bound');
  let seq=0,serial=0,active=null,last=null,closed=false;
  const calls=[];
  const callbacks=[];
  let callbackSeq=0, callbackRoot=callbackSession?.root ? [...callbackSession.root] : null;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const cpuEqual=(a,b,keys=['pc','esp','ebp','eax','ecx','edx','saved'])=>keys.every(k=>a[k]===b[k]);
  const report={version:1,status:'running',scope:'offline transition validation with optional production callback contexts; writer enrollment and authenticated object lifetime OPEN',
    records:[],instructions:0,refills:0,decodeCalls:0,decodeReturns:0,writes:0,readChanges:0,loops:0,exits:0,pending:[],classification:'UNKNOWN'};
  const emit=(kind,data={})=>{if(report.records.length>=maxRecords)throw Error('record overflow');report.records.push({kind,sequence:seq,refillToken:active?.token??null,...data});};
  function fail(e){report.status='INVALID';report.error=String(e.message||e);report.classification='UNKNOWN';closed=true;return report;}
  // Explicit context transitions from an owning production Worker session.
  // Callback bodies are opaque here: this does NOT attest their writes or the
  // interrupted object's lifetime. Instruction events alone cannot substitute.
  function transition(record, observation) {
    if(closed)return report;
    try {
      if(!callbackSession || !observation || observation.invalid || observation.session!==callbackSession.session ||
        observation.endpointIdentity!==callbackSession.endpointIdentity || observation.slot!==callbackSession.slot ||
        observation.sequence<record.sequence || record.session!==callbackSession.session ||
        record.endpointIdentity!==callbackSession.endpointIdentity || record.slot!==callbackSession.slot)
        throw Error('callback session lost/overflowed');
      if(record.sequence!==callbackSeq+1)throw Error('callback transition sequence lost');
      if(verify()!==true)throw Error('loaded original verification lost');
      for(const k of ['context','root']) {
        if(!Array.isArray(record[k])||record[k].length!==2)throw Error('callback context missing');
        record[k].forEach(v=>integer(v));
      }
      for(const k of ['pc','esp','ebp','eax','ecx','edx','saved'])integer(record.cpu?.[k],k);
      integer(record.depth);
      if(callbackRoot&&!same(callbackRoot,record.root))throw Error('callback root changed');
      callbackRoot ||= [...record.root];
      callbackSeq++;
      const s=record.cpu, f=callbacks.at(-1);
      if(['suspend','dispatch-suspend'].includes(record.kind)) {
        if(callbacks.length>=8 || f&&f.phase!=='admitted')throw Error('callback admission reordered');
        if(!f&&last&&!cpuEqual(last,s))throw Error('CPU continuity lost');
        if(f&&!same(record.context,f.child))throw Error('nested callback context changed');
        if(record.depth!==callbacks.length)throw Error('callback depth lost');
        callbacks.push({phase:'suspended',saved:structuredClone(s),parent:[...record.context],
          dispatch:record.kind==='dispatch-suspend'});
      } else if(record.kind==='admit') {
        if(!f||f.phase!=='suspended'||same(f.parent,record.context)||
          record.depth!==callbacks.length)throw Error('callback admission missing/reordered');
        const esp=(f.saved.esp-(f.dispatch?56:64))>>>0;
        if(s.esp!==esp||!s.saved)throw Error('callback admission stack mismatch');
        f.phase='admitted';f.child=[...record.context];f.entry=structuredClone(s);
      } else if(record.kind==='ret') {
        if(!f||f.phase!=='admitted'||!same(f.child,record.context)||record.depth!==callbacks.length)
          throw Error('callback RET missing/reordered');
        if(s.pc!==f.entry.saved||s.esp!==f.entry.esp+24)throw Error('callback native RET mismatch');
        f.phase='returned';
      } else if(record.kind==='restore'||record.kind==='cancel') {
        const cancel=record.kind==='cancel';
        if(!f||f.phase!==(cancel?'suspended':'returned')||!same(f.parent,record.context)||
          record.depth!==callbacks.length-1)throw Error('callback restoration missing/reordered');
        const expected={...f.saved};
        if(f.dispatch&&!cancel){expected.pc=expected.saved;expected.esp+=8;}
        if(!cpuEqual(expected,s,f.dispatch&&!cancel?['pc','esp','ebp','eax','ecx','edx']:undefined))
          throw Error('callback restored CPU mismatch');
        callbacks.pop();
      } else throw Error('unknown callback transition');
      last=structuredClone(s);
      emit('callback-'+record.kind,{callbackSequence:callbackSeq,context:[...record.context],depth:record.depth});
    }catch(e){fail(e);}
    return report;
  }
  function push(name,b,a,ret,target) {
    if(calls.length>=8)throw Error('call depth overflow');
    if(a.pc!==target||a.esp!==((b.esp-4)>>>0)||a.saved!==ret)throw Error('CALL target/stack mismatch');
    const frame={name,token:++serial,caller:ret,esp:a.esp};calls.push(frame);
    if(name==='decode')report.decodeCalls++;
    emit('native-call',{...frame,target,sample:active.sample});
  }
  function step(event) {
    if(closed)return report;
    try {
      if(event.owner!==owner||event.epoch!==epoch||event.lifetime!==lifetime)throw Error('owner/epoch/lifetime changed');
      if(verify()!==true)throw Error('loaded original verification lost');
      if(event.sequence!==seq+1||event.missed!==0||event.granularity!=='instruction')throw Error('missed/duplicate/non-instruction event');
      if(callbackSession&&event.callbackSequence!==callbackSeq)throw Error('callback transition high-water lost');
      if(seq>=maxInstructions)throw Error('instruction overflow');
      if(callbacks.length)throw Error('callback transition incomplete before refill instruction');
      seq++;report.instructions=seq;
      const {before:b,after:a}=event;
      for(const s of [b,a])for(const k of ['pc','esp','ebp','eax','ecx','edx'])integer(s[k],k);
      if(last&&JSON.stringify(b)!==JSON.stringify(last))throw Error('CPU continuity lost');
      last=structuredClone(a);
      if(b.pc===0x413258) {
        if(active)throw Error('overlapping refill lifetime');
        if(event.object!==b.ecx||!event.ring||event.ring.sample===0)throw Error('entry object/sample provenance missing');
        active={token:++serial,object:b.ecx,sample:event.ring.sample,caller:b.saved,esp:b.esp};
        report.refills++;emit('refill-entry',{object:active.object,sample:active.sample,caller:active.caller});
      }
      if(!active)throw Error('refill entry history missing');
      if(event.object!==active.object||!event.ring||event.ring.sample!==active.sample)throw Error('object/sample lifetime changed');
      const r=event.ring;
      for(const k of ['read','write','capacity','threshold','sample'])integer(r[k],k);
      if(!r.capacity||r.capacity>0x7fffffff||r.read>=r.capacity||r.write>=r.capacity||r.threshold>0x7fffffff)throw Error('unsupported ring bounds');
      if(b.pc===0x4132a7) {
        if(event.argument!==active.sample)throw Error('decode argument/sample mismatch');
        push('decode',b,a,0x4132ac,0x423f22);
      }
      if(b.pc===0x423f22&&a.pc!==soundBase+0x1b6b)throw Error('Sound_Decode thunk binding changed');
      if(b.pc===soundBase+0x1bff) {
        if(event.argument!==active.sample||calls.at(-1)?.name!=='decode')throw Error('selected decoder parent/sample mismatch');
        push('selected-decoder',b,a,soundBase+0x1c02,event.target);
      }
      if(b.pc===soundBase+0x4959) {
        if(calls.at(-1)?.name!=='selected-decoder')throw Error('adapter parent token missing');
        push('adapter-work',b,a,soundBase+0x495e,soundBase+0x2a470);
      }
      const f=calls.at(-1);
      if(f&&b.esp===f.esp&&['c3','c2'].includes(event.opcode)&&
        (event.opcode!=='c3'||b.saved!==f.caller||a.pc!==f.caller||a.esp!==b.esp+4))
        throw Error('return token/RET target mismatch');
      if(f&&a.pc===f.caller) {
        if(event.opcode!=='c3'||b.esp!==f.esp||b.saved!==f.caller||a.esp!==b.esp+4)throw Error('return token/RET stack mismatch');
        calls.pop();if(f.name==='decode')report.decodeReturns++;
        emit('native-return',{...f,eax:a.eax});
      }
      if(b.pc===0x41327a||b.pc===0x41329b) {
        const equal=b.pc===0x41327a;
        const taken=equal?r.read===r.write:(b.edx|0)<=(r.threshold|0);
        const expected=equal?(taken?0x4132a1:0x41327c):(taken?0x4133dc:0x4132a1);
        if(a.pc!==expected)throw Error('native ring condition mismatch');
        emit('loop-condition',{ring:{...r},taken,next:a.pc,remainder:equal?null:b.edx});
      }
      if(b.pc===0x413358) {
        if(a.pc!==0x41335b||event.writeAfter!==b.edx||b.edx>=r.capacity)throw Error('native write transition mismatch');
        report.writes++;emit('ring-write',{before:r.write,after:event.writeAfter,ring:{...r}});
      }
      if(event.ringAfter?.read!==r.read) {
        const next=event.ringAfter;
        if(!next||next.sample!==active.sample||next.read>=r.capacity||next.capacity!==r.capacity)throw Error('read-index lifetime/transition lost');
        report.readChanges++;emit('ring-read-change',{before:r.read,after:next.read});
      }
      if(b.pc===0x4133d7) {
        if(a.pc!==0x41326e)throw Error('loop edge mismatch');
        report.loops++;emit('refill-loop',{ring:{...r}});
      }
      if(b.pc===0x4133dd) {
        if(calls.length||event.opcode!=='c3'||a.pc!==active.caller||b.saved!==active.caller||b.esp!==active.esp||a.esp!==b.esp+4)throw Error('refill RET mismatch');
        report.exits++;emit('refill-return',{ring:{...r}});active=null;report.status='COMPLETE';closed=true;
      }
    }catch(e){fail(e);}
    return report;
  }
  function finish(observation) {
    if(callbackSession&&report.status!=='INVALID'&&(!observation||observation.invalid||
      observation.endpointIdentity!==callbackSession.endpointIdentity||observation.slot!==callbackSession.slot||
      observation.session!==callbackSession.session||observation.sequence!==callbackSeq))
      fail(Error('callback session final high-water lost/overflowed'));
    if(!closed&&callbacks.length)fail(Error('callback restoration missing at bound'));
    if(!closed){report.status='BOUNDED';closed=true;}
    report.pending=calls.map(f=>({...f}));
    if(report.status!=='INVALID')report.classification=report.exits?'REFILL_RETURNED':
      report.decodeReturns&&report.loops?'RETURNED_DECODE_REFILL_CONTINUES':
      calls.some(f=>f.name==='decode')?'DECODE_PENDING_AT_BOUND':'UNKNOWN';
    return structuredClone(report);
  }
  return {step,transition,finish};
}

// Read-only bridge for an EXCLUSIVE offline CPU controller. A snapshot encloses
// exactly one run(1) with instruction_watch enabled. This module never enables
// it, runs x86, changes registers, infers owner epochs or allocates object IDs.
function reader(ex) {
  const read=(address,n)=>{
    integer(address);if(n<1||n>512||address+n>0x100000000)throw Error('invalid read');
    const bytes=new Uint8Array(ex.memory.buffer),out=Buffer.alloc(n);
    for(let i=0;i<n;i++){const w=ex.guest_to_wasm(address+i)>>>0;if(w===0xf0||w>=bytes.length)throw Error('unmapped read');out[i]=bytes[w];}return out;
  };
  const u32=a=>read(a,4).readUInt32LE();
  const cpu=()=>{const s=Object.fromEntries(['eip','esp','ebp','eax','ecx','edx'].map(k=>[k==='eip'?'pc':k,ex['get_'+k]()>>>0]));s.saved=u32(s.esp);return s;};
  const ring=object=>Object.fromEntries([['sample',0x20],['threshold',0x24],['capacity',0x2c],['read',0x30],['write',0x34]].map(([k,o])=>[k,u32(object+o)]));
  return {read,u32,cpu,ring};
}
module.exports={MEDIA,hash,original,pinMedia,loadedPins,createValidator,reader};
