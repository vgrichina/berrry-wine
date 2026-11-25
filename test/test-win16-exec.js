#!/usr/bin/env node
// Verifies that a 16-bit NE task actually executes.
//
//   node test/test-win16-exec.js
//
// test-ne-loader.js proves the image is loaded and linked. This proves the
// next thing: that the decoder runs the segmented instruction stream, that the
// startup register state is the one a Win16 task is entitled to, and that far
// calls into the import thunk segment are recognised as API calls.
//
// Nothing here is asserted about *which* API the task reaches — that moves
// every time one lands. The invariant is that every API it dispatches is an
// entry point the real module exports under a name, checked against the map
// generated from those modules. That holds however far the task gets, and it
// fails loudly if a bad stack adjustment ever flings the task into a thunk
// slot at random, which is the failure mode worth catching here.
//
// The host imports are all no-ops, so an app that asks the host a question
// gets zero and takes whatever path that implies — usually its error path.
// That is fine for what this test is about, and it is why the sequence of
// APIs here is not the sequence a real run produces.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WASM = process.env.WIN16_TEST_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');
const BIN = path.join(ROOT, 'test', 'binaries', 'win98-16bit');

const SREG_ES = 0, SREG_CS = 1, SREG_SS = 2, SREG_DS = 3;
// Module ids as assigned by $win16_module_id in src/08c-ne-loader.wat.
const MODULE_NAMES = [
  null, 'KERNEL', 'USER', 'GDI', 'KEYBOARD',
  'SOUND', 'SHELL', 'MMSYSTEM', 'COMMDLG', 'CARDS', 'DDEML',
];
const ORDINALS = require(path.join(ROOT, 'src', 'win16-ordinals.generated.json'));

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${name}: got ${fmt(got)}, want ${fmt(want)}`); }
  return ok;
}
function checkThat(name, ok, detail) {
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${name}${detail ? ': ' + detail : ''}`); }
  return ok;
}
function fmt(v) { return typeof v === 'number' ? `0x${(v >>> 0).toString(16)}` : String(v); }

async function instantiate() {
  if (!fs.existsSync(WASM)) execSync('bash tools/build.sh', { cwd: ROOT, stdio: 'inherit' });
  const bytes = fs.readFileSync(WASM);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const mod = await WebAssembly.compile(bytes);
  const logged = [];
  const imports = { host: { memory }, env: { memory } };
  for (const imp of WebAssembly.Module.imports(mod)) {
    if (imp.kind === 'memory') continue;
    if (imp.kind !== 'function') continue;
    imports[imp.module] = imports[imp.module] || {};
    imports[imp.module][imp.name] = imp.name === 'log_i32'
      ? (v) => { logged.push(v >>> 0); return 0; }
      : () => 0;
  }
  const inst = await WebAssembly.instantiate(mod, imports);
  return { inst, memory, logged };
}

function runOne(inst, memory, logged, name) {
  const file = path.join(BIN, name);
  const bytes = fs.readFileSync(file);
  const mem = new Uint8Array(memory.buffer);
  const staging = inst.exports.get_staging();
  mem.fill(0, staging, staging + Math.max(bytes.length, 0x10000));
  mem.set(bytes, staging);
  logged.length = 0;

  const entry = inst.exports.load_pe(bytes.length);
  console.log(`\n${name}`);
  if (entry < 0) { fail++; console.log(`  FAIL load_pe returned ${entry}`); return; }

  // ---- startup state ----
  const csBase = inst.exports.win16_seg_base_of(SREG_CS);
  const ssBase = inst.exports.win16_seg_base_of(SREG_SS);
  const dsBase = inst.exports.win16_seg_base_of(SREG_DS);
  const entryIP = inst.exports.win16_entry_ip();

  check('code16 set', inst.exports.is_code16(), 1);
  check('CS selector is the entry CS', inst.exports.win16_sreg(SREG_CS), inst.exports.win16_entry_cs());
  check('EIP is CS base + entry IP', inst.exports.get_eip() >>> 0, (csBase + entryIP) >>> 0);
  check('DS is the auto-data segment', inst.exports.win16_sreg(SREG_DS),
    (inst.exports.win16_auto_data() << 3) | 7);
  check('ES starts equal to DS', inst.exports.win16_sreg(SREG_ES), inst.exports.win16_sreg(SREG_DS));
  check('SS is the auto-data segment', inst.exports.win16_sreg(SREG_SS), inst.exports.win16_sreg(SREG_DS));

  // Every segment base is 64KB aligned; the whole address scheme rests on it.
  checkThat('segment bases are 64KB aligned',
    (csBase & 0xffff) === 0 && (ssBase & 0xffff) === 0 && (dsBase & 0xffff) === 0,
    `cs=${fmt(csBase)} ss=${fmt(ssBase)} ds=${fmt(dsBase)}`);

  const esp0 = inst.exports.get_esp() >>> 0;
  checkThat('SP starts inside the stack segment',
    esp0 > ssBase && esp0 <= ssBase + 0xfffe, `esp=${fmt(esp0)} ss base=${fmt(ssBase)}`);

  const dsSel = inst.exports.win16_sreg(SREG_DS);

  // ---- named resources ----
  // A NAMEINFO id with bit 15 clear is an offset to a Pascal string, not an
  // id, and the walker used to match integer ids only — so every Load* handed
  // a string returned 0. Solitaire's icon is the one that shows: its group
  // icon is stored as "SOL" and it therefore had no icon at all.
  if (name === 'SOL.EXE') {
    const scratch = inst.exports.get_staging() + 0x180000;
    const mem8 = new Uint8Array(memory.buffer);
    const put = (text) => {
      for (let i = 0; i < text.length; i++) mem8[scratch + i] = text.charCodeAt(i);
      mem8[scratch + text.length] = 0;
      return scratch;
    };
    checkThat('RT_GROUP_ICON "SOL" is found by name',
      inst.exports.win16_find_resource_ex(14, 0, put('SOL')) !== 0);
    // USER compares without case, and modules are inconsistent about which
    // case they store and which they ask with.
    checkThat('the name match ignores case',
      inst.exports.win16_find_resource_ex(14, 0, put('sol')) !== 0);
    // A prefix must not match: "SO" and "SOLITAIRE" are both other resources.
    checkThat('a shorter name does not match',
      inst.exports.win16_find_resource_ex(14, 0, put('SO')) === 0);
    checkThat('a longer name does not match',
      inst.exports.win16_find_resource_ex(14, 0, put('SOLX')) === 0);
    // Integer lookup must keep working next to it: the bitmaps are numbered.
    checkThat('numbered resources still resolve',
      inst.exports.win16_find_resource(2, 54) !== 0);

    // FindResource hands back a handle, and every later call in the pipeline
    // works from that handle alone -- the caller's string lives in its own
    // segment and may be freed by then. So a by-name match has to leave
    // behind something durable that names the same entry, which is the
    // NAMEINFO id word. Without it FindResource could only answer integer
    // ids, and Moraff's Jiggler -- whose every image and sound is a named
    // custom resource -- got NULL for all of them and drew an empty board.
    const solAt = inst.exports.win16_find_resource_ex(14, 0, put('SOL'));
    const solRid = inst.exports.win16_res_found_id() | 0;
    checkThat('a by-name match records its NAMEINFO id word', solRid !== 0);
    checkThat('that word is a name offset, not an integer id',
      (solRid & 0x8000) === 0, `rid=${fmt(solRid)}`);
    check('the recorded word finds the same resource again',
      inst.exports.win16_find_resource_rid(14, solRid), solAt);
    // An id word nothing stores must not match some other entry by accident.
    checkThat('an unknown id word finds nothing',
      inst.exports.win16_find_resource_rid(14, 0x7fff) === 0);
  }

  // ---- execute ----
  // Run until an unimplemented API traps, or until the task has had a generous
  // number of batches. Both outcomes are legitimate: early on every image
  // stopped almost immediately, and as the API layer fills in they run on.
  inst.exports.set_win16_trace(1);
  let trapped = false;
  for (let i = 0; i < 400 && !trapped; i++) {
    try {
      inst.exports.run(64);
    } catch (e) {
      trapped = e instanceof WebAssembly.RuntimeError;
      if (!trapped) throw e;
    }
  }

  checkThat('execution left the entry point', (inst.exports.get_eip() >>> 0) !== (csBase + entryIP),
    `eip=${fmt(inst.exports.get_eip())}`);

  // Every call the task made, from the --trace-win16 stream: marker, packed
  // module/ordinal, return address, ten stack words, then the by-name flag —
  // thirteen words after the marker. Each call has to name a real export: an
  // ordinal nobody exports means the task far-called into a thunk slot that was
  // never filled, which is what a wrong stack adjustment looks like from here.
  // key, return address, twelve stack words, by-name flag.
  const CALL_WORDS = 15;
  const calls = [];
  for (let i = 0; i < logged.length; i++) {
    if (logged[i] !== 0xca16a9f0) continue;
    const key = logged[i + 1] >>> 0;
    calls.push({ mod: key >>> 16, ord: key & 0xffff, byName: !!logged[i + CALL_WORDS] });
    i += CALL_WORDS;
  }
  checkThat('the task dispatched several API calls', calls.length >= 3,
    `${calls.length} calls`);
  // Every one of these images starts the same way, and it is the one call
  // whose position is fixed: InitTask is what turns a loaded image into a
  // running task. Checking the call rather than the ES it left behind means
  // the assertion survives the app immediately pointing ES somewhere else,
  // which FreeCell does three instructions later.
  checkThat('the first call was KERNEL.91 InitTask',
    calls.length > 0 && calls[0].mod === 1 && calls[0].ord === 91,
    calls.length ? `${MODULE_NAMES[calls[0].mod] || calls[0].mod}.${calls[0].ord}` : 'none');
  // A by-name import carries a name-table offset where the ordinal would be,
  // so there is nothing to look up for those; what must hold is that the
  // module was still identified, which the check below covers.
  const unnamed = calls.filter((c) => {
    const m = MODULE_NAMES[c.mod];
    if (!m) return true;
    if (c.byName) return false;
    return !(ORDINALS.modules[m] && ORDINALS.modules[m].ordinals[String(c.ord)]);
  });
  checkThat('every dispatched ordinal is a named export of its module',
    unnamed.length === 0,
    unnamed.map((c) => `${MODULE_NAMES[c.mod] || c.mod}.${c.ord}`).join(' '));
  console.log(`  ${calls.length} API calls dispatched`);

  // If it did stop, the same has to hold of the ordinal it stopped at.
  if (!trapped) { console.log('  still running after 400 batches'); return; }
  // Not every stop is an unimplemented ordinal. 0xCA16A9F7 is the bridge into
  // the 32-bit handlers refusing to carry a redirect into guest code back to a
  // 16-bit task; it names the API and is as legitimate a stopping point as an
  // unimplemented one. It shows up here and not in a real run because every
  // host import is a no-op, which sends some APIs down paths they would not
  // otherwise take.
  if (logged.indexOf(0xca16a9f7) >= 0) {
    const at = logged.indexOf(0xca16a9f7);
    console.log(`  stopped: ${MODULE_NAMES[logged[at + 1]] || logged[at + 1]}.${logged[at + 2]}`
      + ' redirected EIP into guest code');
    return;
  }
  const mod = inst.exports.win16_last_module();
  const ord = inst.exports.win16_last_ordinal();
  const byName = inst.exports.win16_last_is_name();
  const modName = MODULE_NAMES[mod];
  checkThat('stopped in a module the loader identified', !!modName, `module id ${mod}`);
  if (byName) {
    // A name import carries an offset into the imported-name table instead of
    // an ordinal, so there is nothing to look up in the ordinal map. What must
    // hold is that the module was still identified — before the name flag
    // existed these all collapsed to module 0.
    console.log(`  stopped at ${modName}.<name+${ord}> (imported by name)`);
  } else {
    const apiName = modName && ORDINALS.modules[modName]
      && ORDINALS.modules[modName].ordinals[String(ord)];
    checkThat('stopped at an ordinal the real module exports by name', !!apiName,
      `${modName || mod}.${ord} is not a named export`);
    console.log(`  stopped at ${modName}.${ord} ${apiName || ''}`);
  }

  // The dispatcher logs marker, packed module/ordinal, return address.
  const marker = logged.indexOf(byName ? 0xca16a9f2 : 0xca16a9f1);
  checkThat('dispatch logged its marker', marker >= 0, `logged=${logged.map(fmt).join(' ')}`);
  if (marker >= 0) {
    check('logged key matches the reported module/ordinal', logged[marker + 1], (mod << 16) | ord);
    const ret = logged[marker + 2] >>> 0;
    // The far call must have pushed CS:IP, so the saved IP is on top of stack.
    const esp = inst.exports.get_esp() >>> 0;
    const view = new DataView(memory.buffer);
    const guestBase = inst.exports.get_guest_base();
    check('saved IP on the stack', view.getUint16(guestBase + esp, true), ret & 0xffff);
    checkThat('saved CS on the stack names a loaded segment',
      inst.exports.win16_seg_base(view.getUint16(guestBase + esp + 2, true) >> 3) !== 0,
      `cs=${fmt(view.getUint16(guestBase + esp + 2, true))}`);
  }
}

// Portable, synthetic NE: no installed game or retained run is needed. Distinct
// full-size DS/ES/FS segments also let us check the unused DS source and guards.
async function runStringComparisons() {
  const assert = require('assert/strict');
  const { inst, memory } = await instantiate();
  const e = inst.exports, mem = new Uint8Array(memory.buffer);
  const image = Buffer.alloc(1024), ne = 64;
  image.writeUInt16LE(0x5a4d); image.writeUInt32LE(ne, 60);
  const word = (offset, value) => image.writeUInt16LE(value, ne + offset);
  for (const [offset, value] of [[0,0x454e],[4,0x90],[6,2],[14,3],
    [18,4096],[22,1],[24,0x8000],[26,8],[28,8],[34,0x40],[50,4]]) word(offset, value);
  for (let i = 0; i < 8; i++) {
    word(0x40+i*8, 0x20+i); word(0x42+i*8, 16);
    word(0x44+i*8, i ? 1 : 0); word(0x46+i*8, 0);
  }
  mem.set(image, e.get_staging());
  assert(e.load_pe(image.length) >= 0);
  assert.equal(e.is_code16(), 1);
  e.set_uop(0); e.set_block_exec(0); e.set_fault_unmapped(2);
  e.win16_set_sreg(0, 5*8+7); e.win16_set_sreg(4, 7*8+7);
  const code = e.win16_seg_base(1), ds = e.win16_seg_base(3);
  const es = e.win16_seg_base(5), source = e.win16_seg_base(7);
  const stack = e.win16_seg_base(8)+0x8000, g = p => e.guest_to_wasm(p) >>> 0;
  assert.equal(e.win16_seg_base_of(1), code);
  assert.equal(e.win16_seg_base_of(3), ds);
  for (const n of [1,3,5,7,8]) assert.equal(e.win16_seg_limit(n), 65536);
  const spans = [ds,es,source].map(p => [g(p-64), 65664]);
  for (const p of [ds,es,source]) assert.equal(g(p+65599)-g(p-64), 65663);
  const names = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
  const regs = () => names.map(n => e['get_'+n]() >>> 0);
  const lazy = () => ['op','a','b','res','sign_shift'].map(n => e['get_flag_'+n]());
  const segments = () => Array.from({length:6}, (_,i) =>
    [e.win16_sreg(i),e.win16_seg_base_of(i)]);
  // Separate arithmetic oracle: exact difference, unsigned borrow, signed
  // range overflow, nibble borrow, and parity of the low result byte.
  function subFlags(bits, a, b) {
    const modulus = 2**bits, sign = modulus/2;
    const result = Number((BigInt(a)-BigInt(b)+BigInt(modulus))%BigInt(modulus));
    const signed = x => x >= sign ? x-modulus : x;
    const difference = signed(a)-signed(b);
    let ones = 0;
    for (let bit=0; bit<8; bit++) ones += (result >>> bit)&1;
    return (a<b ? 1:0) | (ones%2===0 ? 4:0) | ((a&15)<(b&15) ? 16:0)
      | (result===0 ? 64:0) | (result>=sign ? 128:0)
      | (difference < -sign || difference >= sign ? 2048:0);
  }
  let setupAt = code+0x9000;
  const setups = new Map();
  function setup(bytes) {
    const key = bytes.join(',');
    if (!setups.has(key)) {
      setups.set(key, setupAt); mem.set([...bytes,235,0],g(setupAt)); setupAt += 32;
      assert(setupAt < code+0xff00);
    }
    e.clear_yield(); e.set_eip(setups.get(key)); e.run(1);
  }
  function flags() {
    const ax = e.get_eax(); setup([0x9c,0x58]);
    const value = e.get_eax()&65535; e.set_eax(ax); return value;
  }
  let site = 0, rows = 0;
  for (const bits of [8,16]) for (const cmps of [true,false])
    for (const rep of [0,0xf3,0xf2]) for (let scenario=0; scenario<5; scenario++) {
      const size=bits/8, modulus=2**bits, sign=modulus/2;
      const at=code+0x100+site++*32;
      const bytes=[0x64,...(rep ? [rep]:[]),cmps ? (size===1?0xa6:0xa7):(size===1?0xae:0xaf),235,0];
      mem.set(bytes,g(at));
      for (let hot=0; hot<2; hot++) {
        const df=hot, step=(df?-1:1)*size;
        const count=scenario===4 ? hot : 4-hot;
        e.set_esp(stack); setup([0x68,0xd7,0x0a,0x9d,df?0xfd:0xfc]);
        for (const [p,n] of spans) mem.fill(0x6c,p,p+n);
        const si=df?0:65536-size, di=df?0:65536-size;
        const [a,b]=[[modulus-1,0],[sign,1],[sign-1,modulus-1],[7,7],[0,0]][scenario];
        const acc=(a+hot)%modulus;
        const pairs=[];
        const put=(base,index,value) => {
          for (let j=0;j<size;j++) mem[g(base+index+j)]=(value >>> (j*8))&255;
        };
        for (let k=0;k<4;k++) {
          const x=cmps ? (acc+k)%modulus : acc;
          const y=rep===0xf3 ? (k===0?x:(x+1)%modulus)
            : rep===0xf2 ? (k===1?x:(x+1)%modulus) : b;
          pairs.push([x,y]); put(source,(si+k*step)&65535,x); put(es,(di+k*step)&65535,y);
        }
        const initial=[(0xa55a0000|acc)>>>0,(0xface0000|count)>>>0,0xc33c4433,
          0xd11d6655,stack,0xe22e8877,(0x13570000|si)>>>0,(0x24680000|di)>>>0];
        names.forEach((n,i)=>e['set_'+n](initial[i]));
        const beforeFlags=flags(), beforeLazy=lazy(), seg=segments();
        mem.fill(0xa5,g(stack-64),g(stack+64));
        const guards=spans.map(([p,n])=>Buffer.from(mem.subarray(p,p+n)));
        const stackGuard=Buffer.from(mem.subarray(g(stack-64),g(stack+64)));
        e.clear_yield(); e.set_eip(at);
        const hits=e.get_page_hits(), stores=e.get_cache_stores();
        e.run(1);
        const actual=regs(), afterLazy=lazy();
        assert.deepEqual(segments(),seg);
        assert.deepEqual(Buffer.from(mem.subarray(g(at),g(at)+bytes.length)),Buffer.from(bytes));
        spans.forEach(([p,n],i)=>assert.deepEqual(Buffer.from(mem.subarray(p,p+n)),guards[i]));
        assert.deepEqual(Buffer.from(mem.subarray(g(stack-64),g(stack+64))),stackGuard);
        assert.deepEqual([e.get_page_hits()-hits,e.get_cache_stores()-stores],hot?[1,0]:[0,1]);
        let used=0, status=beforeFlags&0x8d5;
        while (used < (rep ? count : 1)) {
          status=subFlags(bits,...pairs[used++]);
          if (rep===0xf3 && !(status&64) || rep===0xf2 && (status&64)) break;
        }
        const expected=initial.slice();
        if (cmps) expected[6]=(initial[6]&0xffff0000 | (si+used*step)&65535)>>>0;
        expected[7]=(initial[7]&0xffff0000 | (di+used*step)&65535)>>>0;
        if (rep) expected[1]=(initial[1]&0xffff0000 | count-used)>>>0;
        const label=`code16 ${bits} ${cmps?'CMPS':'SCAS'} rep=${rep} case=${scenario} hot=${hot}`;
        checkThat(label+' GPRs',JSON.stringify(actual)===JSON.stringify(expected));
        check(label+' flags',flags()&0xcd5,status|(df?0x400:0));
        if (used) check(label+' width',afterLazy[4],bits-1);
        else checkThat(label+' zero count preserves lazy flags',JSON.stringify(beforeLazy)===JSON.stringify(afterLazy));
        rows++;
      }
    }
  console.log(`code16 string comparisons: ${rows} rows, ${site} cold and ${site} same-address cache hits`);
}

(async () => {
  await runStringComparisons();
  // One instance per image, deliberately. The block cache is keyed by linear
  // address and loading a second NE does not invalidate it, so a shared
  // instance runs the *previous* app's decoded blocks at the same addresses —
  // which is exactly what happened here, and it made FREECELL stop somewhere
  // WINMINE's code had gone.
  for (const name of process.argv.includes('--strings-only') ? []
    : ['WINMINE.EXE', 'FREECELL.EXE', 'MSHEARTS.EXE', 'SOL.EXE']) {
    const { inst, memory, logged } = await instantiate();
    runOne(inst, memory, logged, name);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
