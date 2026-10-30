import control as c,pathlib,json,hashlib,tarfile,re,os
O=c.O;P=pathlib.Path('/tmp/tuxracer-vertex-color-isolated-capture-runtime-oct30')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
c.admission()
receipt=json.loads((P/'reused-mount-receipt.json').read_text());mp=pathlib.Path(receipt['path']);assert sha(mp)==receipt['sha256']
mount=json.loads(mp.read_text());assert len(mount['files'])==157 and mount['argv']==['--app=tuxracer_original_061a']
c.save('same-task-mount-validation.json',dict(PASS=True,receipt=receipt,files=mount['files'],commaFiles=mount['commaFiles'],configurationUnchanged=True,parser='validateLocalManifestSync'))
base='52de1079f2ce7f89e082b033e80d01231fc53d5f'
assert c.git('trusted-origin','remote','get-url','origin').decode().strip()=='git@github.com:vgrichina/wine-assembly.git'
assert c.git('published-main','ls-remote','--exit-code','origin','refs/heads/main').split()[0].decode()==base
c.save('original-index.json',{'sha256':sha(c.REPO/'.git/index') if (c.REPO/'.git').is_dir() else None})
assert c.git('head','rev-parse','HEAD').decode().strip()==base
c.git('task-branch','switch','-c','test/tuxracer-main-menu-race-progression-oct30',base)
manifest=json.loads((P/'source-manifest.json').read_text());rows=manifest['inputs'];assert len(rows)==141
pre=json.loads((P/'preflight.json').read_text());data={}
archives=[pathlib.Path('/tmp/tuxracer-software-render-msvcrt-retest-oct30/packet.tar.gz'),c.OLD/'candidate.tar.gz',pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30/candidate-delta.tar.gz')]
expected=[pre['archive']['sha256'],pre['candidateArchiveSHA'],pre['deltaSHA']]
modules=[]
for root in c.ROOTS:
 if root.exists():modules.extend(str(p) for p in root.rglob('*.wasm'))
assert not modules
for p,h in zip(archives,expected):
 assert sha(p)==h
 with tarfile.open(p) as t:
  for m in t.getmembers():
   if m.name in rows:data[m.name]=t.extractfile(m).read()
for n,x in rows.items():
 b=data[n];assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],n
oids=c.git('pinned-input-identities','ls-tree',base,'--',*rows).decode().splitlines();assert len(oids)==141
for line in oids:
 meta,n=line.split('\t');b=data[n];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==meta.split()[2],n
seen=set()
def walk(n):
 if n in seen:return
 seen.add(n)
 for k in re.findall(r'\(include\s+"([^"]+)"\)',data[n].decode()):walk(str(pathlib.PurePosixPath(n).parent/k))
walk('src/main.watx');assert len(seen)==128
for name in ['preflight.json','source-manifest.json','host-abi-reuse.json']:(O/name).write_bytes((P/name).read_bytes())
c.save('closure.json',dict(PASS=True,base=base,accepted=manifest['candidate'],sourceCount=141,includeCount=128,moduleAbsent=True,compileNecessary=True,archives=[dict(path=str(p),sha256=h,bytes=p.stat().st_size) for p,h in zip(archives,expected)],mount=receipt,retainedAPITransferSmoke={'path':str(P/'standing-transfer-receipt.json'),'sha256':sha(P/'standing-transfer-receipt.json')},captureSmoke={'path':str(P/'capture-manifest.json'),'sha256':sha(P/'capture-manifest.json')}))
c.save('source-status-before.json',{'status':c.git('owned-source-status','status','--porcelain=v1','--',*rows).decode()})
assert not json.loads((O/'source-status-before.json').read_text())['status']
c.run('legitimate-file-control',['/usr/bin/python3','-B','-c',"import pathlib; p=pathlib.Path('disposable-file');p.write_bytes(b'x'*655360);assert p.stat().st_size==655360;p.unlink();print('PASS file655360 > capture524288')"],cwd=O)
c.run('capture-overflow-control',['/usr/bin/python3','-B','-c',"import os,time;os.write(1,b'x'*530000);time.sleep(.2)"],cwd=O,expect_capture=True)
c.save('limit-controls.json',dict(PASS=True,fileBytes=655360,fileLimit=12582912,captureLimit=524288,captureOverflowRejected=True,supervisorRSS=134217728,groupRSS=536870912,pythonDATA=134217728,gitChildDATA=268435456,CPU=90,wall=120,RAMAdmission=False,diskFloor=1610612736))
print('PINNED CLOSURE / MOUNT / LIMITS PASS; compile necessary')
