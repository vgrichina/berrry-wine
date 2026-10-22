import pathlib,subprocess,json
E=pathlib.Path('/home/user/wine-assembly-aoe3-oleaut-independent-sparse-review-oct22/scratch/runs/20261022-aoe3-oleaut-independent-sparse-review')
code=r'''
import pathlib,shutil,os,json,hashlib
src=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22'); dest=pathlib.Path('/home/user/aoe3-independent-review-oct22');dest.mkdir()
for name in ['baseline','candidate']:
 r=dest/name;r.mkdir()
 for part in ['src','lib','tools','test','packages']:
  shutil.copytree(src/part,r/part,copy_function=os.link,symlinks=True)
 for name2 in ['package.json','package-lock.json']:
  os.link(src/name2,r/name2)
 if name=='baseline':
  for rel in ['src/01-header.wat','lib/host-imports.js']:
   p=r/rel;p.unlink();shutil.copy2(src/'baseline-inputs'/rel,p)
print(json.dumps({'review':str(dest),'source':str(src),'node':os.popen('node --version').read().strip()}))
'''
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'setup-receipt.json').write_text(p.stdout);print(p.stdout,p.stderr)
