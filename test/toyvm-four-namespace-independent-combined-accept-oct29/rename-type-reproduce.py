"""Unchanged direct-handler mismatch reproduction; no mount or filesystem I/O."""
import importlib.util,json,stat,struct,sys
from pathlib import Path
p=Path(sys.argv[1]).resolve()
spec=importlib.util.spec_from_file_location("actual_backend",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
results=[]
for source_mode,dest_mode in [(stat.S_IFREG,stat.S_IFDIR),(stat.S_IFDIR,stat.S_IFREG)]:
 b=m.Backend('/tmp/unused-rename-type-reproducer')
 s=b.create(1,b'S',source_mode|0o700);t=b.create(1,b'T',dest_mode|0o700)
 before=b.state();error=None
 try: result=b.handle(12,1,struct.pack('<Q',1)+bytes([83,0,84,0]));result=result.hex()
 except OSError as e: error=e.errno;result=None
 results.append(dict(source=s,destination=t,sourceMode=source_mode,destinationMode=dest_mode,before=before,after=b.state(),names={k.decode():v for k,v in b.nodes[1]['names'].items()},destinationExists=t in b.nodes,result=result,errno=error))
print(json.dumps(results,indent=2))
