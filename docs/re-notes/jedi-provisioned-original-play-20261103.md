# Jedi original Play passes prerequisites, then cannot start the game

One ordinary installed `Jedi.exe` session with the two genuine DirectX files
passes the original prerequisite predicate. The first new blocker is the
ordinary `WinExec` handoff: the unquoted executable path under `C:\Program Files`
is split into `C:\Program.exe` plus parameters. Both launcher attempts return 2,
and its original “Unable to start the Jedi Knight Demo game program” dialog
appears. No child engine starts and gameplay remains unqualified.

Evidence: `scratch/runs/20261103-jedi-provisioned-original-play/`. This is a
findings-only change; no production source, guest bytes or registry were edited.

## Genuine provisioning and identities

The [published prerequisite recovery](jedi-genuine-directx-prerequisites-20261103.md)
is reused, with all 41 retained artifacts independently size/SHA-256 verified.
The signed 12,144,784-byte DX81 package retains SHA-256
`d1762981f497a623b2f3e725c0916b96e716bd4a8845c5a4cc7f764b1a5cc5f7`.
The only added file visibility is through the supported explicit VFS mounts:

| System file | Bytes | SHA-256 |
| --- | ---: | --- |
| DSOUND.VXD | 48,170 | `92fd75ba86688d7058a449fb37242f2bfb57bc6057d92fb06d5b127212dea404` |
| DDHELP.EXE | 31,744 | `fa21dafc3c4052824861fbca1acb06b225ca51b0de93dd255aedbbce533315cf` |

These are file-only prerequisites, not a complete DirectX installation or
native VxD/DDHELP execution. Existing DDRAW/DSOUND builtin execution policy and
their accepted 1,024-byte file entries remain unchanged. Restoring those
accepted entries does not retain a `staticModule` entry tag; builtin-only
execution is selected separately by `lib/dll-registry.js`. An initial scratch
verification assertion confused those two layers and was corrected without
changing production code or repeating the guest session.

Alice35407 and GL64819 exact threads each had actual terminal0 and exact
`AUTHOR RELEASE` before this task built, allocated a boat or ran a guest.
GL released commit `c1f211fdc027052994180ca52b0bff873715cd99` at 05:08:26 UTC.
A fresh `flock /tmp/wine-build.lock bash tools/build.sh` then passed. All
4,156 sealed current source/support inputs remained identical during the
build and after the guest. The 2,081,417-byte module has SHA-256
`36a80f073b3bc4f59bb66d8c292684085c111be42cf999523723ff0cfab64788`.
`current-source-inputs.json.gz` has SHA-256
`cfdf83f296ed5d5686aec2e859867949fa69e2676336c501e9e7369c114590a9`.
`actual-module-inputs.jsonl` records this module as both the actual compile
input and completed instance. There is one guest process and no child receipt.

The accepted original package recovery again verifies 361 mappings and all
28 installed originals / 39,900,850 bytes. Before and after observations also
hash every original in the actual VFS, both added genuine files, and all
219 staged runtime members. All 136 observed VFS entries are unchanged.
The accepted installer registry, both live captures and final export compare
equal across all 76 keys. No DirectX version or installation metadata is added.

## One ordinary Play and the new blocker

The personally reviewed `retrieved/session/before-play.png` shows the original
launcher with its Play button. One renderer click at `(320,284)`, batch
1,036,084, produces the following observed path:

1. All four required names resolve: DDRAW.DLL, DSOUND.DLL, DSOUND.VXD and
   DDHELP.EXE. The two newly provisioned files have their exact original sizes.
   All four existing optional `CompareFileTime` calls return +1.
2. At batch 1,038,212 the predicate returns `EAX=0` at `0x4028af`; batch
   1,038,213 reaches `0x402905`. Neither missing-file branch `0x402f1a` nor
   DirectX-dialog branch `0x4028b3` is taken.
3. The original launcher calls `WinExec` with the unquoted command
   `C:\Program Files\LucasArts\Jedi Knight Demo\Jkdemo.exe`, show command 5.
   The current host parser splits the first whitespace and adds `.exe` to
   `C:\Program`. The CLI therefore looks for `C:\Program.exe`, which is absent,
   and returns 2. A second original attempt with `JkDemo.exe` does the same.
   Between them, the launcher's own `FindFirstFileA` finds the actual installed
   `JkDemo.exe`, size 1,388,032 bytes.
4. The personally reviewed `retrieved/session/after-play.png`, batch 2,260,976,
   shows the original “Unable to start” dialog, rather than the prior DirectX
   requirement warning. No suggested direct JK.EXE launch was followed.

The source-only `launch-parser-observation.json` reproduces the current parse
and includes a quoted control without executing a guest. Relevant code is
`host.js`'s `parseShellLaunchCommand` / `resolveShellLaunchPath` and the ordinary
spawn boundary in `test/run.js`. This localizes the observed behavior; it does
not establish which Win98 path/short-name or launch semantics should change.
There is no proposed engine repair or old-fail/new-pass claim in this task.
The next bounded work must establish faithful Win98 behavior and process-path
provenance before changing that contract, then retest the same ordinary route.

The session was stopped at this new blocker using harness quit: exit0 after
68.569 seconds. `final.png` is the reviewed solid teal desktop after quit;
the blocker capture is **after-play.png**. No gameplay controls, audio, FPS,
engine initialization or native driver execution are qualified.

## Retrieval and delegated shutdown

Boat `bx_k44k9b4f` had finite TTL 1,200 seconds and original expiry
`2026-11-03T05:30:07.205Z`; its ID, expiry and this worker's delegated shutdown
ownership were recorded before use. The 256,993-byte evidence archive and all
31 members were retrieved and full-SHA verified before the stop request.
A separately retrieved/hash-verified postflight record at 05:13:15 UTC shows
no scoped guest/controller/supervisor processes and no 8143/8144 listeners.

Stop `stop_b0beb044b0ea8b96` was accepted at `05:13:15.411Z` with `error:null`.
This worker selected `--no-snapshots`, which removes the sandbox/stop metadata
after shutdown. Subsequent info and scoped stop-status queries return 404,
the scoped all-state list has no such boat, and its preview returns HTTP410
“preview archived”. Those are the actual retained shutdown observations.
A literal terminal `STOPPED` / completed-stop receipt is **unavailable**;
the pending acceptance receipt must not be relabeled as completed. A global
stop query was denied by the API key and was not pursued. Future tests should
retain normal lifecycle metadata through completed-stop verification. No
boat was resumed or left available, and no new boat was allocated to hide
this evidence gap.

The brief pre-runtime local disk shortfall was observed, flagged, and cleared
by coordinator-owned lossless cleanup before any build/boat/guest operation.
No subworkers, browser run or public deployment occurred. Findings and recovery
are published; Alice's next task follows this worker's actual terminal/release.
