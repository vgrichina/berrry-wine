'use strict';
// Execute the complete current normal-build prefix, stopping before concat.
// Keep shell arrays, branches, ordering and every gate exactly as authored.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), file = path.join(root, 'tools/build.sh');
const source = fs.readFileSync(file, 'utf8'), marker = 'echo "Concatenating WAT parts..."';
if (source.split(marker).length !== 2) throw Error('build boundary changed; inspect before proceeding');
const prefix = source.slice(0, source.indexOf(marker));
if (/^node tools\/(?:concat-wat|build-compile-wat)\.js/m.test(prefix)) throw Error('unexpected compiler in prefix');
const result = cp.spawnSync('bash', ['-c', prefix, file], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status === 0 ? 0 : result.status || 1;
if (!process.exitCode) console.log('FULL NORMAL PRECOMPILE PREFIX PASS; stopped before concat/compile, no module built');
