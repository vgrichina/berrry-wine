from transport import *
import shutil
O=H/'ops';R=H/'repo';E=R/'docs/re-notes/maelstrom-qualified-head-original-capture-20261024'
E.mkdir(parents=True,exist_ok=True)
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.py','.json','.cjs'] and p.name not in ['result.json','publication.json','committed-evidence-verification.json']:shutil.copyfile(p,E/p.name)
for n in ['manifest.json','guest-args.json','api-history.jsonl','remote-rehash.json','transform-tree-receipt.json','preflight-api.json','transfer-receipts.json','cleanup-api.json','capture-accounting.json','collect-inventory-api.json','fresh-remote-admission-api.json','guest-api.json','cutoff-clarified.json']:
 if (H/n).exists():shutil.copyfile(H/n,E/n)
for p in (H/'collected').rglob('*'):
 if p.is_file():
  target=E/'collected'/p.relative_to(H/'collected');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
seals=[]
for p in E.rglob('*'):
 if p.is_file() and p.name!='evidence-seals.json':seals.append(dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(E/'evidence-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
subprocess.run(['git','-C',str(R),'add','-f',str(E),str(E)+'.md'],check=True)
subprocess.run(['git','-C',str(R),'diff','--cached','--check'],check=True)
print(json.dumps(dict(files=len(seals),evidenceBytes=sum(x['bytes'] for x in seals))))
