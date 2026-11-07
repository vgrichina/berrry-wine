'use strict';
const assert = require('assert/strict');
const fs = require('fs'), vm = require('vm');
const { createMachineRunner } = require('../tools/toyvm/run-dos');

// Install an ordinary DOS INT 15h hook. No host call into the handler: input
// must enter by real IRQ1, run BIOS code, INT 15h and return to the interrupted
// instruction. Log make/break bytes and return AL/CF, or chain to the old BIOS.
function image(mode) {
  const b = Buffer.alloc(0x180);
  const put = (off, bytes) => b.set(bytes, off - 0x100);
  put(0x100, [0x0e,0x1f,                         // push cs / pop ds
    0xb8,0x15,0x35,0xcd,0x21,                   // get old INT 15h
    0x89,0x1e,0x06,0x03,0x8c,0x06,0x08,0x03,
    0xba,0x80,0x01,0xb8,0x15,0x25,0xcd,0x21, // install our hook
    0xb8,0x34,0x12,0xbb,0x78,0x56,0xb9,0xbc,0x9a,0xba,0xf0,0xde,
    0xbe,0x57,0x13,0xbf,0x68,0x24,0xfb,0xf9,0xfd, // STI/STC/STD
    0xeb,0xfe]);
  const handler = [0x9c,0x80,0xfc,0x4f,0x75,0x20, // pushf; cmp ah,4f; jne chain
    0x9d,0x53,0x9c,0x5b,0x2e,0x89,0x1e,0x40,3, // save incoming flags
    0x2e,0x8b,0x1e,0,3,                        // cs:mov bx,[300]
    0x2e,0x88,0x87,0x20,3,                     // cs:mov [bx+320],al
    0x2e,0xff,0x06,0,3,0x5b];                 // cs:inc word [300] / pop bx
  handler.push(0xa8,0x80,0x75,8,                // test al,80h; jnz release
    0x2e,0xc6,0x06,0x50,3,1,0xeb,6,            // guest held state := 1
    0x2e,0xc6,0x06,0x50,3,0);                  // release: held state := 0
  if (mode === 'remap') handler.push(0x34,0x2e); // A->B, A-break->B-break
  if (mode === 'chain') handler.push(0x2e,0xff,0x2e,6,3);
  else handler.push(mode === 'drop' ? 0xf8 : 0xf9,0xca,2,0);
  // Other INT 15h services chain too.
  handler[5] = handler.length - 6;
  handler.push(0x9d,0x2e,0xff,0x2e,6,3);
  put(0x180, handler);
  return b;
}
async function scenario(mode, extended = false) {
  const irqs=[];
  const r=await createMachineRunner({ image:image(mode), name:'KBIOS.COM',budget:100000,
    sessionOptions:{slice:100,irqEvery:1000,stuckLimit:0} });
  r.session.hooks.onIrq=v=>irqs.push(v);
  const base=r.machine.pspSeg<<4;
  function until(n) {
    while(r.session.dispatched<n&&!r.session.done) assert.notEqual(r.step(),'unimplemented');
    assert.equal(r.session.done,false);
  }
  until(2000);
  const regs=['ax','bx','cx','dx','si','di','bp','ds','es','ss','sp'];
  const before=regs.map(k=>r.vm.get(k));const flags=r.vm.get('flags');
  r.machine.keyDown(extended?0x4b:0x1e,extended?0:97,extended);
  until(20000);
  assert.equal(r.vm.mem[base+0x300],extended?2:1,mode+': make reached guest intercept');
  assert.equal(r.vm.mem[base+0x320],extended?0xe0:0x1e);
  assert.equal(r.vm.mem[base+0x350],1,'guest observes held make state');
  assert.equal(r.vm.mem[base+0x340]&0x201,1,'intercept enters with CF set and IF clear');
  assert.deepEqual(regs.map(k=>r.vm.get(k)),before,mode+': registers restored');
  assert.equal(r.vm.get('flags')&0x601,flags&0x601,mode+': CF/IF/DF restored by IRQ IRET');
  if(mode==='drop')assert.deepEqual(r.machine.keys,[],'CF clear suppresses BIOS key');
  else assert.deepEqual(r.machine.keys,[{ah:extended?0x4b:mode==='remap'?0x30:0x1e,al:extended?0:mode==='remap'?98:97}]);
  r.machine.keyUp(extended?0x4b:0x1e,extended);
  until(40000);
  assert.equal(r.vm.mem[base+0x300],extended?4:2,mode+': break reached guest intercept');
  assert.equal(r.vm.mem[base+(extended?0x323:0x321)],extended?0xcb:0x9e);
  assert.equal(r.vm.mem[base+0x350],0,'independent break clears guest held state');
  if(extended)assert.deepEqual([...r.vm.mem.subarray(base+0x320,base+0x324)],[0xe0,0x4b,0xe0,0xcb]);
  assert.equal(r.machine.keys.length,mode==='drop'?0:1,'no BIOS key for break or duplicate make');
  assert.equal(r.machine.kbQueue.length,0);
  assert.equal(r.machine.heldKeys.size,0);
  assert.deepEqual([...r.machine.unhandledFn],[]);
  assert.equal(irqs.filter(v=>v.src==='kbd'&&v.vec===9).length,extended?4:2,'real IRQ1 deliveries');
}
async function main() {
  const classes=[require('../tools/toyvm/dos').Machine];
  if(!process.env.KEYBOARD_INTERCEPT_NODE_ONLY)for(const p of ['docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js']) {
    const c={self:{},console,TextEncoder,TextDecoder,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary')};
    c.globalThis=c;vm.runInNewContext(fs.readFileSync(p,'utf8'),c);
    classes.push(c.self.ToyVM.require('tools/toyvm/dos.js').Machine);
  }
  for(const Machine of classes) {
    const m=new Machine(new Uint8Array(1<<20));
    assert.equal(m.hookedVector(9),false);
    m.mem.set([0,2,0,0x20],0x15*4);
    assert.equal(m.biosKeyboardIntercept(),true);
    m.keyDown(0x1e,97);
    assert.equal(m.keys.length,0,'no BIOS key before hook result');
    m.pic.imr[0]|=2;assert.equal(m.keyboardIrq(),0,'masked IRQ1');
    m.pic.imr[0]&=~2;assert.equal(m.keyboardIrq(),9);
    assert.equal(m.portIn(0x60),0x1e);
    assert.equal(m.service(9,{get:n=>n==='flags'?1:n==='ax'?0x4f30:0}),true);
    assert.equal(m.keys.length,1);assert.equal(m.keys[0].ah,0x30);assert.equal(m.keys[0].al,98);
    assert.equal(m.kbBiosFrames.length,0);
    // An existing custom IRQ1 handler retains priority over the BIOS route.
    m.mem.set([0,3,0,0x20],9*4);
    assert.equal(m.biosKeyboardIntercept(),false);
    const queued=new Machine(new Uint8Array(1<<20));
    queued.pushKey(0x1e,97); // Before a guest installs its intercept.
    queued.mem.set([0,2,0,0x20],0x15*4);
    assert.equal(queued.keyboardIrq(),9);queued.portIn(0x60);
    assert.equal(queued.keys.length,0,'pre-hook key cannot bypass interception');
    queued.service(9,{get:n=>n==='ax'?0x4f1e:0});
    assert.equal(queued.keys.length,0,'CF clear removes the pre-hook BIOS key');
    // A hook may enable interrupts. Keep provenance with each outstanding IRQ
    // rather than allowing a nested byte to replace the outer input character.
    const nested=new Machine(new Uint8Array(1<<20));
    nested.mem.set([0,2,0,0x20],0x15*4);
    nested.keyDown(0x1e,97);nested.keyDown(0x30,98);
    assert.equal(nested.keyboardIrq(),9);nested.portIn(0x60);
    assert.equal(nested.keyboardIrq(),9);nested.portIn(0x60);
    for(const scan of [0x30,0x1e])nested.service(9,{get:n=>n==='flags'?1:n==='ax'?0x4f00|scan:0});
    assert.equal(nested.keys.map(k=>k.al).join(','),'98,97');
    assert.equal(nested.kbBiosFrames.length,0);
  }
  for(const mode of ['pass','drop','remap','chain'])await scenario(mode);
  await scenario('pass',true);
  console.log('PASS BIOS keyboard IRQ1/INT15 intercept make/break, CF swallow, AL remap, chaining and IRQ IRET state');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
