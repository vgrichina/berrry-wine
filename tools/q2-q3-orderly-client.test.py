"""Offline full PIPE controller using actual retained branches and ACK senders.

No browser, guest, Boat or allocation. Each controller has an independent
process watchdog; actual waits and each pipe EOF are recorded separately.
"""
import ast
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def load(game):
    path = ROOT/'tools'/('quake2-native-launch-client.py' if game == 'q2' else 'q3-native-launch-client.py')
    spec = importlib.util.spec_from_file_location('client', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def child(game, directory, mode, old):
    m = load(game)
    shared = m.shared if game == 'q2' else m
    if old:
        # Load the exact recorded pre-repair shared Session; production caller
        # and input controller are otherwise the same test invocation.
        import types
        source = subprocess.check_output(['git', 'show', old+':tools/q3-native-launch-client.py'], cwd=ROOT)
        shared = types.ModuleType('old_shared')
        exec(compile(source, 'git:'+old, 'exec'), shared.__dict__)
        if game == 'q2':
            m.Session = shared.Session
    task_path = ROOT/('scratch/runs/20261109-quake2-observed-guard-route-0105/control.py' if game == 'q2'
                     else 'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py')
    task = m.compose_task(task_path, hashlib.sha256(task_path.read_bytes()).hexdigest())
    runtime = directory/'runtime/original'
    (runtime/'commands').mkdir(parents=True)
    (runtime/'execution-window.json').write_text(json.dumps(dict(
        browserStop=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time()+180))+'Z')))
    task['REMOTE'], task['OUT'], task['ROOT'], task['R'] = str(ROOT), str(runtime), ROOT, directory
    task['RUN'] = str(runtime.parent.relative_to(ROOT))
    task['save'] = lambda name, value: (directory/(name+'.json')).write_text(json.dumps(value))
    stop = directory/'exit'
    def transport(code, timeout):
        if code == 'CANCEL':
            return [sys.executable, '-c', 'from pathlib import Path;Path('+repr(str(directory/'cancel-marker'))+').touch();print("cancel UNKNOWN")']
        if '--remote-parent' in code or 'PRELAUNCH_ACTUAL_WAIT' in code:
            ending = ('import os;os.close(1);os.close(2);time.sleep(.7)' if mode == 'incomplete-wait'
                      else 'print(json.dumps(dict(stdout="incomplete remote result")))' if mode == 'invalid-launch'
                      else 'print(json.dumps(dict(stdout="joined inert launch",exitCode=0)));raise SystemExit('+('7' if mode == 'nonzero' else '0')+')')
            return [sys.executable, '-c', 'import pathlib,time,json\np=pathlib.Path('+repr(str(stop))+')\nwhile not p.exists():time.sleep(.005)\n'+ending]
        tree = ast.parse(code)
        call = tree.body[1].value
        assert ast.unparse(call.func) == 'subprocess.run'
        argv = ast.literal_eval(call.args[0])
        assert argv[:2] == ['node', '-e']
        assert ('t.request(out,s.command.id,s.command,50000)' if game == 'q2' else 't.request(out,c.id,c,55000)') in argv[2]
        with (directory/'sender-codes.jsonl').open('a') as out:
            out.write(json.dumps(dict(code=code, argv=argv))+'\n')
        # Boat's JSON envelope is inert here. Retain the exact sender body and
        # argv in this same directly owned Node process: no wrapper descendant
        # can outlive a cancelled command or turn absence into a wait claim.
        argv[2] = ("const envelopeLog=console.log;let envelopeOutput='';"
                   "console.log=(...args)=>{envelopeOutput+=require('util').format(...args)+'\\n'};"
                   "process.on('exit',()=>envelopeLog(JSON.stringify({stdout:envelopeOutput,exitCode:process.exitCode||0})));"
                   +argv[2])
        return argv
    if game == 'q2':
        caller = m.Caller(task, directory/'session', transport, cancel_code='CANCEL')
        session, launch, request = caller.session, caller.launch, caller.request
        if old:
            def request(value):
                session.check()
                return task['owned_request'](['control.py', 'request', json.dumps(value['command']), None])
    else:
        session = shared.Session(directory/'session', transport, cancel_code='CANCEL')
        task['remote'] = task['c'].remote = session.remote
        launch = lambda: task['owned_launch'](['task.py', 'launch'])
        def request(value):
            invoke = lambda: task['owned_command'](['task.py', 'command', json.dumps(value['command']), None])
            return invoke() if old else session.request(value, invoke)
    # Consumer is actual production numbered transport; only execute is inert.
    provider = './tools/quake2-native-transport.cjs' if game == 'q2' else './scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs'
    js = r"""
const fs=require('fs'),t=require(process.argv[1]),out=process.argv[2],stop=process.argv[3],mode=process.argv[4];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{for(let n=0;n<2;n++){
 while(!fs.existsSync(out+'/commands/'+n+'.json'))await pause(5);
 const c=JSON.parse(fs.readFileSync(out+'/commands/'+n+'.json'));
 if(c.action==='quit'&&['stale','stale-number','refused'].includes(mode)){
  t.publish(out+'/reply-'+n+'.json',{ok:true,id:mode==='stale'?'old_quit':c.id,
   number:mode==='stale-number'?99:n,...(mode==='refused'?{status:'refused-before-dispatch',effects:0,refreshRequired:true}:{})});
  fs.writeFileSync(stop,'stop');return;
 }
 if(c.action==='quit'&&mode==='missing-ack'){fs.writeFileSync(stop,'stop');return;}
 await t.consume(out,n,async(command,mark)=>{
  mark();fs.appendFileSync(out+'/executed',command.action+'\n');
  if(command.action==='quit'&&mode!=='after'){
   fs.writeFileSync(stop,'stop');await pause(150);
  }
 });
 if(c.action==='quit'&&mode==='after'){await pause(150);fs.writeFileSync(stop,'stop');}
}})().catch(e=>{console.error(e);process.exitCode=1;});
"""
    consumer = subprocess.Popen(['node', '-e', js, provider, str(runtime), str(stop), mode],
                                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        rc = shared.run_input(session, launch, request)
        if getattr(session, 'completed', False):
            before = len(session.children)
            try:
                request(dict(command=dict(id='later_capture', action='capture', waitMs=0)))
            except shared.TerminalFailure:
                pass
            else:
                raise AssertionError('later command accepted')
            assert len(session.children) == before
        return rc
    finally:
        if consumer.poll() is None:
            consumer.terminate()
        stdout, stderr = consumer.communicate(timeout=3)
        (directory/'consumer.stdout.gz').write_bytes(gzip.compress(stdout))
        (directory/'consumer.stderr.gz').write_bytes(gzip.compress(stderr))
        (directory/'consumer-wait.json').write_text(json.dumps(dict(
            pid=consumer.pid, status=consumer.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True)))


def scenario(out, game, mode, old=None):
    directory = out/(game+'-'+mode+('-old' if old else ''))
    directory.mkdir(parents=True)
    process = subprocess.Popen([sys.executable, '-B', __file__, '--child', game, str(directory), mode, old or ''],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Independent process deadline, armed before any start/input message.
    watchdog = subprocess.Popen([sys.executable, '-c',
        'import os,sys,time,signal,json\nfrom pathlib import Path\np=int(sys.argv[1]);stop=Path(sys.argv[2]);due=time.monotonic()+12\nwhile not stop.exists() and time.monotonic()<due:time.sleep(.02)\nfired=not stop.exists()\nif fired:\n try:os.kill(p,signal.SIGTERM)\n except ProcessLookupError:pass\nprint(json.dumps(dict(fired=fired)))',
        str(process.pid), str(directory/'watchdog-stop')], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    output = [bytearray(), bytearray()]
    eof = [False, False]
    logs = [gzip.open(directory/('controller.'+name+'.gz'), 'wb') for name in ('stdout', 'stderr')]
    poll = selectors.DefaultSelector()
    for i, stream in enumerate((process.stdout, process.stderr)):
        poll.register(stream, selectors.EVENT_READ, i)
    def pump():
        for key, _ in poll.select(.02):
            data = os.read(key.fileobj.fileno(), 65536)
            if data:
                output[key.data].extend(data)
                logs[key.data].write(data)
                logs[key.data].flush()
            else:
                eof[key.data] = True
                poll.unregister(key.fileobj)
    def until(check):
        due = time.monotonic()+10
        while not check():
            pump()
            assert time.monotonic()<due, (game, mode, [b.decode(errors='replace') for b in output])
    def send(value):
        process.stdin.write(json.dumps(value).encode()+b'\n')
        process.stdin.flush()
    try:
        until(lambda: b'OWNED_INPUT_READY' in output[0])
        send(dict(start=True))
        until(lambda: b'OWNED_LAUNCH_STARTED' in output[0])
        if mode == 'unexpected':
            (directory/'exit').touch()
        else:
            send(dict(command=dict(id='capture', action='capture', label='capture', waitMs=0)))
            until(lambda: b'commandComplete' in output[0])
            send(dict(command=dict(id='quit', action='quit', waitMs=0)))
            if mode in ('missing-ack', 'incomplete-wait', 'stdin-eof'):
                until(lambda: (directory/'runtime/original/commands/1.json').exists())
                process.stdin.close()
        # Successful quit must return while this same PIPE writer stays open.
        until(lambda: process.poll() is not None)
        status = process.wait(timeout=1)
        until(lambda: all(eof))
        success = not old and mode in ('before', 'after')
        assert (status == 0) == success, (status, [b.decode(errors='replace') for b in output])
        session = directory/'session'
        assert (session/'normal-completion.json').exists() == success
        assert not (directory/'runtime/original/commands/2.json').exists()
        cleanup = json.loads((session/'cleanup.json').read_text())
        assert all(r['actualWait'] and r['stdoutEOF'] and r['stderrEOF'] for r in cleanup['children'])
        if success:
            assert all(r['status'] == 0 for r in cleanup['children'])
            assert not (directory/'cancel-marker').exists()
            assert not (session/'first-terminal.json').exists()
            assert not process.stdin.closed
        else:
            assert (directory/'cancel-marker').exists()
            terminal = json.loads((session/'first-terminal.json').read_text())
            assert terminal['noReplay'] and terminal['remoteCustody'] == 'UNKNOWN'
        (directory/'controller-wait.json').write_text(json.dumps(dict(
            pid=process.pid, status=status, actualWait=True, stdoutEOF=eof[0], stderrEOF=eof[1],
            stdinOpenAtWait=not process.stdin.closed, old=old, success=success)))
    finally:
        if process.poll() is None:
            process.terminate()
        process.wait(timeout=4)
        if not process.stdin.closed:
            process.stdin.close()
        while poll.get_map():
            pump()
        poll.close()
        for log in logs:
            log.close()
        (directory/'watchdog-stop').touch()
        stdout, stderr = watchdog.communicate(timeout=3)
        assert watchdog.returncode == 0 and json.loads(stdout)['fired'] is False
        (directory/'watchdog-wait.json').write_text(json.dumps(dict(
            pid=watchdog.pid, status=watchdog.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, fired=False)))
    print(directory.name, 'PASS actual PIPE controller, retained branches, numbered ACK, joined actual waits/separate EOF')


if __name__ == '__main__':
    if sys.argv[1] == '--child':
        raise SystemExit(child(sys.argv[2], Path(sys.argv[3]), sys.argv[4], sys.argv[5]))
    out = Path(sys.argv[1]).resolve()
    base = sys.argv[2]
    for game in ('q2', 'q3'):
        for mode in ('before', 'after'):
            scenario(out, game, mode, base)
            scenario(out, game, mode)
        for mode in ('unexpected', 'nonzero', 'stale', 'stale-number', 'refused', 'invalid-launch',
                     'missing-ack', 'incomplete-wait', 'stdin-eof'):
            scenario(out, game, mode)
