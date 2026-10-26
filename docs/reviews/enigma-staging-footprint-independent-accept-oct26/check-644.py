import hashlib,importlib.util,json,os,stat,tempfile
from pathlib import Path
H=Path(__file__).parent
spec=importlib.util.spec_from_file_location('candidate',H.parent/'repo/tools/enigma-bounded-staging.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
with tempfile.TemporaryDirectory(dir=H) as d:
    root=Path(d);p=root/'source';p.write_bytes(b'pinned-source-mode-fixture');p.chmod(0o644)
    row=dict(kind='file',path=str(p),target='runtime/required',bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    s.stage([row],root/'out');dest=root/'out/runtime/required'
    result=dict(sourceMode=oct(stat.S_IMODE(p.stat().st_mode)),destinationMode=oct(stat.S_IMODE(dest.stat().st_mode)),contentPreserved=p.read_bytes()==dest.read_bytes())
    print(json.dumps(result),flush=True)
    if result['sourceMode']!=result['destinationMode']:
        print('REJECT: required 0644 nonfont mode changed',flush=True)
        raise SystemExit(1)
