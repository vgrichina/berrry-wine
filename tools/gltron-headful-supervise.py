#!/usr/bin/env python3
"""Bound a single private local native fixture. No game launch or input."""
import ctypes, json, os, pathlib, signal, subprocess, sys, time


def write(path, value):
    with open(path, 'x') as f:
        json.dump(value, f, indent=2)
        f.write('\n')


def token(pid):
    try:
        return pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    except FileNotFoundError:
        return None


def watchdog(pid, start, deadline, stop, armed):
    write(armed, dict(pid=os.getpid(), target=pid, startToken=start, deadline=deadline, at=time.time(), independent=True))
    print('ARMED', flush=True)
    while time.monotonic() < deadline:
        if pathlib.Path(stop).exists():
            print('DISARMED', flush=True)
            return
        time.sleep(.02)
    if token(pid) == start:
        print('DEADLINE SIGTERM', flush=True)
        os.killpg(pid, signal.SIGTERM)
        time.sleep(2)
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def run(out):
    out = pathlib.Path(out).resolve()
    assert not out.exists(), 'unique run required'
    base = str(out)
    ctypes.CDLL(None).prctl(36, 1, 0, 0, 0)  # subreaper for our own descendants
    gate, stop = base+'-gate', base+'-stop'
    env = dict(os.environ, GLTRON_HEADFUL_GATE=gate)
    started = time.time()
    node = subprocess.Popen(['node', 'test/test-gltron-headful-current-capture.cjs', '--native', base], env=env, start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    limit = time.monotonic()+120
    wd = subprocess.Popen([sys.executable, __file__, '--watchdog', str(node.pid), token(node.pid), str(limit), stop, base+'-watchdog-armed.json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert wd.stdout.readline() == b'ARMED\n'
    write(base+'-launch.json', dict(pid=node.pid, startToken=token(node.pid), watchdog=wd.pid, startedAt=started, monotonicDeadline=limit, gateReleasedAfterACK=True))
    pathlib.Path(gate).touch(exist_ok=False)
    stdout, stderr = node.communicate()
    pathlib.Path(base+'-stdout.log').write_bytes(stdout)
    pathlib.Path(base+'-stderr.log').write_bytes(stderr)
    write(base+'-wait.json', dict(pid=node.pid, code=node.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, startedAt=started, waitedAt=time.time()))
    pathlib.Path(stop).touch(exist_ok=False)
    wo, we = wd.communicate()
    write(base+'-watchdog-wait.json', dict(pid=wd.pid, code=wd.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, stdout='ARMED\n'+wo.decode(), stderr=we.decode()))
    # Reap adopted, already-exited grandchildren. No system-wide process action.
    adopted=[]
    while True:
        try:
            pid, status=os.waitpid(-1, os.WNOHANG)
            if not pid:
                break
            adopted.append(dict(pid=pid, status=status, actualWait=True))
        except ChildProcessError:
            break
    write(base+'-adopted-waits.json', adopted)
    pathlib.Path(gate).unlink()
    pathlib.Path(stop).unlink()
    return node.returncode


if __name__ == '__main__':
    if sys.argv[1] == '--watchdog':
        watchdog(int(sys.argv[2]), sys.argv[3], float(sys.argv[4]), *sys.argv[5:])
    else:
        sys.exit(run(sys.argv[1]))
