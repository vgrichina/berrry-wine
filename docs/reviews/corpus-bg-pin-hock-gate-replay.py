#!/usr/bin/env python3
"""Bounded consumer replay; requires retained local BG and Hock intake, no network/build."""
import copy, hashlib, json, pathlib, shutil, subprocess, sys

repo = pathlib.Path.cwd()
host = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
assert shutil.disk_usage(repo).free > 2285895680 + 600000000 + 67108864
base = '2e2c363e8a6229ce6938b4284cb57c119809f62f'
hock = 'a6da8ba20500eb8dd73170499edee5dcc8796dde'
manifest = repo / 'test/candidate-corpus/manifest.json'
runner = repo / 'test/test-cli-candidate-corpus.js'
regression = repo / 'test/test-hock-a-loogie-local-registration.js'
saved = {p: p.read_bytes() if p.exists() else None for p in [manifest, runner, regression]}
checks = []

def blob(ref, file):
    return subprocess.check_output(['git', 'show', ref + ':' + file])

def run(label, args, expected=0, contains=None):
    p = subprocess.run(args, text=True, capture_output=True)
    text = p.stdout + p.stderr
    (out / (label + '.log')).write_text(text)
    checks.append(dict(label=label, args=args, exit=p.returncode, expected=expected))
    (out / 'checks.json').write_text(json.dumps(checks, indent=2) + '\n')
    assert p.returncode == expected, (label, text)
    if contains:
        assert contains in text, (label, text)

def gates(label, id, expected=0):
    for mode in ['--list', '--dry-run']:
        run(label + '-' + mode[2:], ['node', str(runner), '--id=' + id, mode], expected,
            'keeps its exact Archive.org artifact and SHA-1' if expected else 'LOCAL')

assets = repo / 'test/binaries/candidates'
bg = assets / 'baldurs-gate-interactive-demo'
hf = assets / 'hock-a-loogie-1995'
assert not bg.exists() and not hf.exists()
assets.mkdir(parents=True, exist_ok=True)
bg_exe = host / 'test/binaries/candidates/baldurs-gate-interactive-demo/installed-extracted/MinimumData/BGDemo.exe'
bg_hash = hashlib.sha256(bg_exe.read_bytes()).hexdigest()
assert bg_hash == 'ed7f1efd9df8d9a62c1a32f2598e8cc19e5dc601689aeebb72a3bc835db343d9'
(out / 'bg-retained-executable.json').write_text(json.dumps(dict(path=str(bg_exe), sha256=bg_hash,
    pinSource=base + ':test/test-baldurs-gate-demos.js', scope='original executable identity only; no new media extraction or gameplay'), indent=2) + '\n')
bg.symlink_to(host / 'test/binaries/candidates/baldurs-gate-interactive-demo', target_is_directory=True)
try:
    # Original baseline runner, exact base and then exact Hock candidate manifest.
    runner.write_bytes(blob(base, 'test/test-cli-candidate-corpus.js'))
    gates('unchanged-base', 'baldurs-gate-interactive-demo', 1)
    manifest.write_bytes(blob(hock, 'test/candidate-corpus/manifest.json'))
    gates('unchanged-hock', 'hock-a-loogie-1995', 1)
    runner.write_bytes(saved[runner])
    manifest.write_bytes(saved[manifest])
    gates('corrected-base', 'baldurs-gate-interactive-demo')
    good = json.loads(saved[manifest])
    controls = ['wrong-sha1', 'old-iso', 'wrong-bin', 'missing-raw', 'old-cab', 'wrong-group', 'wrong-exe', 'missing-companion', 'wrong-case']
    for name in controls:
        changed = copy.deepcopy(good)
        c = next(c for c in changed['candidates'] if c['id'] == 'baldurs-gate-interactive-demo')
        if name == 'wrong-sha1': c['packages'][0]['sha1'] = '0' * 40
        if name == 'old-iso':
            c['packages'][0].update(url='https://archive.org/download/bg-demo/BG%20Demo.iso', sha1='3796defce51a3e867aa216bc27f0be0689fdadf0')
        if name == 'wrong-bin': c['postExtract'][0]['image'] = 'other.bin'
        if name == 'missing-raw': c['postExtract'].pop(0)
        if name == 'old-cab': c['postExtract'][1]['cab'] = 'data1.cab'
        if name == 'wrong-group': c['postExtract'][1]['group'] = 'All'
        if name == 'wrong-exe': c['executables'] = ['installed-extracted/MinimumData/Baldur.exe']
        if name == 'missing-companion': c['postExtract'].pop(3)
        if name == 'wrong-case': c['postExtract'][3]['into'] = c['postExtract'][3]['into'].upper()
        manifest.write_text(json.dumps(changed))
        for mode in ['--list', '--dry-run']:
            run('reject-' + name + '-' + mode[2:], ['node', str(runner), mode], 1, 'AssertionError')
    manifest.write_bytes(blob(hock, 'test/candidate-corpus/manifest.json'))
    regression.write_bytes(blob(hock, 'test/test-hock-a-loogie-local-registration.js'))
    intake = host / 'scratch/runs/20261020-hock-loogie-original-intake-oct20'
    run('hock-sealed-regression', ['node', str(regression), '--intake=' + str(intake)])
    inner = intake / 'extracted/BEAVISLG.ZIP'
    c = next(c for c in json.loads(manifest.read_bytes())['candidates'] if c['id'] == 'hock-a-loogie-1995')
    outer = (intake / 'beavislg.zip').read_bytes()
    assert hashlib.sha1(outer).hexdigest() == c['packages'][0]['sha1']
    assert hashlib.sha256(outer).hexdigest() == c['packages'][0]['sha256']
    # The regression above seals the nested archive too; the package pin is
    # for the outer ZIP, not distribution/BEAVISLG.ZIP.
    (hf / 'distribution').mkdir(parents=True)
    shutil.copyfile(inner, hf / 'distribution/BEAVISLG.ZIP')
    run('hock-fetcher-prepare', ['node', 'tools/fetch-candidate-corpus.js', '--id=hock-a-loogie-1995', '--prepare'])
    gates('corrected-hock', 'hock-a-loogie-1995')
    run('syntax', ['node', '--check', str(runner)])
finally:
    for p, data in saved.items():
        if data is None: p.unlink(missing_ok=True)
        else: p.write_bytes(data)
    bg.unlink()
    if hf.exists(): shutil.rmtree(hf)
print('PASS baseline failures, corrected base/Hock gates, 18 rejecting controls and sealed Hock preparation')
