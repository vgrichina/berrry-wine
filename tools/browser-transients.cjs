'use strict';
// Disposable browser state belongs on the existing tmpfs, never in evidence.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {finished} = require('node:stream/promises');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function create() {
  assert.equal(fs.statfsSync('/dev/shm').type, 0x01021994, '/dev/shm must be tmpfs; no disk fallback');
  const root = fs.mkdtempSync('/dev/shm/wine-browser-');
  fs.chmodSync(root, 0o700);
  const identity = fs.lstatSync(root), children = [];
  let cleaned = false, cleanupTask;
  const dirs = Object.fromEntries(['profile', 'tmp', 'cache', 'crashes', 'downloads'].map(name => {
    const file = path.join(root, name); fs.mkdirSync(file, {mode:0o700}); return [name, file];
  }));
  fs.mkdirSync(path.join(dirs.profile, 'Default'));
  fs.writeFileSync(path.join(dirs.profile, 'Default/Preferences'), JSON.stringify({
    download:{default_directory:dirs.downloads, prompt_for_download:false},
  }), {flag:'wx', mode:0o600});
  const api = {
    root, ...dirs,
    // Installed BetterChromium otherwise runs a network timezone probe before
    // starting Chrome. Its 15s wait can consume the entire launch deadline.
    // Match the test guest's ordinary UTC locale without changing deadlines.
    args:Object.freeze(['--bw-timezone=Etc/UTC', '--user-data-dir=' + dirs.profile, '--disk-cache-dir=' + dirs.cache,
      '--crash-dumps-dir=' + dirs.crashes]),
    env(base = process.env) { return {...base, TMPDIR:dirs.tmp, TMP:dirs.tmp, TEMP:dirs.tmp, XDG_CACHE_HOME:dirs.cache}; },
    // Register immediately after spawn, before awaiting startup. close includes
    // process wait and pipe EOF; output streams must finish separately.
    watch(child, writers = []) {
      assert(!cleaned && !cleanupTask, 'workspace closing');
      let spawnError;
      child.once('error', e => { spawnError = e; });
      const drains = writers.map(w => finished(w));
      // Attach rejection handlers now, while preserving errors for cleanup.
      for (const p of drains) p.catch(() => {});
      const joined = new Promise((resolve, reject) => child.once('close', async (code, signal) => {
        try {
          for (const stream of [child.stdout, child.stderr]) if (stream)
            assert(stream.readableEnded || (spawnError && stream.destroyed), 'child pipe EOF missing');
          await Promise.all(drains);
          resolve({pid:child.pid ?? null, code, signal, actualWait:true,
            stdoutEOF:child.stdout?.readableEnded ?? null, stderrEOF:child.stderr?.readableEnded ?? null,
            writersDrained:true, spawnError:spawnError ? String(spawnError) : null});
        } catch (e) { reject(e); }
      }));
      joined.catch(() => {}); children.push(joined); return joined;
    },
    cleanup(evidenceDirectory) {
      if (cleanupTask) return cleanupTask;
      cleanupTask = (async () => {
        const waits = await Promise.all(children);
        const retained = [];
        // Downloads may be unique guest outputs. Copy exclusively across the
        // filesystem boundary, verify and fsync before deleting anything.
        function retain(directory, relative = '') {
          for (const name of fs.readdirSync(directory)) {
            const source = path.join(directory, name), rel = path.join(relative, name), st = fs.lstatSync(source);
            assert(!st.isSymbolicLink(), 'retain symlink requires explicit recovery; workspace kept');
            if (st.isDirectory()) { retain(source, rel); continue; }
            assert(st.isFile(), 'unknown output type; workspace kept');
            assert(evidenceDirectory, 'unique downloads require durable evidence destination');
            const destination = path.join(evidenceDirectory, 'browser-downloads', rel);
            fs.mkdirSync(path.dirname(destination), {recursive:true});
            fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
            const bytes = fs.readFileSync(source), digest = sha(bytes);
            assert.equal(sha(fs.readFileSync(destination)), digest, 'download copy mismatch');
            const fd = fs.openSync(destination, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
            retained.push({file:path.join('browser-downloads', rel), bytes:bytes.length, sha256:digest});
          }
        }
        const current = fs.lstatSync(root);
        assert(!current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino,
          'workspace identity changed; no cleanup');
        retain(dirs.downloads);
        fs.rmSync(root, {recursive:true}); cleaned = true;
        return {root, removed:!fs.existsSync(root), waits, retained, crossFilesystem:'exclusive copy + SHA256 + fsync before unlink'};
      })(); return cleanupTask;
    },
  };
  return api;
}

function encodeXwd(b) {
  assert(b.length >= 100, 'short XWD');
  const width=b.readUInt32BE(16), height=b.readUInt32BE(20), order=b.readUInt32BE(28),
    stride=b.readUInt32BE(48), start=b.readUInt32BE(0)+12*b.readUInt32BE(76);
  assert.equal(b.readUInt32BE(44),32); assert(order===0 || order===1);
  assert(width>0 && height>0 && stride>=width*4 && start+height*stride<=b.length, 'invalid XWD bounds');
  const {PNG}=require('pngjs'), p=new PNG({width,height});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=start+y*stride+x*4,v=order===0?b.readUInt32LE(i):b.readUInt32BE(i),j=(y*width+x)*4;
    p.data[j]=v>>>16&255;p.data[j+1]=v>>>8&255;p.data[j+2]=v&255;p.data[j+3]=255;
  }
  return {png:PNG.sync.write(p,{deflateLevel:1,filterType:0}),width,height};
}
function captureWhole(out, name, env) {
  assert(/^[a-z0-9-]+$/.test(name));
  const at=Date.now();
  // execFileSync returns only after actual wait and stdout EOF. Raw XWD never
  // touches rootfs (or evidence); encode exactly the previous whole image.
  const b=cp.execFileSync('xwd',['-root','-silent'],{env,timeout:3000,maxBuffer:16*1024*1024});
  const {png,width,height}=encodeXwd(b);
  fs.writeFileSync(path.join(out,name+'.png'),png,{flag:'wx'});
  const metadata={at,completedAt:Date.now(),sha256:sha(png),width,height,rawBytes:b.length,
    rawSHA256:sha(b),rawStorage:'memory',actualWait:true,stdoutEOF:true,
    route:'XGetImage root window; entire private display',reviewed:false};
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
  assert(Date.now()-at<3000,'fixed3000ms whole capture'); return metadata;
}
module.exports={create, encodeXwd, captureWhole};
