from common import *
if sys.argv[1]=='initial':
 code='import pathlib,json,os,resource,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,node=shutil.which("node"),limits={n:resource.getrlimit(getattr(resource,"RLIMIT_"+n)) for n in ("DATA","AS","RSS","CPU","FSIZE")})))'
 j,raw=py(code);q=json.loads(j['stdout']);assert q['free']-256*M>=2982150144 and q['memAvailable']>=2560*M;save('remote-admission.json',dict(**q,allocation=256*M,closure=15760340,temp=32*M,captures=16*M,logs=2*M,reserve=8*M,passAdmission=True))
 print(json.dumps(q))
else:
 send((H/'manifest.json').read_bytes(),'manifest.json')
 code='import pathlib,json,hashlib;h=pathlib.Path('+repr(REMOTE)+');m=json.loads((h/"manifest.json").read_text());bad=[x["target"] for x in m if (h/x["target"]).stat().st_size!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];assert not bad,bad;print(json.dumps(dict(files=len(m),bytes=sum(x["bytes"] for x in m),passHash=True)))'
 j,raw=py(code);save('remote-rehash.json',j);print(j['stdout'])
