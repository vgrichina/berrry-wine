import base64, hashlib, json, os, pathlib, subprocess, tarfile, time
E = pathlib.Path(__file__).resolve().parent
W = E.parents[2]
ROOT = pathlib.Path('/home/user/wine-assembly')
DONOR = pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22')
BOX = 'bx_2gnkcnac'
REMOTE = '/home/user/deus-ex-training'
receipts = []
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1048576), b''): h.update(b)
    return h.hexdigest()
def run(code):
    r=subprocess.run(['boat','exec',BOX,'--','python3','-c',code],capture_output=True,text=True)
    v=json.loads(r.stdout)
    receipts.append(v)
    (E/'transport.json').write_text(json.dumps(receipts,indent=2))
    assert r.returncode==0 and v.get('exitCode')==0,v
    return v
assert os.statvfs(E).f_bavail*os.statvfs(E).f_frsize>=2982150144
app=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./lib/apps').APPS.deus_ex_demo))"],cwd=W))
paths=sorted(set([app['exe']]+app['dlls']+[x if isinstance(x,str) else x['url'] for x in app['files']]))
assets=[]
for p in paths:
    f=ROOT/p
    assert f.is_file(),p
    assets.append(dict(path=p,size=f.stat().st_size,sha256=sha(f)))
for item in app['files']:
    if isinstance(item,dict) and 'size' in item: assert (ROOT/item['url']).stat().st_size==item['size'],item
pins={'system/deusex.exe':'2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f','system/core.dll':'2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167','maps/entry.dx':'3cf7df2a0538e4e177f19c184849a5869499af8c9a3bfb6386483ab22d57a931'}
for p,h in pins.items(): assert sha(ROOT/'test/binaries/candidates/deus-ex-demo/installed'/p)==h,p
assert (ROOT/app['exe']).stat().st_size==253952
ini=(ROOT/'test/binaries/candidates/deus-ex-demo/installed/system/deusex.ini').read_text()
for s in ['FirstRun=1002','GameRenderDevice=SoftDrv.SoftwareRenderDevice','RenderDevice=SoftDrv.SoftwareRenderDevice','StartupFullscreen=False','UseSound=True']: assert s in ini,s
(E/'assets.json').write_text(json.dumps(dict(app=app,files=assets,pins=pins,totalBytes=sum(x['size'] for x in assets)),indent=2))
archive=DONOR/'scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz'
assert sha(archive)=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
with tarfile.open(archive) as t: module=t.extractfile('build/wine-assembly.wasm').read()
assert hashlib.sha256(module).hexdigest()=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
(E/'module.json').write_text(json.dumps(dict(archive=str(archive),archiveSha256=sha(archive),moduleSha256=hashlib.sha256(module).hexdigest(),moduleBytes=len(module)),indent=2))
run("import pathlib,shutil; assert shutil.disk_usage('/home/user').free>2147483648; pathlib.Path(%r).mkdir(parents=True,exist_ok=True)"%REMOTE)
def transfer(stream,name):
    h=hashlib.sha256();size=0
    while True:
        b=stream.read(60000)
        if not b: break
        h.update(b)
        run("import base64;open(%r,%r).write(base64.b64decode(%r))"%(REMOTE+'/'+name,'wb' if size==0 else 'ab',base64.b64encode(b).decode()))
        size+=len(b)
    run("import hashlib; p=%r; h=hashlib.sha256(open(p,'rb').read()).hexdigest(); assert h==%r; print(p,h)"%(REMOTE+'/'+name,h.hexdigest()))
    print(name,size,h.hexdigest(),flush=True)
    return dict(name=name,bytes=size,sha256=h.hexdigest())
import io
transfers=[transfer(io.BytesIO(module),'wine-assembly.wasm')]
source=json.loads((E/'source-manifest.json').read_text())
for paths,cwd,name in [([x['path'] for x in source],W,'runner.tar.gz'),([x['path'] for x in assets]+['test/binaries/tlbs/stdole2.tlb'],ROOT,'assets.tar.gz')]:
    proc=subprocess.Popen(['tar','czf','-','-C',str(cwd),*paths],stdout=subprocess.PIPE)
    transfers.append(transfer(proc.stdout,name))
    assert proc.wait()==0
    run("import tarfile;tarfile.open(%r).extractall(%r,filter='data')"%(REMOTE+'/'+name,REMOTE))
(E/'transfers.json').write_text(json.dumps(transfers,indent=2))
run("import pathlib;pathlib.Path(%r).mkdir(exist_ok=True)"%(REMOTE+'/evidence'))
print('STAGED',len(assets),'assets',flush=True)
