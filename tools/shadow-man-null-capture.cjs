'use strict';
// Synchronous observer, intentionally single instance / single guest thread.
const crypto = require('node:crypto');
const ADDRESS = 0x004015d4;
const PIN = Object.freeze({runtime:'58e90870a40a541a4083cae5e987ca8de31889e6',moduleSha256:'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553',moduleBytes:1879387});
const regs = ['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
const fields = ['savedEip','savedEsp','pumpHwnd','returnAddress','ended','sharedPumpHwnd','sharedEnded','syncDepth','eventCount'];
const kinds = ['','sender-pre','sender-before-restore','modal-frame-consume','modal-frame-complete','first-zero','overflow'];
const transferFields = ['kind','preEip','preEsp','postEip','postEsp','thunkAddress','thunkMarker','retAddress','retWord','syncDepth','eventCountBeforeZero','pumpHwnd','returnAddress','ended','sharedPumpHwnd','sharedEnded','syncReturnThunk','modalLoopThunk','threadCursor'];
const transferSites = ['unknown','win32_dispatch_inner:CACA0005','th_ret','th_ret_imm','th_pop_run_ret'];
function zeroTransfer(e, boundary, registers) {
  if((e.null_diag_field(9)>>>0)!==1) throw Error('unsupported zero-transfer schema');
  const kind=e.null_diag_field(10)>>>0;
  if(kind===0) return {schema:1,kind:'unknown',site:'unknown',reason:'no immediate instrumented transfer'};
  if(kind>4) throw Error('invalid zero-transfer writer');
  const t=Object.fromEntries(transferFields.map((n,i)=>[n,e.null_diag_field(10+i)>>>0]));
  if(t.postEip!==0||t.postEsp!==registers.esp||t.syncDepth!==boundary.syncDepth||
     t.eventCountBeforeZero+1!==boundary.eventCount) throw Error('stale zero-transfer record');
  if(kind===1) {
    if(!t.thunkAddress||t.thunkMarker!==0xcaca0005||
       t.preEip!==t.thunkAddress||t.preEsp!==t.postEsp||t.retAddress!==0||t.retWord!==0)
      throw Error('invalid CACA0005 provenance');
  } else if(t.thunkAddress!==0||t.thunkMarker!==0||t.retAddress!==t.preEsp||t.retWord!==0||
            ((t.postEsp-t.preEsp)>>>0)<4||(kind===2&&((t.postEsp-t.preEsp)>>>0)!==4)) {
    throw Error('invalid guest RET provenance');
  }
  // Native first-zero validation already matched its saved i64 token/root to
  // these live values. No numeric conversion or stale dbg_prev_eip inference.
  return {...t,schema:1,kind:kind===1?'native-caca0005':'guest-ret-zero',site:transferSites[kind],
    ...(kind===1?{syncReturnThunkMatches:t.thunkAddress===t.syncReturnThunk}:{}),token:boundary.token,root:boundary.root};
}
const seal = r => crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');
class CaptureStop extends Error { constructor(reason) { super(reason); this.name='CaptureStop'; } }
function createCapture({retain, stop, metadata, untilZero=false, maxRecords=32, requireBlock=false, zeroTransferProvenance=false}) {
  if(typeof retain!=='function'||typeof stop!=='function'||!metadata||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>32) throw Error('invalid capture contract');
  if(typeof zeroTransferProvenance!=='boolean'||(zeroTransferProvenance&&!untilZero)) throw Error('zero-transfer requires first-zero mode');
  let e, terminal=false, blockSeen=false, armed=false; const records=[];
  function end(reason) { terminal=true; stop(reason); throw new CaptureStop(reason); }
  function fail(reason) { return end('capture-failed: '+reason); }
  function bytes(address, length) {
    if(address<0||address+length>0x100000000) throw Error('guest span wraps');
    return Array.from({length},(_,i)=>e.guest_read8((address+i)>>>0)&255).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function log(eip) {
    if(terminal) return fail('callback after stop');
    const tag=eip|0, kind=tag<0&&tag>=-6?kinds[-tag]:null;
    if(!kind&&(eip>>>0)!==ADDRESS) return false;
    if(!armed) return false; // startup observations never consume the selected-send quota
    if(!kind&&blockSeen) return true; // first block snapshot only
    if(records.length>=maxRecords||(untilZero&&kind!=='first-zero'&&records.length>=maxRecords-1)||kind==='overflow') return fail('record limit');
    try {
      const r={schema:1,sequence:records.length,kind:kind||'decoded-block',metadata:{...metadata},registers:{}};
      for(const n of regs) r.registers[n]=e['get_'+n]()>>>0;
      if(!kind&&r.registers.eip!==ADDRESS) throw Error('wrong callback EIP');
      if(kind==='first-zero'&&r.registers.eip!==0) throw Error('nonzero zero event');
      r.stack={address:r.registers.esp-32,bytes:bytes(r.registers.esp-32,128)};
      r.code={address:ADDRESS,bytes:bytes(ADDRESS,64)};
      if(kind) {
        r.boundary=Object.fromEntries(fields.map((n,i)=>[n,e.null_diag_field(i)>>>0]));
        r.boundary.token=e.null_diag_token().toString(); r.boundary.root=e.null_diag_root().toString();
      }
      if(kind==='first-zero') {
        if(zeroTransferProvenance) r.zeroTransfer=zeroTransfer(e,r.boundary,r.registers);
        r.classification=r.zeroTransfer&&r.zeroTransfer.kind!=='unknown'?
          r.zeroTransfer.kind:'ordinary-or-unknown; zero-writer unproven';
      }
      r.stop=kind==='first-zero'||(!kind&&!untilZero);
      r.continuation=r.stop?'forbidden':'explicit-until-first-zero';
      const envelope={record:r,sha256:seal(r)};
      // Deep freeze retained values; no live typed-array/memory references escape.
      const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
      freeze(envelope); retain(envelope); records.push(envelope);
      if(!kind) blockSeen=true;
      if(r.stop) return kind==='first-zero'&&requireBlock&&!blockSeen?fail('first-zero before required block'):end(r.kind);
      return true;
    } catch(err) { if(terminal) throw err; return fail(String(err)); }
  }
  return {
    arm(exports, selection) {
      if(armed||terminal) return fail('rearm'); e=exports;
      for(const n of [...regs.map(n=>'get_'+n),'guest_read8','set_trace_eip_range','set_bp',...(untilZero?['set_null_diag','null_diag_field','null_diag_token','null_diag_root']:[])])
        if(typeof e[n]!=='function') return fail('missing export '+n);
      if(zeroTransferProvenance&&(e.null_diag_field(9)>>>0)!==1) return fail('unsupported zero-transfer schema');
      if(selection) {
        const prior={registers:Object.fromEntries(regs.map(n=>[n,e['get_'+n]()>>>0])),boundary:untilZero?Object.fromEntries(fields.map((n,i)=>[n,e.null_diag_field(i)>>>0])):null};
        // Persist the resolved action and pre-arm state before any diagnostic mutation.
        const receipt=JSON.parse(JSON.stringify({phase:'pre-arm',selection,prior,metadata}));
        const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
        try { retain(freeze({receipt,sha256:seal(receipt)})); } catch(err) { return fail('arm retention '+err); }
      }
      records.length=0; blockSeen=false;
      e.set_bp(0); e.set_trace_eip_range(1,ADDRESS,ADDRESS);
      if(untilZero) e.set_null_diag(zeroTransferProvenance?2:1); armed=true;
    }, log,
    run(fn) {
      if(terminal||!armed) return fail('execution outside armed lifetime');
      try { fn(); } catch(err) { if(terminal) throw err; return fail('execution exception '+err); }
      return fail('execution returned without terminal capture');
    },
    get records(){return records.slice();}, get terminal(){return terminal;}
  };
}
function validateCapture(envelope,{expectedStack,requireStop=true}={}) {
  const r=envelope.record;
  if(seal(r)!==envelope.sha256) throw Error('changed record');
  if(r.kind!=='decoded-block'||r.registers.eip!==ADDRESS||r.code.address!==ADDRESS) throw Error('wrong/missing block');
  for(const n of regs) if(!Number.isInteger(r.registers[n])) throw Error('missing register');
  if(!/^[0-9a-f]{256}$/.test(r.stack.bytes)||r.stack.address!==r.registers.esp-32||!/^[0-9a-f]{128}$/.test(r.code.bytes)) throw Error('missing bytes');
  if(expectedStack!==undefined&&r.stack.bytes!==expectedStack) throw Error('changed stack');
  if(requireStop&&(!r.stop||r.continuation!=='forbidden')) throw Error('continued execution');
  return true;
}
const SEND_HOOK=Symbol.for('wine.shadow-null.selected-send.v1');
function createSelectedSend({instance,capture,selection,runner,pid=process.pid}) {
  const keys=['actionSequence','batch','cmdId','hwnd'];
  // Explicit intent selects one dequeued action, never an arbitrary matching send.
  // Its current HWND/batch are unavailable until the runner resolves that action.
  const fresh=selection?.mode==='selected-action';
  const selectedKeys=fresh?['mode','actionSequence','cmdId']:keys;
  if(!selection||Object.keys(selection).some(k=>!selectedKeys.includes(k))||
     (fresh?['actionSequence','cmdId']:keys).some(k=>!Number.isSafeInteger(selection[k])||selection[k]<0)||
     selection.cmdId!==3||selection.actionSequence===0||
     (!fresh&&(selection.hwnd===0||selection.hwnd>0xffffffff))) throw Error('invalid final Beenden selector');
  selection=Object.freeze(Object.fromEntries(selectedKeys.map(k=>[k,selection[k]])));
  let used=false; const priorActions=[];
  return function selectedSend(context,send) {
    if(context.instance!==instance||context.pid!==pid||context.runner!==runner||context.action!=='dlg-cmd'||typeof send!=='function') throw Error('wrong process/context/action');
    if(used) throw Error('duplicate or late arm');
    if(context.actionSequence<selection.actionSequence) {
      const value=send();
      priorActions.push({actionSequence:context.actionSequence,batch:context.batch,cmdId:context.cmdId,hwnd:context.hwnd,resolution:context.resolution,returned:true});
      if(priorActions.length>2)priorActions.shift();
      return value;
    }
    if((fresh?['actionSequence','cmdId']:keys).some(k=>context[k]!==selection[k])) throw Error('wrong or late selected action/HWND');
    if(keys.some(k=>!Number.isSafeInteger(context[k])||context[k]<0)||context.hwnd===0||context.hwnd>0xffffffff) throw Error('invalid resolved selection');
    if(!['modal','resolved-dialog'].includes(context.resolution)) throw Error('unvalidated dialog');
    used=true;
    const resolved=Object.fromEntries(keys.map(k=>[k,context[k]]));
    capture.arm(instance.exports,{...resolved,...(fresh?{intent:selection}:{}),pid,runner,action:context.action,resolution:context.resolution,priorActions});
    return capture.run(send); // returning, starvation, and exceptions are terminal failures
  };
}
module.exports={SEND_HOOK,createSelectedSend,createCapture,validateCapture,CaptureStop,ADDRESS,PIN};
