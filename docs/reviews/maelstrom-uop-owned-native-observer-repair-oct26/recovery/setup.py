import pathlib,json,subprocess,os,hashlib,zlib,shutil
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops';R=H/'repo';D=pathlib.Path('/tmp/maelstrom-terminal-closure-accepted-integrate-oct26/repo'); ROOT=pathlib.Path('/home/user/wine-assembly');REV='44e344fdb26daab9a07210656597902ba27cb5f7'
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def dg(*a):return subprocess.check_output(['git','-C',str(D),*a])
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
pins=json.load(open(ROOT/'scratch/usage-watch'/ (H.name+'-dispatch.json')))
for x in pins['pins']:
 b=dg('show',REV+':'+x['path']);assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
save('pins.json',pins['pins'])
# No guest argv in this source-only task. Validate unchanged exact standing mount receipt.
old=pathlib.Path('/tmp/maelstrom-accepted-diagnostic-original-capture-oct26/ops'); m=json.load(open(old/'mount-precheckout.json'));assert m['passChecks'] and any(',' in x['target'] for x in m['intended'])
save('configuration.json',dict(ssh=SSH,guestArgv=None,runtimeAuthorized=False,unchangedMountReceipt=str(old/'mount-precheckout.json'),mountReceiptSHA256=hashlib.sha256((old/'mount-precheckout.json').read_bytes()).hexdigest(),mountNotExecuted=True))
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(H).free
save('resource-initial.json',dict(memAvailable=mem,allowance=536870912,floor=805306368,free=free,projection=58720256,cap=67108864,passChecks=mem-536870912>=805306368 and free-58720256>=2982150144));assert mem-536870912>=805306368 and free-58720256>=2982150144
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
def git(*a):return subprocess.check_output(['git','-C',str(R),*a]).decode().strip()
leaves=[str(ROOT/'.git/objects')]+[x['path'] for x in json.load(open(old/'flat-leaf-recovery-plan.json'))['selectedLeaves']]
for p in leaves:assert not (pathlib.Path(p)/'info/alternates').exists()
(R/'.git/objects/info/alternates').write_text('\n'.join(leaves)+'\n')
selected=[];ids={REV:'commit'}
for l in dg('ls-tree','-rt',REV).decode().splitlines():
 meta,p=l.split('\t');mode,kind,oid=meta.split()
 if kind=='tree':ids[oid]=kind
 if kind=='blob' and (p.startswith('src/') or (p.startswith('test/maelstrom-') and p.endswith('.cjs')) or p in ['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-select-completion-hook.cjs']):selected.append(p);ids[oid]=kind
ids[dg('rev-parse',REV+'^{tree}').decode().strip()]='tree'
for oid in dg('rev-list',REV,'--not',subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD']).decode().strip()).decode().splitlines():ids[oid]='commit'
copied=[]
for oid,kind in ids.items():
 if subprocess.run(['git','-C',str(R),'cat-file','-e',oid],stderr=subprocess.DEVNULL).returncode==0:continue
 b=dg('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw));copied.append([oid,kind,p.stat().st_size])
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,REV);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for k in ['user.name','user.email']:git('config',k,dg('config',k).decode().strip())
save('checkout.json',dict(base=REV,selected=selected,flatAlternates=leaves,copied=copied));save('incidents.json',[dict(incident='Discovery command overbroad JSON search/read exceeded capture target',effect='Tool truncated output; no runtime or source mutation',correction='Bound individual reads and omit inventory payloads')]);print(json.dumps(dict(selected=len(selected),copied=len(copied))))
