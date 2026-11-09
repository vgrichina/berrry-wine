"""Execute the actual Boat payload from /home/user against native custody.

No Chrome: a delayed Node fixture would capture/input/send if not cancelled.
The production cancellation pump owns TERM and the real supervisor owns reaping.
"""
from pathlib import Path
import gzip
import hashlib
import json
import os
import runpy
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
BASE = Path(sys.argv[1]).resolve()
assert BASE.is_relative_to(ROOT/'scratch/runs') and not BASE.exists()
BASE.mkdir(parents=True)
observer = runpy.run_path(str(ROOT/'tools/q3-phase-observer.py'))
pump = runpy.run_path(str(ROOT/'tools/q3-cancellation-stream-eof.py'))
owner = pump['client'](ROOT)


def until(check):
    due = time.monotonic()+10
    while not check():
        assert time.monotonic() < due, 'offline observation deadline'
        time.sleep(.005)


for mode in ('helper-load-failure', 'cancellation-helper-load-failure', 'invalid-image'):
    trial = BASE/mode
    prepared, phase = trial/'prepared', trial/'cancellation/prepared'
    out = phase/'runtime'
    out.mkdir(parents=True)
    prepared.mkdir()
    plan = dict(prepared=str(phase.relative_to(ROOT)),
                output=str(out.relative_to(ROOT)),
                boundary=str((phase/'execution-boundary.jsonl.gz').relative_to(ROOT)))
    raw = json.dumps(dict(phaseLayout=dict(cancellation=plan))).encode()
    (prepared/'runtime-pins.json.gz').write_bytes(gzip.compress(raw))
    (prepared/'replacement-pinset-seal.json').write_text(json.dumps(dict(
        phaseLayout=dict(cancellation=plan), manifestSHA256=hashlib.sha256(raw).hexdigest())))
    # This is the actual wrapper, also used by the live owning session.
    payload = observer['remote_wrapper'](ROOT, prepared, 'cancellation')
    (trial/'actual-wrapper.py').write_text(payload)
    if mode.endswith('helper-load-failure'):
        # Inject a missing observer at runpy's load boundary, outside its code.
        missing = ROOT/('tools/q3-native-launch-client.py' if mode.startswith('cancellation-') else 'tools/q3-phase-observer.py')
        prefix = "import runpy\nreal=runpy.run_path\ndef load(p,*a,**k):\n if p=="+repr(str(missing))+":raise FileNotFoundError('injected helper unavailable')\n return real(p,*a,**k)\nrunpy.run_path=load\n"
        payload = prefix+payload
    else:
        image = out/'fixture-startup.png'
        image.write_bytes(b'changed image')
        capture = dict(sha256='0'*64, identity=dict(worker='fixture'))
        capture_file = out/'fixture-startup-capture.json'
        capture_file.write_text(json.dumps(capture))
        (phase/'input-service-review-ready.json').write_text(json.dumps(dict(
            label='fixture-startup', image=str(image), captureFile=str(capture_file), capture=capture)))
    node = trial/'delayed.cjs'
    node.write_text("const fs=require('node:fs');\nfs.writeFileSync("+repr(str(trial/'delay-armed'))+",'armed');\nsetTimeout(async()=>{try{await require("+repr(str(ROOT/'tools/q3-input-phase-service.cjs'))+").run({run:async o=>{fs.appendFileSync("+repr(str(trial/'effects'))+",'protocol\\n');await o.capture('fixture-startup');fs.appendFileSync("+repr(str(trial/'effects'))+",'input\\n');}},{out:"+repr(str(out))+",capture:async()=>fs.appendFileSync("+repr(str(trial/'effects'))+",'capture\\n'),wait:async()=>{}});}catch(e){process.exitCode=1;}},1500);\n")
    runtime = trial/'runtime.py'
    runtime.write_text("import sys,os,time,gzip,json\nfrom pathlib import Path\nsys.path.insert(0,"+repr(str(ROOT/'tools'))+")\nfrom native_kernel_custody import supervise,identity\nr=Path("+repr(str(phase))+");end=time.time()+20\nwith gzip.open(r/'runtime-identity.json.gz','xb') as f:f.write(json.dumps(identity(os.getpid())).encode())\nos.environ.update(Q3_INPUT_SERVICE_REVIEW='1',Q3_EXECUTION_BOUNDARY_OUT=str(r/'execution-boundary.jsonl.gz'))\nsupervise(r,['node',"+repr(str(node))+"],deadline=end,cleanup_deadline=end+10,journal_compression='gzip',command_compression='gzip')\n")
    native = subprocess.Popen([sys.executable, '-B', str(runtime)], cwd='/home/user',
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    receipt = []
    with gzip.open(trial/'native.log.gz', 'xb') as log:
        thread = threading.Thread(target=lambda: receipt.append(
            pump['drain_remote'](native, phase, log, [], out, owner)))
        thread.start()
        try:
            until(lambda: (trial/'delay-armed').exists() and (phase/'kernel-armed.json').exists())
            failed = subprocess.run([sys.executable, '-B', '-c', payload], cwd='/home/user',
                                    capture_output=True, timeout=5)
            (trial/'wrapper.stdout').write_bytes(failed.stdout)
            (trial/'wrapper.stderr').write_bytes(failed.stderr)
            assert failed.returncode != 0
            assert (phase/'caller-cancelled.json').exists(), 'failure directly revokes native owner'
            first = (phase/'caller-cancelled.json').read_bytes()
            thread.join(10)
            assert not thread.is_alive(), 'native owner must actually reap'
            assert receipt[0]['actualWait'] and receipt[0]['stdoutEOF'] and receipt[0]['stderrEOF']
            assert not (trial/'effects').exists(), 'no protocol/input/capture after observer failure'
            assert not (phase/'input-service-arm.json').exists()
            assert (phase/'caller-cancelled.json').read_bytes() == first
            drain = json.loads((phase/'kernel-drain.json').read_bytes())
            assert drain['complete'] and not drain['unreaped'] and drain['commandLog']['eof']
            (trial/'result.json').write_text(json.dumps(dict(passed=True, mode=mode,
                actualWrapperCwd='/home/user', delayedStartMs=1500,
                noSubsequentProtocolInputCapture=True, wait=receipt[0],
                owned=len(drain['owned']), reaped=len(drain['reaped']))))
        finally:
            owner['cancel_remote'](phase, out)
            thread.join(15)
            assert not thread.is_alive()
    print(mode, 'PASS actual wrapper; native cancellation/reap; zero later effects', flush=True)
