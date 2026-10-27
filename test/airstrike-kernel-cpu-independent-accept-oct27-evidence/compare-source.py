import ast,difflib,hashlib,json,pathlib,shlex
ops=pathlib.Path(__file__).parent
log=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/airstrike-cgroup-cpu-receipt-oct27/events.jsonl')
lines=log.read_text().splitlines()
def cmd(i):return shlex.split(json.loads(lines[i])['item']['command'])[2]
s=cmd(28).split("<<'PY'\n",1)[1].split('\nPY\n',1)[0]+'\n'
if s.endswith('PY\n'):s=s[:-3]
# Interpret only constant .replace expressions; never execute historical commands.
def value(n,current):
 if isinstance(n,ast.Name) and n.id=='s':return current
 if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute):
  if n.func.attr=='read_text':return current
  assert n.func.attr=='replace'
  return value(n.func.value,current).replace(*[ast.literal_eval(a) for a in n.args])
 raise ValueError(ast.dump(n))
for i in (30,34):
 code=cmd(i).split("<<'PY'\n",1)[1].split('\nPY\n',1)[0]
 for n in ast.parse(code).body:
  if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and n.value.func.attr=='write_text':break
  if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='s' for t in n.targets):s=value(n.value,s)
(ops/'pre-persistence-helper.py').write_text(s)
final=pathlib.Path('/tmp/airstrike-kernel-cpu-independent-accept-oct27/repo/test/helpers/cgroup-cpu-evidence-oct27.py').read_text()
expected=s.replace('r.update(exclusiveFreshCreation=True, ownership=identity(group))',"r.update(exclusiveFreshCreation=True, ownership=identity(group))\n    Path(evidence_path).write_text(json.dumps(r, indent=2)+'\\n')").replace("            assert r['attachedBeforeRelease']","            Path(evidence_path).write_text(json.dumps(r, indent=2)+'\\n')\n            assert r['attachedBeforeRelease']")
(ops/'persistence-source.diff').write_text(''.join(difflib.unified_diff(s.splitlines(True),final.splitlines(True),fromfile='measured-before-persistence',tofile='final-pinned-helper')))
assert expected==final,'unexpected source difference'
print(json.dumps(dict(exactComparison=True,prePersistenceSHA256=hashlib.sha256(s.encode()).hexdigest(),finalSHA256=hashlib.sha256(final.encode()).hexdigest(),onlyChanges='two write-ahead evidence writes; no computation/attachment/finalization change',sourceEventIndices=[28,30,34,39],eventLogSHA256=hashlib.sha256(log.read_bytes()).hexdigest())))
