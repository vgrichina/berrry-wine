#!/usr/bin/env python3
"""One-shot Linux supervisor: real waits/pipe EOF, token scope and pinned pidfds.

TERM records intent without throwing across Popen's pending startup window.
All acquired children belong to one cleanup path. No process-group signalling.
"""
import json, os, pathlib, selectors, signal, subprocess, sys, time


def write(path, value):
    path = pathlib.Path(path)
    pending = path.with_suffix(path.suffix + '.pending')
    pending.write_text(json.dumps(value, indent=2) + '\n')
    pending.replace(path)


def identity(pid):
    s = pathlib.Path(f'/proc/{pid}/stat').read_text()
    fields = s[s.rindex(')') + 2:].split()
    return fields[19], fields[0]


def signal_owned(pid, token, sig, expected=None):
    """Verify scope after pinning identity; never signal a reused numeric PID."""
    if pid == os.getpid():
        return False
    fd = None
    try:
        before, state = identity(pid)
        if state == 'Z' or (expected is not None and before != expected):
            return False
        fd = os.pidfd_open(pid)
        env = pathlib.Path(f'/proc/{pid}/environ').read_bytes().split(b'\0')
        after, state = identity(pid)
        if before != after or state == 'Z' or ('BOIDS_CURRENT_TOKEN=' + token).encode() not in env:
            return False
        signal.pidfd_send_signal(fd, sig)
        return True
    except (ProcessLookupError, FileNotFoundError):
        return False
    finally:
        if fd is not None:
            os.close(fd)


def scoped(token, sig=None):
    found = []
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit() or int(path.name) == os.getpid():
            continue
        try:
            start, state = identity(int(path.name))
            if state != 'Z' and ('BOIDS_CURRENT_TOKEN=' + token).encode() in (path / 'environ').read_bytes().split(b'\0'):
                row = dict(pid=int(path.name), startToken=start)
                if sig is not None:
                    row.update(sent=signal_owned(row['pid'], token, sig, start), signal=int(sig))
                found.append(row)
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return found


def watchdog(out, token, seconds, phase):
    out = pathlib.Path(out)
    end = time.monotonic() + float(seconds)
    write(out / (phase + '-watchdog-armed.json'), dict(pid=os.getpid(), armedAt=time.time(), seconds=float(seconds), independent=True))
    while time.monotonic() < end:
        if (out / (phase + '-watchdog-cancel')).exists():
            write(out / (phase + '-watchdog-result.json'), dict(fired=False, cancelledAt=time.time()))
            return
        time.sleep(.02)
    sent = []
    until = time.monotonic() + .5
    while time.monotonic() < until:
        sent.extend(scoped(token, signal.SIGKILL))
        time.sleep(.02)
    write(out / (phase + '-watchdog-result.json'), dict(fired=True, signals=sent, endedAt=time.time()))


class Capture:
    def __init__(self, process, out, prefix):
        self.process = process
        self.selector = selectors.DefaultSelector()
        self.eof = dict(stdout=False, stderr=False)
        self.eof_at, self.bytes = {}, dict(stdout=0, stderr=0)
        self.files = {}
        self.errors = []
        for name in self.eof:
            pipe = getattr(process, name)
            os.set_blocking(pipe.fileno(), False)
            self.selector.register(pipe, selectors.EVENT_READ, name)
            try:
                self.files[name] = (out / (prefix + name + '.log')).open('wb')
            except OSError as exc:
                self.errors.append(repr(exc))
                self.files[name] = open(os.devnull, 'wb')

    def pump(self):
        for key, _ in self.selector.select(0):
            try:
                data = os.read(key.fileobj.fileno(), 65536)
                if data:
                    self.bytes[key.data] += len(data)
                    try:
                        self.files[key.data].write(data)
                    except OSError as exc:
                        self.errors.append(repr(exc))
                        self.files[key.data].close()
                        self.files[key.data] = open(os.devnull, 'wb')
                else:
                    self.eof[key.data] = True
                    self.eof_at[key.data] = time.time()
                    self.selector.unregister(key.fileobj)
                    key.fileobj.close()
            except BlockingIOError:
                pass

    def close(self):
        for key in list(self.selector.get_map().values()):
            key.fileobj.close()
        self.selector.close()
        for f in self.files.values():
            try:
                f.close()
            except OSError as exc:
                self.errors.append(repr(exc))


class Supervisor:
    def __init__(self, out, command, preparation=240, runtime=300,
                 preparation_watchdog=260, runtime_watchdog=320, grace=5):
        self.out, self.command = pathlib.Path(out), command
        self.preparation, self.runtime, self.grace = preparation, runtime, grace
        self.watch_seconds = dict(preparation=preparation_watchdog, runtime=runtime_watchdog)
        self.token = os.urandom(32).hex()
        self.native = None
        self.watches, self.captures, self.signals, self.actions = [], [], [], []
        self.phase, self.error, self.timed, self.cleaned = 'preparation', None, False, False

    def requested(self, signum, frame):
        if len(self.signals) < 16:
            self.signals.append(dict(signal=signum, at=time.time()))

    def pump(self):
        for c in self.captures:
            c.pump()
        time.sleep(.01)

    def spawn(self, command, prefix, env):
        p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             env=env, start_new_session=True)
        # Register before any subsequent fallible operation.
        if prefix == '':
            self.native = p
        else:
            self.watches.append((self.phase, p))
        self.captures.append(Capture(p, self.out, prefix))
        write(self.out / (prefix + 'process.json'), dict(pid=p.pid, startToken=identity(p.pid)[0]))
        if self.captures[-1].errors:
            raise RuntimeError('pipe log open failed: ' + repr(self.captures[-1].errors))
        return p

    def arm(self):
        env = dict(os.environ)
        env.pop('BOIDS_CURRENT_TOKEN', None)
        p = self.spawn([sys.executable, '-B', str(pathlib.Path(__file__).resolve()),
                       'watchdog', str(self.out), self.token,
                       str(self.watch_seconds[self.phase]), self.phase], self.phase + '-watchdog-', env)
        end = time.monotonic() + 5
        armed = self.out / (self.phase + '-watchdog-armed.json')
        while not armed.exists():
            if self.signals:
                return False
            if p.poll() is not None or time.monotonic() >= end:
                raise RuntimeError(self.phase + ' watchdog did not arm')
            self.pump()
        if json.loads(armed.read_text())['pid'] != p.pid:
            raise RuntimeError('watchdog identity mismatch')
        return True

    def cleanup(self):
        if self.cleaned:
            raise RuntimeError('duplicate cleanup')
        self.cleaned = True
        end = time.monotonic() + self.grace
        while True:
            self.actions.extend(scoped(self.token, signal.SIGTERM if time.monotonic() < end else signal.SIGKILL))
            self.pump()
            c = next((c for c in self.captures if c.process is self.native), None)
            if (self.native is None or self.native.poll() is not None) and (c is None or all(c.eof.values())) and not scoped(self.token):
                break
            if time.monotonic() >= end + 5:
                self.error = self.error or 'native cleanup wait/EOF deadline'
                break
        native_wait = None
        if self.native is not None:
            try:
                rc = self.native.wait(timeout=.1)
                native_wait = dict(pid=self.native.pid, returncode=rc, signal=-rc if rc < 0 else None, actualWait=True, waitedAt=time.time())
            except subprocess.TimeoutExpired:
                native_wait = dict(pid=self.native.pid, returncode=None, actualWait=False)
        # Independent deadlines stay armed until native wait AND observed EOF.
        native_closed = (self.native is None or bool(native_wait and native_wait['actualWait'] and c and all(c.eof.values()))) and not scoped(self.token)
        if native_closed:
            for phase, _ in self.watches:
                (self.out / (phase + '-watchdog-cancel')).touch()
        waits = []
        for phase, p in self.watches:
            due = time.monotonic() + (6 if native_closed else self.watch_seconds[phase] + 2)
            while p.poll() is None and time.monotonic() < due:
                self.pump()
            if p.poll() is None:
                p.kill()  # unreaped direct child; its PID cannot have been reused
                self.error = self.error or 'watchdog join deadline'
            try:
                waits.append(dict(phase=phase, pid=p.pid, returncode=p.wait(timeout=1), actualWait=True, waitedAt=time.time()))
            except subprocess.TimeoutExpired:
                waits.append(dict(phase=phase, pid=p.pid, returncode=None, actualWait=False))
        due = time.monotonic() + 1
        while not all(all(c.eof.values()) for c in self.captures) and time.monotonic() < due:
            self.pump()
        for c in self.captures:
            c.close()
            if c.errors:
                self.error = self.error or 'pipe capture error: ' + repr(c.errors)
        for row in waits:
            c = next((c for c in self.captures if c.process.pid == row['pid']), None)
            row.update(stdoutEOF=c.eof['stdout'] if c else None, stderrEOF=c.eof['stderr'] if c else None)
            row.update(pipeBytes=c.bytes if c else None, eofAt=c.eof_at if c else None)
            result = self.out / (row['phase'] + '-watchdog-result.json')
            row['result'] = json.loads(result.read_text()) if result.exists() else None
            write(self.out / (row['phase'] + '-wait.json'), row)
        c = next((c for c in self.captures if c.process is self.native), None)
        last = waits[-1] if waits else {}
        rc = native_wait['returncode'] if native_wait else None
        remaining = scoped(self.token)
        failed = (self.error or not native_wait or not native_wait['actualWait'] or
                  not all(x['actualWait'] and x['returncode'] == 0 and x['stdoutEOF'] and x['stderrEOF'] and x['result'] is not None for x in waits) or
                  not c or not all(c.eof.values()) or remaining)
        self.exit = (128 + self.signals[0]['signal'] if self.signals else 124 if self.timed else 1 if self.error else
                     (128 - rc if rc < 0 else rc) if rc else 1 if failed else 0)
        write(self.out / 'wait.json', dict(pid=self.native.pid if self.native else None, returncode=rc,
              nativeWait=native_wait, actualWait=bool(native_wait and native_wait['actualWait']), timedOut=self.timed,
              phase=self.phase, stdoutEOF=c.eof['stdout'] if c else None, stderrEOF=c.eof['stderr'] if c else None,
              pipeBytes=c.bytes if c else None, eofAt=c.eof_at if c else None,
              watchdogs=waits, watchdogReturncode=last.get('returncode'), watchdogStdoutEOF=last.get('stdoutEOF'),
              watchdogStderrEOF=last.get('stderrEOF'), signals=self.signals, error=self.error, cleanupCount=1,
              cleanupSignals=self.actions, remainingAfterRuntime=remaining, supervisorExitCode=self.exit,
              cause='signal request' if self.signals else 'native deadline' if self.timed else 'supervisor error' if self.error else 'native completion', endedAt=time.time()))

    def run(self):
        self.out.mkdir(parents=True, exist_ok=False)
        old = {s: signal.signal(s, self.requested) for s in (signal.SIGTERM, signal.SIGINT)}
        try:
            # Fail before launching children if this kernel cannot pin processes.
            fd = os.pidfd_open(os.getpid())
            try:
                signal.pidfd_send_signal(fd, 0)
            finally:
                os.close(fd)
            write(self.out / 'supervisor-identity.json', dict(pid=os.getpid(), startToken=identity(os.getpid())[0], token=self.token))
            if self.arm() and not self.signals:
                p = self.spawn(self.command, '', dict(os.environ, BOIDS_CURRENT_TOKEN=self.token))
                end = time.monotonic() + self.preparation
                write(self.out / 'preparation-armed.json', dict(pid=p.pid, watchdogPid=self.watches[-1][1].pid, seconds=self.preparation, startedAt=time.time()))
                while not (self.out / 'prepared.json').exists() and p.poll() is None and not self.signals and time.monotonic() < end:
                    if self.watches[-1][1].poll() is not None:
                        raise RuntimeError('preparation watchdog exited before native completion')
                    self.pump()
                self.timed = time.monotonic() >= end
                if p.poll() == 0 and not (self.out / 'prepared.json').exists():
                    raise RuntimeError('native exited before preparation')
                if (self.out / 'prepared.json').exists() and p.poll() is None and not self.signals and not self.timed:
                    self.phase = 'runtime'
                    if self.arm() and not self.signals:
                        (self.out / 'preparation-watchdog-cancel').touch()
                        started = time.time()
                        end = time.monotonic() + self.runtime
                        write(self.out / 'native-armed.json', dict(pid=p.pid, watchdogPid=self.watches[-1][1].pid, startedAt=started, seconds=self.runtime, deadline=started+self.runtime))
                        write(self.out / 'runtime-start.json', dict(deadline=int((started+self.runtime)*1000)))
                        while p.poll() is None and not self.signals and time.monotonic() < end:
                            if any(w.poll() not in (None, 0) for _, w in self.watches):
                                raise RuntimeError('watchdog failed during runtime')
                            if self.watches[-1][1].poll() == 0 and not (self.out / 'runtime-watchdog-result.json').exists():
                                raise RuntimeError('runtime watchdog exited without deadline/cancel receipt')
                            self.pump()
                        self.timed = time.monotonic() >= end
        except BaseException as exc:
            self.error = repr(exc)
        finally:
            try:
                self.cleanup()
            finally:
                for s, handler in old.items():
                    signal.signal(s, handler)
        return self.exit


def main():
    out, commit, backend, mode, *fixture = sys.argv[1:]
    return Supervisor(out, ['node', 'tools/boids-current-run.cjs', out, commit, backend, mode, *fixture]).run()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'watchdog':
        watchdog(*sys.argv[2:])
    else:
        sys.exit(main())
