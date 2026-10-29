#!/usr/bin/env python3
"""Independent ordinary-exception acceptance. Tiny synthetic files, no media.

Usage: python3 THIS.py PRODUCTION.py OWNED_OUTPUT
Stops on the first decisive rejection and retains its exact fixture/diagnostics.
Archive verification and objdump text are fixture substitutions for CLI checks;
main/analyze/publish_analysis and actual filesystem operations remain production.
"""
import contextlib
import errno
import hashlib
import importlib.util
import io
import json
import struct
import sys
import traceback
import zlib
from pathlib import Path
from unittest.mock import patch

SOURCE, OUT = map(Path, sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=False)
spec = importlib.util.spec_from_file_location('production', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
NAMES = ('inventory.json', 'closure.json')
results = []


def snapshot(root):
    return {n: (root/n).read_bytes() if (root/n).exists() else None for n in NAMES}


def fixture(root):
    (root/'extracted/app').mkdir(parents=True)
    data = bytearray(128)
    data[:2] = b'MZ'
    struct.pack_into('<I', data, 60, 64)
    data[64:68] = b'PE\0\0'
    struct.pack_into('<H', data, 68, 0x14c)
    struct.pack_into('<H', data, 88, 0x10b)
    (root/'extracted/app/gltron.exe').write_bytes(data)
    (root/'inno-list.txt').write_text(
        'Listing "GLtron version 0.70" - setup data version 2.0.18\n'
        f' - "app/gltron.exe" (128 B) Adler32 0x{zlib.adler32(data):08x}\nDone.\n')


def invoke(lane, root):
    if lane == 'api':
        return r.publish_analysis(root, {'new': 'inventory'}, {'new': 'closure'})
    with patch.object(sys, 'argv', [str(SOURCE), 'analyze', str(root/'original.exe')]), \
            patch.object(r, 'verify', return_value={'synthetic': True}), \
            patch.object(r, 'tool', return_value=' DLL Name: KERNEL32.dll\n'), \
            contextlib.redirect_stdout(io.StringIO()):
        return r.main()


def finish(accepted):
    receipt = dict(decision='ACCEPT' if accepted else 'REJECT',
                   source=str(SOURCE), sourceSHA256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                   scope='single writer, ordinary exceptions; no crash/concurrent-reader guarantee',
                   results=results)
    (OUT/'decision.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(dict(decision=receipt['decision'], checks=len(results),
                         firstFailure=next((v['name'] for v in results if not v['passed']), None))))
    raise SystemExit(0 if accepted else 1)


def challenge(lane, prior, boundary, denial=None):
    name = '-'.join([lane, prior, boundary] + ([denial] if denial else []))
    root = OUT/name
    fixture(root)
    if prior == 'pair':
        # Intentionally preserve exact bytes, including whitespace and binary data.
        (root/NAMES[0]).write_bytes(b'prior inventory\x00\n')
        (root/NAMES[1]).write_bytes(b'{"prior":"closure"}\n\n')
    before = snapshot(root)
    fault = OSError(errno.EIO, 'independent causal fault: '+boundary)
    recovery = PermissionError(errno.EACCES, 'independent persistent recovery denial: '+str(denial))
    original_replace, original_cleanup = r.os.replace, r.shutil.rmtree
    original_write, original_unlink, original_mkdir = Path.write_bytes, Path.unlink, Path.mkdir
    state = dict(faults=0, denials=0)

    def replace(src, dst):
        src, dst = Path(src), Path(dst)
        if boundary in ('replace1', 'replace2') and src.name == NAMES[int(boundary[-1])-1]:
            state['faults'] += 1
            raise fault
        if denial == 'restore-replace' and src.name.endswith('.restore'):
            state['denials'] += 1
            raise recovery
        return original_replace(src, dst)

    def cleanup(path, *args, **kwargs):
        path = Path(path)
        if boundary.startswith('cleanup') and path.name.startswith('.analysis-pair-'):
            if boundary == 'cleanup-partial':
                (path/'inventory.json.old').unlink(missing_ok=True)
            elif boundary == 'cleanup-total':
                original_cleanup(path, *args, **kwargs)
            state['faults'] += 1
            raise fault
        return original_cleanup(path, *args, **kwargs)

    def write(path, content):
        if state['faults'] and ((denial == 'backup-write' and path.name.endswith('.old'))
                               or (denial == 'restore-write' and path.name.endswith('.restore'))):
            state['denials'] += 1
            raise recovery
        return original_write(path, content)

    def unlink(path, *args, **kwargs):
        if state['faults'] and denial == 'restore-unlink' and path.name in NAMES:
            state['denials'] += 1
            raise recovery
        return original_unlink(path, *args, **kwargs)

    def mkdir(path, *args, **kwargs):
        if state['faults'] and denial == 'recovery-mkdir' and path.name.startswith('.analysis-pair-'):
            state['denials'] += 1
            raise recovery
        return original_mkdir(path, *args, **kwargs)

    observed = None
    with patch.object(r.os, 'replace', replace), patch.object(r.shutil, 'rmtree', cleanup), \
            patch.object(Path, 'write_bytes', write), patch.object(Path, 'unlink', unlink), \
            patch.object(Path, 'mkdir', mkdir):
        try:
            invoke(lane, root)
        except Exception as error:
            observed = error
    after = snapshot(root)
    stages = list(root.glob('.analysis-pair-*'))
    failures = []
    if state['faults'] != 1:
        failures.append('intended production exception boundary not reached exactly once')
    if denial:
        if not state['denials']:
            failures.append('recovery denial not exercised')
        if not isinstance(observed, RuntimeError) or observed.__cause__ is not fault:
            failures.append('persistent recovery failure lacks explicit error and original cause')
        if observed and ('rollback failed' not in str(observed) or 'recovery in ' not in str(observed)
                         or 'independent persistent recovery denial' not in str(observed)
                         or any('restored' in n for n in getattr(observed, '__notes__', []))):
            failures.append('recovery diagnostic misleading or missing evidence location/denial')
    else:
        if observed is not fault:
            failures.append('causal ordinary exception was lost or silent success')
        if before != after:
            failures.append('failed generation did not restore exact prior pair/initial absence')
    # Cleanup rollback and unsuccessful restore must retain recoverable old bytes
    # whenever the injected filesystem permits writing/recreating those backups.
    if prior == 'pair' and boundary.startswith('cleanup') and denial not in ('backup-write', 'recovery-mkdir'):
        if not any(all((s/(n+'.old')).exists() and (s/(n+'.old')).read_bytes() == before[n]
                       for n in NAMES) for s in stages):
            failures.append('recoverable complete backups lost')
    if not denial and boundary.startswith('cleanup'):
        if not observed or not any('prior publication restored; recovery evidence in ' in n
                                   for n in getattr(observed, '__notes__', [])):
            failures.append('successful recovery evidence note absent')
    if not denial and boundary.startswith('replace') and stages:
        failures.append('ordinary replacement rollback leaked staging')
    diagnostics = ''.join(traceback.format_exception(observed)) if observed else 'SILENT SUCCESS\n'
    (root/'exception.txt').write_text(diagnostics)
    result = dict(name=name, passed=not failures, failures=failures, injection=state,
                  exceptionType=type(observed).__name__, error=str(observed),
                  before={n:hashlib.sha256(v).hexdigest() if v is not None else None for n,v in before.items()},
                  after={n:hashlib.sha256(v).hexdigest() if v is not None else None for n,v in after.items()},
                  retainedStages=[str(p) for p in stages])
    results.append(result)
    (OUT/'checkpoint.json').write_text(json.dumps(results, indent=2)+'\n')
    if failures:
        finish(False)


for lane in ('api', 'cli'):
    for prior in ('pair', 'absent'):
        for boundary in ('replace1', 'replace2', 'cleanup-none', 'cleanup-partial', 'cleanup-total'):
            challenge(lane, prior, boundary)
    for denial in ('backup-write', 'restore-write', 'restore-replace', 'recovery-mkdir'):
        challenge(lane, 'pair', 'cleanup-total', denial)
    challenge(lane, 'absent', 'cleanup-total', 'restore-unlink')
    challenge(lane, 'absent', 'cleanup-total', 'recovery-mkdir')
finish(True)
