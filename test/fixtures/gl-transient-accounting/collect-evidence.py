#!/usr/bin/env python3
"""Read the explicit production output contract, never immutable ops inputs.

Transport adapters should transfer these exact relative names with the returned
lengths/hashes, and use receipt ownership records for identity-aware cleanup.
Historical flat-ops collectors remain historical and must not be replayed.
"""
import hashlib
import json
import pathlib
import sys

def collect(task_root):
    output=pathlib.Path(task_root)/'ops/output'
    files={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
           for p in sorted(output.iterdir()) if p.is_file()}
    receipts=[json.loads((output/n).read_text()) for n in files if n.endswith('-receipt.json')]
    return dict(outputRelative='ops/output',files=files,receiptCount=len(receipts),
                cleanupComplete=bool(receipts) and all(r['cleanupComplete'] for r in receipts),
                owned=[identity for r in receipts for identity in r['owned']],
                testInvoked=(output/'invocation-start.json').exists())

if __name__=='__main__':print(json.dumps(collect(sys.argv[1]),indent=2))
