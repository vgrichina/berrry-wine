#!/usr/bin/env node

'use strict';

// Drive the setup program shipped with an Unreal-family demo inside Wine
// Assembly, export the installed VFS, and boot the installed executable. Host
// archive extraction may unwrap a self-extractor, but never substitutes for
// running Setup.exe (or the InstallShield engine it launches).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { startControlSession } = require('../test/control-session');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');
const SPECS = {
  'unreal-special': { exe: 'system/unreal.exe', installRoot: 'unrealspecial', legacy: true },
  ut99: { exe: 'system/unrealtournament.exe' },
  ut2003: { exe: 'system/ut2003.exe', crt: 'msvcr70.dll', d3d8: true,
    ini: 'ut2003.ini' },
  ut2004: { exe: 'system/ut2004.exe', crt: 'msvcr71.dll', d3d8: true,
    ini: 'ut2004.ini' },
};

function arg(name) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function run(args) {
  return spawnSync(process.execPath, [RUN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function step(session, count) {
  while (count > 0) {
    const n = Math.min(count, 10);
    const reply = await session.send({ action: 'step', n });
    if (reply.ran !== n) return false;
    count -= n;
  }
  return true;
}

// The media's own spelling of a name. The UT2004 demo archive ships
// System/MSVCR71.dll; a case-insensitive host (macOS) finds 'msvcr71.dll' anyway,
// a Linux boat did not and the install asserted.
function inDir(dir, name) {
  const exact = path.join(dir, name);
  if (fs.existsSync(exact)) return exact;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_) {}
  const hit = entries.find(entry => entry.toLowerCase() === name.toLowerCase());
  return hit ? path.join(dir, hit) : exact;
}

async function runUnrealSetup(source, installVfs, spec) {
  const system = inDir(source, 'System');
  const setup = inDir(system, 'Setup.exe');
  const seeds = [inDir(system, 'Core.dll'), inDir(system, 'Window.dll')];
  if (spec.crt) seeds.push(inDir(system, spec.crt));
  for (const file of [setup, ...seeds]) assert(fs.existsSync(file), `missing setup dependency: ${file}`);

  const session = startControlSession([RUN,
    `--exe=${setup}`,
    `--vfs-tree=${source}`,
    `--dll-seed=${seeds.join(',')}`,
    '--cwd=c:\\System',
    '--screen=800x600', '--batch-size=100000', '--tick-ms-per-batch=100',
    '--max-batches=1000000', '--max-seconds=300', '--repaint-every=20',
    '--quiet-api', '--quiet-blocks', '--no-build', '--no-close',
    '--control-stdin', '--frozen', `--save-vfs=${installVfs}`,
  ], { cwd: ROOT, idPrefix: 'uti-' });

  try {
    await step(session, 40);
    for (let page = 0; page < 12; page++) {
      await session.send('dlg-click:1004');
      if (!await step(session, 35)) break;
      if (fs.existsSync(path.join(installVfs, spec.exe))) break;
    }
    await session.quit({ ignoreReplyError: true });
  } catch (error) {
    await session.quit({ ignoreReplyError: true });
    if (!fs.existsSync(path.join(installVfs, spec.exe))) throw error;
  }
  assert(fs.existsSync(path.join(installVfs, spec.exe)),
    `authentic Unreal Setup did not install ${spec.exe}\n${session.output().slice(-8000)}`);
  assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(session.output()),
    `Unreal Setup hit a compatibility failure\n${session.output().slice(-8000)}`);
}

async function runLegacySetup(source, installVfs, spec, temp) {
  const capture = path.join(temp, 'legacy-capture');
  const bootstrap = run([
    `--exe=${path.join(source, 'SETUP.EXE')}`, `--vfs-tree=${source}`, '--cwd=c:\\',
    '--screen=800x600', '--batch-size=100000', '--max-batches=10000', '--max-seconds=60',
    '--input=20:0x111:1', '--quiet-api', '--quiet-blocks', '--no-build', '--no-close',
    `--capture-launch=${capture}`,
  ]);
  const bootstrapOutput = `${bootstrap.stdout || ''}${bootstrap.stderr || ''}`;
  assert.strictEqual(bootstrap.status, 0, bootstrapOutput.slice(-8000));
  assert.match(bootstrapOutput, /\[capture-launch\] snapshotted .*_ins.*\._mp/i,
    `InstallShield bootstrap did not launch its engine\n${bootstrapOutput.slice(-8000)}`);

  const metadata = JSON.parse(fs.readFileSync(path.join(capture, 'launch.json'), 'utf8'));
  const engine = path.join(capture, ...metadata.exe.split('/'));
  const session = startControlSession([RUN,
    `--exe=${engine}`, `--exe-guest-path=${metadata.guestExe}`, `--vfs-tree=${capture}`,
    `--cwd=${metadata.directory || 'c:\\'}`, '--screen=800x600', '--batch-size=100000',
    '--tick-ms-per-batch=100', '--max-batches=1000000', '--max-seconds=300',
    '--repaint-every=20', '--quiet-api', '--quiet-blocks', '--no-build', '--no-close',
    '--control-stdin', '--frozen', `--save-vfs=${installVfs}`,
  ], { cwd: ROOT, idPrefix: 'usi-' });
  try {
    await step(session, 150);
    for (const id of [1, 6, 1, 1]) {
      await session.send(`dlg-click:${id}`);
      await step(session, 40);
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      if (fs.existsSync(path.join(installVfs, spec.installRoot, spec.exe))) break;
      if (!await step(session, 10)) break;
    }
    await session.quit({ ignoreReplyError: true });
  } catch (error) {
    await session.quit({ ignoreReplyError: true });
    if (!fs.existsSync(path.join(installVfs, spec.installRoot, spec.exe))) throw error;
  }
  assert(fs.existsSync(path.join(installVfs, spec.installRoot, spec.exe)),
    `authentic InstallShield setup did not install ${spec.exe}\n${session.output().slice(-8000)}`);
  // This 1998 engine calls through NULL after writing Unreal.ini. That is its
  // post-install cleanup path; the complete payload is already durable.
  assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(session.output()),
    `Unreal InstallShield setup hit a compatibility failure\n${session.output().slice(-8000)}`);
}

function validateLaunch(installed, spec) {
  const system = path.join(installed, 'system');
  const seeds = ['core.dll', 'engine.dll', 'window.dll'];
  if (spec.crt) seeds.push(spec.crt);
  else seeds.push('msvcrt.dll');
  const result = run([
    `--exe=${path.join(installed, spec.exe)}`, `--vfs-tree=${installed}`,
    `--dll-seed=${seeds.map(name => path.join(system, name)).join(',')}`,
    '--cwd=c:\\system', '--screen=800x600', '--max-batches=3000', '--max-seconds=60',
    '--batch-size=50000', '--repaint-every=100', '--quiet-api', '--quiet-blocks',
    '--no-build', '--no-close',
    ...(spec.d3d8 ? ['--trace-api=Direct3DCreate8,IDirect3D8_GetDeviceCaps,IDirect3D8_CheckDeviceFormat,IDirect3D8_GetAdapterIdentifier,IDirect3D8_Release', '--trace-api-dedup'] : []),
  ]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (spec.d3d8) {
    assert.doesNotMatch(output, /UNIMPLEMENTED API: Direct3DCreate8/,
      `installed game reached an unimplemented D3D8 factory\n${output.slice(-8000)}`);
    assert.match(output, /Direct3DCreate8/,
      `installed game did not exercise the D3D8 capability facade\n${output.slice(-8000)}`);
    assert.doesNotMatch(output, /Please install DirectX 8\.1/i,
      `installed game rejected the D3D8 capability facade\n${output.slice(-8000)}`);
  } else {
    assert.strictEqual(result.status, 0, output.slice(-8000));
    assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(output), output.slice(-8000));
    assert.match(output, /Initial Configuration|CreateDialog|Unreal Tournament \(Starting\)/i,
      `installed game did not reach first-run UI\n${output.slice(-8000)}`);
  }
}

function configureLocalRenderer(installed, spec) {
  const system = path.join(installed, 'system');
  if (spec.legacy) {
    const file = path.join(system, 'unreal.ini');
    let text = fs.readFileSync(file, 'utf8');
    text = text.replaceAll('FirstRun=True', 'FirstRun=False')
      .replace('RenderDevice=GlideDrv.GlideRenderDevice',
        'RenderDevice=SoftDrv.SoftwareRenderDevice')
      .replaceAll('StartupFullscreen=True', 'StartupFullscreen=False');
    fs.writeFileSync(file, text);
    return;
  }
  if (!spec.ini) return;
  for (const name of [spec.ini, 'default.ini']) {
    const file = path.join(system, name);
    let text = fs.readFileSync(file, 'utf8');
    text = text.replaceAll('RenderDevice=D3DDrv.D3DRenderDevice',
      'RenderDevice=OpenGLDrv.OpenGLRenderDevice')
      .replaceAll('StartupFullscreen=True', 'StartupFullscreen=False');
    fs.writeFileSync(file, text);
  }
}

async function main() {
  const id = arg('id');
  const source = path.resolve(arg('source') || '');
  const output = path.resolve(arg('output') || '');
  const spec = SPECS[id];
  if (!spec || !arg('source') || !arg('output')) {
    console.error(`usage: node tools/install-unreal-demo.js --id=${Object.keys(SPECS).join('|')} --source=DIR --output=DIR`);
    process.exit(2);
  }
  assert(fs.existsSync(source), `source tree is missing: ${source}`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `wa-${id}-installer-`));
  const installVfs = path.join(temp, 'installed-vfs');
  try {
    if (spec.legacy) await runLegacySetup(source, installVfs, spec, temp);
    else await runUnrealSetup(source, installVfs, spec);
    const installed = spec.installRoot ? path.join(installVfs, spec.installRoot) : installVfs;
    validateLaunch(installed, spec);
    configureLocalRenderer(installed, spec);
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.cpSync(installed, output, { recursive: true });
    console.log(`PASS  authentic ${id} installer completed and installed game booted`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`FAIL  Unreal demo installer: ${error.stack || error.message}`);
  process.exit(1);
});
