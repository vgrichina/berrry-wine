#!/usr/bin/env node

'use strict';

// What does a wasm JIT actually make of one of our handlers?
//
//   node tools/wasm-native.js --func='$th_rle_run'
//   node tools/wasm-native.js --index=914 --limit=80
//   node tools/wasm-native.js --top=20            # biggest functions, named
//   node tools/wasm-native.js --engine=v8 --func='$next'   # V8 TurboFan instead
//
// WHY THIS EXISTS: every performance argument in this project ends at the same
// wall -- "the JIT probably does X". A handler that looks tight in WAT can come
// out of the compiler with a spilled loop, a redundant bounds check per access,
// or a call where a tail call was written, and nothing in a batches/s number
// says which. This prints the machine code.
//
// HOW, and what the number is NOT. Node's V8 is a release build: --print-code
// and --print-wasm-code are compiled out, and attaching a debugger to read the
// JIT pages is refused by macOS. SpiderMonkey's shell, though, exposes
// wasmExtractCode(module, tier), which hands back the native code AND a
// segment table naming each function index -- no debugger, no privileges. So
// the disassembly here is **SpiderMonkey Ion**, not V8 TurboFan. The two are
// different compilers and will differ in register allocation and instruction
// selection. What carries across is everything structural: how many loads a
// handler really performs, whether a bounds check survived, whether the loop
// body stayed in registers, how big the function is. Read it for that, and do
// not quote a cycle count from it as "what Chrome does".
//
// `--engine=v8` reads V8 TurboFan's code instead -- what node and Chrome
// run -- out of the jitdump d8 writes under --perf-prof (extractV8 below).
// The two compilers can disagree completely: a register-allocation outcome
// seen in Ion says nothing about TurboFan until this confirms it.
//
// The disassembly is for the HOST architecture (this box is arm64; a run on an
// Intel box disassembles x86-64), because the compiler runs here.
//
// Needs the SpiderMonkey shell and a GNU objdump:
//   npx jsvu@latest --engines=spidermonkey     (installs ~/.jsvu/bin/sm)
//   brew install binutils                      (gobjdump, -b binary)
// Point $SM / $OBJDUMP elsewhere to override.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { scan, facts } = require('./func-index');

const ROOT = path.join(__dirname, '..');
const DEFAULT_WASM = path.join(ROOT, 'build', 'wine-assembly.wasm');
const COMBINED = path.join(ROOT, 'build', 'combined.wat');

function arg(name, fallback) {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}
function flag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

// The shells and disassemblers this looks for, in order. Each is a real
// install path on a normal box; none of them is bundled.
function findTool(envVar, candidates, hint) {
  if (process.env[envVar]) return process.env[envVar];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.error(`${envVar} not found. Tried:\n  ${candidates.join('\n  ')}\n${hint}`);
  process.exit(1);
}

// Function indices count imports first, then definitions in source order --
// the same walk tools/func-index.js does, so the names cannot drift apart.
// `--wat=` points the name table at some other module's source, so this works
// on anything we compile and not just the shipped build -- e.g. a toyvm module
// with a JIT region in it (tools/toyvm/region-jit.js --emit=).
function nameTable(watPath) {
  if (!fs.existsSync(watPath)) {
    console.error(watPath === COMBINED
      ? `${COMBINED} is missing; run bash tools/build.sh first.`
      : `${watPath} is missing (--wat=)`);
    process.exit(1);
  }
  // The shipped build is named from the compiler's own table (see facts() in
  // tools/func-index.js); the text walk misnames every index past the first
  // compiler-generated function. `--wat=` modules keep the walk.
  const { imports, defined } = (watPath === COMBINED && facts()) || scan(fs.readFileSync(watPath, 'utf8'));
  const byIndex = new Map();
  imports.forEach((f, i) => byIndex.set(i, f.name));
  defined.forEach((f, i) => byIndex.set(imports.length + i, f.name));
  const byName = new Map();
  for (const [i, n] of byIndex) if (!byName.has(n)) byName.set(n, i);
  return { byIndex, byName, importCount: imports.length };
}

function extract(smPath, wasmPath, tier, outBin) {
  const script = `
const bytes = os.file.readFile(${JSON.stringify(wasmPath)}, 'binary');
const mod = new WebAssembly.Module(bytes);
const c = wasmExtractCode(mod, ${JSON.stringify(tier)});
if (!c) { print('ERR no code for tier ${tier}'); quit(1); }
const segs = c.segments.filter(s => s.funcIndex !== undefined);
// The segment offsets are not always offsets into c.code: an x64 shell
// (SpiderMonkey 157) puts 64 bytes in front, so every function read 64 bytes
// early -- the previous function's tail on top, this one's last 64 bytes cut.
// Nothing in the result reports that base, but every normal entry opens with
// the same prologue, so pick the skew at which the most entries agree.
let skew = 0, best = -1;
for (let k = 0; k <= 512; k += 4) {
  const seen = new Map();
  for (const s of segs.slice(0, 400)) {
    const at = s.funcBodyBegin + k;
    const key = c.code[at] | (c.code[at + 1] << 8) | (c.code[at + 2] << 16) | (c.code[at + 3] << 24);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const mode = Math.max(...seen.values());
  if (mode > best) { best = mode; skew = k; }
}
os.file.writeTypedArrayToFile(${JSON.stringify(outBin)}, c.code);
print('JSON' + JSON.stringify(segs.map(s =>
  [s.funcIndex, s.funcBodyBegin + skew, s.funcBodyEnd + skew])));
`;
  const tmp = path.join(os.tmpdir(), `wasm-native-${process.pid}.js`);
  fs.writeFileSync(tmp, script);
  try {
    const out = execFileSync(smPath, [`--wasm-compiler=${tier === 'ion' ? 'ion' : 'baseline'}`, tmp],
      { encoding: 'utf8', maxBuffer: 1 << 28 });
    const line = out.split('\n').find(l => l.startsWith('JSON'));
    if (!line) {
      console.error(out.trim() || 'the shell produced no segment table');
      process.exit(1);
    }
    return JSON.parse(line.slice(4));
  } finally {
    fs.unlinkSync(tmp);
  }
}

// V8 TurboFan (`--engine=v8`). d8's disassembler is compiled out as well, but
// `--perf-prof` still writes a Linux-perf jitdump (jit-PID.dump in the cwd)
// that carries every code object's BYTES, named `JS:wasm-function[N]-N-turbofan`.
// --no-liftoff with --no-wasm-lazy-compilation makes `new WebAssembly.Module`
// compile every function with TurboFan up front, so no instance and no imports
// are needed. The functions are copied into outBin back to back, and the same
// [index, begin, end] segment table as extract() comes back.
// jitdump: a header whose third u32 is its size, then records of {u32 id,
// u32 size, u64 timestamp}; a JIT_CODE_LOAD (id 0) continues {u32 pid, u32 tid,
// u64 vma, u64 code_addr, u64 code_size, u64 code_index, name NUL, code}.
function extractV8(d8Path, wasmPath, outBin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasm-native-v8-'));
  try {
    const script = path.join(dir, 'compile.js');
    fs.writeFileSync(script, `new WebAssembly.Module(readbuffer(${JSON.stringify(wasmPath)}));\n`);
    execFileSync(d8Path, ['--perf-prof', '--no-liftoff', '--no-wasm-lazy-compilation', script],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const dump = fs.readdirSync(dir).find(f => /^jit-\d+\.dump$/.test(f));
    if (!dump) { console.error('d8 wrote no jitdump (--perf-prof)'); process.exit(1); }
    const b = fs.readFileSync(path.join(dir, dump));
    const parts = [], segs = [];
    let at = b.readUInt32LE(8), out = 0;
    while (at + 16 <= b.length) {
      const id = b.readUInt32LE(at), size = b.readUInt32LE(at + 4);
      if (size < 16) break;
      if (id === 0) {
        const codeSize = Number(b.readBigUInt64LE(at + 16 + 8 + 16));
        const nameAt = at + 16 + 40;
        const nul = b.indexOf(0, nameAt);
        const m = /^JS:wasm-function\[(\d+)\]/.exec(b.toString('latin1', nameAt, nul));
        if (m) {
          parts.push(b.subarray(nul + 1, nul + 1 + codeSize));
          segs.push([Number(m[1]), out, out + codeSize]);
          out += codeSize;
        }
      }
      at += size;
    }
    fs.writeFileSync(outBin, Buffer.concat(parts));
    return segs;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function disassemble(objdump, bin, begin, end) {
  // GNU objdump's raw-binary mode. Apple's llvm-objdump has no -b binary, which
  // is why this looks for gobjdump specifically.
  const machine = process.arch === 'arm64' ? 'aarch64' : 'i386:x86-64';
  // objdump numbers the blob from its own start; --adjust-vma cannot take a
  // negative, so the rebase to "offset within this function" happens in the
  // caller, on the printed addresses.
  return execFileSync(objdump, [
    '-b', 'binary', '-m', machine, '-D',
    `--start-address=${begin}`, `--stop-address=${end}`, bin,
  ], { encoding: 'utf8', maxBuffer: 1 << 28 });
}

function main() {
  const wasmPath = path.resolve(arg('wasm', DEFAULT_WASM));
  const engine = arg('engine', 'sm');
  if (!['sm', 'v8'].includes(engine)) { console.error(`--engine= is sm or v8, not ${engine}`); process.exit(1); }
  const tier = engine === 'v8' ? 'turbofan' : arg('tier', 'ion');
  const limit = parseInt(arg('limit', '120'), 10);
  const top = arg('top', null);
  const keep = arg('out', null);

  const shell = engine === 'v8'
    ? findTool('D8', [path.join(os.homedir(), '.jsvu', 'bin', 'v8'), '/usr/local/bin/d8', '/opt/homebrew/bin/d8'],
      'Install it with:  npx jsvu@latest --engines=v8')
    : findTool('SM', [
      path.join(os.homedir(), '.jsvu', 'bin', 'sm'),
      '/usr/local/bin/sm', '/opt/homebrew/bin/sm',
    ], 'Install it with:  npx jsvu@latest --engines=spidermonkey');

  const watPath = path.resolve(arg('wat', COMBINED));
  const names = nameTable(watPath);
  const bin = keep ? path.resolve(keep) : path.join(os.tmpdir(), `wasm-native-${process.pid}.bin`);

  const segs = engine === 'v8' ? extractV8(shell, wasmPath, bin) : extract(shell, wasmPath, tier, bin);
  const total = segs.reduce((a, s) => a + (s[2] - s[1]), 0);
  console.log(`${path.relative(ROOT, wasmPath)}: ${segs.length} functions, ` +
    `${(total / 1024).toFixed(0)}KB of ${tier} code for ` +
    `${(fs.statSync(wasmPath).size / 1024).toFixed(0)}KB of wasm ` +
    `(${(total / fs.statSync(wasmPath).size).toFixed(2)}x)`);

  try {
    if (top !== null) {
      const n = parseInt(top, 10) || 20;
      const rows = segs.slice().sort((a, b) => (b[2] - b[1]) - (a[2] - a[1])).slice(0, n);
      console.log('');
      console.log('largest functions:');
      for (const [idx, b, e] of rows) {
        console.log(`  ${String(e - b).padStart(7)} bytes  #${String(idx).padStart(5)}  ` +
          (names.byIndex.get(idx) || '(unnamed)'));
      }
      return;
    }

    let index = arg('index', null);
    const wanted = arg('func', null);
    if (index === null && wanted === null) {
      console.error('give --func=$name or --index=N (or --top=N)');
      process.exit(1);
    }
    if (index === null) {
      const key = wanted.startsWith('$') ? wanted : `$${wanted}`;
      if (!names.byName.has(key)) {
        console.error(`${key} is not a function in ${path.relative(ROOT, watPath)}`);
        process.exit(1);
      }
      index = names.byName.get(key);
    }
    index = parseInt(index, 10);

    const seg = segs.find(s => s[0] === index);
    if (!seg) {
      console.error(`#${index} (${names.byIndex.get(index) || '?'}) has no ${tier} code — ` +
        'it may be an import, or the compiler declined to tier it up.');
      process.exit(1);
    }
    const [, begin, end] = seg;
    console.log('');
    console.log(`#${index} ${names.byIndex.get(index) || '(unnamed)'}: ` +
      `${end - begin} bytes of ${tier} code, host arch ${process.arch}`);
    console.log('');

    const objdump = findTool('OBJDUMP', [
      '/opt/homebrew/opt/binutils/bin/objdump',
      '/usr/local/opt/binutils/bin/objdump',
      '/opt/homebrew/bin/gobjdump', '/usr/bin/gobjdump',
    ], 'Install it with:  brew install binutils');

    const text = disassemble(objdump, bin, begin, end);
    const lines = [];
    for (const l of text.split('\n')) {
      const m = l.match(/^\s*([0-9a-f]+):\t(.*)$/);
      if (!m) continue;
      const off = parseInt(m[1], 16) - begin;
      // Name the call targets. A direct call reads as a bare address, and
      // "does this handler still call out, and to what" is most of what this
      // tool is asked -- the answer is in the same segment table that found
      // this function. A target inside no segment is a runtime stub (trap,
      // instance call, GC barrier) and stays unnamed.
      const call = m[2].match(/\b(?:bl|callq?)\s+(?:\*?)0x([0-9a-f]+)/);
      const hit = call && segs.find(s => {
        const t = parseInt(call[1], 16);
        return t >= s[1] && t < s[2];
      });
      lines.push(`  ${off.toString(16).padStart(4, ' ')}:  ${m[2]}`
        + (hit ? `   ; ${names.byIndex.get(hit[0]) || `#${hit[0]}`}` : ''));
    }
    for (const l of lines.slice(0, limit)) console.log(l);
    if (lines.length > limit) {
      console.log(`  ... ${lines.length - limit} more instructions (--limit=${lines.length} for all)`);
    }
  } finally {
    if (!keep && fs.existsSync(bin)) fs.unlinkSync(bin);
  }
}

// Importable, so a second tool can disassemble MANY functions from ONE
// SpiderMonkey run instead of paying its ~4s startup per name. Used by
// tools/indirect-census.js.
module.exports = { findTool, nameTable, extract, extractV8, disassemble, DEFAULT_WASM, COMBINED };

if (require.main === module) main();
