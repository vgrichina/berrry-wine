'use strict';
const fs = require('fs');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

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

// The Linux subreaper/pidfd resource supervisor (ensureSupervised) served only
// the browser fixture deleted with the JS D3DIM executor; it had no remaining
// caller and went with the Python port.
module.exports = {checkedExecutable, launchConfiguration, gitIdentity};
