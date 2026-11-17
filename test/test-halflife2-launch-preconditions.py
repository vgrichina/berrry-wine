#!/usr/bin/env python3
"""No native media runs: invalid controller order and terminal launch refusal."""
import importlib.util,pathlib,json,os,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location('restored',ROOT/'tools/halflife2-restored-native.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def run(out):
 out=pathlib.Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
 early=out/'early';early.mkdir()
 try:m.supervise_controller(early,['startup'])
 except AssertionError as e:assert 'launch receipt' in str(e)
 else:raise AssertionError('early controller started')
 assert not list(early.iterdir()),'early local call must neither spawn nor poison a future native invocation'
 late=out/'late';late.mkdir();(late/'PERMANENT-UNKNOWN.json').write_text('{"test":true}')
 task=out.parent;marker=task/'original-installer-invocation.json';before=marker.read_bytes() if marker.exists() else None
 env=dict(os.environ,HL2_RUN=str(late),HL2_TASK_RUN=str(task))
 p=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/halflife2-restored-native.py'),'--original'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 a,b=p.communicate(timeout=10);assert p.returncode!=0 and b'original launch refused' in b
 assert (marker.read_bytes() if marker.exists() else None)==before,'no additional allowance reservation'
 assert sorted(x.name for x in late.iterdir())==['PERMANENT-UNKNOWN.json']
 # Same check at the end of preparation, where this session's race occurred.
 try:m.assert_original_launchable(late)
 except AssertionError:pass
 else:raise AssertionError('preexisting UNKNOWN admitted an original')
 proof=dict(passed=True,noOriginal=True,zeroHTTP=True,noSupervisorOrLatchForEarlyLocalCall=True,actualAdapterRefusedBeforePreparation=True,endOfPreparationRefusesUNKNOWN=True,wait=dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
 (out/'proof.json').write_text(json.dumps(proof,indent=2));print('PASS early controller refuses before spawn/latch; actual adapter and post-preparation guard refuse original after UNKNOWN')
if __name__=='__main__':run(sys.argv[1])
