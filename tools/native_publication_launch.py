#!/usr/bin/env python3
"""Pinned custody CLI. Options precede --; command arguments are never shell text.

python3 tools/native_publication_launch.py RUN [--journal-gzip]
    [--publication-observer=d54aa57e3] [--max-records=N] [--max-bytes=N] -- EXE ARGS...
RUN/lifecycle.json supplies the original browserDeadline (milliseconds).
An independent external deadline watchdog remains required by the collector.
"""
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import shutil
import sys
import time
import types
import zlib

VERSION = 'd54aa57e3'
HELPER_SHA = '6be7149c7dfd6b190f65c19ebdc8fa1d91c26c2cd13c9a5d15917b08347ba060'
COLLECTOR_SHA = '3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_providers():
    """Verify bytes before executing either provider; never trust cached imports."""
    root = Path(__file__).resolve().parent
    helper_bytes = (root/'native_publication_observer.py').read_bytes()
    collector_bytes = (root/'native_kernel_custody.py').read_bytes()
    if sha(helper_bytes) != HELPER_SHA or sha(collector_bytes) != COLLECTOR_SHA:
        raise ValueError('published helper/collector drift; refusing before spawn')
    helper = types.ModuleType('native_publication_observer')
    helper.__file__ = str(root/'native_publication_observer.py')
    exec(compile(helper_bytes, helper.__file__, 'exec'), helper.__dict__)
    return helper, collector_bytes.decode('utf-8')


def artifact(path):
    """Read gzip through its trailer (CRC/ISIZE); empty evidence is INVALID."""
    raw = path.read_bytes()
    result = dict(path=path.name, bytes=len(raw), sha256=sha(raw), valid=False)
    try:
        data = gzip.decompress(raw) if path.suffix == '.gz' else raw
        result.update(originalBytes=len(data), originalSha256=sha(data),
                      crc32='%08x' % zlib.crc32(data), gzipCRCChecked=path.suffix == '.gz',
                      valid=bool(data), error=None if data else 'empty evidence INVALID')
    except (OSError, EOFError, zlib.error) as error:
        result['error'] = str(error)
    return result


def validate_run(run, helper, enabled):
    """Integrity, custody drain and observer completeness are separate results."""
    drain = json.loads((run/'kernel-drain.json').read_text())
    journal = drain['journal']
    custody_path = run/journal['path']
    custody_info = artifact(custody_path)
    data = custody_path.read_bytes()
    if custody_path.suffix == '.gz': data = gzip.decompress(data)
    rows = [json.loads(line) for line in data.splitlines()]
    if not rows or [r['sequence'] for r in rows] != list(range(1, len(rows)+1)):
        raise ValueError('invalid custody sequence')
    if sha(data) != journal['originalSha256'] or len(data) != journal['originalBytes']:
        raise ValueError('custody journal digest mismatch')
    by_sequence = {r['sequence']: r for r in rows}
    for receipt in drain['reaped']:
        row = by_sequence[receipt['sequence']]
        if (row['kind'], row['pid'], row['start'], row['status']) != (
                'reaped', receipt['pid'], receipt['start'], receipt['status']):
            raise ValueError('reap receipt mismatch')
    command_path = run/'kernel-command.log'
    command_info = artifact(command_path)
    result = dict(custodyIntegrity=custody_info, commandLog=command_info,
                  custodyComplete=drain['complete'], actualRootExit=drain['exit'],
                  outputEOF=drain['commandLog']['eof'] if drain['commandLog'] else None,
                  observerEnabled=enabled, readiness='UNKNOWN', publication='UNKNOWN')
    if enabled:
        path = run/'publication-syscalls.ndjson'
        observer_data = path.read_bytes()
        records = helper.validate(observer_data)
        begin, footer = records[0], records[-1]
        if (len(records) > begin['maxRecords'] or len(observer_data) > begin['maxBytes'] or
                type(footer.get('complete')) is not bool or
                not isinstance(footer.get('incompleteReasons'), list) or
                footer['complete'] != (not footer['incompleteReasons']) or
                footer.get('observationOnly') is not True):
            raise ValueError('invalid observer footer/bounds')
        for row in records:
            if row['kind'] not in ('entry', 'return'): continue
            wait = by_sequence[row['waitSequence']]
            custody = by_sequence[row['custodySequence']]
            if (wait['kind'], wait['pid'], wait['start'], wait.get('waitStatus')) != (
                    'wait-consumed', row['pid'], row['start'], row['waitStatus']):
                raise ValueError('observer wait mismatch')
            if (custody['kind'], custody['pid'], custody['start']) != ('custody', row['pid'], row['start']):
                raise ValueError('observer custody mismatch')
            raw = bytes.fromhex(row['rawHex'])
            field = int.from_bytes(raw[24:32], 'little', signed=row['kind'] == 'return')
            if field != row['nr' if row['kind'] == 'entry' else 'result']:
                raise ValueError('observer raw syscall mismatch')
        result.update(observerIntegrity=artifact(path), observerComplete=records[-1]['complete'],
                      observerIncompleteReasons=records[-1]['incompleteReasons'])
    return result


def launch(argv):
    if not argv: raise ValueError(__doc__)
    run = Path(argv[0]).resolve()
    args = list(argv[1:]); enabled = False; compression = None
    records, byte_limit = 4096, 4*1024*1024
    # Like the original collector, an unrecognised first word starts the command.
    while args and args[0].startswith('--'):
        option = args.pop(0)
        if option == '--': break
        if option == '--journal-gzip': compression = 'gzip'
        elif option.startswith('--publication-observer='):
            if option.split('=', 1)[1] != VERSION: raise ValueError('unknown observer version')
            enabled = True
        elif option.startswith('--max-records='): records = int(option.split('=', 1)[1])
        elif option.startswith('--max-bytes='): byte_limit = int(option.split('=', 1)[1])
        else: raise ValueError('unknown launcher option: '+option)
    if not args: raise ValueError('missing executable command')
    if not 2 <= records <= 65536 or not 4096 <= byte_limit <= 64*1024*1024:
        raise ValueError('invalid observer bounds')
    if not enabled and (records != 4096 or byte_limit != 4*1024*1024):
        raise ValueError('observer bounds require explicit versioned opt-in')
    helper, source = load_providers()
    if enabled and (sys.platform != 'linux' or platform.machine() != 'x86_64'):
        raise ValueError('observer requires Linux x86_64')
    life = json.loads((run/'lifecycle.json').read_text())
    deadline = life['browserDeadline']/1000
    if not math.isfinite(deadline) or not time.time() < deadline:
        raise ValueError('expired or invalid original browserDeadline')
    executable = shutil.which(args[0])
    # Refuse accidental reuse before the original collector could truncate evidence.
    for name in ('custody.ndjson', 'custody.ndjson.gz', 'kernel-armed.json', 'kernel-drain.json',
                 'kernel-command.log', 'publication-syscalls.ndjson', 'publication-launch.json'):
        if (run/name).exists(): raise ValueError('run already contains custody evidence: '+name)
    transformed = helper.candidate(source, enabled=enabled, max_records=records, max_bytes=byte_limit)
    code = compile(transformed, '<published-custody-'+COLLECTOR_SHA+'>', 'exec')
    collector = types.ModuleType('publication_launch_custody')
    exec(code, collector.__dict__)
    metadata = dict(command=args, executable=str(Path(executable).resolve()) if executable else None,
                    executableSha256=sha(Path(executable).read_bytes()) if executable else None, callerArgv=sys.argv,
                    callerPid=os.getpid(), callerParent=os.getppid(),
                    launcherSha256=sha(Path(__file__).read_bytes()),
                    lifecycleSha256=sha((run/'lifecycle.json').read_bytes()),
                    executableBytes=Path(executable).stat().st_size if executable else None, python=sys.version,
                    pythonExecutable=sys.executable, platform=platform.platform(),
                    helperVersion=VERSION, helperSha256=HELPER_SHA, collectorSha256=COLLECTOR_SHA,
                    candidateSha256=sha(transformed.encode()), observerEnabled=enabled,
                    browserDeadline=life['browserDeadline'], cleanupDeadline=(deadline+30)*1000,
                    journalCompression=compression, commandCompression=None)
    (run/'publication-launch.json').write_text(json.dumps(metadata, indent=2))
    previous = sys.modules.get('native_publication_observer')
    sys.modules['native_publication_observer'] = helper
    failure = None
    try:
        collector.supervise(run, args, deadline=deadline, cleanup_deadline=deadline+30,
                            journal_compression=compression)
    except BaseException as error:
        failure = error
    finally:
        if previous is None: sys.modules.pop('native_publication_observer', None)
        else: sys.modules['native_publication_observer'] = previous
    try:
        report = validate_run(run, helper, enabled)
    except Exception as error:
        report = dict(validationError=repr(error), readiness='UNKNOWN', publication='UNKNOWN')
        if failure is None: failure = error
    report['collectorFailure'] = repr(failure) if failure else None
    (run/'publication-validation.json').write_text(json.dumps(report, indent=2))
    if failure is not None: raise failure
    return 0


if __name__ == '__main__':
    try: sys.exit(launch(sys.argv[1:]))
    except Exception as error:
        print(type(error).__name__+': '+str(error), file=sys.stderr)
        sys.exit(1)
