import ast,json,re,pathlib,hashlib
root=pathlib.Path('/tmp/airstrike-input-observer-independent-accept-oct27/ops');history={};snapshots=[]
class VirtualPath:
 def __init__(self,p):self.p=str(p)
 def read_text(self):
  if self.p in history:return history[self.p]
  return pathlib.Path(self.p).read_text()
 def write_text(self,s):history[self.p]=s
 def with_name(self,s):return VirtualPath(pathlib.Path(self.p).with_name(s))
 def rename(self,p):return None
session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*01a17da0-be80-7a41-9a97-1b6d49bf62ba*'))
fixture=str(root/'independent-boundary.js')
for line in session.open():
 d=json.loads(line);p=d.get('payload',{})
 if p.get('type')!='custom_tool_call' or p.get('name')!='exec':continue
 raw=p.get('input','')
 for m in re.finditer(r'tools\.exec_command\(\{cmd:',raw):
  cmd,_=json.JSONDecoder().raw_decode(raw[m.end():])
  if 'retain-fixtures.py' in cmd:continue
  if str(root) not in cmd:continue
  # Replay source text edits only, in a virtual path store. No subprocesses.
  for h in re.finditer(r"cat > (\S+) <<'EOF'\n(.*?)\nEOF",cmd,re.S):history[h[1]]=h[2]+'\n'
  for h in re.finditer(r"python3 - <<'PY'\n(.*?)\nPY",cmd,re.S):
   script=h[1]
   if fixture not in script:continue
   tree=ast.parse(script)
   tree.body=[n for n in tree.body if not isinstance(n,(ast.Import,ast.ImportFrom))]
   exec(compile(tree,'<retained-own-text-edit>','exec'),{'Path':VirtualPath})
  run=re.search(r'run\.py (\S+) node .*independent-boundary\.js',cmd)
  if run and fixture in history:
   data=history[fixture].encode();name=run[1];out=root/'fixture-lineage'/f'{name}.js';out.parent.mkdir(exist_ok=True);out.write_bytes(data)
   snapshots.append(dict(group=name,path=str(out),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
assert history[fixture]==(root/'independent-boundary.js').read_text(),'virtual replay differs from final fixture'
assert len(snapshots)==8,len(snapshots)
(root/'fixture-lineage.json').write_text(json.dumps({'method':'Replay own retained tool-call text edits in virtual Path store; no behavioral execution or predecessor wrapper runs','snapshots':snapshots},indent=2)+'\n')
print('Retained',len(snapshots),'exact executed fixture versions; final reconstructed text matches current portable fixture')
