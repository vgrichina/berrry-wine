#!/usr/bin/env python3
"""Real detached Chrome custody, no guest runtime or inferred native waits."""
import json,os,pathlib,signal,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools'))
import importlib.util
s=importlib.util.spec_from_file_location('custody',ROOT/'tools/aow2-persistent-runtime.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def main(out):
 out=pathlib.Path(out).resolve();out.mkdir(parents=True,exist_ok=False);results=[]
 for case in ('normal','failure','client-loss','parent-TERM','deadline','cancel','backlog','chrome-failure'):
  r=out/case;mode=case if case in ('normal','failure','backlog','chrome-failure') else 'hold'
  launch=subprocess.run([sys.executable,'-B',str(ROOT/'tools/aow2-persistent-runtime.py'),'launch',str(r),'60' if case=='deadline' else '120','node',str(ROOT/'test/fixtures/aow2-owned-browser.cjs'),mode],capture_output=True,timeout=12)
  assert launch.returncode==0,(case,launch.stderr)
  # This launcher has actually exited while the independently owned runtime runs.
  m.await_file(r/'client-ready.json',55)
  if case=='client-loss':os.kill(json.loads((r/'driver-process.json').read_text())['pid'],signal.SIGKILL)
  if case=='parent-TERM':os.kill(json.loads((r/'keeper-ready.json').read_text())['pid'],signal.SIGTERM)
  if case=='cancel':(r/'cancel').touch()
  parent=m.await_file(r/'parent-wait.json',75);v=m.await_file(r/'supervisor-wait.json')
  assert parent['actualWait'] and parent['stdoutEOF'] and parent['stderrEOF'],parent
  assert v['clean'] and not v['remainingScope'] and not v['remainingChildren'],v
  assert {x['name'] for x in v['waits']}=={'chrome','driver','watchdog'}
  assert all(x['actualWait'] and x['stdoutEOF'] and x['stderrEOF'] and not x['errors'] for x in v['waits']),v
  assert (parent['returncode']==0)==(case in ('normal','backlog')),(case,v)
  if case=='backlog':
   driver=next(x for x in v['waits'] if x['name']=='driver');assert min(driver['pipeBytes'].values())>=2097152
  if case in ('normal','backlog'):assert next(x for x in v['waits'] if x['name']=='chrome')['returncode']==0
  import shutil
  shutil.rmtree(r/'profile')
  results.append(dict(case=case,launcherActualWait=True,launcherBothEOF=True,parent=parent,supervisor=v))
 (out/'proof.json').write_text(json.dumps(dict(passed=True,cases=results),indent=2)+'\n')
 print('PASS eight real Chrome cases: detached launcher loss, normal, child/client loss, parent TERM, deadline, cancel, backlog; actual waits and both EOFs')
if __name__=='__main__':main(sys.argv[1])
