#!/usr/bin/env python3
"""Small real file/log/group controls; no native compiler or arena execution."""
import errno, hashlib, importlib.util, json, os, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
E=ROOT/'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023'
spec=importlib.util.spec_from_file_location('capture',ROOT/'tools/positiont-bounded-capture.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
results=[]
def control(name,code,expected,check=lambda r:True):
    log=E/(name+'.log')
    result=capture.run(['/usr/bin/python3','-c',code],log,seconds=5)
    assert result['exit']==expected,(name,result)
    assert check(result),(name,result)
    results.append(dict(name=name,**result,logBytes=log.stat().st_size,logSha256=hashlib.sha256(log.read_bytes()).hexdigest()))
testfile=E/'control-multimib.bin'
control('multimib-file',f"from pathlib import Path; p=Path({str(testfile)!r}); p.write_bytes(b'x'*2349309); assert p.stat().st_size==2349309; print('2349309 admitted file bytes, tiny capture'); p.unlink()",0,
        lambda r:r['capturedBytes']<100)
# ftruncate over the actual configured 24MiB limit fails before allocation.
# SIGXFSZ is ignored only by this rejecting control so errno can be inspected.
control('over-file-limit',f"import os,signal,errno; signal.signal(signal.SIGXFSZ,signal.SIG_IGN); p={str(testfile)!r}; f=os.open(p,os.O_CREAT|os.O_WRONLY,0o600)\ntry:\n os.ftruncate(f,25165825); raise AssertionError('over-limit accepted')\nexcept OSError as e:\n assert e.errno==errno.EFBIG; assert os.fstat(f).st_size==0; print('EFBIG before allocation')\nfinally:\n os.close(f); os.unlink(p)",0)
# Both streams share the budget, including output from a TERM-resistant child.
control('aggregate-log-overflow',"import os,signal,time; p=os.fork()\nif p==0:\n signal.signal(signal.SIGTERM,signal.SIG_IGN); os.close(1); os.close(2); time.sleep(20)\nelse:\n os.write(1,b'a'*262144); os.write(2,b'b'*262145); time.sleep(20)",125,
        lambda r:r['failure'].startswith('aggregate') and r['capturedBytes']==524288 and r['groupReaped'] and len(r['adoptedReaped'])==1)
control('exact-log-bound',"import os; os.write(1,b'a'*262144); os.write(2,b'b'*262144)",0,
        lambda r:r['capturedBytes']==524288)
# Keep only compact exact hashes of successful synthetic log payloads.
for name in ['exact-log-bound','aggregate-log-overflow']:(E/(name+'.log')).unlink()
(E/'bounds-controls.json').write_text(json.dumps(results,separators=(',',':'))+'\n')
print(json.dumps({'controls':len(results),'passed':True,'allocatedPeakBytes':2349309+524288}))
