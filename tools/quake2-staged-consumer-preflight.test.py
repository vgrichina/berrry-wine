"""Actual provision argument/consumer regression. Offline; never starts Chrome."""
from pathlib import Path
import ast
import gzip
import hashlib
import importlib.util
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
RETAINED = ROOT/'scratch/runs/20261109-quake2-current-policy-guard-door-1645'
H = lambda b: hashlib.sha256(b).hexdigest()


def run(argv, env=None):
    p = subprocess.Popen(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    out, err = p.communicate(timeout=30)
    return dict(argv=argv, pid=p.pid, status=p.returncode, actualWait=True,
                stdoutEOF=True, stderrEOF=True, stdout=out.decode(), stderr=err.decode())


def test(destination):
    destination.mkdir(parents=True, exist_ok=False)
    # Actual published preparer; no substitution or blanket refresh.
    code = '''const g=require('./tools/quake2-staged-closure-gameplay.cjs'),m=require('./tools/quake2-current-module.cjs'),p=require('./tools/quake2-current-browser-policy.cjs');g.prepare(process.argv[1],{moduleVersion:m.browserModuleVersion,browserPolicyVersion:p.version});'''
    preparation = run(['node', '-e', code, str(destination/'prepared')])
    assert preparation['status'] == 0, preparation
    pins = json.loads((destination/'prepared/runtime-pins.json').read_bytes())
    # Same run-only hooks as the actual retained provisioner.
    for name in ['health-preload.cjs', 'native-fixture.cjs', 'observer-preload.cjs']:
        p = RETAINED/name
        b = p.read_bytes()
        assert not any(row['path'] == str(p.relative_to(ROOT)) for row in pins['files'])
        pins['files'].append(dict(path=str(p.relative_to(ROOT)), size=len(b), sha256=H(b)))
    manifest = destination/'runtime-pins.json'
    manifest.write_text(json.dumps(pins, indent=2))
    spec = importlib.util.spec_from_file_location('barrier', ROOT/'tools/native-startup-barrier.py')
    barrier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(barrier)
    barrier.publish(ROOT, manifest, destination/'remote-barrier.json')
    # Extract the exact actual provision command rather than approximating its
    # directory/file argument. Upload/API operations are never invoked here.
    tree = ast.parse((RETAINED/'control.py').read_bytes())
    main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
    branch = main.body[1]
    while ast.unparse(branch.test) != "action == 'provision'":
        branch = branch.orelse[0]
    expressions = [n.value for n in ast.walk(branch) if isinstance(n, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == 'code' for t in n.targets)]
    expression = next(n for n in expressions if 'stage-closure.cjs' in ast.unparse(n))
    namespace = dict(BASE_RUN=RETAINED, ROOT=ROOT, REMOTE=str(ROOT), RUN=str(destination.relative_to(ROOT)), repr=repr, str=str)
    original = eval(compile(ast.Expression(expression), '<actual retained provision>', 'eval'), namespace)
    # Historical ENOTDIR is retained in the prior run. Never execute the old
    # stage-closure route when qualifying fresh production preparation.
    # Fix only the executable/argument contract; retain the exact actual manifest.
    spec = pins['consumerPreflight']
    assert spec == dict(tool='tools/quake2-staged-closure-gameplay.cjs', argument='--consumer-preflight', input='runtime-pins.json')
    cli = str(ROOT/spec['tool'])
    before = repr(str(RETAINED/'stage-closure.cjs'))+','+repr(str(manifest))
    after = repr(cli)+',"--consumer-preflight",'+repr(str(manifest))
    assert original.count(before) == 1, original
    corrected = original.replace(before, after)
    # Runtime import/composition must not depend on Git.
    bin_dir = destination/'bin'
    bin_dir.mkdir()
    git = bin_dir/'git'
    git.write_text('#!/bin/sh\nexit 74\n')
    git.chmod(0o755)
    env = {**os.environ, 'PATH': str(bin_dir)+os.pathsep+os.environ['PATH']}
    good = run([sys.executable, '-c', corrected], env)
    assert good['status'] == 0, good
    receipt = json.loads(good['stdout'])
    assert receipt['passed'] and receipt['observed']['fixture'] and receipt['observed']['wire'] and receipt['observed']['health']
    assert receipt['observed']['preflight'] and not receipt['chromeStarted']
    assert not receipt['actualConsumer']['chromiumStarted'] and not receipt['actualConsumer']['originalStarted']
    controls = []
    controls.append(run(['node', cli, '--consumer-preflight', str(destination)], env))
    controls.append(run(['node', cli, '--consumer-preflight', str(destination/'missing/runtime-pins.json')], env))
    raw = manifest.read_bytes()
    helper = 'scratch/runs/20261109-quake2-current-policy-guard-door-1645/pipe-wait.py'
    helper_pin = next(p for p in pins['files'] if p['path'] == helper)
    assert helper_pin == dict(path=helper, size=961, sha256='5c67aa36ea6d6c5251129309f0cd532937bf855c5cecec46bb71d63c9804e933')
    damaged = json.loads(raw)
    damaged['files'] = [p for p in damaged['files'] if p['path'] != helper]
    manifest.write_text(json.dumps(damaged))
    controls.append(run(['node', cli, '--consumer-preflight', str(manifest)], env))
    assert 'retained Q2 parent wait provider required' in controls[-1]['stderr']
    # Refuse damage during actual preparation, before a manifest is written.
    for mode in ['missing', 'changed']:
        script = '''const fs=require('node:fs'),path=require('node:path');
const read=fs.readFileSync,helper=process.argv[1],mode=process.argv[2];
fs.readFileSync=function(file,...args){if(path.resolve(String(file))===helper){
 if(mode==='missing')throw Error('missing parent wait control');
 const b=Buffer.from(read.call(this,file));b[b.length-1]^=1;return b;
}return read.call(this,file,...args);};
const g=require('./tools/quake2-staged-closure-gameplay.cjs'),m=require('./tools/quake2-current-module.cjs'),p=require('./tools/quake2-current-browser-policy.cjs');
g.prepare(process.argv[3],{moduleVersion:m.browserModuleVersion,browserPolicyVersion:p.version});'''
        refused = destination/('refused-helper-'+mode)
        control = run(['node', '-e', script, str(ROOT/helper), mode, str(refused)])
        assert control['status'] != 0 and not refused.exists(), control
        assert ('missing parent wait control' if mode == 'missing' else 'retained Q2 parent wait SHA') in control['stderr']
        controls.append(control)
    damaged = json.loads(raw)
    damaged['files'] = [p for p in damaged['files'] if not p['path'].endswith('/observer-preload.cjs')]
    manifest.write_text(json.dumps(damaged))
    controls.append(run(['node', cli, '--consumer-preflight', str(manifest)], env))
    assert 'undeclared consumer hook' in controls[-1]['stderr']
    damaged = json.loads(raw)
    next(p for p in damaged['files'] if p['path'] == 'tools/quake2-current-browser-policy.cjs')['sha256'] = '0'*64
    manifest.write_text(json.dumps(damaged))
    controls.append(run(['node', cli, '--consumer-preflight', str(manifest)], env))
    assert 'Q2 runtime provider SHA' in controls[-1]['stderr']
    manifest.write_bytes(raw)
    assert all(r['status'] != 0 for r in controls)
    assert not list(destination.rglob('*.png'))
    result = dict(passed=True, historicalCommandNotExecuted=True, actualRetainedProvisionExpression=True,
                  correctedProductionCLI=True, actualComposedConsumer=True,
                  retainedParentWaitStaged=True, missingDamagedParentWaitRefused=True,
                  gitForbidden=True, chromeStarted=False, nativeQualification=False,
                  preparation=preparation, corrected=good, controls=controls)
    with gzip.open(destination/'regression.json.gz', 'wb') as f:
        f.write(json.dumps(result, indent=2).encode())
    print(json.dumps({k: v for k, v in result.items() if isinstance(v, bool)}))


if __name__ == '__main__':
    test(Path(sys.argv[1]).resolve())
