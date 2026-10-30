"""Streaming full-index object gate, invoked by task ops.py, never history fsck."""
import pathlib,subprocess,selectors,os,time,signal,json,hashlib,tempfile
def check(ops):
 assert ops.BASE is not None
 repo=ops.REPO.resolve(strict=True);assert repo.is_relative_to(ops.ROOT) and repo==ops.REPO
 env=dict(os.environ,GIT_SSH_COMMAND=ops.SSH,PYTHONDONTWRITEBYTECODE='1')
 for label,args,expected in [('root',['rev-parse','--show-toplevel'],str(repo)),('gitdir',['rev-parse','--absolute-git-dir'],str(repo/'.git'))]:
  rc,out=ops.run('index-identity-'+label,['git','-C',str(repo)]+args,cwd=repo,git=True)
  assert rc==0 and out.strip()==expected
 records=[]
 def stream(label,args,onrecord,sep=b'\n',input_file=None):
  admission=ops.admission();argv=['git','-C',str(repo)]+args;start=time.monotonic();count=0;peak=0;buf=b'';digest=hashlib.sha256()
  err=ops.E/(label+'.stderr')
  with err.open('wb') as e:
   p=subprocess.Popen(argv,cwd=repo,env=env,preexec_fn=lambda:ops.child_limits(True),stdin=input_file,stdout=subprocess.PIPE,stderr=e,start_new_session=True)
   sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
   while sel.get_map():
    r=ops.rows();ids={p.pid}
    while True:
     new=ids|{pid for pid,v in r.items() if v[0] in ids}
     if new==ids:break
     ids=new
    rss=sum(r.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
    reason=None
    if rss>512*1048576:reason='groupRSS'
    if r.get(os.getpid(),(0,0))[1]>128*1048576:reason='parentRSS'
    if time.monotonic()-start>90:reason='wall'
    if err.stat().st_size>512*1024:reason='capture'
    if reason:os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError(reason)
    for key,_ in sel.select(.03):
     chunk=os.read(key.fd,65536)
     if not chunk:sel.unregister(key.fileobj);continue
     count+=len(chunk);digest.update(chunk);buf+=chunk
     while sep in buf:
      row,buf=buf.split(sep,1);onrecord(row)
   assert not buf,'unterminated Git record';rc=p.wait(timeout=5)
  rec=dict(argv=argv,cwd=str(repo),exit=rc,elapsed=time.monotonic()-start,peakRSS=peak,stdoutBytes=count,streamSHA256=digest.hexdigest(),stderrBytes=err.stat().st_size,admission=admission)
  records.append(rec);assert rc==0 and not err.read_bytes(),rec
 objects={};entries=0
 def index(row):
  nonlocal entries
  meta,_=row.split(b'\t',1);mode,oid,stage=meta.split();assert stage==b'0','unmerged index'
  expected='commit' if mode==b'160000' else 'blob';assert oid not in objects or objects[oid]==expected
  objects[oid]=expected;entries+=1
 stream('index-object-list',['ls-files','--stage','-z'],index,sep=b'\0')
 missing=[];checked=0
 def result(row):
  nonlocal checked
  a=row.split();oid=a[0];expected=objects[oid];checked+=1
  if len(a)!=3 or a[1].decode()!=expected:missing.append(row.decode())
 with tempfile.TemporaryFile(dir=ops.ROOT) as inp:
  for oid in sorted(objects):inp.write(oid+b'\n')
  inp.seek(0);stream('index-object-check',['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],result,input_file=inp)
 assert checked==len(objects)
 report=dict(PASS=not missing,indexEntries=entries,uniqueObjects=checked,missing=missing,scope='entire inherited index; no ancestor/history fsck',records=records)
 dest=repo/'test/enigma-integrated-trace-complete-module-build-oct30/index-closure-report.json';dest.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='records'}));assert not missing,missing
