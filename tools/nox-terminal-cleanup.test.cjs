'use strict';
// Run the whole generated consumer/Node browser peer under real Linux custody.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),generated=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const script=String.raw`
import os,sys,json,time,runpy
from pathlib import Path
root,generated,out=map(Path,sys.argv[1:]);sys.path.insert(0,str(root/'tools'))
supervise=runpy.run_path(str(root/'tools/nox-startup-custody.py'))['supervise']
results=[]
for mode in ['refusal','stale-refusal','drag-failure','held-identity','held-mouse','held-capture','ordinary']:
 run=out/mode;run.mkdir();peer=run/'peer';peer.mkdir();custody=run/'custody';custody.mkdir()
 os.environ.update(NOX_TEST_CHILD='1',NOX_TEST_MODE=mode,NOX_TEST_DIR=str(peer),NOX_TEST_GENERATED=str(generated))
 try:supervise(custody,['node',str(root/'tools/nox-current-driver.test.cjs')],deadline=time.time()+80,cleanup_deadline=time.time()+90,journal_compression='gzip',command_compression='gzip')
 except AssertionError:
  if mode=='ordinary':raise
 drain=json.loads((custody/'kernel-drain.json').read_text());p=json.loads((peer/'peer.json').read_text());joined=json.loads((peer/'child-wait.json').read_text())
 assert drain['complete'] and not drain['remaining'] and not drain['unreaped']
 assert not drain['failure'] and not drain['cancellation']
 assert drain['journal']['closed'] and drain['commandLog']['closed'] and drain['commandLog']['eof']
 assert len(drain['owned'])==len(drain['reaped'])
 assert joined['stdoutEOF'] and joined['stderrEOF']
 failed=mode!='ordinary'
 assert drain['exit']==(1 if failed else 0),drain
 assert sum(q['method']=='Browser.close' for q in p['protocol'])==(0 if failed else 1)
 if failed:
  assert len(p['protocol'])==p['failurePublishedIndex']
  if mode in ['drag-failure','held-identity','held-mouse','held-capture']:assert len(p['protocol'])==p['terminalIndex']
  assert not (generated/'original/native-events.json').exists()
  assert not (generated/'original/command-0.png').exists()
 (generated/('original' if failed else 'production-preflight')).rename(run/'runtime')
 results.append(dict(mode=mode,reaped=len(drain['reaped']),exit=drain['exit'],passed=True))
(out/'results.json').write_text(json.dumps(dict(passed=True,actualGeneratedConsumer=True,actualKernelCustody=True,results=results),indent=2))
print(json.dumps(results))
`;
const p=cp.spawn('python3',['-c',script,root,generated,out],{stdio:['ignore',fs.openSync(out+'/stdout','wx'),fs.openSync(out+'/stderr','wx')]});
p.on('exit',(code,signal)=>{assert.equal(signal,null);assert.equal(code,0,fs.readFileSync(out+'/stderr','utf8'));console.log(fs.readFileSync(out+'/results.json','utf8'));});
