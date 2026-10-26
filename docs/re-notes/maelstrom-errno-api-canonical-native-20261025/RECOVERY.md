The complete remote evidence is a gzip-compressed JSON object mapping original
ops filenames to base64 bytes. Decode offline without executing any guest:

```python
import base64, gzip, hashlib, json, pathlib
evidence = pathlib.Path('docs/re-notes/maelstrom-errno-api-canonical-native-20261025')
rows = json.loads(gzip.decompress((evidence / 'remote-evidence.json.gz').read_bytes()))
manifest = json.loads((evidence / 'remote-evidence-manifest.json').read_text())
for row in manifest['files']:
    data = base64.b64decode(rows[row['name']])
    assert len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256']
# Inspect json.loads(base64.b64decode(rows['native-result-errno4.json'])), etc.
```

`manifest.json` seals all committed driver, test and evidence bytes.
`execution-identities.json` binds the scripts executed remotely to the committed
driver/test and the unchanged historical module guard. `qualification-summary.json`
is a readable subset; the archive contains the full ABI/types, transformed and
original source seals, actual per-block native states and bounded supervisor logs.

Local retained ops: `/tmp/maelstrom-errno-api-canonical-native-oct25/ops`.
Remote retained root: `/home/user/maelstrom-errno-api-canonical-native-oct25` on
`bx_k38z8byn`. The remote `ops/errno-latch.wasm` and `errno-latch.compat.wasm`
hashes are in the report. `ops/sources.json.gz` holds all 128 authentic source
byte snapshots in a gzip JSON base64 mapping. Both outputs and this input bundle
remain outside Git; coordinator must snapshot before the assigned box expires.
No binary or source expansion is required to inspect the committed evidence.

Recipe scripts are retained under `recipe/`; their original location is the
owned local ops directory above. They expect the sibling `repo/` and remote
`canonical/` layout, and are not intended to run in this documentation folder.
`setup.py` demonstrates exact dependency-first sparse checkout and pin admission;
`stage.py` and `api.py` perform bounded direct APIexec chunks, verify hashes and
make staged inputs readonly. The source bundle is decoded directly into the
three-alias canonical compiler VFS; raw source files are not expanded on disk.
The twelve compiler dependencies are copied byte-identically, including unchanged
watx-closure.js/compileClosure, trampoline and section stamping.

`make-oracle.py` derives the ABI and full storage/span inventory locally from the
standing pinned combined source/mirror, never from the declared fingerprint
alone. The remote static test uses that sealed oracle and the unchanged parser.
`run-stage.py` supplies fresh both-host admission, then dispatches the guarded
compiler or native batch. `native-batch.py` uses sequential fresh OS processes
because the single-shot latch has no reset; no arenas overlap. No workers/agents
are launched remotely. Standalone fixture script supports `--preflight` and
requires the native supervisor marker for execution.

These are reproduction recipes, not authorization for another runtime attempt.
Fresh assignment, box, schedule and resource receipts are required after this
task. Do not reuse the expired schedule or assume original CRT mapping. Inputs
must match the report's source/compiler/binary pins and remain readonly. There
is no main integration, original guest or gameplay result to recover.
