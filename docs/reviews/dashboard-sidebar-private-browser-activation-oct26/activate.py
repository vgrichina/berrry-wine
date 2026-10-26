from control import *
import difflib,re
gate('before-activation',browser=True)
assert sha(L/'app.js')==OLD and sha(R/'ops/app.js')==APP
assert sha(L/'blocker-model.js')=='1d3ebcd5e31e1eb2e91eb78e9996da2ae8f12840d1a2c30a11fe61c307fe3f7b'
assert sha(L/'readers.js')=='079da22e440c6a3eb6efb28a994b222fe827290ccfb0874ae48f1802ef08c78c'
before=service();save('service-before.json',before)
listeners=[x.split() for x in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:] if x.split()[1].endswith(':1FA2') and x.split()[3]=='0A']
assert len(listeners)==1 and listeners[0][1]=='0100007F:1FA2'
assert 'socket:['+listeners[0][9]+']' in [os.readlink(x) for x in pathlib.Path('/proc/'+str(before['pid'])+'/fd').iterdir()]
save('loopback-listener.json',dict(localAddress=listeners[0][1],state='LISTEN',pid=before['pid']))
manifest={str(f.relative_to(L)):dict(sha256=sha(f),bytes=f.stat().st_size,mode=f.stat().st_mode,uid=f.stat().st_uid,gid=f.stat().st_gid) for f in L.rglob('*') if f.is_file()}
save('deployed-before-manifest.json',manifest)
htmlinfo,html=get('/');assert htmlinfo['status']==200
scripts=re.findall(r'<script src="([^"]+)"',html.decode());assert scripts.index('/blocker-model.js')<scripts.index('/app.js')
receipts={}
for s in scripts:
 info,b=get(s);assert info['status']==200
 f=L/('node_modules/@xterm/xterm/lib/xterm.js' if s=='/vendor/xterm.js' else s.lstrip('/'))
 assert info['sha256']==sha(f),s
 receipts[s]=info
assert receipts['/app.js']['sha256']==OLD
model=(L/'blocker-model.js').read_text();assert 'countSummary,' in model and 'countSummaryText,' in model
diff=''.join(difflib.unified_diff((L/'app.js').read_text().splitlines(True),(R/'ops/app.js').read_text().splitlines(True),fromfile='deployed-prior-app',tofile='accepted-app'))
save('compatibility.json',dict(html=htmlinfo,scripts=scripts,served=receipts,modelExportsPresent=True,unchangedDependencies=True,diff=diff,staticReadsOnEachRequest=True,noStore=True,reusedAcceptance='independent8/8 including128 snapshots+28 transitions; merged8/8; candidate5/5; prior10/26/6; no replay'))
backup=P/'backups';backup.mkdir(exist_ok=False);shutil.copy2(L/'app.js',backup/'app.js');assert sha(backup/'app.js')==OLD
rollback='''from control import *
assert sha(P/'backups/app.js')==OLD
assert sha(L/'app.js') in [OLD,APP], 'live app has another owner; stop rollback'
t=L/'.app.js.sidebar-private-rollback-oct26'
assert not t.exists()
shutil.copy2(P/'backups/app.js',t)
with t.open('rb') as f:os.fsync(f.fileno())
os.replace(t,L/'app.js')
fd=os.open(L,os.O_RDONLY);os.fsync(fd);os.close(fd)
assert sha(L/'app.js')==OLD
print('prior exact bytes restored atomically; no restart')
'''
(P/'rollback.py').write_text(rollback)
t=L/'.app.js.sidebar-private-activation-oct26';assert not t.exists()
try:
 shutil.copy2(R/'ops/app.js',t);os.chmod(t,(L/'app.js').stat().st_mode)
 assert sha(t)==APP
 assert t.stat().st_uid==(L/'app.js').stat().st_uid and t.stat().st_gid==(L/'app.js').stat().st_gid
 with t.open('rb') as f:os.fsync(f.fileno())
 os.replace(t,L/'app.js');fd=os.open(L,os.O_RDONLY);os.fsync(fd);os.close(fd)
 served,_=get('/app.js');assert served['status']==200 and served['sha256']==APP
 after=service();assert (after['pid'],after['startTicks'])==(before['pid'],before['startTicks'])
 current={str(f.relative_to(L)) for f in L.rglob('*') if f.is_file()};assert current==set(manifest)
 for n,v in manifest.items():
  if n!='app.js':assert sha(L/n)==v['sha256'],n
 save('service-after-activation.json',after)
 save('activation.json',dict(activated=True,at=time.time(),candidate=BASE,appSHA256=APP,priorAppSHA256=OLD,served=served,unchangedOtherFiles=len(manifest)-1,unchangedFileSet=True,rollback=str(P/'rollback.py'),backup=str(backup/'app.js'),atomicReplacement=True,noRestart=True))
 save('checkpoint.json',dict(candidate=BASE,sourceSHA256=APP,completed=['pinned input and compatibility','atomic private activation','served HTTP200 exacthash','all other deployed files unchanged'],remaining=['bounded real browser','task evidence publication'],reused='all accepted implementation/independent/merged groups unchanged, not replayed'))
except BaseException:
 if t.exists():t.unlink()
 if sha(L/'app.js')==APP:exec(compile(rollback,str(P/'rollback.py'),'exec'))
 raise
print('exact one-file atomic activation PASS; all other files unchanged')
