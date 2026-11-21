'use strict';

// Preloaded into every node process tools/build.sh starts (NODE_OPTIONS
// --require, set ONLY inside build.sh). Two jobs, one JSONL line per process at
// exit, appended to $WINE_BUILD_RECORDS:
//
//   * how many bytes of src/ this process read, through readFileSync, readFile,
//     fs.promises.readFile and createReadStream. Twenty gates each re-reading
//     the whole tree is exactly how the build got slow, and a byte counter is
//     the only measure of it that does not depend on how loaded the box is.
//   * its own resource usage (user/sys CPU, peak RSS), so the step runner gets
//     per-process numbers for nested processes too (a gate that spawns node,
//     a bash step that runs two) without /usr/bin/time and its platform flags.
//
// The step a process belongs to comes from $WINE_BUILD_STEP, which
// tools/build-run-steps.js sets per step and children inherit. Nothing here
// changes what a read returns; with WINE_BUILD_RECORDS unset it is inert.

const RECORDS = process.env.WINE_BUILD_RECORDS;
if (RECORDS) install(RECORDS);

function install(recordsPath) {
  const fs = require('fs');
  const path = require('path');
  const { isMainThread } = require('worker_threads');
  const SRC = path.join(path.resolve(__dirname, '..'), 'src') + path.sep;
  const started = process.hrtime.bigint();
  let srcBytes = 0;
  let srcReads = 0;

  const underSrc = (p) => {
    if (typeof p === 'number') return false;
    let s = p;
    if (Buffer.isBuffer(s)) s = s.toString();
    else if (s instanceof URL) { if (s.protocol !== 'file:') return false; s = require('url').fileURLToPath(s); }
    if (typeof s !== 'string') return false;
    return path.resolve(s).startsWith(SRC);
  };
  const count = (data) => {
    srcReads++;
    if (data == null) return;
    srcBytes += typeof data === 'string' ? Buffer.byteLength(data) : data.length;
  };

  const readFileSync = fs.readFileSync;
  fs.readFileSync = function patchedReadFileSync(p, ...rest) {
    const out = readFileSync.call(this, p, ...rest);
    if (underSrc(p)) count(out);
    return out;
  };
  const readFile = fs.readFile;
  fs.readFile = function patchedReadFile(p, ...rest) {
    if (!underSrc(p)) return readFile.call(this, p, ...rest);
    const cb = rest.pop();
    return readFile.call(this, p, ...rest, (err, data) => { if (!err) count(data); cb(err, data); });
  };
  const promisesReadFile = fs.promises.readFile;
  fs.promises.readFile = async function patchedPromisesReadFile(p, ...rest) {
    const out = await promisesReadFile.call(this, p, ...rest);
    if (underSrc(p)) count(out);
    return out;
  };
  const createReadStream = fs.createReadStream;
  fs.createReadStream = function patchedCreateReadStream(p, ...rest) {
    const stream = createReadStream.call(this, p, ...rest);
    if (underSrc(p)) {
      srcReads++;
      stream.on('data', (chunk) => { srcBytes += chunk.length; });
    }
    return stream;
  };

  process.on('exit', (code) => {
    const rec = {
      step: process.env.WINE_BUILD_STEP || null,
      pid: process.pid,
      thread: isMainThread ? 'main' : 'worker',
      script: path.relative(path.resolve(__dirname, '..'), process.argv[1] || '') || null,
      exit: code,
      srcBytes,
      srcReads,
    };
    if (isMainThread) {
      const ru = process.resourceUsage();
      rec.wallMs = Number(process.hrtime.bigint() - started) / 1e6;
      rec.userMs = ru.userCPUTime / 1000;
      rec.sysMs = ru.systemCPUTime / 1000;
      rec.maxRssKb = ru.maxRSS;
    }
    try { fs.appendFileSync(recordsPath, JSON.stringify(rec) + '\n'); } catch (_) { /* never fail the step */ }
  });
}
