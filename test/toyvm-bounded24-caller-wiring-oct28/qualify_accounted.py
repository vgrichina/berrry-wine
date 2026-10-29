#!/usr/bin/env python3
"""Source-owned tiny-fixture caller. Browser qualification remains fail-closed."""
import argparse
import base64
import hashlib
import importlib.util
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
RECEIPT_SHA256 = '543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870'
BACKEND_PINS = {
    'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py': 'e45f6f6d1eaf24a06e92ffe2521ee4026fcc1cdccf22a15be4c7e99911424acb',
    'toyvm-kernel-profile-accounting-backend-oct28/confine.py': '0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8',
    'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py': 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105',
    'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py': '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85',
}
BROWSER_ALLOWANCE = dict(cpuSeconds=35.353183, wallSeconds=101.495550694, captures=1)
MAX_LIMITS = dict(live_limit=1048576, write_limit=1048576, file_limit=1048576,
                  rss_limit=128*1024**2, cpu_limit=90, wall_limit=120, output_limit=65536)


def load_backend():
    # Import only the accepted adapter. In particular, do not execute the pinned
    # supervisor as __main__: its top-level browser workload is not qualified.
    validated_sources = {}
    for relative, expected in BACKEND_PINS.items():
        path = ROOT / 'test' / relative
        source = path.read_bytes()
        if hashlib.sha256(source).hexdigest() != expected:
            raise RuntimeError('accepted backend identity mismatch: ' + relative)
        validated_sources[relative] = source
    relative = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
    path = ROOT / 'test' / relative
    spec = importlib.util.spec_from_file_location('accepted_accounted_adapter', path)
    module = importlib.util.module_from_spec(spec)
    # Execute the bytes just verified, never a cached pyc or a second file read.
    code = compile(validated_sources[relative], str(path), 'exec', dont_inherit=True)
    exec(code, module.__dict__)
    return module.supervise_accounted


def validate_receipt(path):
    data = pathlib.Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != RECEIPT_SHA256:
        raise ValueError('cancellation receipt identity mismatch')
    receipt = json.loads(data)
    runtime = receipt['runtime']
    if (receipt['task'] != 'toyvm-capture-cancellation-qualification-oct28'
            or receipt['tests']['browserExecutionAccepted'] is not False
            or runtime['remainingCPU'] != BROWSER_ALLOWANCE['cpuSeconds']
            or runtime['remainingWall'] != BROWSER_ALLOWANCE['wallSeconds']
            or runtime['capturesRemaining'] != BROWSER_ALLOWANCE['captures']):
        raise ValueError('cancellation receipt contract mismatch')


def filesystem_clean(cleanup):
    return (isinstance(cleanup, dict)
            and type(cleanup.get('remainingMounts')) is list
            and cleanup['remainingMounts'] == []
            and 'unmountExit' in cleanup
            and (cleanup['unmountExit'] is None
                 or (type(cleanup['unmountExit']) is int and cleanup['unmountExit'] == 0))
            and type(cleanup.get('serverExit')) is int
            and cleanup['serverExit'] in (0, -15))


def evaluate(result, limits):
    if not isinstance(result, dict):
        raise ValueError('missing authoritative backend receipt')
    failures = []
    fs = result.get('filesystem')
    accounting = isinstance(fs, dict)
    if accounting:
        for key, maximum in [('live', limits['live_limit']), ('peak', limits['live_limit']),
                             ('written', limits['write_limit'])]:
            value = fs.get(key)
            accounting = accounting and type(value) is int and 0 <= value <= maximum
        accounting = (accounting and 'failure' in fs and fs['failure'] is None
                      and type(fs.get('openHandles')) is int and fs['openHandles'] == 0)
    if not accounting:
        failures.append('authoritative filesystem receipt rejected')
    cleanup = result.get('cleanupComplete') is True and filesystem_clean(result.get('filesystemCleanup'))
    if not cleanup:
        failures.append('cleanup not established')
    if result.get('stopReason') is not None or 'stopReason' not in result:
        failures.append('supervisor stopped or stop receipt missing')
    for key, limit in [('cpuSeconds', 'cpu_limit'), ('wallSeconds', 'wall_limit'), ('peakRSS', 'rss_limit')]:
        value = result.get(key)
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= limits[limit]:
            failures.append('resource receipt rejected: ' + key)
    child = type(result.get('exit')) is int and result['exit'] == 0
    if not child:
        failures.append('child did not succeed')
    output = result.get('output')
    if not isinstance(output, bytes) or len(output) > limits['output_limit']:
        failures.append('output receipt rejected')
    retained = dict(result)
    if isinstance(output, bytes):
        retained['output'] = {'encoding': 'base64', 'data': base64.b64encode(output).decode('ascii')}
    return dict(accepted=not failures, childSucceeded=child, accountingAccepted=bool(accounting),
                cleanupComplete=cleanup, failures=failures, backendReceipt=retained)


def qualify(*, domain, receipt, command, work, **limits):
    report = dict(accepted=False, browserAllowed=False, browserAllowanceRemaining=dict(BROWSER_ALLOWANCE),
                  childSucceeded=False, accountingAccepted=False, cleanupComplete=False)
    try:
        # Domain is an explicit caller contract, not a guess from executable names.
        # The unchanged tiny-fixture confinement policy remains mandatory beneath it.
        if domain != 'tiny-fixture':
            raise ValueError('unqualified browser/domain: ' + domain)
        validate_receipt(receipt)
        if set(limits) != set(MAX_LIMITS):
            raise ValueError('all quota/resource limits must be explicit')
        for key, maximum in MAX_LIMITS.items():
            value = limits[key]
            integer = key not in ('cpu_limit', 'wall_limit')
            if (type(value) not in ((int,) if integer else (int, float))
                    or not math.isfinite(value) or not 0 < value <= maximum):
                raise ValueError('unsupported quota/resource limit: ' + key)
        if limits['file_limit'] > limits['live_limit']:
            raise ValueError('file quota exceeds live quota')
        if not command or not all(isinstance(x, str) and x and '\0' not in x for x in command):
            raise ValueError('nonempty argv command required')
        work = pathlib.Path(work)
        if not work.is_dir() or any(work.iterdir()):
            raise ValueError('fresh empty owned work directory required')
        backend = load_backend()
        result = backend(list(command), work, backend='synchronous-fuse', **limits)
        report.update(evaluate(result, limits))
    except Exception as error:
        report.update(accepted=False, error=type(error).__name__ + ': ' + str(error))
        cleanup = getattr(error, 'filesystemCleanup', None)
        if cleanup is not None:
            report['filesystemCleanup'] = cleanup
            report['filesystemCleanupComplete'] = filesystem_clean(cleanup)
        # An exception's unmount receipt alone does not prove child-tree reap.
        report['cleanupComplete'] = False
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--domain', required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--work', required=True)
    for name in MAX_LIMITS:
        parser.add_argument('--' + name.replace('_', '-'), required=True,
                            type=float if name in ('cpu_limit', 'wall_limit') else int)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    options = vars(parser.parse_args(argv))
    command = options.pop('command')
    options['command'] = command[1:] if command[:1] == ['--'] else command
    report = qualify(**options)
    print(json.dumps(report, sort_keys=True))
    return 0 if report['accepted'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
