#!/usr/bin/env python3
"""Independent fail-closed cleanup acceptance; exact caller, no real backend spawn.

An assertion failure is the rejecting oracle. Only the first adversarial case
runs; API and CLI retain the same counterexample without repairing the caller.
"""
import contextlib,hashlib,importlib.util,io,json,pathlib,sys,tempfile
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
RECEIPT=pathlib.Path(sys.argv[1])
CALLER=ROOT/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
assert hashlib.sha256(CALLER.read_bytes()).hexdigest()=='c6ea49a11917ac62777b4682013ce5bf3d086ab7a0b145c0513ed3478d0f06cb'
spec=importlib.util.spec_from_file_location('independent_caller',CALLER)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
limits=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=128*1024**2,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
command=[sys.executable,'-B','-c','print("bounded child success")']
def invoke(work):
 args=['--domain','tiny-fixture','--receipt',str(RECEIPT),'--work',str(work)]
 for k,v in limits.items():args.extend(['--'+k.replace('_','-'),str(v)])
 stream=io.StringIO()
 with contextlib.redirect_stdout(stream):code=c.main(args+['--']+command)
 return code,json.loads(stream.getvalue())
with tempfile.TemporaryDirectory(prefix='independent-',dir=HERE) as tmp:
 work=pathlib.Path(tmp)
 # Unchanged earliest-boundary reproducer from pinned predecessor test_caller.py.
 with patch('subprocess.Popen',side_effect=RuntimeError('fixture stops before filesystem server')) as spawn:
  code,report=invoke(work)
  assert not report['accepted'] and 'fixture stops before filesystem server' in report['error']
  assert spawn.call_count==1
  actual=spawn.call_args.args[0]
  assert pathlib.Path(actual[2])==ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
  assert actual[3:]==[str(work/'domain'),str(work/'status.sock'),'32768','65536','16384']
 boundary=dict(code=code,report=report,attemptedArgv=actual,actualSpawns=0)
 # The first new adversarial input: boolean is not a subprocess exit status.
 fixture=dict(exit=0,stopReason=None,peakRSS=10000000,cpuSeconds=.01,wallSeconds=.1,output=b'bounded child success\n',cleanupComplete=True,
  filesystem=dict(live=12288,peak=12288,written=5,failure=None,openHandles=0),
  filesystemCleanup=dict(unmountExit=False,remainingMounts=[],serverExit=-15,serverStdout='',serverStderr=''))
 calls=[]
 def fake_backend(argv,actual_work,**forwarded):
  assert argv==command and actual_work==work
  assert forwarded==dict(limits,backend='synchronous-fuse')
  calls.append(dict(argv=argv,work=str(actual_work),forwarded=forwarded))
  return fixture
 with patch.object(c,'load_backend',return_value=fake_backend):
  api=c.qualify(domain='tiny-fixture',receipt=RECEIPT,command=command,work=work,**limits)
  cli_code,cli=invoke(work)
 witness=dict(boundary=boundary,changedField='filesystemCleanup.unmountExit',malformedValue=False,
  expected=dict(accepted=False,cleanupComplete=False,cliExit=1),api=api,cli=cli,cliExit=cli_code,calls=calls,
  actualSpawns=0,browserAllowanceUnchanged=c.BROWSER_ALLOWANCE)
 print(json.dumps(witness,sort_keys=True))
 assert not api['accepted'] and not cli['accepted'] and cli_code==1, 'malformed boolean unmount exit accepted by exact caller API and CLI'
