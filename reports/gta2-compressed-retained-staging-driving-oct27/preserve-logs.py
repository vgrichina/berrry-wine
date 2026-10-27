# No guest input or execution. Retain all owned remote diagnostics in a compact safe archive.
q=py('import pathlib,tarfile,io,hashlib,json;H=pathlib.Path('+repr(str(H))+');O=H/"ops";b=io.BytesIO();files=[];\nwith tarfile.open(fileobj=b,mode="w:gz") as t:\n for p in sorted(O.rglob("*")):\n  if p.is_file() and (p.suffix in (".json",".stdout",".stderr",".log",".js",".py") or p.name.endswith(".png")):\n   data=p.read_bytes();name=str(p.relative_to(O));i=tarfile.TarInfo(name);i.size=len(data);t.addfile(i,io.BytesIO(data));files.append(dict(path=name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))\nz=b.getvalue();(O/"preserved-diagnostics.tar.gz").write_bytes(z);(O/"preserved-diagnostics-pins.json").write_text(json.dumps(files));print(json.dumps(dict(count=len(files),archiveBytes=len(z),sha256=hashlib.sha256(z).hexdigest())))');save('diagnostics-archive.json',q);print(q['stdout'])
sys.argv=['transfer',str(O/'preserved-diagnostics.tar.gz'),'preserved-diagnostics.tar.gz'];exec((O/'transfer-file.py').read_text())
p=O/'retrieved/preserved-diagnostics.tar.gz';dst=O/'remote';dst.mkdir(exist_ok=True)
with tarfile.open(p) as t:
 assert all(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.Path(x.name).parts for x in t);t.extractall(dst,filter='data')
print('remote diagnostics preserved locally')
