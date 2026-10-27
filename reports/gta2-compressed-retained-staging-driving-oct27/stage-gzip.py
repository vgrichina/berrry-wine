plan=json.loads((O/'compressed-transfer-plan.json').read_text());assert plan['timePass'] and plan['remotePass'];first=int(sys.argv[-2]);last=int(sys.argv[-1]);groups=plan['groups'][first:last]
# Small bounded groups, each archive <=40 files; no local archive materialization.
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/('gzip-git-'+str(first)+'.stderr')).open('xb') as err:
  p=subprocess.Popen(['git','-C',str(H/'repo'),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
  for index,g in enumerate(groups,first):
   assert not (O/('pins/group-'+str(index)+'.json')).exists();buf=io.BytesIO()
   with tarfile.open(fileobj=buf,mode='w:gz',compresslevel=6) as t:
    for r in g['pins']:
     if r['kind']=='source':
      p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();assert p.stdout.readline().decode().split()==[r['oid'],'blob',str(r['bytes'])];b=p.stdout.read(r['bytes']);assert p.stdout.read(1)==b'\n'
     else:b=(ROOT/r['target']).read_bytes()
     assert len(b)==r['bytes'] and sha(b)==r['sha256'];info=tarfile.TarInfo(r['target']);info.size=len(b);t.addfile(info,io.BytesIO(b))
   z=buf.getvalue();assert len(z)==g['gzipBytes'];enc=base64.b64encode(z).decode();rp=str(O/('gzip-'+str(index)+'.b64'))
   for n in range(0,len(enc),30000):
    part=enc[n:n+30000];final=n+30000>=len(enc);code='import pathlib,base64,hashlib,tarfile,io;p=pathlib.Path('+repr(rp)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('x' if n==0 else 'a')+');f.write('+repr(part)+');f.close();'
    if final:
     code+='z=base64.b64decode(p.read_bytes());assert len(z)=='+str(len(z))+' and hashlib.sha256(z).hexdigest()=='+repr(sha(z))+';t=tarfile.open(fileobj=io.BytesIO(z),mode="r:gz");assert all(x.isfile() and not x.name.startswith("/") and ".." not in pathlib.Path(x.name).parts for x in t);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();'
    code+='print("ok")';command='python3 -c '+shlex.quote(code);assert len(command.encode())<=36000;api(command)
   # Verify hashes after extraction in a separate bounded receipt.
   code='import pathlib,hashlib;rows='+repr(g['pins'])+';root=pathlib.Path('+repr(str(H/'repo'))+');\nfor r in rows:\n b=(root/r["target"]).read_bytes();assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"]\nprint("verified",len(rows))';py(code)
   save('pins/group-'+str(index)+'.json',g);print('gzip verified',index,g['count'],g['gzipBytes'],flush=True)
  p.stdin.close();assert p.wait(timeout=10)==0
save('stage-range-'+str(first)+'-'+str(last)+'.json',dict(first=first,last=last,at=time.time()))
