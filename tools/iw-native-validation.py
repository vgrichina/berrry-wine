#!/usr/bin/env python3
"""Bounded serial native validation; run only after external sole-lane grant."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import uuid

HEAD = '17e713cd2ceab10b9b31e4d6d6448b120c3fd43f'
OLD_SHA = '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'
SUITES = [
    ('scoped', 'test-scoped-dll-native.js', 90),
    ('same-module', 'test-dll-same-module-concurrent.js', 90),
    ('mapping', 'test-dll-concurrent-mapping.js', 90),
    ('races', 'test-dll-lifecycle-races.js', 90),
    ('worker', 'test-dll-worker-message-lifecycle.js', 90),
    ('imports', 'test-dll-import-graph-lifecycle.js', 90),
    ('terminal', 'test-dll-terminal-lifecycle.js', 180),
    ('process-send', 'test-process-send-runtime.js', 180),
]

def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()

def snapshot(root):
    names = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode().split('\0')
    return {name: digest(root / name) for name in names if name}

def tagged(marker):
    result = []
    needle = ('WA_IW_VALIDATION=' + marker).encode()
    for entry in Path('/proc').iterdir():
        if entry.name.isdigit() and int(entry.name) != os.getpid():
            try:
                if needle in (entry / 'environ').read_bytes().split(b'\0'):
                    result.append(int(entry.name))
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                pass
    return result

def cleanup(marker):
    found = tagged(marker)
    for pid in found:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    for _ in range(20):
        remaining = tagged(marker)
        if not remaining:
            return found, []
        time.sleep(.1)
    return found, remaining

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--grant', required=True, help='Explicit sole-runtime grant reference')
    args = parser.parse_args()
    root, out = args.root.resolve(), args.out.resolve()
    if git(root, 'rev-parse', 'HEAD') != HEAD:
        raise RuntimeError('candidate HEAD differs')
    if git(root, 'status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('candidate tracked source is dirty')
    if (root / 'build/wine-assembly.wasm').exists():
        raise RuntimeError('fresh isolated build directory required; never overwrite donor')
    out.mkdir(parents=True, exist_ok=False)
    marker = uuid.uuid4().hex
    before = snapshot(root)
    env = dict(os.environ, WA_IW_VALIDATION=marker)
    for key in list(env):
        if key.startswith('WINE_') or key in ('NODE_OPTIONS', 'WA_TEST_WASM'):
            del env[key]
    env['WA_TEST_WASM'] = str(root / 'build/wine-assembly.wasm')
    start = time.monotonic()
    report = dict(head=HEAD, grant=args.grant, node=subprocess.check_output(['node', '--version']).decode().strip(),
                  started=time.time(), marker=marker, stages=[], passed=False)
    def save(name, data):
        (out / name).write_text(json.dumps(data, indent=2) + '\n')
    save('source-pre.json', before)
    def run(name, command, budget):
        remaining = 1200 - (time.monotonic() - start)
        if remaining < budget + 10:
            raise RuntimeError('total budget cannot admit full ' + name + ' stage')
        if tagged(marker):
            raise RuntimeError('prior stage survivor')
        launched = time.time()
        with (out / (name + '.log')).open('wb') as log:
            child = subprocess.Popen(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT,
                                     start_new_session=True)
            timed_out = False
            try:
                code = child.wait(timeout=budget)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(child.pid, signal.SIGKILL)
                code = child.wait(timeout=5)
        killed, survivors = cleanup(marker)
        report['stages'].append(dict(name=name, command=command, pid=child.pid, started=launched,
                                     finished=time.time(), code=code, timedOut=timed_out,
                                     killed=killed, survivors=survivors))
        save('result.json', report)
        if code != 0 or timed_out or killed or survivors:
            raise RuntimeError(name + ' failed or left descendants; stop on first failure')
        if snapshot(root) != before:
            raise RuntimeError('tracked source changed during ' + name)
    try:
        run('build', ['bash', 'tools/build.sh'], 600)
        module = root / 'build/wine-assembly.wasm'
        if module.is_symlink() or module.resolve().parent != root / 'build':
            raise RuntimeError('module must be physical inside isolated build')
        module_sha = digest(module)
        report['module'] = dict(path=str(module), size=module.stat().st_size, sha256=module_sha)
        if module_sha == OLD_SHA:
            raise RuntimeError('unexpected historical module after changed native source')
        save('result.json', report)
        for name, test, budget in SUITES:
            run(name, ['node', 'test/' + test], budget)
            if digest(module) != module_sha:
                raise RuntimeError('canonical physical module changed during ' + name)
        report['passed'] = True
    except BaseException as error:
        report['error'] = str(error)
        raise
    finally:
        report['cleanupKilled'], report['survivors'] = cleanup(marker)
        after = snapshot(root)
        save('source-post.json', after)
        report['sourceUnchanged'] = before == after
        report['finished'] = time.time()
        report['elapsedSeconds'] = time.monotonic() - start
        report['passed'] = report['passed'] and before == after and not report['survivors']
        save('result.json', report)

if __name__ == '__main__':
    main()
