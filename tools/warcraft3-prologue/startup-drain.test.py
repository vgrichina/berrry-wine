"""Offline composed startup/close under real ptrace custody; no browser runtime."""
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import types
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
BASELINE = '4341b87723a7d56bc98223215cca4cdc878fcae2'


def load(version):
    source = (subprocess.check_output(['git', 'show', BASELINE + ':tools/native_kernel_custody.py'], cwd=ROOT)
              if version == 'old' else (ROOT / 'tools/native_kernel_custody.py').read_bytes())
    module = types.ModuleType('custody')
    exec(compile(source, 'native_kernel_custody.py', 'exec'), module.__dict__)
    return module, hashlib.sha256(source).hexdigest()


def supervise(run, version):
    kernel, digest = load(version)
    life = json.loads((run / 'deadlines.json').read_text())
    append = kernel.Journal.append

    def durable_delay(journal, value):
        append(journal, value)  # actual durable write, then controlled storage delay
        if value['kind'] == 'cancellation-sent':
            time.sleep(.2)

    try:
        with patch.object(kernel.Journal, 'append', durable_delay):
            kernel.supervise(run, ['node', str(run / 'driver.cjs'), str(run)],
                             deadline=life['deadline'], cleanup_deadline=life['cleanupDeadline'],
                             journal_compression='gzip', command_compression='gzip')
    except (InterruptedError, TimeoutError):
        pass  # Cancellation must remain abnormal even when custody drains.
    (run / 'source.json').write_text(json.dumps(dict(version=version, sha256=digest)))


def main(base):
    base.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location('kernel', ROOT / 'tools/native_kernel_custody.py')
    kernel = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kernel)
    assert kernel.libc.prctl(36, 1, 0, 0, 0) == 0  # reap old-failure EXITKILL orphans
    for version in ('old', 'new'):
        run = base / version
        run.mkdir()
        (run / 'runtime-pins.json').write_text('{"files":[],"httpPins":[]}')
        (run / 'peer.py').write_text('''import pathlib,sys,threading,time
for _ in range(40):
 threading.Thread(target=lambda:time.sleep(30),daemon=True).start()
pathlib.Path(sys.argv[1], 'peer-armed').write_text('40 real native threads; no endpoint')
time.sleep(30)
''')
        # Existing fixture executes the actual production composition through
        # readiness failure and close. Replace only its Node protocol child
        # with a controlled, multithreaded pipe writer lacking an endpoint.
        (run / 'driver.cjs').write_text('''const cp=require('node:child_process'),path=require('node:path');
const spawn=cp.spawn,run=process.argv[2];
process.env.BROWSER_DEADLINE=String(Date.now()+45000);
cp.spawn=function(command,args,options){
 if(args[1]==='node-browser')return spawn('python3',[run+'/peer.py',run],options);
 throw Error('unexpected launch '+command);
};
require(''' + json.dumps(str(ROOT / 'tools/warcraft3-prologue/startup-fixture.js')) + ''').run(run,'noendpoint',{nodeOnly:true});
''')
        due = time.time() + 3
        (run / 'deadlines.json').write_text(json.dumps(dict(deadline=due, cleanupDeadline=due + 5)))
        supervisor = subprocess.Popen([sys.executable, __file__, '--supervise', str(run), version],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # Arm an independent observable watchdog before waiting on the child.
        watchdog = subprocess.Popen([sys.executable, '-c', '''import json,os,pathlib,signal,sys,time
p=pathlib.Path(sys.argv[1]);pid=int(sys.argv[2]);due=float(sys.argv[3])
(p/'watchdog-armed.json').write_text(json.dumps(dict(pid=pid,deadline=due)))
time.sleep(max(0,due-time.time()))
(p/'watchdog-fired').write_text('independent deadline')
os.kill(pid,signal.SIGKILL)
''', str(run), str(supervisor.pid), str(due + 20)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            end = time.monotonic() + 7
            while not (run / 'original/browser-terminal.json').exists():
                lifecycle = run / 'original/browser-lifecycle.jsonl'
                if lifecycle.exists() and '"kind":"cancel"' in lifecycle.read_text():
                    break
                assert time.monotonic() < end, 'composed close never began'
                time.sleep(.01)
            assert (run / 'peer-armed').exists()
            os.kill(supervisor.pid, signal.SIGTERM)
            stdout, stderr = supervisor.communicate(timeout=30)
        finally:
            # On setup/assertion failure, still let the prearmed independent
            # watchdog enforce its deadline, then consume both actual waits.
            if supervisor.returncode is None:
                supervisor.communicate(timeout=30)
            watchdog.terminate()
            watchdog.communicate(timeout=3)
        adopted = []
        while True:
            try:
                pid, status = os.waitpid(-1, 0)
                adopted.append(dict(pid=pid, status=status))
            except ChildProcessError:
                break
        (run / 'outer-waits.json').write_text(json.dumps(dict(
            supervisorWait=supervisor.returncode, stdoutEOF=True, stderrEOF=True,
            stdout=stdout.decode(), stderr=stderr.decode(), watchdogWait=watchdog.returncode,
            watchdogStdoutEOF=True, watchdogStderrEOF=True, adoptedActualWaits=adopted)))
        assert not (run / 'watchdog-fired').exists()
        drain = json.loads((run / 'kernel-drain.json').read_text())
        rows = [json.loads(s) for s in gzip.open(run / 'custody.ndjson.gz', 'rt')]
        by_sequence = {r['sequence']: r for r in rows}
        for r in drain['reaped']:
            before = by_sequence[r['beforeReapSequence']]
            assert before['pid'] == r['pid'] and before['start'] == r['start']
        if version == 'old':
            assert not drain['complete'] and drain['unreaped']
            assert 'cleanup deadline' in drain['failure']
        else:
            assert drain['complete'], drain
            assert not drain['unreaped'] and not drain['remaining']
            assert drain['commandLog']['eof']
            # Supervisor cancellation may kill the controller before its
            # browser receipt. Require actual kernel waits and command EOF;
            # never promote those to a missing browser-observer EOF receipt.
            failure = json.loads((run / 'original/first-browser-failure.json').read_text())
            assert 'DevTools startup deadline; no endpoint' in failure['error']
            assert drain['cancellation'] and drain['exit'] != 0
            assert all(r['beforeReapSequence'] < r['sequence'] for r in drain['reaped'])
            assert not (run / 'original/fixture-startup.json').exists()
        print(version, 'complete', drain['complete'], 'owned', len(drain['owned']),
              'actual waits', len(drain['reaped']), 'command EOF', drain['commandLog']['eof'], flush=True)


if __name__ == '__main__':
    if sys.argv[1] == '--supervise':
        supervise(Path(sys.argv[2]), sys.argv[3])
    else:
        main(Path(sys.argv[1]).resolve())
