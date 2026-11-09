"""Execute Q3's staged Node composition without a browser or provider copies.

Supply an existing explicit-version pinset and a fresh evidence directory.
Missing/stale bytes are substituted at the actual filesystem read boundary.
"""
import gzip
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PINS = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
assert OUT.is_relative_to(ROOT / 'scratch/runs')
OUT.mkdir(exist_ok=False)
CODE = r'''
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),cp=require('node:child_process');
const root=process.cwd(),pins=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(process.argv[1])));
assert.equal(pins.checkpointObserverVersion,'q3-checkpoint-b993419a5-v1');
const by=new Map(pins.files.map(p=>[path.resolve(root,p.path),p]));
const read=fs.readFileSync,seen=new Set(),target=process.argv[2],mode=process.argv[3];
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])
 cp[name]=()=>{throw Error('OFFLINE process effect refused');};
fs.readFileSync=function(file,...args){
 const absolute=path.resolve(String(file));
 if(!absolute.startsWith(root+'/'))return read.call(this,file,...args);
 if(absolute.endsWith('.cjs')||absolute.endsWith('.js')||absolute.endsWith('.py')){
  const pin=by.get(absolute);assert(pin,'unstaged production import '+path.relative(root,absolute));
  if(path.relative(root,absolute)===target&&mode==='missing')throw Error('staged missing '+target);
  let bytes=read.call(this,file);
  if(path.relative(root,absolute)===target&&mode==='stale')bytes=Buffer.concat([bytes,Buffer.from('\n')]);
  assert.equal(bytes.length,pin.size,'staged size '+pin.path);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pin.sha256,'staged SHA '+pin.path);
  seen.add(pin.path);
  return typeof args[0]==='string'?bytes.toString(args[0]):bytes;
 }
 return read.call(this,file,...args);
};
const entry='./tools/q3-native-driver-composition.cjs';
try{
 const m=require(entry),result=m.compose({root});
 for(const n of ['q3-native-input-cause-diagnostic.cjs','q3-input-wire-observation.cjs',
                 'q3-execution-boundary.cjs','q3-menu-pointer-control.cjs'])require('./tools/'+n);
 const bound=path.join(root,'scratch/runs/20261108-q3-gl-readiness-gameplay/bound-input.cjs');
 let integrated;
 m.compileBoundInput(result,{_compile(source){integrated=source;}},bound,path.dirname(process.argv[1]));
 assert(integrated.includes('physicalSource:')&&integrated.includes('peekKeyDownState'));
 assert(result.source.includes('cancellationCheckpoint')&&result.source.includes('q3-startup.cjs'));
 assert(result.fixtureSource.includes('WINE_REDLINE_STARTUP'));
 assert(!result.source.includes("fs.writeFileSync(file,b,{flag:'wx'})"),'duplicate module copy');
 assert.equal(mode,'good','negative must refuse');
 console.log(JSON.stringify({passed:true,reads:[...seen].sort(),browserStarted:false,nativeQualified:false}));
}catch(e){
 if(mode==='good')throw e;
 assert(String(e).includes(target),'negative must name its actual missing/stale dependency: '+e);
 console.log(JSON.stringify({passed:true,target,mode,refusal:String(e),browserStarted:false,nativeQualified:false}));
}
'''


def run(target='', mode='good'):
    child = subprocess.Popen(['node', '-e', CODE, str(PINS), target, mode], cwd=ROOT,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    expired = False
    try:
        so, se = child.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        expired = True
        child.kill()
        so, se = child.communicate(timeout=3)
    label = 'good' if mode == 'good' else mode + '-' + Path(target).name
    record = dict(status=child.returncode, expired=expired, actualWait=True, stdoutEOF=True,
                  stderrEOF=True, stdout=so.decode(), stderr=se.decode())
    (OUT/(label+'.json.gz')).write_bytes(gzip.compress(json.dumps(record).encode(), mtime=0))
    assert child.returncode == 0, se.decode()
    return json.loads(so)


good = run()
for target in good['reads']:
    run(target, 'missing')
    run(target, 'stale')
(OUT/'result.json.gz').write_bytes(gzip.compress(json.dumps(dict(
    passed=True, imported=good['reads'], negatives=2*len(good['reads']),
    nativeQualified=False, browserEOF='UNKNOWN')).encode(), mtime=0))
print('PASS staged actual composition and per-read missing/stale refusals', len(good['reads']))
