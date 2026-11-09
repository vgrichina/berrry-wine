"""Owned Q2 launch/request session. Offline import never launches anything.

Use --task fresh/control.py --task-sha256 SHA --evidence fresh/client.
The control caller is compiled from its actual launch/request branches, with
its transport replaced by the reviewed shared owner. Retain Popen(stdin=PIPE),
await OWNED_INPUT_READY, send {"start":true}, flush, and keep the writer open
through setup and command/review JSON lines. EOF revokes the run; it cannot
detach the caller. No allocation, retries, replay, route or remote custody claim.
Stage fresh run inputs and all production providers before a separate original.
"""
import argparse
import ast
import hashlib
import importlib.util
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('q2_owned_transport', ROOT/'tools/q3-native-launch-client.py')
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
Session, TerminalFailure = shared.Session, shared.TerminalFailure


def compose_task(task, expected_sha):
    source = Path(task).read_bytes()
    if hashlib.sha256(source).hexdigest() != expected_sha:
        raise ValueError('retained control SHA mismatch')
    tree = ast.parse(source, filename=str(task))
    mains = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main']
    if len(mains) != 1:
        raise ValueError('unique control main required')
    selected = {}
    branch = mains[0].body[1]
    while isinstance(branch, ast.If):
        for action in ('launch', 'request'):
            if ast.unparse(branch.test) == 'action == '+repr(action):
                selected[action] = branch.body
        branch = branch.orelse[0] if len(branch.orelse) == 1 else None
    if set(selected) != {'launch', 'request'}:
        raise ValueError('actual launch/request branches required')
    body = [n for n in tree.body if n is not mains[0] and not (
        isinstance(n, ast.If) and ast.unparse(n.test) == "__name__ == '__main__'")]
    namespace = {'__file__': str(Path(task).resolve()), '__name__': 'q2_owned_task'}
    exec(compile(ast.Module(body=body, type_ignores=[]), str(task), 'exec'), namespace)
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


class Caller:
    def __init__(self, task, evidence, transport, cancel_code=None):
        self.task = task
        self.session = Session(evidence, transport, launch_label='remote-launch', cancel_code=cancel_code)
        def remote(label, code, timeout=40):
            if label == 'remote-launch':
                before = '["python3",r+"/remote-parent.py"]'
                if code.count(before) != 1:
                    raise self.session.fail('actual remote parent call site changed')
                code = code.replace(before, '["python3",root+"/tools/quake2-native-launch-client.py","--remote-parent",r]')
            else:
                before = "require(r+'/transport.cjs')"
                tree = ast.parse(code)
                sites = [n for n in ast.walk(tree) if isinstance(n, ast.Constant)
                         and isinstance(n.value, str) and before in n.value]
                if len(sites) != 1 or sites[0].value.count(before) != 1:
                    raise self.session.fail('actual request transport call site changed')
                sites[0].value = sites[0].value.replace(before, "require("+json.dumps(str(task['ROOT']/'tools/quake2-native-transport.cjs'))+")")
                code = ast.unparse(tree)
            return dict(stdout=self.session.remote(label, code, timeout), exitCode=0)
        task['remote'] = task['t'].remote = remote

    def launch(self):
        self.session.check()
        return self.task['owned_launch'](['control.py', 'launch'])

    def request(self, value):
        # Before reading/publishing any review, requested-* record or command.
        self.session.check()
        try:
            return self.session.request(value, lambda: self.task['owned_request'](
                ['control.py', 'request', json.dumps(value['command']), value.get('review')]), prefix='request-')
        except BaseException as error:
            raise self.session.fail(str(error)) from error


def cancel_remote(run):
    """Sticky run-scoped revocation; also works before the parent is spawned."""
    run = Path(run).resolve()
    if run == ROOT/'scratch/runs/20261109-quake2-observed-guard-route-0105':
        raise ValueError('retained evidence is read-only')
    with (run/'caller-cancelled.json').open('a') as output:
        output.flush()
        os.fsync(output.fileno())
    # Wake an already spawned numbered ACK sender without fabricating an ACK.
    # Preserve an earlier runtime fault; this record explicitly names the caller.
    if (run/'original').is_dir():
        try:
            with (run/'original/first-failure.json').open('x') as output:
                json.dump(dict(at=time.time(), source='caller input revocation',
                               error='caller terminal; no replay', noReplay=True), output)
                output.flush()
                os.fsync(output.fileno())
        except FileExistsError:
            pass
    return dict(cancelPublished=True, remoteCustody='UNKNOWN')


def supervise_caller(run, command, deadline):
    """Cancel the actual supervisor, whose existing kernel owner drains children.

    Remote revocation is asynchronous; its marker forbids new bootstrap at the
    remote observation, not retroactively at the local stdin timestamp.
    """
    run = Path(run)
    cancelled = run/'caller-cancelled.json'
    if cancelled.exists():
        receipt = dict(prevented=True, children=[], remoteCustody='UNKNOWN')
    else:
        child = shared.Child(command, run, 'remote-supervisor', lambda _: None, lambda *_: None)
        due = time.monotonic()+max(0, deadline-time.time())
        while not child.waited.wait(.01):
            if cancelled.exists() or time.monotonic() >= due:
                # Send once; the supervisor's existing immutable cleanup cap
                # owns descendant retirement. Do not kill its reaper early.
                if child.process.poll() is None:
                    child.process.send_signal(signal.SIGTERM)
                child.waited.wait(max(0, due-time.monotonic()))
                break
        receipt = child.finish(due, terminate=not child.waited.is_set())
    (run/'caller-parent-wait.json').write_text(json.dumps(receipt))
    return receipt


def remote_parent(run):
    """Retain actual launch.py custody, selecting the production consumer preload."""
    run = Path(run).resolve()
    retained = ROOT/'scratch/runs/20261109-quake2-observed-guard-route-0105'
    if run == retained:
        raise ValueError('retained evidence is read-only')
    os.environ['QUAKE2_NATIVE_RUN'] = str(run)
    if os.environ.get('QUAKE2_CURRENT_BROWSER_COMPOSITION') == '1':
        if os.environ.get('QUAKE2_NATIVE_COMPOSITION') == '1':
            raise ValueError('use only the versioned Q2 browser preload')
        if os.environ.get('QUAKE2_BROWSER_POLICY_VERSION') != 'quake2-current-primary-3e491c08-v1':
            raise ValueError('explicit Q2 browser policy version required')
        preload = 'tools/quake2-current-browser-policy.cjs'
    else:
        os.environ['QUAKE2_NATIVE_COMPOSITION'] = '1'
        preload = 'tools/quake2-native-driver-composition.cjs'
    command = ['node', '--require', str(ROOT/preload), str(retained/'browser-run.cjs')]
    deadline = json.loads((run/'lifecycle.json').read_text())['browserDeadline']/1000+30
    receipt = supervise_caller(run, [sys.executable, str(retained/'launch.py'), '--consumer-control',
                               str(run), json.dumps(command)], deadline)
    print(json.dumps(receipt), flush=True)
    return receipt.get('status', 1) if receipt.get('actualWait') and receipt.get('stdioEOF') else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', type=Path)
    parser.add_argument('--task-sha256')
    parser.add_argument('--evidence', type=Path)
    parser.add_argument('--remote-parent', type=Path)
    parser.add_argument('--cancel-remote', type=Path)
    args = parser.parse_args()
    if args.remote_parent:
        return remote_parent(args.remote_parent)
    if args.cancel_remote:
        print(json.dumps(cancel_remote(args.cancel_remote)), flush=True)
        return 0
    if not all((args.task, args.task_sha256, args.evidence)):
        parser.error('task, task-sha256 and evidence required')
    task = compose_task(args.task, args.task_sha256)
    # ROOT is the remote staged root in control.py, not this local checkout.
    task['ROOT'] = Path(task['REMOTE'])
    cancel_code = 'import runpy,json;m=runpy.run_path('+repr(str(task['ROOT']/'tools/quake2-native-launch-client.py'))+');print(json.dumps(m["cancel_remote"]('+repr(str(task['ROOT']/task['RUN']))+')))'
    caller = Caller(task, args.evidence, lambda code, timeout: [
        'boat', '--no-update', '--json', 'exec', task['t'].box_id(), '--timeout', str(timeout),
        '--', 'python3', '-c', code], cancel_code=cancel_code)
    return shared.run_input(caller.session, caller.launch, caller.request)


if __name__ == '__main__':
    raise SystemExit(main())
