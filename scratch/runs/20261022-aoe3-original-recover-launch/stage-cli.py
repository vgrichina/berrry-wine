"""Stage exact historical CLI helper closure without rebuilding the module."""
import io, json, pathlib, re, tarfile, posixpath
from stage import E, REV, REMOTE, git, run, save, sha, transfer
pins=json.loads((E/'runtime-pins.json').read_text());known={x['path'] for x in pins}
queue=['test/run.js','tools/region-layout-hash.js','tools/disasm.js']; added={}
while queue:
 rel=queue.pop()
 if rel in added:continue
 try:b=git('show',REV+':'+rel)
 except Exception:continue
 added[rel]=b
 if rel not in known:pins.append(dict(path=rel,size=len(b),sha256=sha(b)));known.add(rel)
 for match in re.finditer(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)',b):
  target=posixpath.normpath(posixpath.join(posixpath.dirname(rel),match[1].decode()))
  if not pathlib.PurePosixPath(target).suffix:target+='.js'
  if target not in added:queue.append(target)
stream=io.BytesIO()
with tarfile.open(fileobj=stream,mode='w:gz') as t:
 for rel,b in sorted(added.items()):
  info=tarfile.TarInfo(rel);info.size=len(b);t.addfile(info,io.BytesIO(b))
save('runtime-pins.json',pins)
stream.seek(0);transfer(stream,'cli-closure.tar.gz')
print(run('import tarfile;tarfile.open(%r).extractall(%r,filter="data");print("CLI staged")'%(REMOTE+'/cli-closure.tar.gz',REMOTE+'/runtime'))['stdout'])
