from common import *
count=0;before=0;after=0
for p in H.glob('*.command.json'):
 q=json.loads(p.read_text())
 if 'argv' not in q:continue
 a=q.pop('argv');command=a[-1];q.update(argvPrefix=a[:-1],commandBytes=len(command.encode()),commandSHA256=sha(command.encode()),recovery='stage-manifest source pins plus stage.py deterministic tar/chunk recipe; retained actual argv SHA256')
 before+=p.stat().st_size;p.write_text(json.dumps(q,indent=2));after+=p.stat().st_size;count+=1
save('command-payload-compaction.json',dict(files=count,bytesBefore=before,bytesAfter=after,hashesPreserved=True,sourcePayloadCopied=False))
print(count,before,after)
