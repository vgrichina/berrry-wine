# Region census between-gate validation repair

This source candidate repairs the rejection of candidate
`66436f785bbe3166a992402f95abf083ca0d6736` (base
`1cf9788cc3ac807027206c39fcbf1d2771599845`). It requires **fresh independent
acceptance before integration or runtime**. There was no main integration,
full build, guest, browser, Boat, compiler, CPU/control change, or worker launch.
Historical CPU rejections 126.1068 > 90 and 105.48018 remain binding;
modules remain UNQUALIFIED and completeness UNKNOWN. No box was assigned;
the coordinator retains lifecycle ownership.

Before editing, the byte-identical portable driver from rejection commit
`a4765f6347b9bbb94274c2bce9ca37c07c779954` reproduced REJECT in eight actual
production CLI invocations. After the first `host.js` read, its preload appends
`(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))` to both fixtures.
The separate original processes fail at embedded-wat; the unchanged combined
candidate exits 0 with all four OK. Driver SHA-256 is
`fc237edbf04b7e0f735aee352a9774515b3b4cfde4ad3cdcf43d73ae45930b21`.
The original receipt is preserved as `original-rejection.json` in the new
acceptance directory, with full outputs retained in the durable archive.

The combined invocation now rereads declaration text and validates its layout
before reusing parsed declarations. Its private parse cache requires identical
file, text and validated layout identity. Layout memoization compares the actual
compiler input: current declaration text plus freshly discovered/resolved law
globals. Source text already read by the collector is shared only within that
consumption, avoiding redundant reads of the same declaration file. Changes,
removals, malformed declarations, changed or removed law providers and newly
discovered providers therefore cannot reuse an obsolete layout.

Each later gate also reloads/validates main.watx before its scanner, matching the
old process-start boundary even for the embedded-WAT scanner. WAT target lists
are stable within a gate and refreshed for the next gate; JS targets and all
scanner text/baselines retain live discovery/reads. The first `--gate` before
`gen-region-map --check` and the subsequent js-copies, embedded-wat, dup-payloads,
hand-rolled order remain unchanged, including stopping at the first failure.
No baseline was altered and the combined path remains enabled.

Validation on the final source includes 17 differential mutation cases against
the pinned original CLI **and original layout/declaration dependencies**. Cases
cover the unchanged attack, added/changed/removed/malformed declarations,
declaration-file removal, same-size alignment mutation with restored timestamp,
changed/removed/new law providers, JS discovery, new/removed WAT targets,
malformed/removed manifests and late layout invalidation before hand-rolled.
Exit status, ordered stdout and causal errors agree. Stack excerpts/paths are
normalized; compile-wat's process-start loader wrapper is normalized to the
same underlying manifest error. Original stderr is retained. The final source
also passes the existing 147-invocation matrix for violations/first failure,
default/individual/record/unsupported CLI behavior, unavailable inputs, omission
controls and exported-API isolation. Build order was asserted, not built.

Deliberately restoring stale declarations, stale layout or stale manifest
targets makes the differential driver fail. The stale-layout control restores
the demonstrated false-success result; the stale-declaration control delays
the failure past the correct gate. Controls retain assertion stderr and exit 1.

Three alternating tiny-fixture repetitions measured declaration-file reads
10 -> 5, actual declaration parses 2 -> 1, and layout compiles 3 -> 1. Collector
calls remain 2 and layout calls 3 because freshness is checked at consumption;
manifest reads remain 4. Parse counts use distinct returned parse-array
identities, with real collector/compiler execution. Observed process CPU totals
were 0.286602–0.293174 s original versus 0.105425–0.114784 s combined; maximum
single-process RSS was 60024–60580 KiB versus 63316–64304 KiB. These are bounded
fixture observations, **not full-build savings**, and single-process RSS is not
aggregate peak. Trusted supervisor receipts separately retain aggregate sampled
RSS, conservative CPU accounting and complete process cleanup.

## Portable evidence and recovery

New committed evidence and drivers are under
`test/acceptance/region-census-between-gates-oct27/`; new original dependency
snapshots are `.txt` files under `test/fixtures/region-census-build-gates/`.
The incremental `source-and-evidence.json` references the coordinator-verified
inherited manifest SHA-256
`27de6f07ac2c987bb6f6d1bccb64f4a80e7ffe1f0cd7d3242a9adcba864c9eae`.
This task verified the two supplied portable-input pins and new/changed inputs;
it does not claim a fresh full inherited payload sweep or sealed predecessor
census. Source snapshots and raw outcomes are preserved separately.

The canonical incremental completion receipt is
`scratch/usage-watch/airstrike-census-between-gates-repair-oct27/receipt.json` in
the main host workspace. It binds the final commit, exact verified remote ref,
new source/test/evidence hashes, retained archive, operation receipts and cleanup.
The adjacent `repair-evidence.tar.gz` preserves ignored artifacts outside /tmp;
object-alternate views are excluded. It contains distinct stdout/stderr and
admission/supervisor receipts for each command, including failures.

For portable recovery, restore this branch's source/test closure into a new
owned `PARENT/repo` using existing immutable Git objects and flattened read-only
alternates, and use a fresh `PARENT/ops`. Do not run predecessor wrappers or
overwrite their receipts. The exact test commands, from the restored repo, are:

```sh
/usr/bin/node --max-old-space-size=512 test/acceptance/region-census-between-gates-oct27/repair.cjs PARENT/ops/boundaries
/usr/bin/node --max-old-space-size=512 test/acceptance/region-census-between-gates-oct27/measure.cjs PARENT/ops/measurement
/usr/bin/node --max-old-space-size=512 test/test-region-census-build-gates.js test/fixtures/region-census-build-gates/original-region-census.js.txt PARENT/ops/legacy
```

Run under the archived owned wrapper, adapted to the new ROOT/accounting paths,
the pinned trusted supervisor and fresh admissions. For rejecting controls add
`--stale-declarations --only=unchanged-invalid-align`,
`--stale-layout --only=unchanged-invalid-align` or
`--stale-targets --only=new-manifest-target` to repair.cjs with distinct output
directories. These controls must exit 1. For the unchanged pre-repair driver,
follow the rejection report's recovery recipe on exact candidate 66436f7;
driver exit 0 means REJECT reproduced, not acceptance.

Node startup was checked once for `/usr/bin/node --max-old-space-size=512`,
v20.20.2, sanitized explicit environment, inherited DATA/AS unlimited and the
unchanged trusted supervisor configuration. Node RSS768MiB is supervised
separately from its heap512MiB flag. Git receives DATA512MiB only on the Git
subprocess and RSS256MiB; Python uses RSS128MiB. Each operation uses CPU90,
wall120, file24MiB, output2MiB, pool slots1/wait20, and Git flock where relevant.
No enforced limit was raised. Per-operation fresh admissions include allocated
checkout/Git/ops and directories, launcher/session/events, conservative full
current shared WAL once, 176MiB prospective growth including 32MiB reserve,
allocation512MiB, host free disk minus872415232 >=2982150144, remaining client
growth to320MiB, largest child768MiB and host headroom805306368. Final actual
admission measurements are retained in the canonical receipt.

Strict dedicated Git SSH identity/known-hosts configuration was retained. No
mount invocation exists, so filename-bearing mount parsing is inapplicable.
Root/donor tracked files, index and refs stayed read-only; the root board was
claimed, watched and released append-only. Initial root-ref identity reuses
the supplied launcher digest; no full ref listing was captured. No clone,
fetch or repack was performed. Early policy/inspection terminal captures
exceeded the intended per-operation display ceiling; session/events preserve
that incident. Test-setup and error-normalization failures remain in distinct
receipts, and corrected continuations reused completed unaffected cases.
