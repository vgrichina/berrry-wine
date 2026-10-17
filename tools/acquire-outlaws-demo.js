#!/usr/bin/env node
'use strict';
// Remote-only acquisition: never executes the downloaded Windows program.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const url = 'https://archive.org/download/outdemo_v2/outdemo_v2.exe';
const expected = {size: 14186356, sha1: '5568d44da014b6be21d105b1149ec022c10c0655', md5: 'ccd7678d2276fe1b39cef399598d4a6d'};
const dir = process.argv[2];
if (!dir || !path.isAbsolute(dir) || fs.existsSync(dir)) throw Error('Supply a new absolute directory');
fs.mkdirSync(dir, {recursive: false});
const stat = fs.statfsSync(dir);
if (stat.bavail * stat.bsize < 256 * 1024 * 1024) throw Error('Need 256 MiB remote space');
function run(command, args, timeout = 60000) {
  return cp.execFileSync(command, args, {cwd: dir, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024});
}
const started = new Date().toISOString();
run('curl', ['--fail', '--location', '--max-time', '30', '--max-filesize', '1048576', '--output', 'metadata.json', 'https://archive.org/metadata/outdemo_v2'], 35000);
const entry = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'))).files.find(f => f.name === 'outdemo_v2.exe');
if (!entry || +entry.size !== expected.size || entry.sha1 !== expected.sha1 || entry.md5 !== expected.md5) throw Error('Fresh metadata mismatch');
const finalUrl = run('curl', ['--fail', '--location', '--max-time', '120', '--max-filesize', '20971520', '--dump-header', 'outdemo_v2.headers', '--output', 'outdemo_v2.exe', '--write-out', '%{url_effective}', url], 125000);
const bytes = fs.readFileSync(path.join(dir, 'outdemo_v2.exe'));
const actual = {size: bytes.length};
for (const name of ['sha1', 'md5', 'sha256']) actual[name] = crypto.createHash(name).update(bytes).digest('hex');
for (const name of Object.keys(expected)) if (actual[name] !== expected[name]) throw Error(`${name} mismatch`);
fs.chmodSync(path.join(dir, 'outdemo_v2.exe'), 0o444);
const receipt = {started, finished: new Date().toISOString(), url, finalUrl, expected, actual, format: run('file', ['outdemo_v2.exe'])};
fs.writeFileSync(path.join(dir, 'acquisition.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
