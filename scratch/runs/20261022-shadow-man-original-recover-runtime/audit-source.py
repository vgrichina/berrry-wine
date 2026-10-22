"""Assigned-Boat native media audit; outputs inventories, never edits payload."""
import hashlib,json,pathlib,re,subprocess
R=pathlib.Path('/home/user/shadow-man-original-oct22');O=R/'native-audit'
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def save(n,x):(O/n).write_text(json.dumps(x,indent=2)+'\n')
def manifest(root):return [dict(path=p.relative_to(root).as_posix(),size=p.stat().st_size,sha256=digest(p)) for p in sorted(root.rglob('*')) if p.is_file()]
files=manifest(R/'native');listing=(O/'list.txt').read_text()
rows=[]
for line in listing.splitlines():
    m=re.match(r'^\s+(\d+)\s+(.+)$',line)
    if m and '\\' in m[2]:rows.append((int(m[1]),m[2]))
assert len(files)==len(rows)==1959
assert sum(x['size'] for x in files)==sum(x[0] for x in rows)==100354053
expected={name.replace('Program Executable Files','Program_Executable_Files').replace('\\','/'):size for size,name in rows}
assert {x['path']:x['size'] for x in files}==expected
save('native-manifest.json',dict(files=files,fileCount=len(files),totalBytes=sum(x['size'] for x in files),listingExact=True,historicalComparison='same file count and byte total'))
save('support-manifest.json',manifest(R/'support'))
api={x['name'] for x in json.loads((R/'runtime/src/api_table.json').read_text())}
pe=[];other=[];dumps=O/'imports';dumps.mkdir()
for base in ['recovery/source','native','support']:
    for p in sorted((R/base).rglob('*')):
        if not p.is_file():continue
        with p.open('rb') as f:head=f.read(2)
        if head!=b'MZ':continue
        rel=p.relative_to(R).as_posix();s=subprocess.run(['objdump','-p',str(p)],capture_output=True,text=True)
        out=rel.replace('/','__')+'.txt';(dumps/out).write_text(s.stdout+s.stderr)
        entry=dict(path=rel,size=p.stat().st_size,sha256=digest(p),objdumpExit=s.returncode,raw='imports/'+out)
        if s.returncode:other.append(entry);continue
        imports=[];dll=None
        for line in s.stdout.split('PE File Base Relocations')[0].splitlines():
            if 'DLL Name:' in line:dll=line.split('DLL Name:')[1].strip().lower()
            elif dll:
                m=re.match(r'^\s+[0-9a-f]+\s+(\d+)\s+(\S+)\s*$',line)
                if m:imports.append(dict(dll=dll,name=m[2],apiTable=m[2] in api))
        exports=set(re.findall(r'^\s*\[\s*\d+\]\s+(\S+)',s.stdout,re.M))
        pe.append(dict(**entry,imports=imports,exports=sorted(exports)))
nativeExports={pathlib.Path(x['path']).name.lower():set(x['exports']) for x in pe}
unknown=[]
for x in pe:
    for row in x['imports']:
        row['originalNativeExport']=row['name'] in nativeExports.get(row['dll'],set())
        if not row['apiTable'] and not row['originalNativeExport']:unknown.append(dict(owner=x['path'],**row))
save('import-audit.json',dict(pe=pe,nonPeMZ=other,unknown=unknown,note='Static inventory only; API-table match does not prove implementation and unknown imports do not prove invocation. NE modules preserved. No patches.'))
save('source-summary.json',dict(isoBytes=(R/'recovery/GS1199.iso').stat().st_size,isoSha1='f985ca1349af958f886957aa662e87956a7db22d',isoSha256=digest(R/'recovery/GS1199.iso'),sourceFiles=len(manifest(R/'recovery/source/Demos/Shadowman')),nativeFiles=len(files),nativeBytes=sum(x['size'] for x in files),PEs=len(pe),nonPeMZ=len(other),unknownImports=len(unknown)))
print((O/'source-summary.json').read_text())
