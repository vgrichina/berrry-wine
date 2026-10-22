"""Read-only retained input, runner closure, ABI and conflict admission. No guest."""
import datetime,hashlib,json,os,pathlib,socket,subprocess
R=pathlib.Path('/home/user/shadow-man-original-oct22')
O=pathlib.Path('/home/user/shadow-man-error112-targeted-capture-oct22')
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def seals():
    pins=json.loads((R/'runtime-expected.json').read_text());rows=[]
    for group in ['runtime','runner']:
        for x in pins[group]:
            p=R/'runtime'/x['path'] if group=='runtime' else R/x['path']
            assert p.stat().st_size==x['size'] and sha(p)==x['sha256'],str(p)
            rows.append(dict(path=str(p),size=x['size'],sha256=x['sha256']))
    members=json.loads((R/'recovery/extracted-members.json').read_text())['extractedMembers']
    assert len(members)==23 and sum(x['bytes'] for x in members)==73339636
    for x in members:
        p=R/'recovery/source/Demos/Shadowman'/x['name'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],str(p)
        rows.append(dict(path=str(p),size=x['bytes'],sha256=x['sha256']))
    # Preserve prior evidence, scripts, registry and receipts as well as run inputs.
    for base in ['setup-run','receipt']:
        for p in sorted((R/base).rglob('*')):
            if p.is_file():rows.append(dict(path=str(p),size=p.stat().st_size,sha256=sha(p)))
    return rows
def conflicts():
    procs=[]
    for p in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
        try:
            raw=p.read_bytes().split(b'\0');exe=pathlib.Path(raw[0].decode()).name;args=[x.decode(errors='replace') for x in raw]
            if exe in ['node','nodejs','chrome','chromium','firefox'] and any('shadow-man' in x or 'test/run.js' in x for x in args):procs.append(dict(pid=int(p.parent.name),args=args))
        except (OSError,IndexError):pass
    ports={}
    for port in [8123,8124]:
        with socket.socket() as s:ports[str(port)]=s.connect_ex(('127.0.0.1',port))!=0
    assert not procs and all(ports.values()),(procs,ports)
    return dict(guestProcesses=procs,portsClosed=ports)
if __name__=='__main__':
    assert not (O/'preflight.json').exists()
    rows=seals();c=conflicts();free=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize
    assert free>=4*1024**3+128*1024**2
    env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
    code="""const fs=require('fs');const {createRequire}=require('module');const r=createRequire(process.cwd()+'/test/run.js');const m=new WebAssembly.Module(fs.readFileSync('build/wine-assembly.wasm'));const ex=WebAssembly.Module.exports(m).map(x=>x.name);for(const n of ['get_eax','get_eip','get_esp','get_ebp','get_image_base','set_trace_eip_range'])if(!ex.includes(n))throw Error(n);const a=r('../src/api_table.json');for(let i=0;i<a.length;i++)if(a[i].id!==i)throw Error('API index');for(const f of ['pngjs','../lib/mem-utils','../lib/host-imports','../lib/filesystem','../lib/renderer'])r(f);console.log(JSON.stringify({node:process.version,imports:WebAssembly.Module.imports(m),exports:ex,apiEntries:a.length,pngjs:r.resolve('pngjs')}));"""
    p=subprocess.run(['node','-e',code],cwd=R/'runtime',env=env,capture_output=True,text=True)
    (O/'abi-check.json').write_text(json.dumps(dict(exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr),indent=2)+'\n');assert p.returncode==0,p.stderr
    (O/'preflight.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),passAll=True,seals=rows,freeBytes=free,projectedNewBytes=16*1024**2,captureCap=8*1024**2,remoteCap=128*1024**2,**c),indent=2)+'\n')
    print(json.dumps(dict(passAll=True,sealedFiles=len(rows),freeBytes=free,**c)))
