# Runtime coverage evidence gate

`tools/gfx-runtime-coverage.js` checks an explicit caller-owned GL/D3D corpus
manifest against retained evidence. It does not infer historical 27-app membership
or read the registry. `gfx-app-census.js` remains a static API-reach census;
its results are not runtime coverage evidence.

Run with installed Node (no dependencies):

```sh
node tools/gfx-runtime-coverage.js manifest.json evidence.json retained-artifacts
node --max-old-space-size=128 --test test/gfx-runtime-coverage.test.js
```

The manifest has exactly `version: 1` and a nonempty `apps` array of unique
`{ "app": "caller-app-id", "build": "immutable-build-identity" }` entries.
The caller must select the authorized corpus and actual tested build. Each app
requires exactly one `software` and one `webgl` record matching that build.
All objects use only the documented fields; unknown or missing fields fail closed.

The evidence document has exactly `version: 1` and `records`. Each record has
`app`, `backend`, `build`, `kind: "runtime"`, a globally distinct `run` identity,
a nonempty `observation` describing what was observed at runtime, and
`artifact: { "path": "relative/file", "sha256": "64 lowercase hex digits" }`.
Identity strings are nonempty and have no surrounding whitespace. Artifact paths
resolve relative to the explicit third argument, including through symlinks, and
must remain inside it. Artifacts must be existing regular files. SHA-256 is
computed from their retained bytes, in chunks. Screenshots, logs, or other retained
files are allowed; duplicate paths, symlink aliases, and duplicate artifact digests
are rejected, as are shared run IDs. Every member of a duplicate group is rejected.
An app/backend duplicate is invalid even if one competing record is malformed.

Output is deterministic JSON: apps sorted by ID, software then WebGL, each with
`accepted`, `rejected`, or `missing` status. Accepted entries include the evidence
record index, run and artifact. The top-level `rejected` list identifies input
record indices (zero-based) and sorted reason codes, including records for unknown
apps/backends. Exit status is 0 for complete valid evidence, 1 for missing/rejected
records, and 2 for invalid documents, unavailable inputs, or invocation errors.
`--help` prints usage and exits 0. No partial document error is treated as success.

This is an integrity and completeness gate, not an authenticity oracle: the caller
must retain honest runtime observations with correct app/backend/build attribution.
It cannot determine whether arbitrary artifact bytes depict gameplay, authenticate
an observer, or detect a false assertion relabeled as runtime. Static-import-only
records fail the schema and runtime-kind requirements. A passing report does not
by itself establish gameplay, playability, or acceptance of the authorized corpus.
Keep artifacts stable while verifying; this is not a hostile concurrent filesystem
or signed provenance verifier.

## Synthetic fixture example

This creates two text fixtures, **not runtime captures or actual gameplay**.
Run in a temporary directory, setting `VERIFIER` to the verifier's absolute path:

```sh
mkdir retained-artifacts
printf 'SYNTHETIC software fixture\n' > retained-artifacts/software.txt
printf 'SYNTHETIC webgl fixture\n' > retained-artifacts/webgl.txt
node - <<'JS'
const fs = require('node:fs'), crypto = require('node:crypto');
fs.writeFileSync('manifest.json', JSON.stringify({version: 1,
  apps: [{app: 'fixture-app', build: 'fixture-build'}]}));
fs.writeFileSync('evidence.json', JSON.stringify({version: 1,
  records: ['software', 'webgl'].map(backend => ({
    app: 'fixture-app', build: 'fixture-build', backend, kind: 'runtime',
    run: `fixture-${backend}`, observation: 'Synthetic verifier test only.',
    artifact: {path: `${backend}.txt`, sha256: crypto.createHash('sha256')
      .update(fs.readFileSync(`retained-artifacts/${backend}.txt`)).digest('hex')}
  }))}));
JS
node "$VERIFIER" manifest.json evidence.json retained-artifacts
```

The fixture should exit 0. Altering either artifact should exit 1. These outcomes
test the verifier only and do not count toward real corpus acceptance.
