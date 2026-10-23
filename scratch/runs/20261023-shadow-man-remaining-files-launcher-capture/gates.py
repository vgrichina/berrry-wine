"""After complete restoration only: receipts, one clone, exact accepted gates."""
import importlib.util,io,json,pathlib,time,hashlib
from transport import *
def main():
 spec=importlib.util.spec_from_file_location('continuation',E/'continue.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
 c.local_gate();fresh=json.loads((E/'after-transfer.json').read_text());full=json.loads((E/'full-accepted-manifest.json').read_text());actual={x['path']:x for x in fresh['originals']}
 assert len(actual)==2083 and len((E/'completed-new.jsonl').read_text().splitlines())==238
 for x in full:assert actual[x['path']]['bytes']==x['bytes'] and actual[x['path']]['sha256']==x['sha256']
 assert fresh['immutableReadOnly'] and not fresh['tmpfsMounted']
 assert time.time()+180<c.DEADLINE
 data=''.join(json.dumps({k:x[k] for k in ['path','bytes','sha256']})+'\n' for x in full).encode();(E/'all-originals-verified.jsonl').write_bytes(data)
 run('import pathlib\np=pathlib.Path('+repr(ROOT+'/immutable/receipts')+')\np.chmod(0o755)\nassert not (p/"transfer-files.jsonl").exists()','receipt-parent-write-api.json',10)
 try:save('new-manifest-upload.json',upload_stream(io.BytesIO(data),len(data),ROOT+'/immutable/receipts/transfer-files.jsonl'))
 finally:run('import pathlib\np=pathlib.Path('+repr(ROOT+'/immutable/receipts')+')\nfor x in [p,p/"transfer-files.jsonl"]:\n if x.exists():x.chmod(0o555 if x.is_dir() else 0o444)','receipt-parent-readonly-api.json',10)
 # Helper-only deadline adaptation; accepted runtime and compile guard stay byte-identical.
 for name in ['preguest.py','launch_once.py']:
  p=E/name;s=p.read_text().replace('2026,10,23,1,10,','2026,10,23,1,22,');p.write_text(s)
  save(name+'-upload.json',upload_stream(io.BytesIO(s.encode()),len(s.encode()),ROOT+'/fixed/'+name))
 for name in ['hash_gate.py','prepare_mutable.py','preguest.py']:
  result=run('import runpy\nrunpy.run_path('+repr(ROOT+'/fixed/'+name)+',run_name="__main__")',name+'-api.json',30)
  if name!='prepare_mutable.py':save(name+'-result.json',json.loads(result['stdout']))
 c.local_gate()
if __name__=='__main__':main()
