"""Prepare one bounded command against existing staged inputs; never clone or restore."""
import sys
from transport import *
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

if __name__=='__main__':prepare_session(sys.argv[1])
