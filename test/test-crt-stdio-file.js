#!/usr/bin/env node

// The built-in CRT's FILE* is a real 32-byte MSVCRT FILE in guest memory,
// because MSVC-compiled code reads it directly: feof/ferror and getc/putc are
// macros over _flag/_ptr/_cnt. Winamp 2.91 inlines feof as
// `test byte [FILE+0xc],0x10` and spun forever on a bare handle when
// msvcrt.dll was absent. This pins the struct fields and the _flag
// transitions (MSVCRT's _filbuf/_flsbuf rules) through every stdio handler,
// against the real VFS. Each handler is cdecl and pops only its return
// address.

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const call = (name, params) => {
  const args = params.map(p => `(local.get $${p})`);
  while (args.length < 5) args.push('(i32.const 0)');
  return String.raw`
  (func (export "t_${name}") ${params.map(p => `(param $${p} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x7e7e7e7e))
    (call $handle_${name} ${args.join(' ')} (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK + 4}))
      (then (unreachable)))
    (i32.load offset=0 (global.get $reg_base)))`;
};

const extraWat = String.raw`
  (func (export "t_init")
    (global.set $image_base (i32.const 0))
    (global.set $thunk_guest_base (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  ;; fputc reads its byte from the caller's argument slot [esp+4].
  (func (export "t_fputc") (param $c i32) (param $f i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $gs32 (i32.const ${STACK + 4}) (local.get $c))
    (call $gs32 (i32.const ${STACK + 8}) (local.get $f))
    (call $handle_fputc (local.get $c) (local.get $f)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK + 4}))
      (then (unreachable)))
    (i32.load offset=0 (global.get $reg_base)))
  ${call('fopen', ['path', 'mode'])}
  ${call('freopen', ['path', 'mode', 'f'])}
  ${call('fclose', ['f'])}
  ${call('fgets', ['buf', 'n', 'f'])}
  ${call('fread', ['buf', 'size', 'count', 'f'])}
  ${call('fwrite', ['buf', 'size', 'count', 'f'])}
  ${call('fputs', ['s', 'f'])}
  ${call('feof', ['f'])}
  ${call('ferror', ['f'])}
  ${call('clearerr', ['f'])}
  ${call('setbuf', ['f', 'buf'])}
  ${call('fseek', ['f', 'off', 'whence'])}
  ${call('ftell', ['f'])}
  ${call('fflush', ['f'])}
  ${call('_iob', [])}
`;

const _IOREAD = 0x1, _IOWRT = 0x2, _IONBF = 0x4, _IOEOF = 0x10, _IOERR = 0x20, _IORW = 0x80;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none',
    extraHostOverrides: { crash_unimplemented: () => {} } });
  const e = harness.exports;
  const vfs = harness.hostCtx.vfs;
  e.t_init();

  const ascii = (p, s) => [...s, '\0'].forEach((c, i) => e.guest_write8(p + i, c.charCodeAt(0)));
  const cstr = p => { let s = ''; for (let c; (c = e.guest_read8(p)); p++) s += String.fromCharCode(c); return s; };
  const u32 = p => e.guest_read32(p) >>> 0;
  const flag = f => u32(f + 0x0c);
  const PATH = 0x1000, MODE = 0x1100, BUF = 0x2000, TEXT = 0x3000;

  const host = vfs.createFile('c:\\stdio.txt', 0xc0000000, 2);
  const content = 'one\ntwo\nlast';
  vfs.writeFile(host, Uint8Array.from(Buffer.from(content)), content.length);
  vfs.closeHandle ? vfs.closeHandle(host) : harness.host.fs_close_handle(host);
  ascii(PATH, 'c:\\stdio.txt');

  // --- fopen("r"): the struct MSVCRT builds for an unbuffered read stream.
  ascii(MODE, 'r');
  const f = e.t_fopen(PATH, MODE) >>> 0;
  assert.notStrictEqual(f, 0, 'fopen returns a FILE*');
  assert.strictEqual(u32(f + 0x00), f + 0x14, '_ptr points at _charbuf');
  assert.strictEqual(u32(f + 0x04), 0, '_cnt is 0: inline getc falls through to the library');
  assert.strictEqual(u32(f + 0x08), f + 0x14, '_base is _charbuf');
  assert.strictEqual(flag(f), _IOREAD | _IONBF, '_flag = _IOREAD | _IONBF');
  const handle = u32(f + 0x10);
  assert(vfs.handles.get(handle), '_file is the live VFS handle');
  assert.strictEqual(e.t_setbuf(f, 0), 0x7e7e7e7e, 'setbuf is void and preserves EAX');
  assert.strictEqual(flag(f), _IOREAD | _IONBF);
  const snapshot = file => Array.from({length:8}, (_,i)=>u32(file+i*4));
  const rejectsSetbuf = (file, buf, label) => {
    const before = file ? snapshot(file) : null;
    assert.throws(()=>e.t_setbuf(file,buf),WebAssembly.RuntimeError,label);
    if (file) assert.deepStrictEqual(snapshot(file),before,label+' leaves FILE unchanged');
  };
  rejectsSetbuf(f, BUF, 'custom buffer is explicitly unsupported');
  rejectsSetbuf(0, 0, 'NULL FILE is rejected');
  rejectsSetbuf(BUF, 0, 'unowned FILE is rejected');
  for (const [offset,value,label] of [
    [4,1,'pending count'],
    [12,flag(f)|0x08,'CRT allocated buffering flag'],
    [12,flag(f)|0x100,'caller buffering flag'],
    [16,handle+1,'descriptor mismatch'],
    [0,f+21,'pointer mismatch'],
    [8,f+21,'base mismatch'],
  ]) {
    const saved=u32(f+offset);
    e.guest_write32(f+offset,value);
    rejectsSetbuf(f,0,label);
    e.guest_write32(f+offset,saved);
  }
  e.guest_write32(f+12,flag(f)|_IOEOF|_IOERR);
  e.t_setbuf(f,0);
  assert.strictEqual(flag(f),_IOREAD|_IONBF|_IOEOF|_IOERR,'setbuf preserves EOF/error indicators');
  e.t_clearerr(f);
  assert.strictEqual(u32(f + 0x18), 2, '_bufsiz of an unbuffered stream');
  assert.strictEqual(u32(f + 0x1c), 0, '_tmpfname');
  assert.strictEqual(e.t_feof(f), 0);

  // --- fgets line by line; EOF is set only when a read comes up short.
  assert.strictEqual(e.t_fgets(BUF, 64, f) >>> 0, BUF);
  assert.strictEqual(cstr(BUF), 'one\n');
  assert.strictEqual(flag(f) & _IOEOF, 0, 'a full line does not set _IOEOF');
  assert.strictEqual(e.t_ftell(f), 4);
  assert.strictEqual(e.t_fgets(BUF, 3, f) >>> 0, BUF, 'n-1 bytes at most');
  assert.strictEqual(cstr(BUF), 'tw');
  assert.strictEqual(e.t_fgets(BUF, 64, f) >>> 0, BUF);
  assert.strictEqual(cstr(BUF), 'o\n');
  assert.strictEqual(e.t_fgets(BUF, 64, f) >>> 0, BUF, 'a last line without newline is returned');
  assert.strictEqual(cstr(BUF), 'last');
  assert.strictEqual(flag(f) & _IOEOF, _IOEOF, 'running into the end sets _IOEOF in the struct');
  assert.notStrictEqual(e.t_feof(f), 0, 'feof agrees with the inline macro');
  assert.strictEqual(e.t_fgets(BUF, 64, f), 0, 'fgets at EOF returns NULL');
  assert.strictEqual(e.t_ferror(f), 0, 'EOF is not an error');
  assert.strictEqual(u32(f + 0x04), 0, '_cnt stays 0');

  // --- clearerr and fseek both clear _IOEOF; fread to the end sets it again.
  e.t_clearerr(f);
  assert.strictEqual(flag(f) & (_IOEOF | _IOERR), 0, 'clearerr clears _IOEOF/_IOERR');
  e.t_fgets(BUF, 64, f);
  assert.notStrictEqual(e.t_feof(f), 0);
  assert.strictEqual(e.t_fseek(f, 4, 0), 0);
  assert.strictEqual(flag(f) & _IOEOF, 0, 'fseek clears _IOEOF');
  assert.strictEqual(e.t_fseek(f, 0, 7), -1, 'invalid whence');
  assert.strictEqual(e.t_fread(BUF, 1, 100, f), content.length - 4, 'fread returns what was there');
  assert.strictEqual(flag(f) & _IOEOF, _IOEOF, 'a short fread sets _IOEOF');
  assert.strictEqual(e.t_fseek(f, 0, 0), 0);
  assert.strictEqual(e.t_fread(BUF, 4, 2, f), 2, 'fread counts whole items');
  assert.strictEqual(flag(f) & _IOEOF, 0);

  // --- writing to a read-only stream fails and latches _IOERR.
  assert.strictEqual(e.t_fputc(0x41, f), -1, 'fputc on an "r" stream is EOF');
  assert.notStrictEqual(e.t_ferror(f), 0, '_IOERR latched');
  assert.strictEqual(flag(f) & _IOERR, _IOERR);
  e.t_clearerr(f);
  assert.strictEqual(e.t_ferror(f), 0);
  assert.strictEqual(e.t_fflush(f), 0);

  assert.strictEqual(e.t_fclose(f), 0, 'fclose succeeds');
  const rec = vfs.handles.get(handle);
  assert(!rec || rec.closed, 'fclose closes the VFS handle');
  assert.strictEqual(e.t_fclose(f), -1, 'a closed FILE* is no longer a stream');

  // --- unknown FILE*: rejected, and nothing is written through it.
  e.guest_write32(0x4000 + 0x0c, 0x12345678);
  assert.strictEqual(e.t_fgets(BUF, 64, 0x4000), 0);
  assert.strictEqual(e.t_fputs(TEXT, 0x4000), -1);
  assert.strictEqual(u32(0x4000 + 0x0c), 0x12345678, 'a foreign FILE* is left untouched');
  assert.strictEqual(e.t_feof(0), 1, 'feof(NULL) terminates a polling loop');

  // --- invalid mode.
  ascii(MODE, 'x');
  assert.strictEqual(e.t_fopen(PATH, MODE), 0, 'an invalid mode returns NULL');

  // --- "w+": _IORW only; direction switches need a seek, as in MSVCRT.
  ascii(PATH, 'c:\\rw.txt');
  ascii(MODE, 'w+b');
  const w = e.t_fopen(PATH, MODE) >>> 0;
  assert.notStrictEqual(w, 0);
  assert.strictEqual(flag(w), _IORW | _IONBF, '"w+" is _IORW alone');
  ascii(TEXT, 'hello');
  assert.strictEqual(e.t_fputs(TEXT, w), 0);
  assert.strictEqual(flag(w), _IORW | _IONBF | _IOWRT, 'writing sets _IOWRT');
  assert.strictEqual(e.t_fread(BUF, 1, 5, w), 0, 'read right after write fails');
  assert.notStrictEqual(e.t_ferror(w), 0);
  e.t_clearerr(w);
  assert.strictEqual(e.t_fseek(w, 0, 0), 0);
  assert.strictEqual(flag(w), _IORW | _IONBF, 'fseek drops the direction of an _IORW stream');
  assert.strictEqual(e.t_fread(BUF, 1, 5, w), 5);
  assert.strictEqual(flag(w), _IORW | _IONBF | _IOREAD, 'reading sets _IOREAD');
  assert.strictEqual(e.t_fputc(0x21, w), -1, 'write while reading (not at EOF) fails');
  e.t_clearerr(w);
  assert.strictEqual(e.t_fread(BUF, 1, 5, w), 0);
  assert.notStrictEqual(e.t_feof(w), 0);
  assert.strictEqual(e.t_fputc(0x21, w), 0x21, 'write after reading to EOF is allowed');
  assert.strictEqual(flag(w) & (_IOREAD | _IOEOF), 0);
  assert.strictEqual(e.t_fwrite(TEXT, 1, 5, w), 5);
  assert.strictEqual(e.t_ftell(w), 11);
  assert.strictEqual(e.t_fclose(w), 0);

  // --- "a": every write lands at the end.
  ascii(MODE, 'a');
  const a = e.t_fopen(PATH, MODE) >>> 0;
  assert.strictEqual(flag(a), _IOWRT | _IONBF);
  e.t_fseek(a, 0, 0);
  ascii(TEXT, '#');
  assert.strictEqual(e.t_fputs(TEXT, a), 0);
  assert.strictEqual(e.t_ftell(a), 12, 'append ignores the seek');
  assert.strictEqual(e.t_fread(BUF, 1, 1, a), 0, 'an "a" stream cannot read');
  assert.strictEqual(e.t_fclose(a), 0);
  const rwPath = [...vfs.files.keys()].find(k => /rw\.txt$/i.test(k));
  assert.strictEqual(Buffer.from(vfs.files.get(rwPath).data).toString(), 'hello!hello#');

  // --- _iob: stdin/stdout/stderr are real FILEs too.
  const iob = e.t__iob() >>> 0;
  assert.notStrictEqual(iob, 0);
  assert.strictEqual(e.t__iob() >>> 0, iob, 'one _iob table per process');
  assert.deepStrictEqual([0, 1, 2].map(i => flag(iob + 32 * i)), [_IOREAD, _IOWRT, _IOWRT]);
  assert.deepStrictEqual([0, 1, 2].map(i => u32(iob + 32 * i + 0x10)), [0, 1, 2], '_file = fd');
  const stderr = iob + 64;
  e.t_setbuf(stderr,0);
  assert.strictEqual(flag(stderr),_IOWRT|_IONBF);
  assert.strictEqual(u32(stderr),stderr+20);
  assert.strictEqual(u32(stderr+8),stderr+20);
  assert.strictEqual(u32(stderr+24),2);
  const stdout = iob + 32;
  ascii(PATH, 'c:\\out.txt');
  ascii(MODE, 'w');
  assert.strictEqual(e.t_freopen(PATH, MODE, stdout) >>> 0, stdout, 'freopen keeps stdout\'s FILE*');
  assert.strictEqual(flag(stdout), _IOWRT | _IONBF);
  e.t_setbuf(stdout,0);
  ascii(TEXT, 'to stdout');
  assert.strictEqual(e.t_fputs(TEXT, stdout), 0);
  assert.strictEqual(e.t_fclose(stdout), 0);
  assert.strictEqual(flag(stdout), 0, 'a closed standard stream stays in _iob, not in use');
  rejectsSetbuf(stdout,0,'closed standard FILE is rejected');
  // SDL's fallback memcpy(FILE) does not transfer our hidden ownership.
  ascii(PATH,'c:\\donor.txt');
  const donor=e.t_fopen(PATH,MODE)>>>0;
  for(let i=0;i<32;i+=4)e.guest_write32(stdout+i,u32(donor+i));
  rejectsSetbuf(stdout,0,'copied FILE with foreign backing pointer/handle is rejected');
  assert.strictEqual(e.t_fclose(donor),0);
  const outPath = [...vfs.files.keys()].find(k => /out\.txt$/i.test(k));
  assert.strictEqual(Buffer.from(vfs.files.get(outPath).data).toString(), 'to stdout');

  console.log('PASS  CRT FILE* is a real MSVCRT FILE with truthful _ptr/_cnt/_flag through every stdio handler');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
