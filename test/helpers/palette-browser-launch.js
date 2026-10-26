'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync, spawnSync} = require('child_process');

function checkedExecutable(requested) {
  const executablePath = fs.realpathSync(requested);
  fs.accessSync(executablePath, fs.constants.X_OK);
  const fd = fs.openSync(executablePath, 'r');
  const magic = Buffer.alloc(4);
  try { fs.readSync(fd, magic, 0, 4, 0); } finally { fs.closeSync(fd); }
  // Fail closed on ALL shell/Python/etc wrappers: following sourced files or
  // trying --version can itself invoke external network/host bookkeeping.
  if (!fs.statSync(executablePath).isFile() || !magic.equals(Buffer.from([127,69,76,70])))
    throw new Error(`Browser wrapper rejected before invocation: ${requested} -> ${executablePath}; supply a reviewed explicit ELF executable`);
  const hash = crypto.createHash('sha256');
  const input = fs.openSync(executablePath, 'r'), chunk = Buffer.alloc(65536);
  try {
    let n;
    while ((n = fs.readSync(input, chunk, 0, chunk.length, null))) hash.update(chunk.subarray(0,n));
  } finally { fs.closeSync(input); }
  return {executablePath, executableSha256:hash.digest('hex')};
}

function launchConfiguration(env = process.env) {
  const checked = checkedExecutable(env.CHROME || '/usr/bin/chromium');
  return {checked, options:{headless:true, detached:false, executablePath:checked.executablePath,
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}};
}

function gitIdentity(dir) {
  const git = args => execFileSync('/usr/bin/prlimit', ['--data=536870912:536870912', '--',
    'git', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args],
    {cwd:dir, encoding:'utf8', timeout:120000, maxBuffer:2*1024*1024}).trim();
  return {head:git(['rev-parse','HEAD']), diff:git(['diff','--stat'])};
}

function ensureSupervised() {
  if (!process.env.PALETTE_BROWSER_RESOURCE_CONFIG)
    throw new Error('PALETTE_BROWSER_RESOURCE_CONFIG required: explicit task accounting roots and WAL baseline');
  // Verify the marker against the actual subreaper parent, rather than allow
  // a stale/injected boolean to silently disable process ownership.
  const parent = Number(process.env.PALETTE_BROWSER_SUPERVISED);
  if (parent === process.ppid && fs.readFileSync(`/proc/${parent}/cmdline`, 'utf8')
      .split('\0').includes(path.join(__dirname,'palette-browser-supervisor.py'))) return;
  const result = spawnSync('/usr/bin/python3', [path.join(__dirname,'palette-browser-supervisor.py'),
    process.execPath, ...process.execArgv, ...process.argv.slice(1)],
    {stdio:'inherit', env:{...process.env, PALETTE_BROWSER_BOOTSTRAP:String(process.pid)}});
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}
module.exports = {checkedExecutable, launchConfiguration, gitIdentity, ensureSupervised};
