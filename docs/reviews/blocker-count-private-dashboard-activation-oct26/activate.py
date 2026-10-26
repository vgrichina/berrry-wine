from control import *
expected={'app.js':'7c1c314cfaab858da8a840399b5c9785b0ca1626919304b6069886d119aa4132','blocker-model.js':'1d3ebcd5e31e1eb2e91eb78e9996da2ae8f12840d1a2c30a11fe61c307fe3f7b'}
commit='938ea5bb01a25c51a9d70db756be3873fefe68f7'
assert run(['git','rev-parse','HEAD'],True,D)==commit
pins={}
for n,h in expected.items():
 assert sha(D/'ops'/n)==h
 blob=run(['git','rev-parse',f'{commit}:ops/{n}'],True,D)
 actual=run(['git','hash-object','--',str(D/'ops'/n)],True,D)
 assert blob==actual
 pins[n]={'sha256':h,'acceptedBlob':blob,'liveBefore':sha(L/n)}
assert sha(L/'readers.js')=='079da22e440c6a3eb6efb28a994b222fe827290ccfb0874ae48f1802ef08c78c'
unchanged={str(f.relative_to(L)):sha(f) for f in L.rglob('*') if f.is_file() and f.name not in ['app.js','blocker-model.js']}
save('runtime-unchanged-before.json',unchanged)
save('pinned-inputs.json',pins)
save('compatibility.json',{'compatible':True,'htmlScriptOrder':['terminal.js','task-ui.js','approval-ui.js','blocker-model.js','release-model.js','dos-view.js','views.js','app.js'],'newAppDependencies':['BlockerModel.countSummaryText','blockerSummary.counts','blockerSummary.repeatedIds','BlockerModel.repeatedIdNotes'],'allProvidedByAcceptedModel':True,'newModelExternalDependencies':[],'staticServing':'fs.createReadStream on each request, Cache-Control no-store','unchangedReaders':sha(L/'readers.js'),'acceptedDiff':'two-file delta reviewed; extra duplicate task status group and overview exclusion compatible with existing string status handling','limitations':['sidebar blocker-count remains raw blocked rows in accepted app','overview blocked stat remains raw blocked rows in accepted app'],'acceptanceReused':'10 implementation,26 independent,6 merged status,2 mocked Telegram; not repeated'})
resources('pre-activation')
backup=P/'backups';backup.mkdir(exist_ok=False)
for n in expected: shutil.copy2(L/n,backup/n)
rollback='''#!/usr/bin/env python3
import pathlib,os,shutil,hashlib
p=pathlib.Path('/tmp/blocker-count-private-dashboard-activation-oct26/backups')
d=pathlib.Path('/home/user/wine-dashboard-b0b9bc090/ops')
for n in ['app.js','blocker-model.js']:
 t=d/('.'+n+'.blocker-count-rollback-oct26')
 shutil.copy2(p/n,t)
 with t.open('rb') as f: os.fsync(f.fileno())
 os.replace(t,d/n)
fd=os.open(d,os.O_RDONLY);os.fsync(fd);os.close(fd)
'''
(P/'rollback.py').write_text(rollback)
for n in expected: assert sha(backup/n)==pins[n]['liveBefore']
try:
 for n,h in expected.items():
  t=L/('.'+n+'.blocker-count-activation-oct26')
  assert not t.exists()
  shutil.copy2(D/'ops'/n,t)
  os.chmod(t,(L/n).stat().st_mode)
  assert sha(t)==h
  with t.open('rb') as f: os.fsync(f.fileno())
 for n in expected: os.replace(L/('.'+n+'.blocker-count-activation-oct26'),L/n)
 fd=os.open(L,os.O_RDONLY);os.fsync(fd);os.close(fd)
except BaseException:
 exec(compile(rollback,str(P/'rollback.py'),'exec'));raise
served={}
for n,h in expected.items():
 info,b=get('/'+n,524288);assert info['status']==200 and info['sha256']==h and sha(L/n)==h;served[n]=info
info,_=get('/',524288);served['html']=info
for n,h in unchanged.items(): assert sha(L/n)==h,n
sample('after-activation')
save('activation.json',{'at':time.time(),'activated':True,'atomicity':'per-file atomic replace; both staged+validated before rename; rollback on exception','served':served,'allOtherRuntimeFilesUnchanged':True,'unchangedRuntimeFiles':len(unchanged),'serviceRestarted':False,'rollback':str(P/'rollback.py'),'backupHashes':{n:sha(backup/n) for n in expected}})
print(json.dumps({'activation':True,'served':served,'unchangedRuntimeFiles':len(unchanged)}))
