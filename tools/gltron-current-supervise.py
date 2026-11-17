#!/usr/bin/env python3
"""Native GL lifecycle with process-scoped parent ownership on Linux.

PR_SET_PDEATHSIG belongs to the spawning *thread*. A command runner's transient
spawn thread can exit while its process is still alive. Replace that inherited
notification with a pinned parent-process pidfd; retain ordinary signal handling,
the existing independent deadlines, native waits and separate pipe EOFs.
"""
import argparse
import ctypes
import importlib.util
import json
import os
import pathlib
import select
import signal
import sys
import time

SPEC = importlib.util.spec_from_file_location('boids_lifecycle', pathlib.Path(__file__).with_name('boids-current-supervise.py'))
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
TOKEN_SCOPED = BASE.scoped
ACTIVE_SCOPE = None


class NativeSessionScope:
    """Pin explicitly owned Chrome descendants as well as the native token.

    Chrome rewrites environ. A kernel session inherited from our exclusively
    native child, exact browser binary and unique profile are
    independently verifiable. A foreign pipe holder in that session is excluded.
    Signal each pinned process separately; never broadcast to a process group.
    """
    def __init__(self, out, token):
        self.path = pathlib.Path(out) / 'native-session.json'
        self.token = token

    def rows(self, sig=None):
        if not self.path.exists():
            return []
        root = json.loads(self.path.read_text())
        try:
            if BASE.identity(root['pid'])[0] != root['startToken']:
                return []  # session leader PID has been reused
        except FileNotFoundError:
            pass  # original leader reaped; its session still owns descendants
        browser_path = self.path.with_name('browser-session.json')
        profile = ('--user-data-dir=' + str(self.path.parent.resolve() / 'profile')).encode()
        if not browser_path.exists():
            # Puppeteer detaches Chrome into its own session; Chrome rewrites
            # both environ and argv. Pin the actual direct child while its
            # kernel parent relation is still observable, before any signal.
            for p in pathlib.Path('/proc').iterdir():
                if not p.name.isdigit():
                    continue
                try:
                    pid = int(p.name)
                    fields = (p / 'stat').read_text().rsplit(')', 1)[1].split()
                    if int(fields[1]) != root['pid'] or os.getsid(pid) != pid:
                        continue
                    if (p / 'exe').resolve() != pathlib.Path('/opt/google/chrome/chrome') or profile not in (p / 'cmdline').read_bytes():
                        continue
                    before = BASE.identity(pid)[0]
                    fd = os.pidfd_open(pid)
                    try:
                        fields = (p / 'stat').read_text().rsplit(')', 1)[1].split()
                        if BASE.identity(pid)[0] != before or int(fields[1]) != root['pid'] or os.getsid(pid) != pid:
                            continue
                        candidate = browser_path.with_name(f'browser-session-{os.getpid()}.candidate')
                        BASE.write(candidate, dict(pid=pid, startToken=before, native=root, profile=profile.decode(), pinnedAt=time.time(), ownership='observed direct native child, exact Chrome/profile, own session'))
                        try:
                            os.link(candidate, browser_path)  # atomic first owner
                        except FileExistsError:
                            pass
                        finally:
                            candidate.unlink()
                    finally:
                        os.close(fd)
                    break
                except (FileNotFoundError, ProcessLookupError, PermissionError):
                    pass
        if not browser_path.exists():
            return []
        browser = json.loads(browser_path.read_text())
        try:
            if BASE.identity(browser['pid'])[0] != browser['startToken']:
                return []
        except FileNotFoundError:
            pass
        rows = []
        for p in pathlib.Path('/proc').iterdir():
            if not p.name.isdigit() or int(p.name) == os.getpid():
                continue
            fd = None
            try:
                pid = int(p.name)
                before, state = BASE.identity(pid)
                if state == 'Z' or int(before) < int(browser['startToken']) or os.getsid(pid) != browser['pid']:
                    continue
                if (p / 'exe').resolve() != pathlib.Path('/opt/google/chrome/chrome'):
                    continue
                fd = os.pidfd_open(pid)
                after, state = BASE.identity(pid)
                if before != after or state == 'Z' or os.getsid(pid) != browser['pid']:
                    continue
                row = dict(pid=pid, startToken=before, ownership='exact Chrome binary and pinned browser child session')
                if sig is not None:
                    signal.pidfd_send_signal(fd, sig)
                    row.update(sent=True, signal=int(sig))
                rows.append(row)
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                pass
            finally:
                if fd is not None:
                    os.close(fd)
        return rows


def scoped(token, sig=None):
    rows = []
    if ACTIVE_SCOPE is not None and ACTIVE_SCOPE.token == token:
        rows = ACTIVE_SCOPE.rows(sig)
    known = {r['pid'] for r in rows}
    rows.extend(r for r in TOKEN_SCOPED(token, sig) if r['pid'] not in known)
    return rows


BASE.scoped = scoped


class ParentProcessSupervisor(BASE.Supervisor):
    def spawn(self, command, prefix, env):
        # Existing arm() keeps all startup/deadline behavior. Substitute only
        # the watchdog entry point so its independent scope includes Chrome.
        if prefix.endswith('-watchdog-') and len(command) > 3 and command[3] == 'watchdog':
            command = list(command)
            command[2] = str(pathlib.Path(__file__).resolve())
        p = super().spawn(command, prefix, env)
        if prefix == '':
            assert os.getsid(p.pid) == p.pid
            BASE.write(self.out / 'native-session.json',
                       dict(pid=p.pid, startToken=BASE.identity(p.pid)[0], token=self.token))
        return p

    def run(self):
        global ACTIVE_SCOPE
        ACTIVE_SCOPE = NativeSessionScope(self.out, self.token)
        parent = os.getppid()
        fd = os.pidfd_open(parent)
        poll = select.poll()
        poll.register(fd, select.POLLIN)
        libc = ctypes.CDLL(None, use_errno=True)
        inherited = ctypes.c_int()
        if libc.prctl(2, ctypes.byref(inherited), 0, 0, 0) != 0:
            os.close(fd)
            raise OSError(ctypes.get_errno(), 'PR_GET_PDEATHSIG')
        # Do not silently change a caller's unrelated parent-death policy.
        if inherited.value not in (0, signal.SIGTERM):
            os.close(fd)
            raise RuntimeError('unsupported inherited parent-death signal')
        threads = []
        for task in pathlib.Path(f'/proc/{parent}/task').iterdir():
            try:
                if str(os.getpid()) in (task / 'children').read_text().split():
                    threads.append(int(task.name))
            except FileNotFoundError:
                pass
        self.parent_owner = dict(pid=parent, startToken=BASE.identity(parent)[0],
                                 spawningThreads=threads, inheritedPdeathsig=inherited.value,
                                 mechanism='pinned parent process pidfd', armedAt=time.time(),
                                 parentDeathObserved=False)
        # Pin and arm before retiring the unsafe thread-scoped notification.
        if libc.prctl(1, 0, 0, 0, 0) != 0:
            os.close(fd)
            raise OSError(ctypes.get_errno(), 'PR_SET_PDEATHSIG')
        self._parent_poll = poll
        BASE.write(self.out.with_name(self.out.name + '-parent-process-armed.json'), self.parent_owner)
        try:
            return super().run()
        finally:
            self.parent_owner['parentProcessAliveAtJoin'] = not bool(poll.poll(0))
            self.parent_owner['spawningThreadsAliveAtJoin'] = {
                str(t): pathlib.Path(f'/proc/{parent}/task/{t}').exists() for t in threads}
            os.close(fd)
            BASE.write(self.out / 'parent-process-owner.json', self.parent_owner)

    def pump(self):
        # Observe ownership while the native parent is alive. This is OS
        # lifecycle observation only; it sends no browser or guest request.
        if not (self.out / 'browser-session.json').exists():
            ACTIVE_SCOPE.rows()
        if self._parent_poll.poll(0) and not self.parent_owner['parentDeathObserved']:
            self.parent_owner.update(parentDeathObserved=True, observedAt=time.time())
            self.requested(signal.SIGTERM, None)
        super().pump()


def main():
    global ACTIVE_SCOPE
    if len(sys.argv) > 1 and sys.argv[1] == 'watchdog':
        out, token, seconds, phase = sys.argv[2:]
        ACTIVE_SCOPE = NativeSessionScope(out, token)
        BASE.watchdog(out, token, seconds, phase)
        return 0
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('out')
    parser.add_argument('commit')
    args = parser.parse_args()
    return ParentProcessSupervisor(args.out, ['node', 'tools/gltron-current-native-capture.cjs',
                                   args.out, args.commit], runtime=300, runtime_watchdog=320).run()


if __name__ == '__main__':
    sys.exit(main())
