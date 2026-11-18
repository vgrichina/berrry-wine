'use strict';

// Execute the production browser resolver verbatim, with a child registered
// and mounted by the real shell, real VFS and shared production DLL graph.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const { createBrowserShell } = require('../lib/browser-shell');
const { VirtualFS } = require('../lib/filesystem');
const processBoot = require('../lib/process-boot');
const dllRegistry = require('../lib/dll-registry');
const ref = process.argv.find(a => a.startsWith('--source-ref='));
const source = ref
  ? require('child_process').execFileSync('git', ['show', ref.slice(13) + ':lib/browser-shell.js'], {encoding:'utf8'})
  : fs.readFileSync(require.resolve('../lib/browser-shell'), 'utf8');
const start = source.indexOf('        const availableDlls =');
const end = source.indexOf('        // How many DLLs the graph', start);
assert(start > 0 && end > start);

async function resolver(app, vfs, requests) {
  const context = vm.createContext({ app, wine: { _helpCtx: { vfs } },
    window: { dllRegistry }, ctx: {}, URL, location: { href: 'http://local/index.html' },
    console, WineAssembly: { async fetchAssetBytes(url) {
      requests.push(url);
      if (url === dllRegistry.DLL_PATHS['msvcrt.dll']) throw Error('HTTP 404');
      return Uint8Array.of(9);
    } } });
  vm.runInContext(source.slice(start, end) + '\nthis.loadSpec = fetchDll; this.loadSpec.isMountedPrivateDll = typeof isMountedPrivateDll === "function" ? isMountedPrivateDll : () => false;', context);
  return context.loadSpec;
}

(async () => {
  const apps = {}, parent = new VirtualFS();
  parent.setLazyFile('C:\\System\\Rune.exe', { size: 2, load: () => Uint8Array.of(77, 90) });
  let materializations = 0;
  const original = Uint8Array.of(77, 90, 42);
  parent.setLazyFile('C:\\System\\MSVCRT.dll', { size: original.length,
    load: async () => { materializations++; return original; } });
  parent.setLazyFile('D:\\private\\MSVCRT.dll', { size: 1, load: () => Uint8Array.of(7) });
  const shell = createBrowserShell({ apps, debugMode: false,
    screenCanvasSize: () => ({ w: 640, h: 480 }), appendDebugLog() {}, singleApp: () => false });
  shell.launchApp = () => {};
  assert(shell.launchVfsExe('C:\\System\\Rune.exe', {
    _helpCtx: { vfs: parent }, _loadedDllBytesByName: { 'msvcrt.dll': original },
  }, 'C:\\System', 'testrendev=D3DDrv.D3DRenderDevice log=Detected.log'));
  const child = apps['vfs:c:\\system\\rune.exe'];
  assert(child.inheritedDlls.includes('msvcrt.dll'));
  const vfs = new VirtualFS();
  await child.mounts[0](vfs);
  assert.equal(materializations, 0, 'child snapshot keeps lazy mounted sibling');
  const requests = [], loadSpec = await resolver(child, vfs, requests);
  const graph = await processBoot.resolveDllGraph({ exeBytes: Uint8Array.of(1),
    seeds: [], isLoadable: n => child.inheritedDlls.includes(n),
    detectRequiredDlls: b => b[0] === 1 ? ['msvcrt.dll'] : [], loadSpec });
  assert.equal(graph.length, 1, 'automatic child must retain original CRT instead of global 404');
  assert.deepEqual([...graph[0].bytes], [...original]);
  assert.equal(graph[0].path, 'c:\\system\\msvcrt.dll', 'module identity is the mounted application directory');
  assert.equal(materializations, 1);
  assert.deepEqual(requests, [], 'application sibling precedes global registry');

  assert.deepEqual([...(await loadSpec('private/MSVCRT.dll')).bytes], [9]);
  assert.equal(requests.pop(), 'private/MSVCRT.dll', 'explicit URL bypasses sibling');
  const explicit = await loadSpec('D:\\private\\MSVCRT.dll');
  assert.deepEqual([...explicit.bytes], [7]);
  assert.equal(explicit.path, 'd:\\private\\msvcrt.dll');
  assert.equal(await loadSpec('D:\\absent\\MSVCRT.dll'), null, 'explicit absent path cannot substitute sibling');

  vfs.files.delete('c:\\system\\msvcrt.dll');
  assert.equal(await loadSpec('MSVCRT.dll'), null);
  assert.equal(requests.pop(), dllRegistry.DLL_PATHS['msvcrt.dll'], 'absent sibling retains global fallback');
  const parentRequests = [], parentLoad = await resolver({ exe: 'games/other.exe',
    exeGuestPath: 'C:\\Other\\other.exe', files: [], dlls: [] }, parent, parentRequests);
  assert.equal(await parentLoad('msvcrt.dll'), null);
  assert.equal(parentRequests.pop(), dllRegistry.DLL_PATHS['msvcrt.dll'], 'unrelated URL launch keeps registry lookup');
  const seed = await parentLoad('games/Core.dll');
  assert.equal(seed.path, 'C:\\Other\\Core.dll', 'explicit parent seed preserves module path');
  // Uploaded media has no DLL seeds or inherited module list. Exercise the
  // real graph, including a private DLL importing a second private sibling.
  const uploaded = new VirtualFS();
  uploaded.setLazyFile('C:\\Game\\Core.dll', {size:1, load:()=>Uint8Array.of(2)});
  uploaded.setLazyFile('C:\\Game\\Engine.dll', {size:1, load:()=>Uint8Array.of(3)});
  uploaded.setLazyFile('C:\\Elsewhere\\Missing.dll', {size:1, load:()=>Uint8Array.of(4)});
  uploaded.files.set('c:\\game\\user32.dll', {data:Uint8Array.of(9)});
  uploaded.files.set('c:\\game\\opengl32.dll', {data:Uint8Array.of(9)});
  uploaded.files.set('c:\\game\\placeholder.dll', {data:Uint8Array.of(9),staticModule:true});
  const uploadRequests=[], uploadLoad=await resolver({exe:'C:\\Game\\Game.exe'},uploaded,uploadRequests);
  const uploadGraph=await processBoot.resolveDllGraph({exeBytes:Uint8Array.of(1),
    isLoadable:name=>dllRegistry.isLoadableDll(name)||uploadLoad.isMountedPrivateDll(name),
    detectRequiredDlls:b=>b[0]===1?['CORE.dll','user32.dll','opengl32.dll','missing.dll','placeholder.dll']:b[0]===2?['Engine.dll']:[],
    loadSpec:uploadLoad});
  assert.deepStrictEqual(uploadGraph.map(c=>c.name.toLowerCase()),['core.dll','engine.dll'],
    'uploaded private direct and transitive dependencies must execute their mounted PEs');
  assert.deepStrictEqual(uploadRequests,[],'unrelated and builtin-only modules never fetch through private admission');
  assert.equal(uploadLoad.isMountedPrivateDll('..\\Elsewhere\\Missing.dll'),false,'private admission cannot escape the application directory');
  assert.equal(parentLoad.isMountedPrivateDll('Core.dll'),false,'a registered URL launch needs its explicit registry configuration');
  console.log('PASS production child registration/mount + browser DLL resolver/graph: lazy sibling, module path, explicit paths, absent fallback, unrelated parent');
})().catch(error => { console.error(error); process.exitCode = 1; });
