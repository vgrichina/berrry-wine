"""Run on assigned Boat after original MSI extraction; inventory, never patch media."""
import hashlib,json,pathlib,re,subprocess
R=pathlib.Path('/home/user/aoe3-original-oct22')
I=R/'installed'; G=I/'Age of Empires III'; O=R/'installed-audit';O.mkdir(exist_ok=True)
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
assert digest(R/'acquisition/Age-of-empire-3trial-Win98-SW.exe')=='4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad'
assert digest(G/'age3.exe')=='5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256'
files=[dict(path=p.relative_to(I).as_posix(),size=p.stat().st_size,sha256=digest(p)) for p in sorted(I.rglob('*')) if p.is_file()]
save('installed-manifest.json',dict(files=files,fileCount=len(files),totalBytes=sum(x['size'] for x in files)))
seeds=[R/'runtime/test/binaries/dlls/msvcrt.dll',R/'runtime/test/binaries/explorer98/dlls/shlwapi.dll']+[G/n for n in ['rockalldll.dll','granny2.dll','deformerdll.dll','binkw32.dll']]+[I/'System:System'/n for n in ['msxml4r.dll','msxml4.dll']]
save('launch-dlls.json',[dict(path=str(p),size=p.stat().st_size,sha256=digest(p)) for p in seeds])
api={x['name'] for x in json.loads((R/'runtime/src/api_table.json').read_text())}
imports={};exports={};dump=O/'imports';dump.mkdir(exist_ok=True)
for p in [G/'age3.exe']+seeds:
 s=subprocess.check_output(['objdump','-p',str(p)],text=True);(dump/(p.name+'.txt')).write_text(s)
 exports[p.name.lower()]=set(re.findall(r'^\s*\[\s*\d+\]\s+(\S+)',s,re.M))
 rows=[];dll=None
 for line in s.split('PE File Base Relocations')[0].splitlines():
  if 'DLL Name:' in line:dll=line.split('DLL Name:')[1].strip().lower()
  elif dll:
   m=re.match(r'^\s+[0-9a-f]+\s+(\d+)\s+(\S+)\s*$',line)
   if m:rows.append(dict(dll=dll,name=m[2]))
 imports[p.name.lower()]=rows
unknown=[]
for owner,rows in imports.items():
 for row in rows:
  native=row['dll'] in exports
  row['resolution']='original native export' if native and row['name'] in exports[row['dll']] else 'accepted API table' if row['name'] in api else 'unresolved inventory; invocation untested'
  if row['resolution'].startswith('unresolved'):unknown.append(dict(owner=owner,**row))
save('import-audit.json',dict(imports=imports,unknown=unknown,note='Inventory does not imply invocation or runtime failure. Original DLLs preserved; no stubs/patches.'))
node="const fs=require('fs'),s=require('./lib/storage');s.setRegValue('HKCR\\\\CLSID\\\\{7c6e29bc-8b8b-4c3d-859e-af6cd158be0f}\\\\InprocServer32','',1,'c:\\\\msxml4.dll');fs.writeFileSync('../installed-audit/launch-registry.json',JSON.stringify(s.exportStore(),null,2)+'\\n')"
subprocess.run(['node','-e',node],cwd=R/'runtime',check=True)
command=['node','test/run.js','--exe='+str(G/'age3.exe'),'--no-build','--wasm='+str(R/'runtime/build/wine-assembly.wasm'),'--winver=winxp','--dlls='+','.join(map(str,seeds)),'--vfs-include=**/*','--reg-import='+str(O/'launch-registry.json'),'--reg-export='+str(R/'game-run/final-registry.json'),'--save-vfs='+str(R/'game-run/vfs'),'--control=8123','--max-batches=1000000000','--max-seconds=600','--stuck-after=0','--no-close','--quiet-api','--quiet-blocks','--png='+str(R/'game-run/final.png')]
save('launch-command.json',command)
print(json.dumps(dict(files=len(files),bytes=sum(x['size'] for x in files),unknownImports=len(unknown),age3Sha256=digest(G/'age3.exe'))))
