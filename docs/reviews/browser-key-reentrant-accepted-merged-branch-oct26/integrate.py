import pathlib as P, subprocess as S, os, json, hashlib as H, shutil, time, resource
T=P.Path('/tmp/browser-key-reentrant-accepted-merged-branch-oct26'); R=T/'repo'; O=T/'ops'
L=P.Path('/home/user/wine-assembly/scratch/usage-watch/browser-key-reentrant-accepted-merged-branch-oct26')
D=P.Path('/tmp/browser-key-reentrant-focus-ownership-repair-oct26/repo'); A=P.Path('/tmp/browser-key-reentrant-retained-accept-oct26/repo')
B=P.Path('/tmp/renderer-side-polling-main-retained-closeout-oct26/repo')
BASE='c3d394149406189cf1c5dbbc434491f0130666c9'; C='be746ec811b98365c378609ca936502783bb106d'; ACCEPT='bafc96c72e2ffb811248968b99e03f74f903087e'
BRANCH='task/browser-key-reentrant-accepted-merged-branch-oct26'; DOC='docs/reviews/browser-key-reentrant-accepted-merged-branch-oct26'; ADOC='docs/reviews/browser-key-reentrant-retained-accept-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def h(b): return H.sha256(b).hexdigest()
def filehash(p):
 q=H.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):q.update(b)
 return q.hexdigest()
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(v,indent=2)+'\n')
def run(a,cwd=None,ok=(0,)):
 p=S.run(a,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=60)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072, 'capture gate'
 assert p.returncode in ok,(a,p.returncode,p.stderr[:2000].decode(errors='replace'))
 return p
def git(*a,repo=R):return run(['git','-C',str(repo),*a]).stdout
def wal():return {str(p):p.stat().st_size for p in P.Path('/home/user/.codex').glob('*-wal')}
def measure(stage,initial=False):
 if initial:write(O/'wal-initial.json',wal())
 w0=json.loads((O/'wal-initial.json').read_text()); w=wal(); delta=sum(max(0,n-w0.get(p,0)) for p,n in w.items())
 files=set(p for d in [T,L] for p in d.rglob('*') if p.is_file() and not p.is_symlink())
 first=json.loads((L/'events.jsonl').open().readline()); sid=first['thread_id']
 files.update(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 rows=[{'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512} for p in sorted(files)]
 used=sum(max(r['bytes'],r['allocated']) for r in rows)+delta
 mem=int(next(s.split()[1] for s in P.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024; free=shutil.disk_usage(T).free
 growth=58720256; future=12*1024**2; reserve=8*1024**2; materialize=8*1024**2 if initial else 2*1024**2
 v=dict(stage=stage,files=rows,walInitial=w0,walCurrent=w,positiveWalDeltaOnce=delta,measured=used,futureGrowthOnce=future,materializationAllowance=materialize,reserve=reserve,projected=used+future+materialize+reserve,allocation=67108864,memAvailable=mem,clientHeap=553648128,afterClientHeap=mem-553648128,freeDisk=free,diskAdmissionGrowth=growth,freeAfterGrowth=free-growth)
 v['pass']=v['projected']<=67108864 and v['afterClientHeap']>=805306368 and v['freeAfterGrowth']>=2982150144
 write(O/('resources-'+stage+'.json'),v);assert v['pass'],{k:x for k,x in v.items() if k!='files'}
 print(stage,'PASS projected',v['projected'],'RAM',mem,'disk',free)
def setup():
 measure('precheckout',True)
 ancestors=[]; pid=os.getpid()
 for _ in range(8):
  if pid<=0:break
  p=P.Path('/proc')/str(pid); cmd=(p/'cmdline').read_bytes().split(b'\0');
  if len(cmd)>1 and cmd[1]==b'exec' and b'codex' in cmd[0]:ancestors.append({'pid':pid,'argv':[x.decode() for x in cmd if x]})
  pid=int((p/'stat').read_text().rsplit(')',1)[1].split()[1])
 assert len(ancestors)==1
 argv=ancestors[0]['argv'];assert 'gpt-6.1-sol' in argv and 'model_auto_compact_token_limit=200000' in argv and 'model_auto_compact_token_limit_scope="total"' in argv and 'model_reasoning_effort="medium"' in argv
 write(O/'launch-verified.json',ancestors)
 write(O/'configuration.json',dict(ssh=SSH,mountArgv=[],intendedFiles=[],mountValidation='N/A offline task; no mounts or conditional guest execution',reusedConfiguration=str(B.parent/'ops/configuration.json'),nodeCommand='timeout 25s node --max-old-space-size=16 FIXTURE',nodeExecution='None unless changed dependency requires affected checks'))
 objects=set()
 def flat(p):
  p=p.resolve()
  if p in objects:return
  objects.add(p); alt=p/'info/alternates'
  if alt.exists():
   for s in alt.read_text().splitlines():flat(P.Path(s) if s.startswith('/') else p/s)
 donors=[B,D,A,P.Path('/tmp/vfs-bounds-delayed-main-closeout-oct26/repo'),P.Path('/home/user/wine-assembly')]
 for d in donors:
  if (d/'.git/objects').exists():flat(d/'.git/objects')
 write(O/'readonly-objects.json',{'flatAlternates':[str(p) for p in sorted(objects)],'standingLogicalBytes':sum(p.stat().st_size for d in objects for p in d.rglob('*') if p.is_file()),'copiedHistory':False})
 run(['git','init','-q',str(R)]);(R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 for key in ['user.name','user.email']:git('config',key,git('config','--get',key,repo=D).decode().strip())
 remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip();base=remote.split()[0]
 git('cat-file','-e',base+'^{commit}');git('merge-base','--is-ancestor',BASE,base)
 write(O/'remote-main-initial.json',{'remote':remote,'base':base,'immutableBaseline':BASE})
 git('config','core.sparseCheckout','true');(R/'.git/info/sparse-checkout').write_text('/lib/browser-input.js\n/lib/renderer-input.js\n/lib/mem-utils.js\n/lib/region-map.generated.js\n/test/browser-key-*.cjs\n/test/keyboard-focus-renderer*.cjs\n/'+DOC+'/\n/'+ADOC+'/\n/docs/reviews/browser-key-reentrant-focus-ownership-repair-oct26/\n')
 git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,base);git('read-tree','-m','-u',base)
 patch=git('diff','--binary',C+'^',C,'--','.',':(exclude)lib/browser-input.js',repo=D)
 # Main has not integrated the original focus ownership prerequisite. Graft the
 # complete accepted browser blob using an explicit base-to-candidate patch.
 patch+=git('diff','--binary',base,C,'--','lib/browser-input.js');(O/'accepted.patch').write_bytes(patch)
 git('apply','--cached','--check',str(O/'accepted.patch'));git('apply','--cached',str(O/'accepted.patch'))
 # Add the accepted independent fixtures and all original evidence exactly.
 ap=git('diff','--binary',ACCEPT+'^',ACCEPT,repo=A);(O/'acceptance.patch').write_bytes(ap)
 git('apply','--cached','--check',str(O/'acceptance.patch'));git('apply','--cached',str(O/'acceptance.patch'))
 tree=git('write-tree').decode().strip();git('read-tree','--reset','-u',tree)
 write(O/'tested-tree.json',dict(base=base,immutableBaseline=BASE,candidate=C,acceptance=ACCEPT,testedTree=tree,repairPatchSHA256=h(patch),acceptancePatchSHA256=h(ap)))
 print('MERGED',base,tree)
def validate():
 t=json.loads((O/'tested-tree.json').read_text()); tree=t['testedTree'];base=t['base']
 rows=[]
 for p in ['lib/browser-input.js','lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js']:
  source=C if p=='lib/browser-input.js' else BASE
  actual=git('show',tree+':'+p);expected=git('show',source+':'+p)
  assert actual==expected
  assert git('ls-tree',tree,'--',p).split(b'\t')[0]==git('ls-tree',source,'--',p).split(b'\t')[0]
  rows.append(dict(path=p,sha256=h(actual),blob=git('rev-parse',tree+':'+p).decode().strip(),equalRevision=source))
 assert rows[0]['sha256']=='5b2c47fa0b901f0323bc04df34ff27d8c50e47a001d77e9dcae3f2986a3477f0'
 manifest=json.loads(git('show',ACCEPT+':'+ADOC+'/evidence-manifest.json'));checked=[]
 for p,m in manifest.items():
  data=git('show',tree+':'+p);assert h(data)==m['sha256'] and len(data)==m['bytes'];assert data==git('show',ACCEPT+':'+p);checked.append(p)
 reuse=json.loads(git('show',ACCEPT+':'+ADOC+'/reuse-validation.json'));tools=[]
 for row in reuse['tools']:
  p=P.Path(shutil.which(row['name'])).resolve();assert str(p)==row['path'] and filehash(p)==row['sha256'];tools.append(row)
 # Check the full renderer receipt manifest against the exact accepted revision.
 rm=P.Path('/tmp/renderer-side-polling-merged-branch-oct26/repo/docs/reviews/renderer-side-polling-merged-branch-oct26/evidence-manifest.json')
 rv=json.loads(git('show',ACCEPT+':'+ADOC+'/retained-validation.json'))['rendererReceipt'];assert filehash(rm)==rv['manifestSHA256']
 rendererChecked=[]
 for p,m in json.loads(rm.read_text()).items():
  full=p if p.startswith(('test/','lib/','docs/')) else 'docs/reviews/renderer-side-polling-merged-branch-oct26/'+p
  data=git('show','0d2aaf964b31d4191a76cf84900d7433b4611fa4:'+full);assert h(data)==m['sha256'] and len(data)==m['bytes'];rendererChecked.append(full)
 original=git('show',ACCEPT+':'+ADOC+'/crosslayer-original.test.cjs');fixture=git('show',tree+':test/keyboard-focus-renderer-repaired-pin-oct26.test.cjs')
 assert original.count(b'2b5eaa0')==1 # provenance comment, distinct from hash pin
 old=b'2b5eaa0' # exact source hash is independently recovered from the assertion below
 import re
 oldpin=re.search(rb"assert.equal\(hash\(source\), '([0-9a-f]{64})'\)",original).group(1)
 assert original.replace(oldpin,rows[0]['sha256'].encode(),1)==fixture
 changed=git('diff','--name-only',base,tree).decode().splitlines()
 assert all(p=='lib/browser-input.js' or p.startswith('test/') or p.startswith('docs/reviews/browser-key-reentrant-') for p in changed)
 production=[p for p in changed if not p.startswith(('docs/','test/'))];assert production==['lib/browser-input.js']
 # Git recursive raw diff binds every changed mode/blob and therefore every unchanged entry.
 raw=git('diff','--raw','--no-abbrev',base,tree);(O/'review-raw.diff').write_bytes(raw)
 diff=git('diff',base,tree,'--','lib/browser-input.js');(O/'production.diff').write_bytes(diff)
 whitespace=run(['git','-C',str(R),'diff','--check',base,tree],ok=(0,2));(O/'diff-check.log').write_bytes(whitespace.stdout)
 if whitespace.returncode:
  lines=whitespace.stdout.decode().splitlines();assert all('renderer-aggregate-known-limitation.log:' in l or l.startswith('+') for l in lines)
 write(O/'identity-reuse.json',dict(sourceClosure=rows,acceptancePayloads=len(checked),acceptancePaths=checked,rendererPayloads=len(rendererChecked),tools=tools,groupsReused={'unchanged':7,'reentrant':7,'crosslayer':25,'rejectingControls':2,'renderer':'119 plus legacy'},rerunGroups=0,changedDependencies=[],fixturePinOnly=True,historicalAggregateFailures=3,environmentOverrides={k:os.environ.get(k) for k in ['NODE_OPTIONS','NODE_PATH','WINE_REGION_MAP','BROWSER_INPUT_SOURCE','RENDERER_INPUT_SOURCE']},remaining=['real browser focus/removal behavior','guest/runtime qualification','coordinator review and authorized main publication']))
 write(O/'preservation.json',dict(base=base,testedTree=tree,changedPaths=changed,productionPaths=production,rawDiffSHA256=h(raw),allUnrelatedBytesModesPreserved=True))
 measure('postvalidation');print('IDENTITY PASS',len(checked),'accepted payloads',len(rendererChecked),'renderer payloads; zero test reruns')
if __name__=='__main__':setup();validate()
