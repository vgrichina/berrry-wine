"""Own the retained Q3 launch AND command sender in one fail-closed session.

Production entry: python3 -B tools/q3-native-launch-client.py --task TASK.py
--task-sha256 SHA --evidence UNIQUE_DIRECTORY. Feed JSON lines containing
{"command":{...},"review":"..."}; EOF requests local bounded cleanup only.
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
from pathlib import Path
import selectors
import subprocess
import threading
import time


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
    def __init__(self, evidence, transport, cleanup_seconds=2):
        self.evidence = Path(evidence)
        self.evidence.mkdir(exist_ok=False, parents=True)
        self.transport = transport
        self.cleanup_seconds = cleanup_seconds
        self.lock = threading.RLock()
        self.terminal = None
        self.launch = None
        self.children = []
        self.changed = threading.Event()
        self.started = threading.Event()
        self.cleanup_thread = None
        self.receipts = []

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
            if self.terminal:
                raise TerminalFailure(self.terminal['reason'])

    def remote(self, label, code, timeout=40):
        launch = label == 'sole-original-launch'
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
        if not launch:
            self.check()
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
    task['remote'] = task['c'].remote = session.remote
    def launch():
        try:
            task['owned_launch'](['task.py', 'launch'])
        except BaseException as error:
            session.fail(str(error))
    thread = threading.Thread(target=launch)
    thread.start()
    failed = False
    try:
        while not session.started.wait(.01):
            session.check()
        print('OWNED_LAUNCH_STARTED', flush=True)
        for line in __import__('sys').stdin:
            try:
                session.check()  # Before requested-* evidence, review publication or request.
                value = json.loads(line)
                command = json.dumps(value['command'])
                task['owned_command'](['task.py', 'command', command, value.get('review')])
                print(json.dumps(dict(commandComplete=True)), flush=True)
            except BaseException as error:
                failed = True
                session.fail(str(error))
                print(json.dumps(dict(error=str(error), noReplay=True)), flush=True)
    finally:
        session.close()
        thread.join(session.cleanup_seconds+.2)
        if thread.is_alive():
            raise TerminalFailure('launch caller did not settle at local cleanup cap')
    return int(failed or session.launch.process.returncode != 0)


if __name__ == '__main__':
    raise SystemExit(main())
