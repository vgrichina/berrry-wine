import json,pathlib,hashlib
from transport import *
code='''import pathlib,json,hashlib,os,subprocess,shutil
R=pathlib.Path(ROOT_PATH);I=R/'immutable';M=R/'mutable';F=R/'fixed'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
rows=[[str(p.relative_to(I/'restored')),p.stat().st_size,sha(p)] for p in sorted((I/'restored').rglob('*')) if p.is_file()]
assert len(rows)==2083 and sum(x[1] for x in rows)==186399681
stage=json.loads((I/'receipts/stage-receipts.json').read_text());assert len(stage)==224
for x in stage:
 p=pathlib.Path(x['path']);assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256']
ctl=json.loads((I/'receipts/ctl-pin.json').read_text());assert sha(I/'runtime'/ctl['path'])==ctl['sha256']
source=I/'restored/parent-vfs';clones=[p for p in (M/'vfs').rglob('*') if p.is_file()];assert len(clones)==2045
assert all(sha(p)==sha(source/p.relative_to(M/'vfs')) for p in clones)
reg=sha(I/'restored/parent-registry.json');assert reg==sha(M/'registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
assert all(not p.is_symlink() and not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
node=subprocess.run(['pgrep','-a','node'],capture_output=True,text=True);assert node.returncode==1,node.stdout
assert not (F/'save-gameplay').exists()
st=os.statvfs(M);assert os.path.ismount(M) and st.f_blocks*st.f_frsize==939524096
assert M.stat().st_uid==M.stat().st_gid==1000 and M.stat().st_mode&0o777==0o755
fixture=json.loads((F/'settings-capture-fixture.json').read_text());assert fixture['exit']==1 and 'unsafe diagnostic guest path' in fixture['stderr']
wd=json.loads((F/'watchdog-fixture.json').read_text());assert wd['boundPassed'] and wd['remaining']==[]
natives={n:dict(bytes=(source/'program files/acclaim entertainment/shadowman'/n).stat().st_size,sha256=sha(source/'program files/acclaim entertainment/shadowman'/n)) for n in ['d3dconfigutility.exe','mss32.dll','dsetup.dll','shadowman.exe']}
fixed={str(p.relative_to(F)):json.loads(p.read_text()) for p in F.rglob('*.json') if p.stat().st_size<180000 and p.name!='watchdog-fixture.json'}
a=dict(immutable=alloc(I),fixed=alloc(F),tmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,freeBytes=shutil.disk_usage(R).free)
assert a['immutable']<2147483648 and a['fixed']<100663296 and a['freeBytes']>=2147483648
print(json.dumps(dict(originalRows=rows,allOriginalHashesVerified=True,stageEntriesVerified=224,immutableClosureIncludingCtlReceipt=217,immutableReadOnly=True,cloneCount=1,cloneFiles=2045,cloneUnchanged=True,registrySHA256=reg,nativeSeals=natives,guestAttempts=0,configurationActions=0,settingsWrites=0,gameLaunches=0,ownedNodeProcesses=[],ownedGroups=[],watchdogFixture=wd,settingsCaptureFixture=fixture,fixedReceipts=fixed,allocation=a)))
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'handback-integrity-api.json',30);h=json.loads(r['stdout']);actual=h.pop('originalRows');assert actual==json.loads((E/'destination-original-hashes.json').read_text());save('confirmed-original-hashes.json',actual);h['acceptedDestinationReceiptUnchanged']=True
box=api('sandboxes/'+BOX);save('box-final.json',box);b=box['sandbox'];assert b['state']=='idle' and b['health']=='ok' and b['stop'] is None
h.update(box=BOX,boxState='RUNNING (API idle)',health=b['health'],stop=b['stop'],expiry=b['archiveAfter'],coordinatorLifecycleOwner=True,handbackBefore='2026-10-23T02:45:00Z');save('handback.json',h)
print(json.dumps({k:v for k,v in h.items() if k not in ['fixedReceipts','settingsCaptureFixture']}))
