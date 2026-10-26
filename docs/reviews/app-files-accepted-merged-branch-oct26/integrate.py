import pathlib, subprocess, json, hashlib, os, shutil, time, resource
P=pathlib.Path('/tmp/app-files-accepted-merged-branch-oct26'); R=P/'repo'; O=P/'ops'
MAIN='c3d394149406189cf1c5dbbc434491f0130666c9'
C='e9f3142b68816c6512d65db132ea43ba4e8c36ca'; A='7ec5f75eaaa873bd58165b2e83745bd6648fecae'
D=pathlib.Path('/tmp/app-files-empty-alias-independent-accept-oct26/repo')
CD=pathlib.Path('/tmp/app-files-empty-alias-fallback-repair-oct26/repo')
MD=pathlib.Path('/tmp/renderer-side-polling-main-retained-closeout-oct26/repo')
B='task/app-files-accepted-merged-branch-oct26'
resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def run(args,cwd=R):
 r=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
 assert len(r.stdout)+len(r.stderr)<=2*1024**2, 'capture limit'
 if r.returncode: raise RuntimeError((args,r.returncode,r.stderr[:4096]))
 return r.stdout
def git(*a,cwd=R):return run(['git',*a],cwd)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
def blob(rev,p,cwd=R):return git('show',rev+':'+p,cwd=cwd)
def tree(rev,cwd=R):
 return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-r',rev,cwd=cwd).splitlines()}
def resources(label):
 admission=json.loads((O/'admission.json').read_text())
 launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/app-files-accepted-merged-branch-oct26')
 event=launcher/'events.jsonl'; session=None
 with event.open() as f:
  for line in f:
   e=json.loads(line)
   if e.get('type')=='thread.started': session=e['thread_id'];break
 sessionfiles=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+session+'*')) if session else []
 owned=sum(x.stat().st_size for x in P.rglob('*') if x.is_file())
 external=sum(x.stat().st_size for x in launcher.rglob('*') if x.is_file())+sum(x.stat().st_size for x in sessionfiles)
 wal={str(x):max(0,x.stat().st_size-admission['walInitial'].get(str(x),0)) for x in pathlib.Path('/home/user/.codex').glob('*sqlite-wal')}
 peak=owned+external+sum(wal.values())+12582912+8388608
 mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(P).free
 x={'at':time.time(),'ownedBytes':owned,'launcherSessionBytes':external,'sessionId':session,'positiveWALOnce':wal,'futureOnce':12582912,'reserve':8388608,'projectedPeak':peak,'allocation':67108864,'freeDisk':free,'diskAfterRemainingGrowth':free-(12582912+8388608),'memAvailable':mem,'memoryAfterLightClient':mem-553648128,'memoryFloor':805306368}
 x['pass']=peak<=67108864 and x['diskAfterRemainingGrowth']>=2982150144 and x['memoryAfterLightClient']>=805306368
 save('resources-'+label+'.json',x);assert x['pass'],x
 return x
if __name__=='__main__':
 resources('precheckout')
 R.mkdir(exist_ok=True);git('init','-q');git('config','gc.auto','0');git('config','maintenance.auto','false')
 # Enumerate existing object directories once, flattening alternates without copying.
 roots=set()
 def visit(p):
  p=p.resolve()
  if str(p) in roots:return
  assert p.is_dir();roots.add(str(p))
  alt=p/'info/alternates'
  if alt.exists():
   for s in alt.read_text().splitlines():visit(pathlib.Path(s) if s.startswith('/') else p/s)
 for d in [D,CD,MD]:visit(d/'.git/objects')
 (R/'.git/objects/info/alternates').write_text('\n'.join(sorted(roots))+'\n')
 save('readonly-objects.json',{'directories':sorted(roots),'copiedObjectBytes':0,'standingLogicalBytes':sum(sum(x.stat().st_size for x in pathlib.Path(p).rglob('*') if x.is_file()) for p in roots)})
 for rev,d in [(MAIN,MD),(C,CD),(A,D)]:assert git('rev-parse',rev,cwd=d).decode().strip()==rev
 git('symbolic-ref','HEAD','refs/heads/'+B);git('update-ref','refs/heads/'+B,MAIN);git('read-tree',MAIN)
 base=git('rev-parse',C+'^').decode().strip()
 # Merge the accepted delta, retaining every unrelated entry from the pinned main tree.
 mt=tree(MAIN);ct=tree(C);bt=tree(base);at=tree(A)
 changes={p:v for p,v in ct.items() if bt.get(p)!=v}
 assert set(changes)-{'lib/app-files.js','test/app-files-empty-alias-fallback-oct26.test.cjs'}=={p for p in changes if p.startswith('docs/reviews/app-files-empty-alias-fallback-oct26/')}
 comment=b"    // Match host.js loadFiles' literal default basename. Query/fragment text\n    // remains part of the mounted guest name; extensionOf only classifies the\n    // resource. Use vfsPath/vfsPaths to give a URL a different guest identity.\n"
 assert blob(base,'lib/app-files.js').replace(comment,b'')==blob(MAIN,'lib/app-files.js'),'unexpected main app-files divergence'
 accept={p:v for p,v in at.items() if ct.get(p)!=v}
 assert all(p.startswith('docs/reviews/app-files-empty-alias-independent-oct26/') or p=='test/app-files-empty-alias-independent-oct26.test.cjs' for p in accept)
 for p,v in {**changes,**accept}.items():
  mode,typ,oid=v.split();git('update-index','--add','--cacheinfo',mode+','+oid+','+p)
 paths=sorted(set(changes)|set(accept)|{'host.js','lib/app-files.js'})
 for p in paths:
  out=R/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(blob(A if p in accept else C if p in changes else MAIN,p));out.chmod(int((accept.get(p) or changes.get(p) or mt[p]).split()[0],8)&0o777)
 tested=git('write-tree').decode().strip(); merged=tree(tested)
 different={p for p in set(mt)|set(merged) if mt.get(p)!=merged.get(p)}
 assert different==set(changes)|set(accept)
 assert [p for p in different if not p.startswith(('docs/','test/'))]==['lib/app-files.js']
 save('preservation.json',{'base':MAIN,'testedTree':tested,'allOtherBytesAndModesPreserved':True,'changedPaths':sorted(different),'acceptedProductionEntry':ct['lib/app-files.js'],'mergedProductionEntry':merged['lib/app-files.js']})
 manifests=[]
 for rev,prefix,d in [(C,'app-files-empty-alias-fallback-oct26',CD),(A,'app-files-empty-alias-independent-oct26',D)]:
  mp='docs/reviews/'+prefix+'/evidence-manifest.json';data=blob(rev,mp,cwd=d); manifest=json.loads(data); entries=[]
  for p,item in manifest.items():
   b=blob(rev,p,cwd=d);assert sha(b)==item['sha256'] and len(b)==item['bytes'],p
   assert blob(tested,p)==b,p
   entries.append({'path':p,**item})
  manifests.append({'revision':rev,'manifest':mp,'manifestSha256':sha(data),'verifiedPayloads':entries})
 save('accepted-payload-verification.json',manifests)
 # Closure covers actual code loaded, full host/extraction input, complete fixtures and Node builtins/executable.
 closurePaths=['lib/app-files.js','host.js','test/app-files-empty-alias-fallback-oct26.test.cjs','test/app-files-empty-alias-independent-oct26.test.cjs']
 closure={p:{'acceptedEntry':at[p],'mergedEntry':merged[p],'sha256':sha(blob(A,p)),'identical':blob(A,p)==blob(tested,p)} for p in closurePaths}
 assert all(x['identical'] for p,x in closure.items() if p!='host.js')
 node=pathlib.Path(shutil.which('node')).resolve();nodepin={'path':str(node),'bytes':node.stat().st_size,'sha256':sha(node.read_bytes())}
 old=json.loads(blob(A,'docs/reviews/app-files-empty-alias-independent-oct26/admission.json'))['toolsStanding']['node'];assert nodepin==old
 check=json.loads(blob(A,'docs/reviews/app-files-empty-alias-independent-oct26/checkpoint.json'))
 for group in check['groups']:
  for p,h in group['sourceAndFixtureHashes'].items():
   assert sha(blob(A,p))==h
   if p!='host.js':assert sha(blob(tested,p))==h
  evidence=blob(A,'docs/reviews/app-files-empty-alias-independent-oct26/'+group['evidence']);assert sha(evidence)==group['sha256'] and len(evidence)==group['bytes']
 host=blob(tested,'host.js');start=host.index(b'  async loadFiles(urls, options = {}) {');end=host.index(b'\n  async loadDlls(',start);excerpt=host[start:end]
 assert len(excerpt)==16464 and sha(excerpt)=='5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659'
 oldhost=blob(A,'host.js');oldstart=oldhost.index(b'  async loadFiles(urls, options = {}) {');oldend=oldhost.index(b'\n  async loadDlls(',oldstart)
 assert oldhost[oldstart:oldend]==excerpt
 save('closure-reuse.json',{'candidate':C,'acceptance':A,'main':MAIN,'preCompatibilityTree':tested,'paths':closure,'node':nodepin,'hostExcerpt':{'start':start,'end':end,'acceptedStart':oldstart,'acceptedEnd':oldend,'bytes':len(excerpt),'sha256':sha(excerpt),'identical':True},'acceptedGroups':check['groups'],'reusedSuppliedPass':7,'reusedIndependentPass':8,'reusedRejectedMutants':3,'remaining':'Full-host fixture guard differs because pinned main parser hardening must remain; run only host-pin-adapted merged compatibility groups with original test bodies unchanged.'})
 save('tested-tree.json',{'tree':tested,'base':MAIN,'candidate':C,'acceptance':A,'validation':'Exact closure and all accepted evidence rehashed; 7+8 PASS and 3 rejecting mutants reused','completed':['integration','preservation','manifest verification','closure verification'],'remaining':['docs-only finalization','task-only push','exact remote verification']})
 resources('validated')
 print(json.dumps({'preCompatibilityTree':tested,'changedPaths':len(different),'manifests':[len(x['verifiedPayloads']) for x in manifests],'hostMethodClosureUnchanged':True,'fullHostChanged':True}))
