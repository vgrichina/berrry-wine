import pathlib,subprocess,json,os,shutil,hashlib,re
H=pathlib.Path(__file__).parent;P=pathlib.Path('/tmp/maelstrom-poststart-phase-capture-oct24');D=pathlib.Path('/tmp/maelstrom-sdl-event-drain-cause-oct24/repo');C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
assert subprocess.check_output(['git','-C',str(D),'rev-parse','HEAD'],text=True).strip()=='48bf87b2a159a0a332ca5040483a1cb237d05c87'
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
r=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/task/maelstrom-sdl-event-drain-cause-oct24','refs/heads/main'],env=env,capture_output=True,text=True,timeout=30);assert r.returncode==0,r.stderr;assert '48bf87b2a159a0a332ca5040483a1cb237d05c87' in r.stdout
(H/'donor-verification.json').write_text(json.dumps(dict(donor=str(D),head='48bf87b2a159a0a332ca5040483a1cb237d05c87',remote=r.stdout,ssh=ssh),indent=2))
s=(P/'work.py').read_text().replace('bx_wc4mkcn9','bx_ktknkc9m');(H/'work.py').write_text(s)
from work import remote,save
j=remote("python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,meminfo=pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].splitlines()[0],python=os.path.realpath(\"/usr/bin/python3\"))))'")
save('remote-admission.json',j);rr=json.loads(j['stdout']);assert rr['uid']==1000
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-select-return-capture-oct24')
size=lambda p:sum(f.stat().st_blocks*512 for f in p.rglob('*') if f.is_file()) if p.exists() else 0
sql={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
m=json.load(open(P/'manifest.json'));charges=dict(remoteClosure=sum(x['bytes'] for x in m),remoteHelpersEvidence=1000000,checkoutGit=3500000,localHelpersEvidence=2500000,transferOverlap=1000000,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,externalFuture=16000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
j=dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=rr['free'],remoteAfter=rr['free']-peak,session=str(session),launcher=str(launcher),sourceMemAvailable=mem,perFileMax=max(x['bytes'] for x in m),standingManifest=str(P/'manifest.json'),standingTools=[])
for name in ['git','python3','node']:
 p=pathlib.Path(shutil.which(name)).resolve();j['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
j['passAdmission']=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and int(rr['meminfo'].split()[0])*1024>=2684354560
save('admission.json',j);assert j['passAdmission'],j
save('manifest.json',m)
a=[s.replace(str(P),str(H)) for s in json.load(open(P/'guest-args.json'))]
a=[s for s in a if not s.startswith(('--count=','--input=','--trace-at','--trace-input-dispatch'))]
old=next(s.split('=',1)[1] for s in json.load(open(P/'guest-args.json')) if s.startswith('--input='))
schedule=','.join(s.replace(str(P),str(H)) for s in old.split(',') if s.split(':')[1] in ['keydown','keyup','png'])
a+=['--count=0x40287d,0x7a3362,0x40e000,0x4019a0,0x406378,0x075040f8','--input='+schedule,'--trace-from=30000','--trace-at=0x406378','--trace-at-start-batch=30000','--trace-at-limit=1','--trace-at-mem=esp:24,*esp+20:8,*esp+8:20']
save('guest-args.json',a)
# Canonical first-match parser applied before checkout, with the exact filename-bearing argv.
src=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const vm=require("vm"),fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(4);'+parser+';assert.equal(getArgs("vfs-tree").length,1);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("cwd"),"C:\\\\maelstrom");console.log(JSON.stringify({tree:getArgs("vfs-tree"),cwd:getArg("cwd"),count:getArg("count")}));'
r=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json')],capture_output=True,text=True,timeout=60);save('precheckout-parser.json',dict(returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,r.stderr
# Full intended original mapping, preserving comma filename.
rows=[x for x in m if x['target'].startswith('vfs/')];assert len(rows)==48 and sum(x['bytes'] for x in rows)==2794170
assert any(',' in x['target'] for x in rows);save('intended-originals.json',rows)
R=H/'repo';R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
obj=subprocess.check_output(['git','-C',str(D),'rev-parse','--git-path','objects'],text=True).strip();obj=str((D/obj).resolve()) if not obj.startswith('/') else obj
alts=[obj];ap=pathlib.Path(obj)/'info/alternates'
if ap.exists():alts+=ap.read_text().splitlines()
(R/'.git/objects/info/alternates').write_text('\n'.join(dict.fromkeys(alts))+'\n')
subprocess.run(['git','-C',str(R),'config','core.sparseCheckout','true'],check=True);subprocess.run(['git','-C',str(R),'config','core.sparseCheckoutCone','false'],check=True)
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/docs/re-notes/maelstrom-select-return-capture-20261024*\n/tools/maelstrom-select-observer*\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/maelstrom-select-return-capture-oct24','48bf87b2a159a0a332ca5040483a1cb237d05c87'],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
print(json.dumps(j))
