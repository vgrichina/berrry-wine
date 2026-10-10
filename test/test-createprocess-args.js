#!/usr/bin/env node
'use strict';
// CreateProcess(lpApplicationName, lpCommandLine, ...) hands the shell the
// program and its arguments separately. With an application name the command
// line is the child's whole command line, program token first; the handoff
// used to pass only the application name, so InstallShield's child setup
// (lpApplicationName "...\setup.exe", lpCommandLine " -deleter ") started with
// no arguments. Arguments are what follows the program-name token, read the
// C-runtime way: a quoted token runs to the next quote, an unquoted one to the
// first space or tab, and a line that starts with whitespace has an empty one.

const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const extraWat = String.raw`
  (func (export "test_create_process") (param $app i32) (param $cmd i32) (param $esp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_CreateProcessA (local.get $app) (local.get $cmd)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_create_process_w") (param $app i32) (param $cmd i32) (param $esp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_CreateProcessW (local.get $app) (local.get $cmd)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

async function main() {
  const bytes = compileSrcWasm((filename, source) =>
    filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const context = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(context);
  const launches = [];
  const readA = wa => {
    const u8 = new Uint8Array(memory.buffer);
    let s = '';
    for (let i = wa; u8[i]; i++) s += String.fromCharCode(u8[i]);
    return s;
  };
  imports.host.memory = memory;
  imports.host.exit = () => {};
  imports.host.log = () => {};
  imports.host.log_i32 = () => {};
  imports.host.crash_unimplemented = () => {};
  imports.host.shell_execute = (hwnd, opWa, fileWa, paramsWa) => {
    launches.push({ file: fileWa ? readA(fileWa) : null, params: paramsWa ? readA(paramsWa) : null });
    return 33;
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const e = instance.exports;
  context.exports = e;

  const str = (s, wide) => {
    const p = e.guest_alloc((s.length + 1) * (wide ? 2 : 1)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      if (wide) e.guest_write16(p + i * 2, s.charCodeAt(i)); else e.guest_write8(p + i, s.charCodeAt(i));
    }
    if (wide) e.guest_write16(p + s.length * 2, 0); else e.guest_write8(p + s.length, 0);
    return p;
  };
  // A stack frame whose lpCurrentDirectory / lpStartupInfo / lpProcessInformation
  // (ESP+32/+36/+40) are all NULL.
  const esp = e.guest_alloc(64) >>> 0;
  for (let i = 0; i < 64; i += 4) e.guest_write32(esp + i, 0);
  const launch = (app, cmd, wide) => {
    launches.length = 0;
    const ok = (wide ? e.test_create_process_w : e.test_create_process)(
      app === null ? 0 : str(app, wide), cmd === null ? 0 : str(cmd, wide), esp);
    assert.strictEqual(ok, 1, `CreateProcess${wide ? 'W' : 'A'}(${app}, ${cmd}) failed`);
    assert.strictEqual(launches.length, 1, 'exactly one shell handoff');
    return launches[0];
  };

  for (const wide of [false, true]) {
    const tag = wide ? 'W' : 'A';
    // InstallShield's child: an application name and a command line that is
    // only arguments (empty program token).
    assert.deepStrictEqual(launch('C:\\TEMP\\_ISTMP0\\setup.exe', ' -deleter ', wide),
      { file: 'C:\\TEMP\\_ISTMP0\\setup.exe', params: '-deleter ' }, `${tag}: leading-space command line`);
    // The usual shape: the command line repeats the program, quoted.
    assert.deepStrictEqual(
      launch('C:\\Program Files\\Game\\game.exe', '"C:\\Program Files\\Game\\game.exe" -window -level 2', wide),
      { file: 'C:\\Program Files\\Game\\game.exe', params: '-window -level 2' }, `${tag}: quoted program token`);
    // Unquoted program token, tab separator.
    assert.deepStrictEqual(launch('C:\\GAME.EXE', 'game\t/s', wide),
      { file: 'C:\\GAME.EXE', params: '/s' }, `${tag}: unquoted token, tab separator`);
    // No arguments at all.
    assert.deepStrictEqual(launch('C:\\GAME.EXE', 'GAME.EXE', wide),
      { file: 'C:\\GAME.EXE', params: '' }, `${tag}: program token only`);
    // Application name, no command line.
    assert.deepStrictEqual(launch('C:\\GAME.EXE', null, wide),
      { file: 'C:\\GAME.EXE', params: null }, `${tag}: NULL command line`);
    // No application name: the whole command line is the file, and the host
    // splits it as before.
    assert.deepStrictEqual(launch(null, '"C:\\Setup Dir\\setup.exe" /q', wide),
      { file: '"C:\\Setup Dir\\setup.exe" /q', params: null }, `${tag}: NULL application name`);
    console.log(`PASS  CreateProcess${tag} hands the shell the program and its arguments separately`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
