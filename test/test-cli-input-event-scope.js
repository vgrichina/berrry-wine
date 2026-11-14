#!/usr/bin/env node
'use strict';
// Exercise the actual CLI producer/renderer/host table through the real RPC
// wire. The preload captures tables; it does not replace their input functions.
if (process.env.CLI_SCOPE_PRELOAD === '1') {
  const imports = require('../lib/host-imports');
  const create = imports.createHostImports;
  globalThis.scopeTables = [];
  globalThis.scopeRPC = require('../lib/guest-rpc');
  const threads = require('../lib/guest-thread-host');
  const GuestThreadHost = threads.GuestThreadHost;
  threads.GuestThreadHost = class extends GuestThreadHost {
    constructor(options) {
      super(options);
      globalThis.scopeFactory = options.hostImportsForSlot;
    }
  };
  imports.createHostImports = function(...args) {
    const result = create.apply(this, args);
    scopeTables.push(result.host);
    return result;
  };
} else {
  const assert = require('assert/strict');
  const fs = require('fs');
  const { startControlSession } = require('./control-session');
  (async () => {
   for (const mode of ['main', 'worker']) {
    const evidence = process.env.CLI_SCOPE_EVIDENCE && process.env.CLI_SCOPE_EVIDENCE+'.'+mode;
    const session = startControlSession(['--require', __filename, 'test/run.js',
      '--app=sol', '--no-build', '--threads', '--control-stdin', '--frozen',
      '--max-seconds=60', '--quiet-api', '--quiet-blocks'], {
      spawnOptions: { env: { ...process.env, CLI_SCOPE_PRELOAD: '1' } },
    });
    const send = session.send;
    const ev = code => send({ action: 'eval', code });
    try {
      await send({ action: 'step', n: 100 });
      await ev(`globalThis.table=scopeTables[0];
        globalThis.aTable=${mode==='main'?'table':'scopeFactory(1,1)'};
        globalThis.bTable=${mode==='main'?'table':'scopeFactory(2,2)'};
        globalThis.sigs={check_input:{params:[],results:['i32']},
          check_input_lparam:{params:[],results:['i32']},
          check_input_wparam:{params:[],results:['i32']},
          check_input_hwnd:{params:['i32'],results:['i32']},
          get_mouse_position:{params:[],results:['i32']},
          get_mouse_buttons:{params:[],results:['i32']}};
        globalThis.broker=scopeRPC.createMainBroker(memory,slot=>slot===1?aTable:bTable,sigs,{});
        globalThis.worker=slot=>scopeRPC.createWorkerImports(memory,sigs,
          msg=>{if(msg.t==='rpc')broker.serveRpc(msg.slot)},{slot}).imports.host;
        globalThis.a=worker(1);globalThis.b=worker(2);
        // Suspend guest polling while the ordinary CLI producer runs. Restore
        // before every broker call: the broker always calls the real renderer.
        globalThis.realCheck=renderer.checkInput;
        renderer.checkInput=()=>null;true`);
      const owner = await send({ action: 'guarded-bind' });
      let serial = 0;
      async function produce(cmd) {
        const ticket = await send({ action: 'guarded-input', cmd,
          guard: { ...owner, nonce: 'scope-'+(++serial), reviewed: true,
            deadline: Date.now()+5000 } });
        await send({ action: 'step', n: 1 });
        assert((await send({ action: 'guarded-status', nonce: ticket.nonce })).consumed);
      }
      await produce('mousedown:354:330');
      const first = await ev(`renderer.checkInput=realCheck;
        broker.publish({inputPending:1});
        globalThis.read=w=>({lp:w.check_input_lparam(),wp:w.check_input_wparam(),
          hwnd:w.check_input_hwnd(0),point:w.get_mouse_position(),buttons:w.get_mouse_buttons()});
        globalThis.firstPacked=a.check_input();while(firstPacked && (firstPacked&65535)!==513)firstPacked=a.check_input();globalThis.first=read(a);
        renderer.checkInput=()=>null;({packed:firstPacked,...first})`);
      assert.equal(first.packed & 0xffff, 0x201);
      await send({ action: 'guarded-release', owner: owner.owner });
      await send({ action: 'step', n: 1 });
      await produce('mousemove:200:180');
      await produce('keydown:65');
      const interleaved = await ev(`renderer.checkInput=realCheck;
        broker.publish({inputPending:1});
        globalThis.delivered=[];let packed;
        while((packed=b.check_input()))delivered.push({packed,...read(b)});
        broker.publish({inputPending:1});
        ({delivered,empty:b.check_input(),after:read(a),
          active:renderer._activeInputEvent,physical:[renderer._mouseX,renderer._mouseY]})`);
      assert.equal(interleaved.empty, 0);
      assert(interleaved.delivered.some(x => (x.packed & 0xffff) === 0x202), 'release delivered to sibling');
      assert(interleaved.delivered.some(x => (x.packed & 0xffff) === 0x200 && x.point !== first.point), 'distinct motion delivered');
      assert(interleaved.delivered.some(x => (x.packed & 0xffff) === 0x100 && x.hwnd === 0 && x.wp === 65), 'keyboard routing differs from mouse target');
      assert.equal(interleaved.active, null, 'empty poll cleared renderer outer event');
      assert.deepEqual(interleaved.after, Object.fromEntries(Object.entries(first).filter(([k])=>k!=='packed')),
        'sibling delivery and empty poll preserve all first-slot metadata');
      const contract = await ev(`(()=>{
        const scope=table.inputEventScope;
        if(!scope)throw Error('CLI inputEventScope missing');
        const outer=scope.save(), real=aTable.check_input_lparam;
        let nested=false, failed=false;
        aTable.check_input_lparam=()=>{
          const before=scope.save();
          b.check_input_hwnd(0);nested=scope.save().every((x,i)=>x===before[i]);
          throw Error('nested fixture error');
        };
        try{a.check_input_lparam()}catch(e){failed=true}
        aTable.check_input_lparam=real;
        const restored=scope.save().every((x,i)=>x===outer[i]);
        broker.publish({inputPending:1});const empty=a.check_input();
        const cleared=read(a);
        return {nested,failed,restored,empty,cleared,
          hidden:!Object.keys(table).includes('inputEventScope') &&
            !Object.keys(aTable).includes('inputEventScope') && aTable.inputEventScope===scope &&
            bTable.inputEventScope===scope};
      })()`);
      assert.equal(contract.nested, true);
      assert.equal(contract.failed, true);
      assert.equal(contract.restored, true);
      assert.equal(contract.empty, 0);
      assert.equal(contract.cleared.lp, 0);
      assert.equal(contract.cleared.wp, 0);
      assert.equal(contract.hidden, true);
      // A retired slot must not retain the previous transport's event.
      await ev('renderer.checkInput=()=>null;true');
      await produce('mousemove:250:220');
      const cleanup = await ev(`renderer.checkInput=realCheck;broker.publish({inputPending:1});
        a.check_input();globalThis.retiredPoint=a.get_mouse_position();
        globalThis.transport={on(){}};broker.watchWriter(transport,1);
        table.inputEventScope.restore([null,null]);
        broker.detachWriter(1,{});globalThis.retained=a.check_input_lparam();
        broker.detachWriter(1,transport);globalThis.fresh=worker(1);
        ({retained,lp:fresh.check_input_lparam(),wp:fresh.check_input_wparam(),point:fresh.get_mouse_position(),
          physical:((renderer._mouseY&65535)<<16)|(renderer._mouseX&65535)})`);
      assert.notEqual(cleanup.retained, 0, 'unrelated transport cannot retire slot metadata');
      assert.equal(cleanup.lp, 0, 'retirement releases saved metadata');
      assert.equal(cleanup.wp, 0);
      assert.equal(cleanup.point, cleanup.physical);
      console.log(mode+': PASS actual CLI producer/broker: delivery, empty poll, pointer/buttons, nested/error restoration, retirement');
      if (evidence) fs.writeFileSync(evidence,
        JSON.stringify({first,interleaved,contract,cleanup},null,2));
    } finally {
      const exit = await session.quit({ignoreReplyError:true});
      if (evidence) {
        fs.writeFileSync(evidence+'.log',session.output());
        fs.writeFileSync(evidence+'.wait.json',JSON.stringify({exit,actualWait:true,stdoutEOF:true,stderrEOF:true}));
      }
      assert.equal(exit,0);
    }
   }
  })().catch(error=>{console.error(error);process.exitCode=1});
}
