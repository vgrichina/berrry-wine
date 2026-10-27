"""Pinned measured-run API producer closure and executable caller wiring.

build() replaces only the unsafe publication statement in four exact historical
commands. CLI launches that transformed API command; source tests call build()
and execute its publication prefix locally, never the API/polling tail.
"""
import argparse
import hashlib
import json
import pathlib
import shlex
import subprocess

PRODUCERS = ('1793092826212634802', '1793092833026763786',
             '1793092841347248549', '1793092867150456577')
ROOT = '/tmp/ricochet-measured-cpu-round-gameplay-oct27'


def build(saved, expected_sha256, helper_sha256):
    assert hashlib.sha256(saved).hexdigest() == expected_sha256, 'producer source pin'
    assert len(helper_sha256) == 64 and all(c in '0123456789abcdef' for c in helper_sha256)
    command = json.loads(saved)
    argv = shlex.split(command['argv'][-1])
    assert argv[:2] == ['python3', '-c'] and len(argv) == 3
    source = argv[2]
    old = 'p.write_text(json.dumps(j))'
    assert source.count(old) == 1
    new = ("import importlib.util,hashlib;helper=h/'control-publisher.py';"
           "assert hashlib.sha256(helper.read_bytes()).hexdigest()=="+repr(helper_sha256)+";"
           "spec=importlib.util.spec_from_file_location('control_publisher',helper);"
           "publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher);"
           "publisher.publish(o,j)")
    argv = ['python3', '-B', '-c', source.replace(old, new)]
    # Preserve box/timeout/polling/no-replay semantics byte-for-byte.
    command['argv'][-1] = shlex.join(argv)
    command['historicalCommandSHA256'] = command.pop('commandSHA256')
    command['historicalClientLimits'] = command.pop('limits')
    command['commandSHA256'] = hashlib.sha256(json.dumps(command['argv'], sort_keys=True).encode()).hexdigest()
    command['commandHashEncoding'] = 'UTF8 json.dumps(argv, sort_keys=True)'
    command['sourceSHA256'] = expected_sha256
    command['helperSHA256'] = helper_sha256
    command['transformedSourceSHA256'] = hashlib.sha256(argv[-1].encode()).hexdigest()
    return command


def main():
    p = argparse.ArgumentParser()
    p.add_argument('producer', choices=PRODUCERS)
    p.add_argument('--bundle', type=pathlib.Path, required=True)
    a = p.parse_args()
    manifest = json.loads((a.bundle/'producer-manifest.json').read_text())
    raw = (a.bundle/('api-'+a.producer+'-command.json')).read_bytes()
    command = build(raw, manifest['sources'][a.producer], manifest['helperSHA256'])
    # Actual production caller uses build() output, never the historical argv.
    raise SystemExit(subprocess.run(command['argv'], check=False).returncode)


if __name__ == '__main__':
    main()
