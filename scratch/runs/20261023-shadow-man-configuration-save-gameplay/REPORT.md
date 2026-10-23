# First blocker: recovery helper plan-count assertion

Task stopped before runtime staging or guest execution. **Ordinary Configuration
OK/defaults, settings persistence, current Play enablement and gameplay were not
tested.** This is a preparation-helper failure, not a Shadow Man guest failure.

All 2,083 original files / 186,399,681 bytes were restored successfully into
assigned box **bx_fn7pn7yg**. Every per-file source HTTP206 and raw destination
PUT was bounded to 64KiB application reads, checked against the accepted SHA256,
and recorded in `transfer-files.jsonl`. No original transfer error or retry
occurred. A separate read-only destination census then rehashed all 2,083 files
and matched every accepted relative path, size and SHA256;
`destination-original-hashes.json` and `handback-integrity-api.json` retain it.
The complete original transfer took 1,077.401350 seconds.

The running `recover.py` next executed its incorrect `assert len(plan)==217`
and exited **1** before the first runtime staging upload. The accepted donor
`staging-plan.json` actually contains **224** entries: **216 immutable entries
plus eight fixed helpers**. The separate ctl-pin receipt brings the accepted
immutable-entry count to **217**. I confused that immutable count with total
plan length. This was my orchestration error, not missing game media, a denied
Boat action, a capacity failure, or an emulator defect.

I noticed the count discrepancy while the long original transfer was running and
edited the on-disk assertion to 224. That did not change the Python code already
loaded in the process: it still failed its original 217 assertion. Python's
traceback read the later source line from disk, so its displayed `==224` line
does not identify the executed comparison. `recovery-process-result.json`
preserves that raw observed traceback and distinction. `recover.py` is restored
to the exact original executed assertion for reproducibility. There was no
second recovery/staging invocation and no continuation past the blocker.

The prepared `prepare_runtime.py`, `session_runner.py`, `operate.py`, settings
observer, gates and fixtures were **not executed on the box**. They are retained
as unexecuted preparation, not accepted runtime recovery or capture evidence.
Local Python/embedded-command syntax and `node --check` passed; an offline parser
confirmed the eight observation exports in the exact canonical donor Wasm.
No canonical module was uploaded, consumed or instantiated on this box. No
tmpfs mount, VFS clone, native DLL loading, endpoint, ctl command, watchdog fixture,
live PNG, ordinary input, Configuration action, game launch or guest exit occurred.
Attempts: original transfer **one**; runtime staging **zero**; guest sessions
**zero of three**; game launches **zero**. No installer/build/compilation,
replacement task, worker, lifecycle action, main merge or deployment occurred.

Read-only handback collection initially sent too large an inline inventory and
received HTTP400 `sandbox_direct_failed` before execution. That secondary
collection error is preserved in `first-api-error.json`. The subsequent distinct
short read-only command enumerated/hashes destination files itself, avoiding the
oversized argument; it exited 0. It did not retry preparation or guest execution.

## Identities and observations

Authoritative remote main reconciled read-only to
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`, the documentation-only successor of
runtime source `58e90870a40a541a4083cae5e987ca8de31889e6`. All **8,306** integrated
base index entries remain exact. Intended canonical Wasm remains 1,879,387 bytes,
SHA256 `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`;
that is an accepted donor identity, **not a loaded module in this task**.

Fresh destination hashes:

| Original file | Bytes | SHA256 |
| --- | ---: | --- |
| parent-registry.json | 17088 | d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3 |
| D3DConfigUtility.exe | 573440 | 850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0 |
| MSS32.dll | 328704 | 09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c |
| DSETUP.dll | 135680 | 5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f |
| ShadowMan.exe | 1896448 | 4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772 |

No settings writes were exercised. Pristine registry remains separate and exact;
there is no mutable registry clone. Current settings/Play state is unknown.
The accepted historical fixture PNG was visually inspected locally: Primary
Display Driver, 640x480x16, sliders, OK, and disabled Spielen behind Configuration.
That historical image is not a new screenshot, persistence result or gameplay.
Historical `ABANDONED wndproc` after64/yield15 and COMCTL32/OLE32 warnings were
neither reproduced nor suppressed here; no callback-completion claim follows.

No Shadow Man candidate ID was found in the corpus manifest, so the capture
workflow's investigation-note route is used. There is no fabricated candidate
result.json or live screenshot artifact. No guest/player-input or Windows/browser,
audio/FPS/capability claim is made.

## Bounds and handback

Before checkout, focused measured admission was **62,095,360 bytes**, including
used donor allocations, own allowance/tools and 8MiB reserve, below 64MiB.
The final offline verifier records actual own+selected donor+tools+reserve and
host-free measurements; host floor is 2,982,150,144 bytes. No entire unrelated
donor tree, full compressed layer or local tar was staged. Credentials and
signed URLs remained in memory. Read-only donors and root Git were not mutated
by task actions; protected metadata was not independently snapshotted twice.

At handback, recovered immutable-directory allocation is **193,617,920 bytes**,
fixed **4,096**, empty mutable directory **4,096**, remote free
**48,859,430,912** bytes. Hard tmpfs was never mounted and no overlapping guest
copies exist. Recovered files are still writable: the later accepted read-only
locking/preflight phase was not reached. No runtime safety gate is claimed passed.

Box **bx_fn7pn7yg** remains **RUNNING**, actual API state `idle`, health `ok`,
stop `null`, expiry **2026-10-23T03:46:00.580Z**. Fresh `pgrep -a node` returned
1/empty; owned groups and remaining processes are **none**. No guest process
was created, so there is no runtime termination/watchdog or normal guest-exit
evidence to conflate. Coordinator owns lifecycle and 02:50UTC shutdown;
handback is early, before 02:45UTC. Old stopped box was untouched.

Evidence is committed only to `task/shadow-man-configuration-save-gameplay-oct23`.
`publication.json` records push and independent remote verification; the root
append-only messageboard records the final exact SHA. No main merge is authorized.
Task STOPPED at the first preparation blocker; no replacement work is assigned.
