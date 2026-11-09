"""Own the retained Q3 launch AND command sender in one fail-closed session.

Production entry: python3 -B tools/q3-native-launch-client.py --task TASK.py
--task-sha256 SHA --evidence UNIQUE_DIRECTORY. Feed JSON lines containing
{"start":true} first, then {"command":{...},"review":"..."}. Retain the
stdin pipe throughout setup/commands; EOF is terminal bounded cancellation.
This entry composes the actual retained task's launch/command branches, replacing
its remote function (and c.remote) with the owned transport below. It never
allocates, retries, replays, changes input/options/deadlines, or claims remote
custody. Use this entry instead of separate task.py launch/command invocations.
"""
import argparse
import ast
import hashlib
import json
import os
import queue
from pathlib import Path
import selectors
import subprocess
import threading
import time
import sys


class TerminalFailure(RuntimeError):
    pass


class Child:
    def __init__(self, argv, directory, label, on_exit, on_eof):
        self.label = label
        self.process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.target = {'pid': self.process.pid, 'start': Path(
            '/proc', str(self.process.pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]}
        self.waited = threading.Event()
        self.drained = threading.Event()
        self.stop_read = threading.Event()
        self.output = [bytearray(), bytearray()]
        self.eof = [False, False]
        self.directory = directory
        self.finish_lock = threading.Lock()
        # Observation must not wait for stdio EOF (a descendant can hold a pipe).
        self.reader = threading.Thread(target=self._read, args=(on_eof,), daemon=True)
        self.waiter = threading.Thread(target=self._wait, args=(on_exit,), daemon=True)
        self.reader.start()
        self.waiter.start()

    def _read(self, on_eof):
        with selectors.DefaultSelector() as poll:
            for index, stream in enumerate((self.process.stdout, self.process.stderr)):
                poll.register(stream, selectors.EVENT_READ, index)
            while poll.get_map() and not self.stop_read.is_set():
                for key, _ in poll.select(.02):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if chunk:
                        self.output[key.data].extend(chunk)
                    else:
                        self.eof[key.data] = True
                        on_eof(self, key.data)
                        poll.unregister(key.fileobj)
            for stream in (self.process.stdout, self.process.stderr):
                stream.close()
        self.drained.set()

    def _wait(self, on_exit):
        self.process.wait()  # Actual parent wait; exit is observed before pipe drain.
        on_exit(self)
        self.waited.set()

    def finish(self, deadline, terminate=False):
        with self.finish_lock:
            return self._finish(deadline, terminate)

    def _finish(self, deadline, terminate=False):
        if terminate and self.process.poll() is None:
            self.process.terminate()
        if not self.waited.wait(max(0, min(.25, deadline-time.monotonic()))):
            if self.process.poll() is None:
                self.process.kill()
            self.waited.wait(max(0, deadline-time.monotonic()))
        self.drained.wait(max(0, deadline-time.monotonic()))
        if not self.drained.is_set():
            self.stop_read.set()
        self.reader.join(.1)
        self.waiter.join(max(0, deadline-time.monotonic()))
        receipt = dict(**self.target, status=self.process.returncode,
                       actualWait=self.waited.is_set(), stdioEOF=all(self.eof),
                       stdoutEOF=self.eof[0], stderrEOF=self.eof[1], remoteCustody='UNKNOWN')
        for index, name in enumerate(('stdout', 'stderr')):
            (self.directory / (self.label+'.'+name)).write_bytes(self.output[index])
        (self.directory / (self.label+'.wait.json')).write_text(json.dumps(receipt))
        return receipt


class Session:
    def __init__(self, evidence, transport, cleanup_seconds=2, launch_label='sole-original-launch', cancel_code=None):
        self.evidence = Path(evidence)
        self.evidence.mkdir(exist_ok=False, parents=True)
        self.transport = transport
        self.launch_label = launch_label
        self.cleanup_seconds = cleanup_seconds
        self.lock = threading.RLock()
        self.terminal = None
        self.launch = None
        self.children = []
        self.changed = threading.Event()
        self.started = threading.Event()
        self.cleanup_thread = None
        self.receipts = []
        self.cancel_code = cancel_code

    def fail(self, reason):
        with self.lock:
            if self.terminal is None:
                self.terminal = dict(at=time.time(), reason=reason, noReplay=True,
                                     remoteCustody='UNKNOWN')
                (self.evidence/'first-terminal.json').write_text(json.dumps(self.terminal))
                self.cleanup_thread = threading.Thread(target=self._cleanup)
                self.cleanup_thread.start()
            self.changed.set()
        return TerminalFailure(self.terminal['reason'])

    def check(self):
        with self.lock:
            # poll closes the gap before the waiter thread is scheduled.
            if self.launch is not None and self.launch.process.poll() is not None:
                self.fail('owned launch transport terminated: '+str(self.launch.process.returncode))
            if self.launch is not None and any(self.launch.eof):
                self.fail('owned launch transport stdio EOF')
            if self.terminal:
                raise TerminalFailure(self.terminal['reason'])

    def remote(self, label, code, timeout=40):
        launch = label == self.launch_label
        with self.lock:
            self.check()
            if not launch and self.launch is None:
                raise self.fail('command before owned launch')
            if launch and self.launch is not None:
                raise self.fail('second launch forbidden')
            def exited(child):
                if launch:
                    self.fail('owned launch transport terminated: '+str(child.process.returncode))
                self.changed.set()
            def eof(child, index):
                if launch:
                    self.fail('owned launch transport stdio EOF: '+str(index))
                self.changed.set()
            try:
                child = Child(self.transport(code, timeout), self.evidence, label, exited, eof)
            except BaseException as error:
                raise self.fail('owned transport spawn failed: '+str(error)) from error
            self.children.append(child)
            if launch:
                self.launch = child
                self.started.set()
        due = time.monotonic()+timeout+15  # Retained local command timeout, unchanged.
        while not child.waited.is_set() or not child.drained.is_set():
            if not launch:
                try:
                    self.check()
                except TerminalFailure:
                    child.finish(time.monotonic()+self.cleanup_seconds, terminate=True)
                    raise
            if time.monotonic() >= due:
                error = self.fail('owned transport deadline: '+label)
                child.finish(time.monotonic()+self.cleanup_seconds, terminate=True)
                raise error
            self.changed.wait(.01)
            self.changed.clear()
        receipt = child.finish(time.monotonic()+self.cleanup_seconds)
        self.check()  # A completed launch cannot resume bootstrap after terminal.
        if receipt['status'] != 0 or not receipt['actualWait'] or not receipt['stdioEOF']:
            raise self.fail('owned transport failed: '+label)
        rows = [json.loads(line) for line in child.output[0].decode().splitlines() if line.startswith('{')]
        value = rows[0] if len(rows) == 1 and 'stdout' in rows[0] else {
            **next((row for row in reversed(rows) if row.get('type') == 'exit'), {}),
            'stdout': ''.join(row.get('data', '') for row in rows if row.get('type') == 'stdout')}
        if not rows or value.get('exitCode', 0) != 0 or value.get('stdoutTruncated') or value.get('stderrTruncated'):
            raise self.fail('remote result UNKNOWN: '+label)
        return value.get('stdout', '')

    def _cleanup(self):
        # This runs on the first observation, even if the owner's stdin stays
        # open. Never wait for another command to start local cancellation.
        with self.lock:
            children = list(self.children)
        due = time.monotonic()+self.cleanup_seconds
        # Q2 and Q3 callers supply this run-scoped cancellation operation.
        # It is cleanup, never an admitted command or another launch. A failed
        # transport remains UNKNOWN; local waits do not prove remote custody.
        if self.cancel_code is not None and self.launch is not None:
            try:
                child = Child(self.transport(self.cancel_code, 40), self.evidence,
                              'terminal-cancel', lambda _: None, lambda *_: None)
                with self.lock:
                    self.children.append(child)
                children.append(child)
                child.waited.wait(max(0, due-time.monotonic()))
                child.finish(due)
            except BaseException as error:
                (self.evidence/'cancel-unknown.json').write_text(json.dumps(dict(error=str(error))))
        self.receipts = [child.finish(due, terminate=child is not self.launch)
                         for child in children]
        (self.evidence/'cleanup.json').write_text(json.dumps(dict(
            localComplete=all(r['actualWait'] and r['stdioEOF'] for r in self.receipts),
            children=self.receipts, remoteCustody='UNKNOWN')))

    def close(self):
        self.fail('session closed')
        self.cleanup_thread.join(self.cleanup_seconds+.3)
        if self.cleanup_thread.is_alive():
            raise TerminalFailure('local cleanup thread did not settle at cap')
        return self.receipts


def run_input(session, launch, request, stream=None):
    """Own a live input pipe before launch; observe EOF during blocking work.

    The controller must retain Popen(stdin=PIPE), await OWNED_INPUT_READY,
    write {"start":true}\n and flush, then keep that same writer open through
    setup and commands. Closing it is terminal cancellation, never detach.
    """
    stream = sys.stdin if stream is None else stream
    lines = queue.Queue()
    stop = threading.Event()
    def read():
        pending = b''
        try:
            with selectors.PollSelector() as poll:
                poll.register(stream, selectors.EVENT_READ)
                while not stop.is_set():
                    if not poll.select(.02):
                        continue
                    chunk = os.read(stream.fileno(), 65536)
                    if not chunk:
                        raise TerminalFailure('caller stdin EOF')
                    pending += chunk
                    while b'\n' in pending:
                        line, pending = pending.split(b'\n', 1)
                        lines.put(line)
        except BaseException as error:
            session.fail(str(error))
    reader = threading.Thread(target=read)
    reader.start()
    launcher = None
    def next_line():
        while True:
            session.check()
            try:
                line = lines.get(timeout=.02)
                session.check()
                return json.loads(line)
            except queue.Empty:
                pass
    def start():
        try:
            launch()
        except BaseException as error:
            session.fail(str(error))
    try:
        print('OWNED_INPUT_READY', flush=True)
        if next_line() != {'start': True}:
            raise session.fail('explicit start message required before launch')
        session.check()
        launcher = threading.Thread(target=start)
        launcher.start()
        while not session.started.wait(.01):
            session.check()
        session.check()
        print('OWNED_LAUNCH_STARTED', flush=True)
        while True:
            value = next_line()
            session.check()
            request(value)
            session.check()
            print(json.dumps(dict(commandComplete=True)), flush=True)
    except BaseException as error:
        session.fail(str(error))
        print(json.dumps(dict(error=str(error), noReplay=True)), flush=True)
    finally:
        stop.set()
        reader.join(.1)
        session.close()
        if launcher:
            launcher.join(session.cleanup_seconds+.2)
            if launcher.is_alive():
                raise TerminalFailure('launch caller did not settle at local cleanup cap')
    return int(session.terminal is not None)


def compose_task(task, expected_sha):
    """Compile the real caller branches; fail closed if their structure changes."""
    source = Path(task).read_bytes()
    if hashlib.sha256(source).hexdigest() != expected_sha:
        raise ValueError('retained task SHA mismatch')
    tree = ast.parse(source, filename=str(task))
    guards = [node for node in tree.body if isinstance(node, ast.If)
              and ast.unparse(node.test) == "__name__ == '__main__'"]
    if len(guards) != 1:
        raise ValueError('unique retained main required')
    main = guards[0]
    branches = main.body[1]
    selected = {}
    while isinstance(branches, ast.If):
        for action in ('launch', 'command'):
            if ast.unparse(branches.test) == 'action == '+repr(action):
                selected[action] = branches.body
        branches = branches.orelse[0] if len(branches.orelse) == 1 else None
    if set(selected) != {'launch', 'command'}:
        raise ValueError('retained launch/command branches required')
    namespace = {'__file__': str(Path(task).resolve()), '__name__': 'q3_owned_task'}
    exec(compile(ast.Module(body=[n for n in tree.body if n is not main], type_ignores=[]), str(task), 'exec'), namespace)
    class Arguments(ast.NodeTransformer):
        def visit_Attribute(self, node):
            if ast.unparse(node) == 'sys.argv':
                return ast.copy_location(ast.Name(id='argv', ctx=ast.Load()), node)
            return self.generic_visit(node)
    for action, body in selected.items():
        function = ast.FunctionDef(name='owned_'+action, args=ast.arguments(
            posonlyargs=[], args=[ast.arg(arg='argv')], kwonlyargs=[], kw_defaults=[], defaults=[]),
            body=body, decorator_list=[])
        module = ast.fix_missing_locations(Arguments().visit(ast.Module(body=[function], type_ignores=[])))
        exec(compile(module, str(task), 'exec'), namespace)
    return namespace


def cancel_remote(run, output=None):
    """Publish run-scoped revocation; publishing alone never proves custody."""
    run = Path(run).resolve()
    try:
        with (run/'caller-cancelled.json').open('x') as marker:
            json.dump(dict(at=time.time(), reason='owning launch transport terminal',
                           noReplay=True, remoteCustody='UNKNOWN'), marker)
            marker.flush()
            os.fsync(marker.fileno())
    except FileExistsError:
        pass  # First failure is sticky, including cancellation before bootstrap.
    if output is not None and Path(output).is_dir():
        # Wake the independently dispatched ACK sender even if the consumer is
        # killed before it observes revocation. This is a failure, never an ACK.
        try:
            with (Path(output)/'first-failure.json').open('x') as fault:
                json.dump(dict(at=time.time(), source='owning launch transport',
                               error='caller cancelled; UNKNOWN; no replay', noReplay=True), fault)
                fault.flush()
                os.fsync(fault.fileno())
        except FileExistsError:
            pass
    return dict(cancelPublished=True, remoteCustody='UNKNOWN')


def check_remote_cancel(run):
    if (Path(run)/'caller-cancelled.json').exists():
        raise TerminalFailure('remote caller cancelled before prelaunch; no replay')


def arm_remote_cancel(run):
    # Do no file I/O or process work from a signal handler.
    import signal
    requested = []
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, lambda signum, frame: requested.append(signum))
    return requested


def drain_remote(process, run, log, requested, output):
    """Pump independently of wait; notify the existing native reaper, not kill it.

    The native runtime publishes identity before supervise installs handlers.
    Wait for its matching kernel-armed receipt before sending TERM. No new
    runtime/cleanup budget is introduced; custody retains its immutable caps.
    """
    import gzip
    import signal
    run = Path(run)
    signalled = None
    eof = False
    os.set_blocking(process.stdout.fileno(), False)
    with selectors.DefaultSelector() as poll:
        poll.register(process.stdout, selectors.EVENT_READ)
        while process.poll() is None or not eof:
            if requested:
                cancel_remote(run, output)
            if (run/'caller-cancelled.json').exists() and signalled is None:
                try:
                    runtime = json.loads(gzip.decompress((run/'runtime-identity.json.gz').read_bytes()))
                    armed = json.loads((run/'kernel-armed.json').read_bytes())
                    stat = Path('/proc', str(runtime['pid']), 'stat').read_text()
                    start = stat.rsplit(')', 1)[1].split()[19]
                    if (armed['supervisor'], armed['supervisorStart']) != (runtime['pid'], runtime['start']):
                        raise TerminalFailure('remote supervisor binding mismatch; no signal')
                    if start != runtime['start']:
                        raise TerminalFailure('remote supervisor identity changed; no signal')
                    os.kill(runtime['pid'], signal.SIGTERM)
                    signalled = dict(pid=runtime['pid'], start=start, signal=signal.SIGTERM)
                    with (run/'caller-cancel-sent.json').open('x') as marker:
                        json.dump(dict(at=time.time(), **signalled, remoteCustody='UNKNOWN'), marker)
                except (FileNotFoundError, ProcessLookupError, EOFError, gzip.BadGzipFile, json.JSONDecodeError):
                    pass  # No absence-as-wait or fabricated kernel receipt.
            if eof:
                time.sleep(.02)
                continue
            for key, _ in poll.select(.02):
                # Bounded pumping cannot starve cancellation or actual waits.
                for _ in range(16):
                    try:
                        chunk = os.read(key.fd, 65536)
                    except BlockingIOError:
                        break
                    if not chunk:
                        eof = True
                        poll.unregister(key.fileobj)
                        break
                    log.write(chunk)
                    log.flush()
    # Caller records this actual wait separately from the observed pipe EOF.
    return process.wait()


def compose_remote_launch(code, root, output):
    """Amend the exact generated retained parent without rewriting history."""
    before = " while chunk:=p.stdout.read1(65536):log.write(chunk);log.flush()\n status=p.wait();p.stdout.close()"
    if code.count(before) != 1 or code.count('parent=identity(os.getpid());') != 1:
        raise ValueError('unsupported Q3 generated remote launch parent')
    prefix = ("import runpy\n_q3=runpy.run_path("+repr(str(Path(root)/'tools/q3-native-launch-client.py'))+")\n"
              "_q3_signals=_q3['arm_remote_cancel'](r)\n_q3['check_remote_cancel'](r)\n")
    code = code.replace('parent=identity(os.getpid());', prefix+'parent=identity(os.getpid());')
    code = code.replace(before, " status=_q3['drain_remote'](p,r,log,_q3_signals,"+repr(str(output))+");p.stdout.close()")
    compile(code, '<q3-owned-remote-parent>', 'exec')
    return code


def bind_remote(task, session):
    """One owner at both retained call sites, plus a separate cleanup channel."""
    run = str(Path(task['REMOTE'])/task['c'].RUN)
    helper = str(Path(task['REMOTE'])/'tools/q3-native-launch-client.py')
    session.cancel_code = ("import runpy,json;m=runpy.run_path("+repr(helper)+
                           ");print(json.dumps(m['cancel_remote']("+repr(run)+","+repr(task['OUT'])+")))")
    def remote(label, code, timeout=40):
        if label == session.launch_label:
            code = compose_remote_launch(code, task['REMOTE'], task['OUT'])
        return session.remote(label, code, timeout)
    task['remote'] = task['c'].remote = remote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', type=Path, required=True)
    parser.add_argument('--task-sha256', required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    task = compose_task(args.task, args.task_sha256)
    session = Session(args.evidence, lambda code, timeout: [
        'boat', '--no-update', '--json', 'exec', task['c'].box(), '--timeout', str(timeout),
        '--', 'python3', '-c', code])
    bind_remote(task, session)
    return run_input(session, lambda: task['owned_launch'](['task.py', 'launch']),
        lambda value: task['owned_command'](['task.py', 'command', json.dumps(value['command']), value.get('review')]))


if __name__ == '__main__':
    raise SystemExit(main())
