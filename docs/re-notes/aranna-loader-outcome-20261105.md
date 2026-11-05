# Aranna DLL startup outcome, 2026-11-05

The one current original session completed DLL initialization normally and
reached the genuine EULA. After ordinary Accept, its first actual failure was
the `C:\Resources\Logic.dsres` critical-error dialog, last error `0x00000017`
(23). No menu or gameplay was reached. Checksum instrumentation remains deferred;
the dialog alone does not establish a checksum calculation or ReadFile divergence.

Evidence: `scratch/runs/20261105-aranna-loader-outcome/`.
Task: `NEW-GAME-ARANNA-DEMO-20261010`.
Diagnostic repair published on main:
`f78181348d42a1daf2fa2d149c83f401433017e5`.

## What changed and why

The preceding [ordered-read investigation](aranna-ordered-read-checksum-20261105.md)
failed before EULA: `DLL initializer did not return: module=0x9c0000`.
Its browser forwarding discarded the attached outcome, fault/cause, and owning
register context. Mode 1 and a checksum breakpoint were armed before startup.
That session's lost outcome cannot be reconstructed; observer interference
remains unexcluded. The historical [ordinary original run](aranna-original-local-gameplay-20261105.md)
reached EULA and then error 23, but was not the ordered-read session's outcome.
The [Worker read controls](aranna-worker-resource-read-20261105.md) found no
read/seek divergence and do not establish original checksum behavior.

`lib/dll-loader.js` now retains halt/yield alongside the already captured
pre-restoration EIP, ESP, return value, and fault. `lib/guest-worker.js` forwards
the existing loader log and explicitly serializes error name/message/stack,
outcome, fault/cause, and nested rollback errors. `lib/guest-thread-host.js`
reattaches those details and the owning Worker slot/command stage before
rejecting the caller. This repairs diagnostic loss; it does not change guest
execution, callback scheduling, fault mode, or frame restoration. The three
callback-census hashes were updated after reviewing those lifetime invariants;
existing pending ownership classifications remain unchanged (`lifetime-review.json`).

## Validation before the original

The new `test/test-dll-startup-rollback.js` controls exercise real generated PE
DllMain code through production GuestThreadHost/Worker transport: successful
TRUE return, NULL-jump incomplete frame, UD2 trap, and FALSE attach followed
by an incomplete detach. The added regression failed on unchanged production
code because the existing success trace was lost (`baseline-transport.log`).
After the repair both standard and compatibility modules passed, including
retained original/rollback causes, final owning EIP/ESP, halt/yield, and caller
register restoration. Existing rollback tests also passed.

Actual Chrome Worker controls repeated all four cases with the same passive
hooks planned for the original, `defaultViewport:null`, and no debug setters
or breakpoints (`browser-controls.json`, `generated-browser/`). Incomplete
outcome: EIP0, ESP0x74fffec, halt2, yield0. Trap outcome: EIP0x504000,
ESP0x74fffec, halt0, yield0, retained RuntimeError `unreachable` as fault/cause.
The restored caller ESP0x74ffffc is distinct and is not the failing frame.

Additional passing checks: `test/test-dllmain-completion.js`,
`test/test-worker-bootstrap-retirement.js`, callback-census reconciliation tests,
and `flock /tmp/wine-build.lock bash tools/build.sh` (`build-reviewed.log`).
The first full build correctly rejected stale census hashes (`build.log`);
the reviewed hash updates fixed that validation failure without bypassing it.

## The one original observation

Runtime gate: legacyADD1955 FINAL18:41:45, AoE3repairedDXSETUP2005 FINAL18:55:54,
and Conanresidency1825 FINAL19:17:29 were observed in order. Independent release
verification passed 385 absent PIDs, 152 refused ports, 41 absent profiles, four
free locks, zero heavy processes, and disk headroom (`release-gate.json`).
Runtime acquired19:18:52UTC; the original ran19:22:29–19:24:15UTC. There was one
original diagnostic, zero original retests, and no installer/media copy.

All 28 canonical inputs (281799760 bytes) were rehashed in place against the
recorded prior manifest (`media-verification.json`), using
`scratch/game-media/aranna-demo-20261105/extracted/`. Ordinary threads/GPU startup
used Chrome151 on Linux x86_64, SwiftShader, `defaultViewport:null`, viewport
1000x800. Passive transport/module retention made no guest export calls;
no fault-mode setter or breakpoint command was observed. Default execution mode
was preserved; there is no independent numeric mode readback claim.

Owning Worker0 observations (`observations.jsonl`):

- 19:22:48.825UTC: mss32.dll mapped0x9c0000, entry0x9ef6c5,
  original base0x21100000, 3863 thunks.
- 19:22:48.863UTC: `DllMain returned, EAX=0x1`.
- 19:22:48.873UTC: `dllsLoaded`, module0x9c0000, and completed `loadDlls`.
- `startup.png`: personally reviewed genuine EULA and Accept/Decline/Print.
- Ordinary Accept at page173,588 started Worker1; the next reviewed image,
  `after-accept.png`, showed the black game window and Critical Error dialog.
  The runtime MessageBox text names Logic.dsres and error0x17.
- `terminal.png` personally reviewed the same failure, then normal quit closed
  the probe and Chrome with code0. No second launch or checksum instrumentation.

Both actual original Workers received the same standard module (2173782 bytes):
`78a9e8d7563c94b1e002a688c5e65d4269946ab8dd9eb68aa3edf271f4cb1c24`.
The tested compatibility module (2176428 bytes):
`5663c49c8620789c681af2133839a886ba5d5ea877c988289c7a0a682bf29b66`.
`browser-modules.json`, retained tested modules, and `tested-modules.json`
record identity; `runtime-source.json` records exact runtime commit f78181348
and `runtime-relevant.binarydiff` is empty. The precommit SHA and relevant
binary patch, owned new-file patches, captures, and hash manifest are retained.
Git is the source archive; no source-tree archive or repeated media was made.

## Causal limit and next boundary

Current initialization success establishes the normal startup boundary on the
current main and permits future resource investigation. It does not prove why
the earlier instrumented startup failed: that outcome was lost and other main
changes intervened. No CPU/ReadFile divergence or causal guest fix is claimed.
Next, distinguish the resource validation/read failure after successful startup,
using existing tracing first; introduce checksum observation only after proving
it leaves initialization and EULA progress unchanged. There is no reason to
repeat this unchanged original diagnostic.

Final independent cleanup at19:26:03UTC passed six absent owned PIDs (including
watcher), four refused ports, two absent profiles, four free locks, no heavy
processes, and 7.11GB free (`final-cleanup.json`). Generated-browser cleanup
also passed independently. No boxes were assigned: box ID/state/expiry N/A;
no sandbox lifecycle action, subworkers, or deployment. Runtime/file ownership
is handed back with the final board release, within45minutes of acquisition.
