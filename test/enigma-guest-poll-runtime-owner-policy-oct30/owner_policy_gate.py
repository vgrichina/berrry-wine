import pathlib,json,os
import owner_policy_ops as ops
OUT=ops.ROOT/'owner-policy'
def admission():
 a=ops.admission()
 assert sum(p.stat().st_size for p in (OUT/'images').rglob('*') if p.is_file())<=8*1048576
 ops.check_evidence()
 return a
def setup():
 for p in [OUT,OUT/'e',OUT/'raw',OUT/'images']:p.mkdir(exist_ok=True)
 ops.BASE=ops.configure_parent();ops.E=OUT/'e'
 controls={}
 for name,kw in [('omitted',{}),('root',dict(cwd='/home/user/wine-assembly')),('donor',dict(cwd='/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'))]:
  try:ops.run('bad',['/bin/pwd'],**kw)
  except (AssertionError,TypeError):controls[name]='rejected before spawn'
  else:raise AssertionError(name)
 (ops.E/'controls.json').write_text(json.dumps(controls))
