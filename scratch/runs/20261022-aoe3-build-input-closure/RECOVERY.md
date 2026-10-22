# Exact canonical build recovery (future coordinator assignment only)

This offline task authorizes **no build, game, or compute action**. The commands
below are a recovery recipe for a later authorized assignment. Do not run them
against the historical runtime, runner, original game, or stopped box now.

Candidate: `c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2`.
Actual remote main at collection: `63d563df7a2b901d222a311ceaf55a0823a22261`.
Candidate contains repair `24220bf65a04f665c847fc4037a732f8e82db87c`, sparse
fixture `2977ba3bd08e5bde5bab5e5323a5de71a14d6b49`, and census
`28379f3d7475317b429c4c18f082c4deb5bbd489`. Do not replace it with main,
the repair-only ref, or the worker's evidence commit.

`build-inputs.json` contains **3,420 files / 84,967,552 bytes**, Git blob IDs,
SHA-256, modes, and roles. Its SHA-256 is
`024af340bbe84e09b307c875c52c46c77d26906b0be8310ac041c0b7d5f256fb`.
The selection is a conservative, complete directory closure, not a minimal set.
Admit space for that payload, filesystem overhead, Git history/objects,
dependencies, outputs, and logs before staging. It exceeds this offline task's
64 MiB allowance as a simultaneous checkout. Here every blob was materialized
individually and removed; largest individual blob was 2,349,309 bytes.

## Stage a fresh source directory with truthful Git history

Use a new empty destination, never overlay the retained source/runtime. Obtain
this evidence directory from `task/aoe3-build-input-closure-oct22`; let `evidence`
point to that directory on the future host. These commands do not install any
dependencies. Git fetches full commit history (no depth limit), with lazy blob
transfer to avoid unrelated evidence/game blobs. If the server cannot supply
the named commits/history, stop with that concrete prerequisite; do not fake
HEAD, synthesize commits, or accept a source archive as equivalent.

```bash
set -euo pipefail
evidence=/path/to/20261022-aoe3-build-input-closure
staging=/home/user/aoe3-canonical-c7fae5ac-staged
test ! -e "$staging"
git init "$staging"
git -C "$staging" remote add origin https://github.com/vgrichina/berrry-wine.git
git -C "$staging" fetch --filter=blob:none --no-tags origin \
  c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2 \
  63d563df7a2b901d222a311ceaf55a0823a22261
git -C "$staging" sparse-checkout init --no-cone
python3 - "$evidence/build-inputs.json" "$staging" <<'PY'
import json, subprocess, sys
m = json.load(open(sys.argv[1]))
# Anchored literal Git sparse patterns, including metacharacter escaping.
def literal(p):
    return '/' + ''.join('\\'+c if c in '\\*?[]' else c for c in p)
patterns = '\n'.join(literal(r['path']) for r in m['inputs']) + '\n'
subprocess.run(['git', '-C', sys.argv[2], 'sparse-checkout', 'set',
                '--no-cone', '--stdin'], input=patterns.encode(), check=True)
PY
git -C "$staging" checkout --detach c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2
test "$(git -C "$staging" rev-parse --is-shallow-repository)" = false
python3 "$evidence/closure.py" --repo "$staging" --staged-root "$staging" \
  > "$evidence/staged-closure-verification.json"
git -C "$staging" show HEAD^:tools/check-silent-stubs.js >/dev/null
git -C "$staging" show 63d563df7a2b901d222a311ceaf55a0823a22261:src/api_table.json >/dev/null
git -C "$staging" diff --exit-code HEAD -- src lib tools test fonts host.js index.html CLAUDE.md
git -C "$staging" diff --cached --exit-code HEAD
```

The checker reads blobs from the supplied Git repository, independently derives
the revision's directory membership, checks all rows and hashes, writes/reads
one temporary blob at a time, verifies accepted ancestry and history inputs,
and checks the staged files/modes when `--staged-root` is supplied. It rejects
extra files in the scanned directories/root JS set, so an old ignored source
file cannot silently enlarge a directory scan. It does not execute source,
generators, build gates, the compiler, or a guest. Its temporary files live by
the evidence script; include this in the space admission. The offline result's
`stagedRootVerified: null` truthfully means no entire checkout was created here.

For local recovery, the source donor
`/home/user/wine-assembly-aoe3-oleaut-ordinal-repair-oct22` has working origin;
the exact census/evidence donor is
`/home/user/wine-assembly-aoe3-host-census-canonical-oct22`. Read Git blobs rather
than trusting their focused working directories. They borrow object stores;
remote task refs are the durable recovery anchors. This worker used read-only
symlink views of donor object shards/packs to avoid inherited alternates nesting
limits. Those local views are not a backup and must not be assumed portable.
No archive, repack, or canonical module recovery is needed for this manifest.

## Inputs, generated outputs, and external dependencies

`src/` is the complete WAT/WATX/API/generated-source directory. `main.watx`
continues to define compilation order. `tools/` and `lib/` are complete tracked
directory supersets for literal and dynamic module loads, the vendored
compiler's four VM-loaded files, method specs, generators, baselines, census,
layout JSON, and provenance/CHANGELOG seals. `test/` is a complete tracked
directory superset for recursive JS scans, test membership/timeout source
inspection, `run-all.sh`, two build-invoked memory/RPC checks, owner references,
and fixtures. The build does not run that entire test suite. `fonts/` is a
conservative asset directory superset; toyVM ASSETS explicitly requires
`fonts/Terminal.fon`. Root JS files are included for the census, plus
`CLAUDE.md`, `index.html`, package metadata, `.gitignore`, and `AGENTS.md`.

The two tracked `docs/dos-corpus/live/toyvm-{bundle,jit-bundle}.js` files are
comparison **inputs** to bundle reproducibility, not outputs to regenerate for
admission. Both ROOTS and JIT_ROOTS, their recursive literal imports, and ASSETS
are derived in `dependency-review.json`. `tools/toyvm/emit-decoder.js` is an
imported input, not an interchangeable generated artifact. `filesystem-review.txt`
retains source locations for manual inspection of dynamic reads. Region owner
references are derived and checked too. Full directory coverage handles
`path.join` requires and enumeration; this is not a regex-only closure claim.

Tracked generated inputs must be staged at their pinned bytes: dispatch table,
API hash/IDs/data, host signatures, GL encoder ABI, region-map mirror, layout
offsets, and committed toyVM bundles. Gates compare these with generation in
memory; do not run write/sync/update modes or waive a mismatch. The obsolete
`src/09b-dispatch.generated.wat` is absent at this revision; `gen_dispatch.js`
contains a cleanup for it, so do not supply a stale ignored copy.

New canonical outputs are `build/combined.wat`, `build/wine-assembly.wasm`, and
`build/wine-assembly.compat.wasm`. Named wasm is opt-in and off; stale named
output may be removed by the build. `build/` is created by build.sh. None of
these outputs is a missing tracked input. No newly compiled artifact exists
from this task or the last canonical attempt. Historical and test-instrumented
wasm are not canonical outputs of this candidate.

Historical build environment was Linux, Node **v24.18.1**, Bash, Git and standard
`mkdir`/`ls`; no wat2wasm is used. `closure.py` additionally needs Python 3
standard library. The default build/gate path inspected here uses Node builtins
and the vendored compiler. PNG generation CLI branches in `tools/fnt-read.js`
and `tools/toyvm/run-dos.js` have dynamic, repository-local `node_modules/pngjs`
requires, but the normal bundle check/decoder differential do not invoke those
CLI branches. Fixture tests and the retained runner have separate ignored Node
dependencies; do not mistake a complete tracked manifest for their recovery.

`external-dependencies.json` inventories the exact package-lock versions and
integrities for the declared packages. Retained runner dependencies remain at
`/home/user/aoe3-original-oct22/runner/node_modules`, historically supplied via
`NODE_PATH`. This task did not read that stopped remote filesystem and cannot
verify its current availability, binary hashes, native module ABI or Node
executable hash. Those are explicit external unknowns for future admission,
not missing tracked-file discovery. No npm install, download, or package copying
was performed. Preserve existing modules and inspect resolution/version under
the future assigned environment; do not launch a game to discover dependencies.

## History preflight and one later normal build

Run this only after the coordinator authorizes a real build and the staged
checker passes. Save versions and full command/environment with the result.
`HEAD` must stay at the candidate, with its real parent. The API table at main
and candidate is the same 723,350-byte blob; `history-inputs.json` records it.
The explicit base check supplies useful historical evidence in addition to the
normal build's default HEAD comparison. Reject an `index check only` fallback.
The silent-stub check needs clean src/tool/index state and `HEAD^`; archives
cannot provide its same-commit audit. `wat-dup-census --check` uses its tracked
baseline; `--new-from` history diff is not requested by build.sh. The paren
check runs with `--no-diff` against newly concatenated WAT.

```bash
cd "$staging"
check_original_pins() {
  python3 - <<'PY'
import hashlib, json
from pathlib import Path
o = Path('/home/user/aoe3-original-oct22')
groups = [(o/'runtime', json.loads((o/'runtime-pins.json').read_text())),
          (o/'installed', json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]
assert [len(rows) for _, rows in groups] == [199, 174]
for base, rows in groups:
    for row in rows:
        p = base/row['path']
        assert p.stat().st_size == row['size'], str(p)
        assert hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256'], str(p)
print('PASS 373 immutable original runtime/installed pins')
PY
}
check_original_pins > "$evidence/original-pins-before.log"
node --version
git --version
bash --version
node tools/check-api-table.js --base=63d563df7a2b901d222a311ceaf55a0823a22261 \
  > "$evidence/api-history-preflight.log" 2>&1
if rg 'index check only|no .* copy to diff against' "$evidence/api-history-preflight.log"; then
  exit 1
fi
env -u NODE_OPTIONS -u WINE_REGION_MAP -u WINE_REGION_SHAKE -u WINE_WAT_NAMES \
  -u WINE_WAT_COMPILER NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules \
  bash tools/build.sh > "$evidence/canonical-build.log" 2>&1
sha256sum build/combined.wat build/wine-assembly.wasm build/wine-assembly.compat.wasm
check_original_pins > "$evidence/original-pins-after.log"
python3 "$evidence/closure.py" --repo "$staging" --staged-root "$staging" \
  > "$evidence/post-build-closure-verification.json"
```

This is an ordinary build with gates intact. Full-gate success remains unknown
until its actual exit status and complete log are captured. Stop at a genuine
gate/environment failure; do not revise source, census, baselines, or this
manifest to force a pass. Preserve any failure log. No guest command is part of
this recipe; a later original-game qualification is separately assigned.

## Original inputs and stopped runtime recovery references

Box `bx_32262dnp` was snapshot-stopped by the coordinator at
`2026-10-22T12:46:20.151Z`, stop `stop_7760782b0c9f8bab`, completed/error null,
forced false. The receipt is copied unchanged to `coordinator-runtime-closeout.json`;
the original is `scratch/usage-watch/aoe3-oleaut-runtime-closeout-oct22.json`.
Its former running expiry `12:53:29.069Z` is historical, not an active lease.
No resume/fork/new/exec of that box was attempted. Lifecycle and any future
recovery belong to the coordinator.

Retained source/evidence: `/home/user/aoe3-oleaut-repair-oct22`, including
`evidence/host-census-canonical-20261022T1237Z/`. Originals:
`/home/user/aoe3-original-oct22/{runtime,runner,installed}`. Preserve
`runtime-pins.json` (199 runtime rows) and
`installed-audit/installed-manifest.json` (174 installed rows), together **373**.
The recipe must not rewrite or relabel them as source-build pins. For a future
authorized recovery, use their existing size/SHA-256 values to verify both sets
before and after staging/build, rooted at `runtime/` and `installed/` respectively;
do not regenerate manifests from potentially changed files.

`prior-accepted-original-identities.json` is an unchanged copy of accepted
runtime identities and diagnostic handoff. `historical-original-373-check.json.gz`
is an unchanged historical successful check (paths/ok, not replacement hashes).
No new check of the stopped remote originals is claimed. Historical runtime
module `runtime/build/wine-assembly.wasm`: 1,878,971 bytes, SHA-256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
Keep it separate from new canonical output. Historical test-instrumented module
hash prefix `7fdda154` remains in the repair handoff and is not substituted.

Native donor `/home/user/wine-assembly-aoe3-native-parse-failure-cause-oct22`,
commit `07037a8a2eb82c4a86cd3ee64a098f3e98173e0a`, retains
`scratch/runs/20261022-aoe3-native-parse-failure-cause/{RECOVERY.md,REPORT.md,HANDOFF.json}`.
Remote diagnostic handoffs remain
`diagnostics-native-parse-cause-20261022T1125Z/HANDOFF.json` and
`diagnostics-targeted-localization-20261022T1058Z/HANDOFF.json` under originals.
No archive/rebuild of those retained modules/runner/donors is needed. ShadowMan
and all other games remain untouched. Source acceptance is complete; native
OLEAUT8/parseURL/localization/gameplay qualification remains unclaimed.
