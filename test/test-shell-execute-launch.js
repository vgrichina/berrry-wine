// ShellExecute("wordpad.exe") has to start a second guest.
//
// WRITE.EXE is a shim: its whole body is GetCommandLine, GetStartupInfo,
// ShellExecuteA("wordpad.exe"), ExitProcess(0). With the old host import
// (log + return 33) the dropdown entry rendered nothing at all. The shell
// now resolves the exe name against the same app registry the desktop icons
// read, which is the part worth pinning down here: name resolution, the
// unknown-exe decline, and the single-app deferral that exists because the
// launcher process is still in runningApps at the instant it calls us.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createBrowserShell } = require('../lib/browser-shell.js');

// Exercise the real snapshot/adopt/merge operations. Only PE boot is replaced;
// the retained full browser control separately executes both authored PEs.
(async () => {
  const { VirtualFS } = require('../lib/filesystem');
  const put = (vfs, p, text, close = true) => {
    const h = vfs.createFile(p, 0x40000000, 2);
    assert(h); const bytes = Buffer.from(text);
    assert(vfs.writeFile(h, bytes, bytes.length).ok);
    if (close) vfs.closeHandle(h);
    return h;
  };
  const read = (vfs, p) => {
    const h = vfs.createFile(p, 0x80000000, 3);
    if (!h) return null;
    const buf = new Uint8Array(1024), result = vfs.readFile(h, buf, buf.length); vfs.closeHandle(h);
    assert(result.ok);
    return Buffer.from(buf.subarray(0, result.bytesRead)).toString();
  };
  function fixture(singleApp = false) {
    const apps = {}, launches = [], parentVfs = new VirtualFS();
    for (const name of ['child.exe', 'sibling.exe']) put(parentVfs, 'c:\\' + name, 'MZ');
    const parent = { _helpCtx: { vfs: parentVfs }, memory: {}, _stopped: false };
    const shell = createBrowserShell({ apps, singleApp: () => singleApp,
      screenCanvasSize: () => ({ w: 640, h: 480 }), appendDebugLog() {} });
    shell.launchApp = (key, options) => launches.push({ app: options._vfsAppEntry || apps[key], options });
    async function launch(name = 'child.exe', options = {}) {
      assert(shell.launchVfsExe('c:\\' + name, parent, '', '', options));
      const row = launches.at(-1), vfs = new VirtualFS();
      for (const mount of row.app.mounts) await mount(vfs);
      row.child = { _helpCtx: { vfs }, memory: {}, _stopped: false };
      await row.options.beforeRun?.(row.child);
      row.finish = () => { vfs.closeAllDiskHandles(); row.child._stopped = true; row.options.onExit(row.child); };
      return row;
    }
    return { shell, parent, vfs: parentVfs, launches, launch };
  }
  // Closed bytes, independent sibling output, parent writes, deletion, and
  // actual open-handle identity survive both completions in either order.
  for (const reverse of [false, true]) {
    const f = fixture();
    put(f.vfs, 'c:\\gone.txt', 'delete me');
    put(f.vfs, 'c:\\edited.txt', 'before');
    put(f.vfs, 'c:\\deleted-parent.txt', 'before');
    const reader = f.vfs.createFile('c:\\gone.txt', 0x80000000, 3);
    const a = await f.launch(), b = await f.launch('sibling.exe');
    const av = a.child._helpCtx.vfs, bv = b.child._helpCtx.vfs;
    put(av, 'c:\\a.txt', 'closed A'); put(bv, 'c:\\b.txt', 'closed B');
    const openChild = put(av, 'c:\\open-child.txt', 'closed by stop', false);
    put(av, 'c:\\conflict.txt', 'child');
    put(bv, 'c:\\conflict.txt', 'sibling');
    const writer = put(f.vfs, 'c:\\conflict.txt', 'parent', false);
    put(f.vfs, 'c:\\edited.txt', 'new parent');
    av.deleteFile('c:\\edited.txt'); av.deleteFile('c:\\gone.txt');
    f.vfs.deleteFile('c:\\deleted-parent.txt');
    put(av, 'c:\\deleted-parent.txt', 'child still has this');
    put(f.vfs, 'c:\\unrelated.txt', 'unrelated');
    assert.equal(read(f.vfs, 'c:\\a.txt'), null, 'new files publish only at exit');
    for (const row of reverse ? [b, a] : [a, b]) row.finish();
    assert.equal(read(f.vfs, 'c:\\a.txt'), 'closed A');
    assert.equal(read(f.vfs, 'c:\\b.txt'), 'closed B');
    assert.equal(read(f.vfs, 'c:\\open-child.txt'), 'closed by stop');
    assert(av.handles.get(openChild).closed);
    assert.equal(read(f.vfs, 'c:\\conflict.txt'), 'parent');
    assert.equal(read(f.vfs, 'c:\\edited.txt'), 'new parent', 'shared-entry parent write defeats child delete');
    assert.equal(read(f.vfs, 'c:\\deleted-parent.txt'), null, 'child cannot resurrect parent deletion');
    assert.equal(read(f.vfs, 'c:\\unrelated.txt'), 'unrelated');
    assert.equal(read(f.vfs, 'c:\\gone.txt'), null);
    const buffer = new Uint8Array(1024), result = f.vfs.readFile(reader, buffer, buffer.length);
    assert.equal(Buffer.from(buffer.subarray(0, result.bytesRead)).toString(), 'delete me', 'unlinked reader retains entry');
    assert(!f.vfs.handles.get(writer).closed, 'merge does not close a parent handle');
    const bytes = Buffer.from('!'); assert(f.vfs.writeFile(writer, bytes, 1).ok);
    assert.equal(read(f.vfs, 'c:\\conflict.txt'), 'parent!');
    put(f.vfs, 'c:\\a.txt', 'after completion'); a.finish();
    assert.equal(read(f.vfs, 'c:\\a.txt'), 'after completion', 'late exit is inert');
    f.vfs.closeAllDiskHandles();
  }
  // Launch/parent/child identities and null failure completion are terminal.
  for (const mode of ['null', 'stopped-parent', 'parent-context', 'parent-vfs', 'parent-memory',
    'parent-map', 'retired-parent', 'child-context', 'child-vfs', 'child-memory']) {
    const f = fixture(); let calls = 0;
    const row = await f.launch('child.exe', { onExit() { calls++; } });
    put(row.child._helpCtx.vfs, 'c:\\out.txt', 'unpublishable');
    if (mode === 'null') row.options.onExit(null);
    if (mode === 'stopped-parent') f.parent._stopped = true;
    if (mode === 'parent-context') f.parent._helpCtx = { vfs: f.vfs };
    if (mode === 'parent-vfs') f.parent._helpCtx.vfs = new VirtualFS();
    if (mode === 'parent-memory') f.parent.memory = {};
    if (mode === 'parent-map') f.vfs.files = new Map(f.vfs.files);
    if (mode === 'retired-parent') f.vfs.closeAllDiskHandles();
    if (mode === 'child-context') row.child._helpCtx = { vfs: row.child._helpCtx.vfs };
    if (mode === 'child-vfs') row.child._helpCtx.vfs = new VirtualFS();
    if (mode === 'child-memory') row.child.memory = {};
    row.finish(); row.options.onExit(null);
    assert(!f.vfs.files.has('c:\\out.txt'), mode);
    assert.equal(calls, 1, mode + ' callback completes once');
    await assert.rejects(row.options.beforeRun(row.child), /already ended/);
  }
  {
    const f = fixture(); let exits = 0;
    const row = await f.launch('child.exe', { beforeRun(child) { child.startup = true; }, onExit() { exits++; } });
    assert(row.child.startup);
    const alien = { _helpCtx: { vfs: new VirtualFS() }, _stopped: true };
    put(alien._helpCtx.vfs, 'c:\\alien.txt', 'wrong callback');
    row.options.onExit(alien); assert.equal(exits, 0);
    put(row.child._helpCtx.vfs, 'c:\\out.txt', 'right callback'); row.finish();
    assert.equal(read(f.vfs, 'c:\\out.txt'), 'right callback');
    assert.equal(read(f.vfs, 'c:\\alien.txt'), null); assert.equal(exits, 1);
  }
  {
    const f = fixture(); let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const pending = f.launch('child.exe', { beforeRun() {
      entered(); return new Promise(resolve => { release = resolve; });
    } });
    await started;
    const row = f.launches[0]; row.options.onExit(null); release();
    await assert.rejects(pending, /already ended/, 'cancel during attachment prevents startup');
    row.child._stopped = true; put(row.child._helpCtx.vfs, 'c:\\late.txt', 'late bytes');
    row.options.onExit(row.child);
    assert.equal(read(f.vfs, 'c:\\late.txt'), null);
  }
  {
    const f = fixture();
    f.vfs.createDirectory('c:\\removed-dir');
    // Capturing a baseline must never touch the data getter of mounted media.
    const lazy = { _provider: {}, _size: 99, attrs: 0x20 };
    Object.defineProperty(lazy, 'data', { get() { throw new Error('lazy materialization'); } });
    f.vfs.files.set('c:\\lazy.bin', lazy);
    const row = await f.launch();
    put(row.child._helpCtx.vfs, 'c:\\removed-dir\\late.txt', 'must not recreate ancestor');
    f.vfs.removeDirectory('c:\\removed-dir');
    row.finish();
    assert(!f.vfs.dirs.has('c:\\removed-dir'), 'merge cannot recreate a deleted parent directory');
    assert.equal(read(f.vfs, 'c:\\removed-dir\\late.txt'), null);
    assert.equal(f.vfs.files.get('c:\\lazy.bin'), lazy);
  }
  {
    const f = fixture(); let exits = 0;
    assert.equal(f.shell.launchVfsExe('c:\\missing.exe', f.parent, '', '', { onExit() { exits++; } }), false);
    assert.equal(f.launches.length, 0); assert.equal(exits, 0);
    assert(f.shell.launchVfsExe('c:\\dxsetup.exe', f.parent, '', '', { onExit(child, outcome) {
      assert.equal(child, null); assert.equal(outcome, 'already-satisfied'); exits++;
    } }));
    assert.equal(exits, 1); assert.equal(f.launches.length, 0);
    const callbacks = { bypassSingleApp: true, beforeRun() {}, onExit() {} };
    assert(f.shell.launchVfsExe('c:\\child.exe', f.parent, '', '', callbacks));
    assert.equal(f.launches[0].options.beforeRun, callbacks.beforeRun);
    assert.equal(f.launches[0].options.onExit, callbacks.onExit, 'tracked process keeps its own merge lifecycle');
  }
  {
    const f = fixture();
    assert(f.shell.launchVfsExe('c:\\child.exe', f.parent, '', 'first'));
    const first = f.launches[0];
    put(f.vfs, 'c:\\only-second.txt', 'second snapshot');
    assert(f.shell.launchVfsExe('c:\\child.exe', f.parent, '', 'second'));
    const second = f.launches[1];
    const a = new VirtualFS(), b = new VirtualFS();
    for (const mount of first.options._vfsAppEntry.mounts) await mount(a);
    for (const mount of second.options._vfsAppEntry.mounts) await mount(b);
    assert.equal(first.options._vfsAppEntry.args, 'first');
    assert.equal(second.options._vfsAppEntry.args, 'second');
    assert.equal(read(a, 'c:\\only-second.txt'), null);
    assert.equal(read(b, 'c:\\only-second.txt'), 'second snapshot');
    assert.notEqual(first.options.onExit, second.options.onExit, 'each queued same-name launch retains its own completion');
    first.options.onExit(null); second.options.onExit(null);
  }
  console.log('ok: ordinary child exit merges closed bytes with sibling/parent conflicts and lifecycle identity fences');
})().catch(e => { console.error(e); process.exitCode = 1; });

const apps = {
  wordpad:   { exe: 'binaries/win98-apps/wordpad.exe' },
  mspaint98: { exe: 'binaries/win98-apps/mspaint.exe' },
  write:     { exe: 'binaries/win98-apps/write.exe' },
  scr_architec: { exe: 'binaries/screensavers/ARCHITEC.SCR', args: '/s' },
};

function makeShell(opts = {}) {
  const launched = [];
  const logs = [];
  const shell = createBrowserShell({
    apps,
    debugMode: false,
    screenCanvasSize: () => ({ w: 640, h: 480 }),
    appendDebugLog: t => logs.push(t),
    singleApp: () => !!opts.singleApp,
  });
  // launchApp() boots a real guest against the DOM; the resolver is what this
  // test is about, so stand in for the boot itself.
  const realLaunch = shell.launchApp;
  shell.launchApp = key => { launched.push(key); };
  return { shell, launched, logs, realLaunch };
}

// A page navigation must not leave its 512MB guest for Safari's page cache to
// retain. Unlike an ordinary close, this release cannot wait for setTimeout.
{
  const { shell } = makeShell();
  const calls = [];
  const guest = {
    stop(options) { calls.push(options); },
  };
  shell.runningApps.push({ wine: guest, name: 'wordpad' });
  shell.releaseForPageHide();
  assert.deepStrictEqual(calls, [{ repaint: false, releaseNow: true }],
    'pagehide requests synchronous guest-memory release without repainting');
  assert.strictEqual(shell.runningApps.length, 0,
    'pagehide clears the process list after detaching its guests');
  const shellSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'browser-shell.js'), 'utf8');
  assert.match(shellSource, /if \(wine\) guests\.add\(wine\)/,
    'pagehide also owns the host currently booting before runningApps registration');
  console.log('ok: pagehide synchronously releases running and booting guest memory');
}

// 1. exe name -> app key, three ways.
{
  const { shell } = makeShell();
  assert.strictEqual(shell.appKeyForExe('wordpad.exe'), 'wordpad',
    'app key matches the exe stem');
  assert.strictEqual(shell.appKeyForExe('C:\\WINDOWS\\WordPad.EXE'), 'wordpad',
    'a full backslash path and mixed case still resolve');
  assert.strictEqual(shell.appKeyForExe('mspaint.exe'), 'mspaint98',
    'falls back to the registered exe basename when the key differs');
  assert.strictEqual(shell.appKeyForExe('nosuchprogram.exe'), null,
    'an unregistered exe resolves to nothing');
  assert.strictEqual(shell.appKeyForExe('ARCHITEC.SCR'), 'scr_architec',
    'native applet Preview resolves a registered saver basename');
  assert.strictEqual(shell.appKeyForExe('architec.scr'), 'scr_architec');
  assert.strictEqual(shell.appKeyForExe('ARCHITEC.SCR.txt'), null);
  assert.strictEqual(shell.appKeyForExe(''), null);
  console.log('ok: exe name resolution');
}

// 1b. An app this host does not serve never resolves. On the deployed site a
//     guest's "setup.exe" matched the local-only Moorhuhn 3 puzzle (exe
//     setup.exe) and its launch failed with a 404.
{
  const served = createBrowserShell({
    apps: { ...apps, puzzle: { exe: 'test/binaries/candidates/p/setup.exe' } },
    unservedApps: ['puzzle', 'wordpad'],
    debugMode: false,
    screenCanvasSize: () => ({ w: 640, h: 480 }),
  });
  assert.strictEqual(served.appKeyForExe('setup.exe'), null,
    'an unserved app is not matched by its exe basename');
  assert.strictEqual(served.appKeyForExe('wordpad.exe'), null,
    'an unserved app is not matched by its key either');
  assert.strictEqual(served.appKeyForExe('mspaint.exe'), 'mspaint98',
    'served apps still resolve');
  console.log('ok: unserved apps never resolve');
}

// 2. launchExe reports whether the name resolved, and declines unknown exes
//    without launching anything.
{
  const { shell, launched, logs } = makeShell();
  // launchExe closes over the module-internal launchApp, so exercise it
  // through a shell whose registry entry is what we assert on instead.
  assert.strictEqual(shell.launchExe('nosuchprogram.exe'), false,
    'unknown exe is declined');
  assert.strictEqual(launched.length, 0, 'nothing was launched');
  assert.ok(logs.some(l => l.includes('nosuchprogram.exe')),
    'the decline is visible in the debug log');
  console.log('ok: unknown exe declined');
}

// 3. VFS child launches keep the command line with the dynamic app, and the
//    real launcher passes app.args into loadExe() before the PE starts. Inno
//    bootstrap installers rely on this for their /SL4 handoff: without it the
//    child setup EXE looks for a missing sidecar .bin and shows only "Error".
{
  const { shell } = makeShell();
  const files = new Map([
    ['c:\\windows\\temp\\is-test.tmp\\child.tmp', { data: new Uint8Array([77, 90]), attrs: 0x20 }],
    ['c:\\ptanks.exe', { data: new Uint8Array([77, 90, 1]), attrs: 0x20 }],
  ]);
  const vfs = {
    files,
    dirs: new Set(['c:\\windows\\temp\\is-test.tmp']),
    readOnlyDrives: new Set(),
    cwd: 'c:\\windows\\temp\\is-test.tmp\\',
    _normPath: p => String(p).toLowerCase(),
    _resolvePath(p) {
      const value = /^[a-z]:/i.test(p) ? p : this.cwd + p;
      return this._normPath(value).replace(/\\+/g, '\\');
    },
    adoptFrom(other) {
      for (const [p, entry] of other.files) this.files.set(p, entry);
      for (const dir of other.dirs) this.dirs.add(dir);
    },
  };
  const coreBase = { loadAddr: 0x10a62000, origBase: 0x10100000 };
  const caller = { _helpCtx: { vfs }, _runSliceAppKey: 'cue:speed-demons',
    asyncMultimediaTimer: true,
    // host.js keys each loaded module twice, with and without the extension.
    moduleBases: { 'core.dll': coreBase, core: coreBase },
    // The Worker backend's loader results carry no names, so with Threads on
    // only the byte cache knows what was loaded.
    _loadedDllBytesByName: { 'core.dll': new Uint8Array(1), 'engine.dll': new Uint8Array(1) } };
  const ok = shell.launchVfsExe('C:\\windows\\temp\\is-test.tmp\\child.tmp',
    caller, '', '/SL4 $10001 "C:\\ptanks.exe" 2743738 52736');
  assert.strictEqual(ok, true, 'absolute child exe in the caller VFS is accepted');
  const child = apps['vfs:c:\\windows\\temp\\is-test.tmp\\child.tmp'];
  assert.ok(child, 'dynamic vfs app entry is registered');
  assert.strictEqual(child.args, '/SL4 $10001 "C:\\ptanks.exe" 2743738 52736',
    'dynamic child command line is preserved');
  assert.strictEqual(child.runSliceAppKey, 'cue:speed-demons',
    'dynamic child inherits the mounted app Auto run-slice policy');
  assert.strictEqual(child.asyncMultimediaTimer, true,
    'chain-launched installed children inherit multimedia timer semantics');
  assert.deepStrictEqual(child.inheritedDlls, ['core.dll', 'engine.dll'],
    'a child inherits the names of the DLLs its caller runs as real PEs');

  assert.strictEqual(shell.launchVfsExe('child.tmp', { _helpCtx: { vfs } }, '', ''), true,
    'relative child exe resolves against the caller working directory');
  assert.ok(apps['vfs:c:\\windows\\temp\\is-test.tmp\\child.tmp'],
    'relative launch registers the normalized absolute VFS executable');

  const shellSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'browser-shell.js'), 'utf8');
  assert.match(shellSource,
    /let launchArgs = [^;]*\bapp\.args;[\s\S]*?wine\.loadExe\(app\.exe,\s*\{[\s\S]*?\bargs:\s*launchArgs,[\s\S]*?\}\)/,
    'browser launch must pass app.args into loadExe before PE startup');
  assert.match(shellSource,
    /vfs\.setCurrentDirectory\(app\.workingDirectory\)/,
    'browser launch must apply an imported-media executable directory before startup');
  assert.match(shellSource,
    /if \(app\.mirrorWorkingDirectoryToC && vfs\.files instanceof Map\)/,
    'browser launch must mirror imported sidecars beside its reported C:\\ executable path');
  assert.match(shellSource,
    /vfs\.copyFile\(path, alias, false\)/,
    'sidecar aliases must remain lazy but detach safely if the C: copy is written');
  assert.match(shellSource,
    /return \{ name, path: mountedPath, bytes: await vfs\.materialize\(mountedPath\) \}/,
    'app-local DLLs retain their installed path for GetModuleFileName and sibling plug-in discovery');
  assert(shellSource.indexOf('vfs.copyFile(path, alias, false)') <
      shellSource.indexOf('await attachDynamicOverlay(wine, app, sel)'),
    'base-media aliases must exist before overlay change tracking begins');
  const hostSource = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
  assert.match(hostSource,
    /resolved = ctx\.vfs\._resolvePath\(fullName\)[\s\S]*?return ctx\.vfs\.materialize\(resolved\)/,
    'runtime DLL loading prefers the exact current-directory VFS entry over duplicate basenames');
  assert.match(hostSource,
    /if \(absolute && shell\.launchVfsExe && shell\.launchVfsExe\(launchFile, self, launchDir, params, launchOpts\)\)/,
    'browser host offers relative and absolute executable names to the caller VFS');
  const relativeLaunch = hostSource.indexOf('if (!absolute && shell.launchVfsExe && shell.launchVfsExe(launchFile, self, launchDir, params, launchOpts))');
  assert(relativeLaunch >= 0 && relativeLaunch <
      hostSource.indexOf("if (!parsedCommand.isWinExec && /\\.(exe|scr)$/i.test(file) && shell.launchExe(file, launchOpts))"),
    'a bare name in the caller current directory (NFS II autorun "setup.exe") beats the registry basename match');
  assert.strictEqual(
    (shellSource.match(/queuePendingLaunch\(key, SINGLE_APP\(\), launchOpts\);/g) || []).length,
    2,
    'registered and inherited-VFS handoffs use the dormant process queue');
  assert.strictEqual(
    (shellSource.match(/if \(launchInFlight \|\| \(SINGLE_APP\(\) && runningApps\.length\)\)/g) || []).length,
    2,
    'all modes serialize boot while only single-app mode serializes process lifetime');
  assert.match(shellSource, /finally \{\s*launchInFlight = false;\s*dispatchPendingLaunch\(\);/,
    'ending the current boot wakes a child that was queued during synchronous startup');
  console.log('ok: vfs child launch keeps args before PE startup');
}

// DirectX 2 redistributables must not replace the newer emulated runtime.
{
  const { shell, launched, logs } = makeShell();
  assert.strictEqual(shell.launchVfsExe(
    'C:\\REDIST\\DIRECTX\\DXSETUP.EXE', null, '', ''), true,
    'legacy DXSETUP is accepted as already satisfied');
  assert.strictEqual(launched.length, 0, 'no obsolete driver installer is launched');
  assert(logs.some(line => /skipped obsolete DirectX setup/i.test(line)),
    'the DirectX no-op is visible in the debug log');
  console.log('ok: obsolete DirectX setup is already satisfied');
}

// WinExec uses CreateProcess's ordered unquoted candidates at the browser
// callback too. Fixtures never load a PE; only the final boot is substituted.
{
  const vm = require('vm');
  const { VirtualFS } = require('../lib/filesystem');
  const { parseShellLaunchCommand, resolveShellLaunchPath, createWinExecReadiness } = require('../host');
  const source = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
  const start = source.indexOf('    h.shell_execute =');
  const end = source.indexOf('    // The guest asked for the machine to go down', start);
  assert(start >= 0 && end > start);
  const image = 'C:\\Program Files\\Sub Dir\\program.exe';
  function launch(command, files, operation = 'WinExec', applicationPath = '', searchPath = '') {
    const vfs = new VirtualFS();
    for (const file of files) vfs.files.set(vfs._resolvePath(file), { data: new Uint8Array(1) });
    const calls = [];
    const strings = [null, operation, command, applicationPath, searchPath];
    const parent = { _helpCtx: { vfs }, readString: p => strings[p], logToUI() {} };
    const h = {}, winexecReadiness = createWinExecReadiness();
    vm.runInNewContext(source.slice(start, end), {
      h, self: parent, WineAssembly: {}, parseShellLaunchCommand, resolveShellLaunchPath, winexecReadiness,
      console: { log() {} }, window: { wineShell: {
        launchVfsExe(file, caller, dir, params, opts) {
          calls.push({ file, params });
          const exists = vfs.files.has(vfs._resolvePath(file));
          if (exists && opts.beforeRun) {
            const child = {}; opts.beforeRun(child);
            child._winexecStartup.ready = true;
          }
          return exists;
        }, launchExe() { return false; },
      } },
    });
    let status = h.shell_execute(0, 1, 2, searchPath ? 4 : 0, applicationPath ? 3 : 0, 5);
    if ((status >>> 16) === 0x5745) status = winexecReadiness.control(10, 123, status);
    return { status, calls };
  }
  const full = launch(image + ' /flag', [image]);
  assert.strictEqual(full.status, 33);
  assert.deepStrictEqual(full.calls, [{ file: image, params: '/flag' }]);
  const prefix = launch(image + ' /flag', [image, 'C:\\Program.exe']);
  assert.strictEqual(prefix.status, 33);
  assert.deepStrictEqual(prefix.calls, [{ file: 'C:\\Program.exe', params: 'Files\\Sub Dir\\program.exe /flag' }]);
  assert.strictEqual(launch('"C:\\Program" Files\\Sub Dir\\program.exe', [image]).status, 2);
  assert.strictEqual(launch(image, []).status, 2);
  assert.deepStrictEqual(launch(image, [image], 'open').calls, [{ file: image, params: '' }]);
  const app = 'C:\\Tools\\Parent.exe', sibling = 'C:\\Tools\\Helper.exe';
  const order = [sibling, 'C:\\Helper.exe', 'C:\\WINDOWS\\SYSTEM\\Helper.exe',
    'C:\\WINDOWS\\Helper.exe', 'D:\\Bin\\Helper.exe', 'E:\\Bin\\Helper.exe'];
  for (let i = 0; i < order.length; i++) {
    const result = launch('helper /flag "two words"', order.slice(i), 'WinExec', app, 'D:\\Bin;E:\\Bin');
    assert.strictEqual(result.status, 33, 'each search fallback launches');
    assert.deepStrictEqual(result.calls, [{ file: order[i].toLowerCase(), params: '/flag "two words"' }]);
  }
  assert.strictEqual(launch('absent /flag', order, 'WinExec', app).status, 2);
  assert.strictEqual(launch('.\\helper /flag', [sibling], 'WinExec', app).status, 2,
    'explicit relative directory does not search the application directory');
  assert.strictEqual(launch('"helper" /flag', [sibling], 'WinExec', app).status, 33);
  console.log('ok: browser WinExec candidate order, quoted and absent controls, separate ShellExecute lpFile');
}

// Exercise the production browser process_spawn callback with the real shell
// skip policy and loopback transport. Only guest attachment/boot is substituted.
{
  const vm = require('vm');
  const VlanWire = require('../lib/vlan-wire');
  const { parseShellLaunchCommand, resolveShellLaunchPath, createWinExecReadiness } = require('../host');
  const hostSource = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
  const start = hostSource.indexOf('    h.process_spawn =');
  const end = hostSource.indexOf('    // E4:', start);
  assert(start >= 0 && end > start, 'extract the production process_spawn callback');
  function fixture(mode = 'skip', pipes = 1) {
    const { shell, launched } = makeShell();
    let options;
    const parent = {
      memory: new WebAssembly.Memory({ initial: 1 }),
      readString: () => mode === 'skip' ? 'C:\\DXSETUP.EXE' : 'C:\\child.exe',
      threadManager: {},
    };
    const h = {};
    vm.runInNewContext(hostSource.slice(start, end), {
      h, self: parent, WineAssembly: {}, DataView, Map,
      parseShellLaunchCommand, resolveShellLaunchPath,
      console: { log() {} },
      window: { VlanWire, wineShell: { launchVfsExe(...args) {
        options = args[4];
        if (mode === 'decline') return false;
        if (mode === 'throw') throw new Error('launch failed');
        if (mode === 'skip') return shell.launchVfsExe(...args);
        return true;
      } } },
    });
    return { parent, launched, spawn: () => h.process_spawn(1, 0, 0x0a000002, 0, pipes, 1, 0),
      options: () => options };
  }
  function assertRetired(f) {
    const wire = f.options().lanLink.wire;
    assert.deepStrictEqual(f.parent._childSegment.endpoints, [f.parent.vlanWire],
      'only the caller remains attached');
    assert.strictEqual(wire.pending, 0);
    assert.strictEqual(wire.send(new Uint8Array(28)), false);
    wire.deliver(new Uint8Array(28)); wire.peerGone(9); wire.close();
    assert.strictEqual(wire.pending, 0, 'retired child rejects late traffic');
    assert.strictEqual(f.parent.vlanWire.pending, 1, 'completion emits exactly one EOF');
  }
  const skipped = fixture();
  const pid = skipped.spawn();
  const rec = skipped.parent._children.get(pid);
  assert.strictEqual(rec.object.exited, true);
  assert.strictEqual(rec.object.pending, false);
  assert.strictEqual(rec.object.wine, null);
  assert.strictEqual(rec.exitCode, 0, 'tracked skipped installer completes successfully');
  assert.strictEqual(skipped.launched.length, 0);
  skipped.options().onExit(null, 'already-satisfied');
  assertRetired(skipped);

  const noPipes = fixture('skip', 0);
  const noPipePid = noPipes.spawn();
  assert.strictEqual(noPipes.parent._children.get(noPipePid).exitCode, 0,
    'skipped tracked launch without redirected handles also completes successfully');
  assert.strictEqual(noPipes.parent._childSegment, undefined);

  const live = fixture('live');
  const livePid = live.spawn();
  const wire = live.options().lanLink.wire;
  const sibling = live.parent._childSegment.attach();
  live.parent.vlanWire.send(new Uint8Array(28));
  assert.strictEqual(wire.pending, 1, 'endpoint remains live until consumer completes');
  live.options().onExit({ _exitCode: 17 });
  live.options().onExit(null);
  assert.strictEqual(live.parent._children.get(livePid).exitCode, 17);
  assert.strictEqual(sibling.pending, 1, 'sibling keeps its frame and endpoint');
  sibling.close();
  assertRetired(live);

  const cancelled = fixture('live');
  const cancelledPid = cancelled.spawn();
  const cancelledObject = cancelled.parent._children.get(cancelledPid).object;
  cancelledObject.exited = true;
  cancelledObject.exitCode = 0xdeadbeef;
  cancelledObject.complete(null, 'already-satisfied');
  assert.strictEqual(cancelled.parent._children.get(cancelledPid).exitCode, 0xdeadbeef,
    'completion preserves a prior authoritative termination status');
  assertRetired(cancelled);

  const bootFailed = fixture('live');
  const failedPid = bootFailed.spawn();
  bootFailed.options().onExit(null);
  assert.strictEqual(bootFailed.parent._children.get(failedPid).exitCode, 1,
    'null child without the skip outcome remains a boot failure');
  assertRetired(bootFailed);

  for (const mode of ['decline', 'throw']) {
    const failed = fixture(mode);
    if (mode === 'throw') assert.throws(failed.spawn, /launch failed/);
    else assert.strictEqual(failed.spawn(), 0);
    assert.strictEqual(failed.parent._children.size, 0, 'failed launch is unpublished');
    failed.options().onExit(null);
    assertRetired(failed);
  }
  console.log('ok: tracked skipped/normal/failed launches retire only their child endpoint once');
}

// War Wind asks to run that obsolete redistributable from its final setup
// dialog. Once the no-op succeeds, continue into the game from the completed
// installer VFS instead of leaving the Win16 bootstrap visible at 39%.
{
  const { shell, launched, logs } = makeShell();
  const installedPath = 'c:\\program files\\warwind\\ww.exe';
  const vfs = {
    files: new Map([[installedPath, { data: new Uint8Array([77, 90]), attrs: 0x20 }]]),
    dirs: new Set(['c:\\program files', 'c:\\program files\\warwind']),
    readOnlyDrives: new Set(),
    cwd: 'c:\\program files\\warwind\\',
    _normPath: p => String(p).toLowerCase(),
    _resolvePath(p) {
      const value = /^[a-z]:/i.test(p) ? p : this.cwd + p;
      return this._normPath(value).replace(/\\+/g, '\\');
    },
  };
  assert.strictEqual(shell.launchVfsExe(
    'C:\\REDIST\\DIRECTX\\DXSETUP.EXE', { _helpCtx: { vfs } }, '', ''), true);
  setTimeout(() => {
    assert.deepStrictEqual(launched, ['vfs:' + installedPath],
      'accepted final DXSETUP prompt starts the completed War Wind install');
    assert(logs.some(line => /starting installed War Wind after setup/i.test(line)),
      'the automatic handoff is visible in the debug log');
    console.log('ok: War Wind final setup prompt starts the installed game');
  }, 0);
}

// 4. An installer that exits without launching its game leaves a lightweight
//    filesystem snapshot behind for a later desktop/Start-menu launch.
{
  const { shell, launched } = makeShell();
  const installedPath = 'c:\\games\\icytower1.3\\icytower13.exe';
  const installerVfs = {
    files: new Map([[installedPath, { data: new Uint8Array([77, 90]), attrs: 0x20 }]]),
    dirs: new Set(['c:\\games', 'c:\\games\\icytower1.3']),
    readOnlyDrives: new Set(),
    cwd: 'c:\\games\\icytower1.3\\',
    _normPath: p => String(p).toLowerCase(),
    _resolvePath(p) {
      const value = /^[a-z]:/i.test(p) ? p : this.cwd + p;
      return this._normPath(value).replace(/\\+/g, '\\');
    },
  };
  const installer = { _helpCtx: { vfs: installerVfs } };
  shell.runningApps.push({ name: 'icy_tower_installer', wine: installer });
  global.window = {};
  global.document = { getElementById: () => null };
  shell.unregisterRunningApp(installer);
  delete global.window;
  delete global.document;
  installer._helpCtx = null;

  assert.strictEqual(shell.launchVfsExe(installedPath, installer, '', ''), true,
    'an installed exe remains launchable after its installer process exits');
  assert.deepStrictEqual(launched, ['vfs:' + installedPath],
    'the exited installer snapshot starts the requested installed executable');
  console.log('ok: exited installer VFS remains launchable');
}

// 5. A resolvable exe is accepted (returns true) in both modes, and in
//    single-app mode with a guest still running it defers rather than
//    declining — write.exe is still in runningApps when it calls us.
{
  const { shell } = makeShell();
  assert.strictEqual(shell.launchExe('wordpad.exe'), true,
    'a registered exe is accepted');
}

// UT's first-run wizard runs C:\app.exe testrendev=... once per renderer. The
// child has no registry `dlls` seeds, so its import of the app-private
// Core.dll was declined by isLoadableDll and bound to a stub
// (?appPackage@@YAPBGXZ trap). The inherited names make it loadable; a system
// DLL the emulator implements still is not.
(async () => {
  const { resolveDllGraph } = require('../lib/process-boot.js');
  const { isLoadableDll } = require('../lib/dll-registry.js');
  const inherited = new Set(['core.dll']);
  const asked = [];
  const configs = await resolveDllGraph({
    exeBytes: new Uint8Array(1),
    detectRequiredDlls: () => ['core.dll', 'user32.dll'],
    isLoadable: name => inherited.has(name.toLowerCase()) || isLoadableDll(name),
    loadSpec: async spec => { asked.push(spec); return { name: spec, bytes: new Uint8Array(1) }; },
  });
  assert.deepStrictEqual(configs.map(c => c.name), ['core.dll'],
    'an inherited private DLL loads; user32.dll is still served by the emulator');
  assert.deepStrictEqual(asked, ['core.dll'], 'the system DLL is never even looked up');
  const shellSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'browser-shell.js'), 'utf8');
  assert.match(shellSource,
    /resolveDllGraph\(\{[\s\S]*?isLoadable: name => inheritedDlls\.has\(/,
    'the browser launch hands the inherited names to the DLL graph');
  console.log('ok: a VFS child loads the app-private DLLs its caller ran');

  // A system DLL the host cannot serve (a fresh worktree has no gitignored
  // test/binaries/dlls) is named, not dropped: Deus Ex's page run looked like
  // a regression for an hour because msvcrt.dll 404'd silently and the crash
  // surfaced later in a built-in wcschr stub.
  // One the app declares itself (a `dlls` seed) is flagged, and fails the
  // launch in both hosts; one found by the import walk stays optional.
  const missing = [];
  const got = await resolveDllGraph({
    exeBytes: new Uint8Array(1),
    seeds: ['binaries/app/core.dll'],
    detectRequiredDlls: () => ['msvcrt.dll'],
    isLoadable: () => true,
    loadSpec: async () => null,
    onMissing: (name, spec, info) => missing.push([name, spec, info.seed]),
  });
  assert.deepStrictEqual(got, [], 'nothing loads');
  assert.deepStrictEqual(missing, [
    ['core.dll', 'binaries/app/core.dll', true],
    ['msvcrt.dll', 'msvcrt.dll', false],
  ], 'each missing DLL is reported, the declared one as a seed');
  assert.match(shellSource, /resolveDllGraph\(\{[\s\S]*?onMissing: \(name, spec, \{ seed \} = \{\}\) => \{[\s\S]*?log\.textContent \+=[\s\S]*?missingDeclaredDlls\.push/,
    'the browser launch logs a missing DLL and collects the declared ones');
  assert.match(shellSource, /if \(missingDeclaredDlls\.length\) \{[\s\S]*?failLaunch\(error\);/,
    'a missing declared DLL fails the browser launch');
  const runSource = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
  assert.match(runSource, /onMissing: \(name, spec, \{ seed \} = \{\}\) => \{[\s\S]*?if \(seed\) \{\s*console\.error\(`run\.js: declared DLL not found[\s\S]*?process\.exit\(1\)/,
    'and the CLI run');
  console.log('ok: a DLL the host cannot serve is named; a declared one fails the launch');
})().catch(e => { console.error(e); process.exit(1); });

{
  const { shell, launched } = makeShell({ singleApp: true });
  const parent = {};
  shell.runningApps.push({ name: 'write', wine: parent });
  const t0 = Date.now();
  assert.strictEqual(shell.launchExe('wordpad.exe'), true,
    'single-app mode accepts the launch instead of declining it');
  assert.ok(Date.now() - t0 < 50, 'and returns immediately — the host import is synchronous');
  assert.deepStrictEqual(launched, [], 'the child remains dormant while its parent is alive');
  global.window = {};
  global.document = { getElementById: () => null };
  shell.unregisterRunningApp(parent);
  delete global.window;
  delete global.document;
  setTimeout(() => {
    assert.deepStrictEqual(launched, ['wordpad'], 'parent exit wakes exactly one queued child');
    console.log('ok: single-app launch deferred, not declined');
    console.log('PASS test-shell-execute-launch');
  }, 250);
}
