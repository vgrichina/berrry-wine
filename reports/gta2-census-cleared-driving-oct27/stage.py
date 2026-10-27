receipt=json.loads((O/'source-readiness.json').read_text());rs=receipt['sourceFiles']
games=json.loads((ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json').read_text())['files']
allrows=[dict(r,kind='source',target=r['path']) for r in rs]+[dict(r,kind='game',target=str(pathlib.Path(r['path']).relative_to(ROOT))) for r in games]
first=int(sys.argv[-2]);last=int(sys.argv[-1]);end=min(last,(len(allrows)+39)//40)
for group in range(first,end):
 batch=allrows[group*40:(group+1)*40];buf=io.BytesIO();pins=[]
 source=[r for r in batch if r['kind']=='source']
 payload={}
 if source:
  def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX)
   with (O/('cat-'+str(group)+'.stderr')).open('xb') as err:
    p=subprocess.Popen(['git','-C',str(H/'repo'),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
    for r in source:
     p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();header=p.stdout.readline().decode().split();assert header==[r['oid'],'blob',str(r['bytes'])],header
     b=p.stdout.read(r['bytes']);assert p.stdout.read(1)==b'\n';assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['oid'];payload[r['target']]=b
    p.stdin.close();assert p.wait(timeout=10)==0
 with tarfile.open(fileobj=buf,mode='w') as tar:
  for r in batch:
   b=payload[r['target']] if r['kind']=='source' else pathlib.Path(r['path']).read_bytes()
   assert len(b)==r['bytes'];digest=sha(b)
   if r['kind']=='game':assert digest==r['sha256']
   pins.append(dict(target=r['target'],bytes=len(b),sha256=digest,oid=r.get('oid'),kind=r['kind']))
   item=tarfile.TarInfo(r['target']);item.size=len(b);tar.addfile(item,io.BytesIO(b))
 remote=str(O/('pack-'+str(group)+'.tar'));put(remote,buf.getvalue(),'pack-'+str(group))
 py('import pathlib,tarfile;p=pathlib.Path('+repr(remote)+');t=tarfile.open(p);assert all(not x.name.startswith("/") and ".." not in pathlib.Path(x.name).parts for x in t);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();print("extracted")')
 save('pins/group-'+str(group)+'.json',pins)
 print('staged',group,len(batch),sum(r['bytes'] for r in pins),flush=True)
save('stage-range-'+str(first)+'-'+str(last)+'.json',dict(first=first,last=end,at=time.time(),fileCount=len(allrows)))
