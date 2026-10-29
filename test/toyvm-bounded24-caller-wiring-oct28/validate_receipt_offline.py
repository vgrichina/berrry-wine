#!/usr/bin/env python3
"""Validate saved backend-result JSON offline only; runtimeQualified=false.

This command never runs a backend. JSON uses evaluate()'s retained output form:
"output": {"encoding": "base64", "data": "..."}. A positive decision validates
only supplied data and cannot prove execution, filesystem cleanup or live CLI
qualification. The original live CLI/FUSE/browser acceptance gap remains OPEN.
"""
import argparse
import base64
import binascii
import hashlib
import importlib.util
import json
import math
import pathlib

CALLER_SHA256 = '73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60'
MAX_INPUT_BYTES = 1024 * 1024
MAX_DECISION_BYTES = 4096
SCOPE = 'offline validation only; supplied receipt data, no execution or cleanup evidence'


def emit(**values):
    report = dict(values, offlineValidationOnly=True, runtimeQualified=False,
                  validationScope=SCOPE)
    encoded = json.dumps(report, sort_keys=True, allow_nan=False)
    if len(encoded.encode('utf-8')) > MAX_DECISION_BYTES:
        raise ValueError('decision exceeds output bound')
    print(encoded)


class Parser(argparse.ArgumentParser):
    def error(self, message):
        emit(accepted=False, error='invalid arguments: ' + message[:400])
        self.exit(2)


def load_caller():
    path = pathlib.Path(__file__).with_name('qualify_accounted.py')
    if hashlib.sha256(path.read_bytes()).hexdigest() != CALLER_SHA256:
        raise ValueError('pinned production caller identity mismatch')
    spec = importlib.util.spec_from_file_location('offline_pinned_production_caller', path)
    caller = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(caller)
    return caller


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError('duplicate JSON key')
        obj[key] = value
    return obj


def reject_constant(value):
    raise ValueError('nonfinite JSON constant')


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError('nonfinite JSON number')
    return number


def read_result(path):
    # Bound reads even for oversized or changing files. No backend is imported.
    with pathlib.Path(path).open('rb') as source:
        payload = source.read(MAX_INPUT_BYTES + 1)
    if len(payload) > MAX_INPUT_BYTES:
        raise ValueError('input exceeds byte bound')
    result = json.loads(payload, object_pairs_hook=unique_object,
                        parse_constant=reject_constant, parse_float=finite_float)
    if type(result) is not dict:
        raise ValueError('backend result must be a JSON object')
    output = result.get('output')
    if (type(output) is not dict or set(output) != {'encoding', 'data'}
            or output['encoding'] != 'base64' or type(output['data']) is not str):
        raise ValueError('output must use the retained base64 representation')
    try:
        result['output'] = base64.b64decode(output['data'], validate=True)
    except (ValueError, binascii.Error):
        raise ValueError('invalid base64 output') from None
    return result


def main(argv=None):
    parser = Parser(description=__doc__)
    parser.add_argument('--result-json', required=True)
    # Keep the live caller's argv, loader and runtime entry point unchanged.
    try:
        caller = load_caller()
    except (OSError, ValueError, ImportError):
        emit(accepted=False, error='pinned production caller unavailable or changed')
        return 2
    for name in caller.MAX_LIMITS:
        parser.add_argument('--' + name.replace('_', '-'), required=True,
                            type=float if name in ('cpu_limit', 'wall_limit') else int)
    options = vars(parser.parse_args(argv))
    path = options.pop('result_json')
    try:
        for name, maximum in caller.MAX_LIMITS.items():
            if not math.isfinite(options[name]) or not 0 < options[name] <= maximum:
                raise ValueError('unsupported resource limit')
        if options['file_limit'] > options['live_limit']:
            raise ValueError('file quota exceeds live quota')
        result = read_result(path)
        decision = caller.evaluate(result, options)
        # Never reflect arbitrary receipt payload or present it as fresh evidence.
        emit(**{key: decision[key] for key in (
            'accepted', 'childSucceeded', 'accountingAccepted', 'cleanupComplete', 'failures')})
        return 0 if decision['accepted'] else 1
    except (OSError, ValueError, TypeError, OverflowError, RecursionError):
        emit(accepted=False, error='malformed input or unsupported resource limits')
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
