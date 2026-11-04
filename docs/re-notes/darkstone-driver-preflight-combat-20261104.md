# Darkstone driver preflight and safety stop, November 4

The inherited run-only `browser-driver.cjs:23` quoting error is repaired in
`scratch/runs/20261104-darkstone-driver-preflight-combat/`. A template literal
preserves the complete `Runtime.evaluate` expression. Tests execute that exact
expression with absent and populated endpoints and check observation, options,
evidence, adapter and control fields. The predecessor's files and failures are
untouched; `inherited-syntax-failure.txt` also records the original error.
No production source, media, game configuration or guest state was modified.

The unchanged uploaded-manifest verifier passed all **1,424 pins**. Its retained
8,000-record/896,012-byte test passes, and wrong hash and size each exit 1.
Before Chrome, Python/helper JavaScript syntax, Puppeteer/static-server imports,
localhost isolation/HTTP transport, delayed startup ACK, sequential command ACK,
atomic command publication, exact driver capture bytes/state/fresh-name checks,
64-step bounds and binary upload/download recovery passed. Run-only control now
waits for startup and prior replies and publishes through a temporary file and
rename. Recovery no longer assumes another arm retained an equal module.

**Preflight did not establish complete HTTP pin coverage.** The software browser
opened once at 03:17:01Z. The HTTP guard rejected
`build/wine-assembly.wasm` at 03:17:06.527Z because the inherited manifest omitted
that path, despite its actual hash matching the supplied canonical
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
The host then compiled WAT as its ordinary fallback. The guard also rejected
unlisted `test/binaries/dlls/comctl32.dll` (observed SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`).
These are omitted manifest entries, not demonstrated file hash mismatches.
`served.jsonl`, HTTP/console logs and `served-pin-coverage.json` preserve them.
The supplied companion hash
`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`
was not observed executing.

The first requested 64-step command was refused by the driver's halted guard;
**zero requested guest steps ran**. The inspected startup and safety-stop images
show the shell/loading log, with no game world. No guest key or mouse input was
issued; the browser's trusted Launch-button down/up pair is retained separately.
The safety failure stopped gameplay. There was no retry, reload, second launch
or WebGL arm. Manual selection, Town/Ardyl, enemy defeat, surviving player and
actual renderer ownership remain **UNTESTED/unobserved**. Software was selected
in the toolbar, which does not prove draw consumption.

Actual observation records page compilation and instantiation, then transmission
to guest Worker slot 0, of fallback module
`dc2485dcdba40e636e1e13469be3d639cbf248c29d16c74738e95b7d505611c9`
(**2,109,501 bytes**). Its recovered bytes match that full SHA-256. This is not
the supplied canonical module. Prepared source identity remains
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`; exact checkout SHA, relevant binary
diffs and relevant untracked/owned-new-file patches are retained without source
archives or media copies. Historical `4649ee5f…`, EXP 0 → 79 and LIFE 17/35
remain old evidence. No parity, FPS, audio or full-game claim follows.

Recovery exposed another cheap control limitation: a failed command ACK consumed
a sequence number without advancing the local counter, and the prior-ACK gate
also prevented safe recovery after failure. The new run preserves that failure,
records the sequence reconciliation, advances its counter on publication, and
allows only the driver's existing observation/release/quit actions after a
failed ACK. Focused tests verify a failed ACK blocks steps while permitting quit.
These recovery-only actions collected the module, screenshot/state and logs;
all 30 then-existing files were recovered and SHA/size checked before quit.
Final recovery checks **34 files** including acknowledged quit and cleanup.
No gameplay resumed.

Box `bx_92ssqvkw` was verified RUNNING/APIidle, healthy and hydrated and ACKed on
the messageboard before remote use. Chrome PID 32126 exited **0** at
**03:17:55.344Z**, under 54 seconds after launch; the driver is absent and private
port **35613** is closed. Postflight confirms all **15 original media hashes and
sizes unchanged**. Final API verification returns RUNNING/APIidle, health `ok`,
hydrated `true`, expiry **2026-11-04T03:42:18.748Z**. Shutdown ownership returns
to the coordinator. No allocation, resume, stop, delete, subworker or public
deployment occurred.

The next authorized attempt needs a complete served-binary/dependency pin
inventory, verified by actual localhost GETs before Chrome, with canonical-module
fallback treated as a launch failure. Preserve the original 1,424 comparisons
and extend coverage explicitly. This task stops at the runtime safety failure;
paired original combat remains outstanding.
