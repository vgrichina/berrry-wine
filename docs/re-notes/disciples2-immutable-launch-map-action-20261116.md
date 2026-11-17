# Disciples II immutable launch admission, 16 November 2026

Evidence: `scratch/runs/20261116-disciples2-immutable-launch-map-action/`.
The previous original remains permanently closed and disqualified. Its missing
manifest is not reconstructed. The earlier worker's late fix request was not a
repair; this change repairs the production supervisor itself.

Every supervised launch now requires `moduleHolder`, `immutableManifest`, and
`childInheritance: "sealed-node-v1"`. There is no environment-triggered optional
sealing or shared-source fallback. Before preflight, watchdog, or native runner
creation, the supervisor checks the holder's live PID/start token, actual Linux
descriptor seals, manifest identity, complete source inventory and every body
hash, module hash, and preload hash. It copies these into its own sealed,
live descriptors. The actual Node bootstrap is loaded from a sealed descriptor,
with symlink preservation, rather than requiring mutable preload bytes from disk.

`hold-module` now prepares both sources and module. Its `prepare.json` requires
an exact main ancestor SHA in `sourceRevision`, the checkout `cwd`, and an
explicit `ownedPatchPaths` list restricted to this task's helper/test paths.
Git blobs supply all other code, including WAT, CLI helpers, libraries and the
compiler. Foreign shared WIP is excluded. The canonical compiler runs over that
sealed Git view into a transient descriptor; the manifest binds its source,
index, preload and resulting module hashes. Installed pngjs and the original
media manifest/historical media pins are explicitly inventoried non-Git inputs.
Git plus the recorded binary patch is the source archive; no source/media/Wasm
bundle is written to the run.

Use `detach-holder RUN/HOLDER` after writing `prepare.json`. An independent wait
owner arms a finite holder deadline before preparation and records actual wait
and EOF receipts; writing `stop.json` normally closes the holder. This avoids
depending on an invoking tool's long-lived pipe. The recipe's immutableManifest
contains the holder's manifestSHA256 and the manifest's gitSHA, sourceSHA256,
moduleSHA256 and preloadSHA256. `run`/`detach` use that exact recipe. Production
admission probes actual parent, Node Worker and child-process reads of
`test/run.js` and the module, requiring their identities to agree. Explicit
child environments or execArgv that omit sealing are rejected.

Whole-pool eager validation was measured separately: the 103,292,798-byte JSON
pool cost about 370–426 ms in an isolated parent/Worker pair, and 850–1285 ms in
later native processes. A native guest Worker stalled between source read and
inventory validation while observation timed out. Other shell/Python processes
also entered disk-wait state; the full scheduling/IO stall is not attributed
solely to source decoding. The indexed loader follows the published LMarbles
approach: the supervisor validates the entire sealed pool and closure before
launch; each Worker validates the complete index/ranges and hashes source bodies
on first access. Indexed native Worker preload observations were about 65–97 ms
in one run. These are observations, not a new latency admission gate.

Tests retain failed startup and expired-review attempts without claiming their
assertions ran. Production negatives cover omitted activation, missing/stale/
unsealed/mismatched holders, manifest mismatch, omitted inheritance, explicit
Worker/process inheritance loss, and incomplete/corrupt indexed inventories.
The valid production supervisor exercises real Node Worker/process identities
and an actual native fixture with actual native/watchdog waits and both EOFs.
Current reviewed-context unit and native repaint/focus/modal/text/freshness/
UNKNOWN tests preserve 5/30-second freshness, 500 ms confirmation, independently
prearmed 1750 ms physical UP, immutable 3000 ms completion, and permanent closure.
The locked canonical build and actual CLI guarded-input checks passed.

The newly authorized original recipe requires completionSession, real clocks,
guest Workers, 3600-second native limit, independent 3620-second watchdog and
300-second irreversible Quit reserve. Module/source preparation precedes those
clocks. Its eventual New Quest/action/turn/native Quit result belongs in the
run's final result.json; fixture input receipts alone establish no game progress.
