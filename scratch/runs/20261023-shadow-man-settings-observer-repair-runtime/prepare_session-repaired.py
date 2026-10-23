"""Accepted hash/clone/dependency gates, followed by exact owned command admission."""
import io,sys,json,pathlib,hashlib
from transport import *
C=pathlib.Path('/home/user/wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture')
def put(p,target):
 with p.open('rb') as f:r=upload_stream(f,p.stat().st_size,ROOT+'/fixed/'+target)
 return r
def main():
 assert (E/'transfer-complete.json').exists() and len(json.loads((E/'stage-receipts.json').read_text()))==224
 assert not (E/'preguest-api.json').exists()
 (E/'next-runtime-recipe.json').write_bytes((C/'accepted/next-runtime-recipe.json').read_bytes())
 p=E/'preguest.py';p.write_text(p.read_text().replace('2026,10,23,1,10,','2026,10,23,2,42,'))
 for n in ['next-runtime-recipe.json','preguest.py','session_runner.py','settings-observer.cjs']:
  save(n+'-upload.json',put(E/n,n))
 L=pathlib.Path('/home/user/wine-assembly-shadow-man-live-capture-helper-retest-oct23/scratch/runs/20261023-shadow-man-live-capture-helper-retest')
 (E/'reused-capture-fixture.json').write_bytes((L/'offline-fixture.json').read_bytes())
 save('reused-capture-fixture-upload.json',put(E/'reused-capture-fixture.json','reused-capture-fixture.json'))
 # Every accepted staged entry is checked on destination before the single clone.
 code='''import pathlib,json,hashlib,runpy
R=pathlib.Path(ROOT_PATH)
rows=json.loads((R/'immutable/receipts/stage-receipts.json').read_text());assert len(rows)==224
for x in rows:
 p=pathlib.Path(x['path']);assert p.stat().st_size==x['bytes']
 with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==x['sha256'],str(p)
ctl=json.loads((R/'immutable/receipts/ctl-pin.json').read_text());assert hashlib.sha256((R/'immutable/runtime'/ctl['path']).read_bytes()).hexdigest()==ctl['sha256']
assert sum('/immutable/' in x['path'] for x in rows)+1==217
runpy.run_path(str(R/'fixed/hash_gate.py'),run_name='__main__')
'''
 run('ROOT_PATH='+repr(ROOT)+'\n'+code,'full-hash-api.json',30)
 run('import runpy;runpy.run_path('+repr(ROOT+'/fixed/prepare_mutable.py')+',run_name="__main__")','single-clone-api.json',30)
 run('import runpy;runpy.run_path('+repr(ROOT+'/fixed/preguest.py')+',run_name="__main__")','preguest-api.json',30)
 # An actual out-of-process fixture must reap an owned event-loop-blocking process.
 code='''import pathlib,json,sys,os
R=pathlib.Path(ROOT_PATH);F=R/'fixed';M=R/'mutable';sys.path.insert(0,str(F))
from watchdog import supervise
r=supervise(['node','-e','for(;;){}'],str(M/'output'),dict(PATH='/bin:/usr/bin'),str(F/'watchdog-fixture.log'),str(F/'watchdog-fixture.json'),2)
assert r['boundPassed'] and r['elapsedSeconds']<=2 and r['remaining']==[] and r['parentOsExit'] is not None
print(json.dumps(r))
'''
 run('ROOT_PATH='+repr(ROOT)+'\n'+code,'watchdog-fixture-api.json',10)
 code='''import pathlib,subprocess,json,os
R=pathlib.Path(ROOT_PATH);F=R/'fixed';O=R/'mutable/output/save-gameplay/diagnostic-fixture';O.mkdir(parents=True)
js="""const fs=require('fs'),assert=require('assert');const root=process.env.SHADOW_ROOT;const host=require(root+'/immutable/runtime/lib/host-imports');host.createHostImports=c=>({});require(root+'/fixed/settings-observer.cjs');const files=new Map([['c:\\\\test.ini',{data:Buffer.from('original')}]]);const ctx={vfs:{files}};host.createHostImports(ctx);let first=globalThis.__shadowCapture('before');assert.equal(first.changed.length,0);assert.equal(files.size,1);assert.equal(files.get('c:\\\\test.ini').data.toString(),'original');files.get('c:\\\\test.ini').data=Buffer.from('actual-change');let after=globalThis.__shadowCapture('after');assert.equal(after.changed.length,1);assert.equal(fs.readFileSync(process.env.SHADOW_SESSION_OUTPUT+'/state-after/vfs/test.ini','utf8'),'actual-change');assert.equal(files.size,1);assert.equal(files.get('c:\\\\test.ini').data.toString(),'actual-change');assert.equal(after.guestMutation,false);console.log(JSON.stringify({passAll:true,readonlyGuestCapture:true,changedBytesRetained:true,actualStorageExport:true}));"""
p=subprocess.run(['node','-e',js],env=dict(PATH='/bin:/usr/bin',SHADOW_ROOT=str(R),SHADOW_SESSION_OUTPUT=str(O),NODE_PATH=str(R/'immutable/runtime/node_modules')),capture_output=True,text=True,timeout=10)
result=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'settings-capture-repaired-fixture-final.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));assert p.returncode==0
'''
 run('ROOT_PATH='+repr(ROOT)+'\n'+code,'settings-capture-fixture-api.json',20)
 prepare_session('session1')
def prepare_session(sid):
 assert sid in ('session1','session2','session3')
 code='''import pathlib,json,os,socket,subprocess,hashlib,shutil
R=pathlib.Path(ROOT_PATH);F=R/'fixed';M=R/'mutable';I=R/'immutable';RT=I/'runtime';sid=SESSION
base=json.loads((F/'preguest-gate.json').read_text());assert base['passAll'] and base['canonicalInputConsumed']
wd=json.loads((F/'watchdog-fixture.json').read_text());assert wd['boundPassed'] and wd['remaining']==[]
diagnostic=json.loads((F/'settings-capture-repaired-fixture-final.json').read_text());assert diagnostic['exit']==0 and json.loads(diagnostic['stdout'])['passAll']
capture=json.loads((F/'reused-capture-fixture.json').read_text());assert capture['passAll'] and capture['actualSnapshotAdvancedToPng'] and len(capture['rejected'])==8
game=M/'vfs/program files/acclaim entertainment/shadowman/shadowman.exe'
assert game.stat().st_size==1896448 and hashlib.sha256(game.read_bytes()).hexdigest()=='4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772'
b=(RT/'build/wine-assembly.wasm').read_bytes();assert b[:8]==bytes([0,97,115,109,1,0,0,0])
def leb(pos):
 value=0;shift=0
 while True:
  byte=b[pos];pos+=1;value|=(byte&127)<<shift
  if not byte&128:return value,pos
  shift+=7
pos=8;exportsFound=set()
while pos<len(b):
 section=b[pos];length,start=leb(pos+1);end=start+length
 if section==7:
  count,q=leb(start)
  for _ in range(count):
   n,q=leb(q);name=b[q:q+n].decode();q+=n+1;idx,q=leb(q);exportsFound.add(name)
 pos=end
requiredExports={'wnd_slot_hwnd','ctrl_get_id','ctrl_get_class','wnd_get_parent','wnd_get_style_export','wnd_window_screen_x','wnd_window_screen_y','ctrl_get_wh'}
assert requiredExports<=exportsFound,sorted(requiredExports-exportsFound)
assert os.getuid()==1000 and M.stat().st_uid==1000 and M.stat().st_gid==1000 and M.stat().st_mode&0o777==0o755
assert subprocess.run(['pgrep','-a','node'],capture_output=True).returncode==1
S=F/'save-gameplay'/sid;O=M/'output/save-gameplay'/sid
assert not S.exists() and not O.exists();S.mkdir(parents=True);O.mkdir(parents=True)
probe=O/'uid-probe';probe.write_bytes(b'ordinary-user');probe.unlink()
st=os.statvfs(M);assert st.f_blocks*st.f_frsize==939524096
assert shutil.disk_usage(R).free>=2147483648
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
guard=(F/'compile-guard.cjs').read_text().replace('/fixed/module-consumption.jsonl','/fixed/save-gameplay/'+sid+'/module-consumption.jsonl');(S/'compile-guard.cjs').write_text(guard)
observer=(F/'game-observer.cjs').read_text().replace('/fixed/compile-guard.cjs','/fixed/save-gameplay/'+sid+'/compile-guard.cjs').replace("mutable/output';","mutable/output/save-gameplay/"+sid+"';")
(S/'game-observer.cjs').write_text(observer)
command=[x.replace('/fixed/compile-guard.cjs','/fixed/save-gameplay/'+sid+'/compile-guard.cjs').replace('/fixed/game-observer.cjs','/fixed/save-gameplay/'+sid+'/game-observer.cjs').replace('/output/session/','/output/save-gameplay/'+sid+'/') if not x.startswith('--control=') else '--control='+str(port) for x in base['command']]
command[5:5]=['--require',str(F/'settings-observer-repaired.cjs')]
command=[x+',EnableWindow,RegCreateKeyExA,RegSetValueExA,WriteFile,CreateFileA,CloseHandle,WritePrivateProfileStringA' if x.startswith('--trace-api=') else x for x in command]
assert command[:2]==['node','--require'] and command[5:7]==['--require',str(F/'settings-observer-repaired.cjs')]
assert '--no-build' in command and '--wasm='+str(RT/'build/wine-assembly.wasm') in command
env=dict(base['environment'],SHADOW_SESSION_OUTPUT=str(O))
for p in [S/'compile-guard.cjs',S/'game-observer.cjs',F/'settings-observer-repaired.cjs']:
 p1=subprocess.run(['node','--check',str(p)],env=env,capture_output=True,text=True);assert p1.returncode==0,p1.stderr
for p in [RT/'test/run.js',RT/'tools/ctl.js',RT/'lib/storage.js',RT/'lib/vfs-export.js',RT/'lib/guest-worker.js',F/'session_runner-repaired.py',F/'watchdog.py']:
 assert p.is_file(),str(p)
seal={str(p):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [S/'compile-guard.cjs',S/'game-observer.cjs',F/'settings-observer-repaired.cjs',F/'session_runner-repaired.py',F/'watchdog.py',RT/'tools/ctl.js',RT/'lib/storage.js']}
g=dict(base,command=command,environment=env,controlPort=port,session=sid,actualFullCommandChecked=True,settingsCaptureGuestMutation=False,extraDiagnosticDependencies=['fs','path','crypto','worker_threads','lib/host-imports','lib/storage'],helperSeals=seal)
g['allocationFresh']=dict(tmpfsCap=st.f_blocks*st.f_frsize,tmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,free=shutil.disk_usage(R).free)
g['originalGameIdentity']=dict(bytes=game.stat().st_size,sha256=hashlib.sha256(game.read_bytes()).hexdigest())
g['observationExportsVerifiedFromCanonicalSection']=sorted(requiredExports)
g['watchdogFixture']=wd;g['settingsCaptureFixture']=diagnostic;g['acceptedCaptureFixtureReused']=capture
(S/'gate.json').write_text(json.dumps(g,indent=2));print(json.dumps(g))
'''
 r=run('ROOT_PATH='+repr(ROOT)+'\nSESSION='+repr(sid)+'\n'+code,sid+'-preflight-api.json',30)
 save(sid+'-preflight.json',json.loads(r['stdout']))
if __name__=='__main__':
 if len(sys.argv)==1:main()
 else:prepare_session(sys.argv[1])
