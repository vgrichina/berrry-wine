# Army Men support closure: reproducible guest initialization blocker

The four admitted real support DLLs were staged through Boat file APIs on the
same box `bx_e8a7pw8v` and independently downloaded/hash-verified. Complete
transitive real-DLL resolution now passes (comctl32, smackw32, ole32, mfc42,
msvcrt), with no missing DLLs. All 419 originals passed size/SHA-256 verification;
14 generated placeholders remain excluded. Both original CPU DLLs resolve via
the actual VFS fallback and export nonzero `wincpuid` and `cpunormspeed`.
Registry hash remains `f9cb15d55aba37c096a4886b3c1968777281b40665f2d1e0281b127aa5745c6b`.

Tested source: `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`.
Existing canonical module: `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. Identity checked before/after; clean remote Git status and
checked-in observer/runner/authority/loader identities verified. No rebuild,
source census replay, overlay, source repair or main integration. Prior canonical
provenance remains in `20261021-army-repaired-canonical-runtime/report.md` and its
`repaired-evidence`; old logs were not repackaged as new build evidence.

## Actual guest result

Two fresh headless launches used `test/run.js`, the original EXE/guest cwd/VFS,
no-threads route, checked-in observer and the established Boot Camp sequence:
click279, Enter down500/up501, baseline670, Numpad6 down674/up706, capture713.
Full arguments/environment construction are preserved in controller.js and each
run's launch.json. Observer-only tracing was uncapped, with a 90-second runner
bound and 105-second controller deadline. Neither controller deadline fired.
Node was v24.18.1. No browser/FPS/audio qualification is claimed.

Both launches exited 1 before reaching the menu or injecting scheduled input.
Their complete 4,041-byte output logs are byte-identical. comctl32 and smackw32
DllMain return 1; ole32 DllMain at `0xa47fcb` traps:

```
Authority deadline exceeded; operation outcome unknown; client is unusable
crash EIP=0xa481b9 ESP=0x74ffe3c EAX=0x1
Error: DLL initializer did not return: module=0xa26000
code: ETIMEDOUT
```

The stack passes through `NamedEventAuthority` constructor, `cliEventEndpoint`,
`ThreadManager._eventClient`, `_authorityEventReference`, `openEvent`, and
`h.open_event`. This is the first reproducible runtime blocker; root cause is
not established and repair requires a separate bounded assignment. No timeout
increase, threading switch, bypass or source change was attempted.

Boot Camp, unobscured before/after gameplay, actual input acknowledgements,
scrolling, pixel-call correspondence and stripes are **unqualified**. There are
no guest PNGs; renderer-preflight.png is only an encoding check. Observer JSONs
are retained as failed-run evidence, not accepted pixel pairs. No historical
stripe-causality claim.

## Preservation and handoff

Local run: `scratch/runs/20261021-army-support-closure-gameplay`.
Remote: `/home/user/army-current-main/support-gameplay-evidence` plus its tgz.
Both full logs, launch/exit/observer records, closure and postflight identities
were downloaded and verified using remote size/SHA-256 seals. `verify.py` passes.
No Army candidate exists in the local manifest, so this is an investigation
receipt rather than an unrelated dashboard result. No game re-notes entry exists;
this report records the new blocker. Original assets are not copied into Git.

Box left RUNNING (API `idle`, health `ok`), expiry
`2026-10-21T12:21:46.313Z`. No remaining guest/controller. Coordinator owns
shutdown. Source/build/VFS/support DLLs and all prior failed evidence remain
on the same box. Handoff before 12:10 UTC. No other boxes, workers, public deploy,
laptop changes or shared root WIP changes.

Task branch: `task/army-support-closure-gameplay-oct21`.
Tracked report and compact evidence archive: `docs/reviews/army-support-closure-gameplay-20261021.*`.

Repository-wide dashboard evidence check exits 1 for the pre-existing
`20261002T042949Z-reflexive-zuma-deluxe-startup` containment error; historical
missing/invalid records are also reported. None belongs to this task. The task's
offline verification passes all 15 remote artifact seals and both matching
failure logs. Local footprint is below 1 MiB and free space exceeds 3.85 GB,
above the 2,285,895,680-byte floor plus 600 MB reserve.
