"""Record waitable child identities durably before consuming their exit status.

Use from the sole reaper of a Linux subreaper. This closes the census-to-reap
race for direct/adopted waitable children; it does not discover intermediates
already reaped by another parent. Full fork history requires kernel custody.
"""
import json
import os
from pathlib import Path


def identity(pid):
    directory = Path('/proc') / str(pid)
    raw = (directory / 'stat').read_text()
    fields = raw[raw.rfind(')') + 2:].split()
    return dict(pid=pid, start=fields[19], ppid=int(fields[1]), state=fields[0],
                args=(directory / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace'))


def reap_exited_children(journal, register, *, waitid=os.waitid, waitpid=os.waitpid):
    """Peek, register, fsync identity, then reap that exact child; never wait live.

    register(row) must add the exact PID/start to the caller's ownership table.
    Any registration, identity-read or journal failure leaves the child waitable.
    The journal is append-only and retains both before-reap and consumed records.
    No competing waitpid/Popen.poll call may consume children in this process.
    """
    rows = []
    while True:
        try:
            peek = waitid(os.P_ALL, 0, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        except ChildProcessError:
            break
        if peek is None:
            break
        row = identity(peek.si_pid)
        if row['ppid'] != os.getpid():
            raise RuntimeError('waitable child belongs to another parent')
        register(dict(row))
        with Path(journal).open('a') as stream:
            def record(value):
                stream.write(json.dumps(value, sort_keys=True) + '\n')
                stream.flush()
                os.fsync(stream.fileno())
            record(dict(phase='before-reap', **row, siCode=peek.si_code, siStatus=peek.si_status))
            pid, status = waitpid(peek.si_pid, os.WNOHANG)
            if pid != peek.si_pid or not (os.WIFEXITED(status) or os.WIFSIGNALED(status)):
                raise RuntimeError('peek/consume mismatch; competing reaper or nonterminal child')
            result = dict(row, status=status)
            record(dict(phase='reaped', **result))
            rows.append(result)
    return rows
