# Original Airstrike pre6a bounded runtime assignment — 2026-10-24

**BLOCKED before guest startup: the required pinned PNG codec is absent.**
At 01:52:20 UTC the assigned box's ordinary Node process returned exit 2,
`MODULE_NOT_FOUND`, `Cannot find module 'pngjs/package.json'`. The complete Boat
API terminal receipt is adjacent `codec-probe.raw.json`; exact execution argv is
`codec-command.json`. This is a prerequisite failure, not an Airstrike import,
opcode, asset, API or gameplay failure. No original EXE, wasm Module/Instance,
guest input, screenshot, native arena, browser or game watchdog was executed.

The original objective remains unqualified. No claim of original startup,
rendering, gameplay, current-main qualification, or a fatal path through any of
the five static API warnings follows. Downloads, package installs, guessed API
stubs, renderer substitutions and source builds were not used to cross this
blocker. The initial box probe also found no skia-canvas/canvas packages; the
shipping raster path specifically requires pngjs.

## Executed blocker and exact identities

The historical runner `test/run.js` unconditionally attempts the ordinary
`lib/canvas-compat` renderer load; that delegates to `lib/raster-canvas.js`,
whose line 20 requires `pngjs`. A missing module is caught as renderer load
failure by the runner, rather than supplying a working screenshot renderer.
The historical lockfile pins pngjs **7.0.0**, integrity
`sha512-LKWqWJRhstyYo9pGvgor/ivk2w94eSjE3RGVuzLGlr3NmD8bf7RcYGze1mNdEHRP6TRP6rMuDHk5t44hnTRyow==`.
The first API probe reported `pngjs MISSING`; the second, diagnostic-only probe
preserves the exact error code, message and Node search paths. Neither launches
the runner. The latter is the retained minimal executed trace, with
`launcherFailed:false`, `oomKilled:false`, `timedOut:false`, empty stderr, and
no truncation. Default Node package resolution failed; this does not establish
that no retained package exists anywhere on either host.

The exact historical source is
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, not the report's main base.
The actual retained runner is at
`/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23/test/run.js`,
685960 bytes, SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
The canonical build donor contains the module but no `test/run.js`; its missing
path was corrected to the accepted historical runner without compiling or
modifying either donor. Sparse source files missing on disk were inspected by
exact-revision, read-only Git object access.

The full module remains in place at
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm`,
1879746 bytes, SHA256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
`module-identity.json` binds it to the accepted historical runner. Existing
full-module static/synthetic handler acceptance was reused as context only.
Same-task full CLI import/region ABI, real PE loading, codec execution and
ordinary runtime-data qualification were **not reached** after the codec
prerequisite failed. Diagnostic exports did not motivate a smaller module.

The original EXE SHA256 is
`0e6f5450109c4c83e97bcf263bc90dc2d64dd83587356dd8a87994cc4246b474`.
Every retained manifest path was read and compared with its previously accepted
size/SHA256: 81 original EXE/config/data files, 2632138 bytes. Exact paths and
hashes are in `original-vfs-verified.json`. All eight explicit provider hashes
and retained locations are in `dll-identities.json`: the six original bundled
providers, standing MSVCRT SHA256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`,
and authentic legacy zlib SHA256
`0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9`.
The accepted static nine-ordinal proof was reused, not audited or reacquired
again. No original binaries or provider files were changed or copied.

## Admission, execution limits and evidence limits

`historical-harness-manifest.json` inventories 125 exact historical JS/data/font
files, 10690102 bytes, including literal relative-require transitive closure,
region mirror, API/ordinal tables, ordinary fonts and stdole2 data. Optional
native GL/skia branches are identified by their external requirements; the
inactive compiler fallback is explicitly excluded under `--no-build`.
This is a prospective focused inventory, not a successful runtime load or a
claim that arbitrary dynamic requires have been executed. An example require
inside a disassembler comment initially appeared missing; excluding full-line
comments corrected that bookkeeping without changing shipping code.

`consolidated-admission.json` records a conservative **63030278 / 67108864**
byte projection. This includes 33284532 bytes of overlapping potential runtime
materialization on both hosts, measured private metadata/Git, actual session and
launcher bytes, 2 MiB report/Git future growth, 8 MiB bootstrap positive SQLite
growth allowance, 8 MiB future session/event/SQLite growth and 8 MiB reserve.
Local free after the projection was 4303596538 bytes; the assigned remote's
48302624768 bytes free also exceeds the 2982150144-byte floor after that full
projection. Largest prospective file is 723350 bytes, below 24 MiB. Installed
tools and retained read-only inputs are separately identified; installed Node
is used in place, not copied or treated as task staging. The missing codec is
not counted as a supplied package: execution admission is BLOCKED. No transfer
or complete runtime materialization followed.

The initial actual remote memory sample was 7120076 KiB MemAvailable, above
2684354560 bytes; local inspection memory was above 805306368 bytes. The
diagnostic Node probe used 256 MiB old-space and the finite Boat exec timeout;
no native wasm entry occurred. The one-process 512 MiB fixed arena, 512 MiB
old-space and 90-second CPU/wall guest supervisor were planned but never
exercised. There is no fabricated TERM/KILL guest-watchdog acceptance evidence.

Initial combined policy reads and an overly broad search in already retained
event logs produced oversized/truncated displays. They were not repeated as
acceptance checks. Existing launcher/session history is retained; bootstrap
capture is conservatively charged 700000 bytes against the 1 MiB internal
contract, without resetting history. Later output is bounded. This is not a
claim that every bootstrap capture met the requested 8 KiB display limit or
that a streaming byte supervisor guarded those initial shell reads. The
initial private-index skip-worktree stdin option was also corrected before
staging/commit; `index-correction.json` records clean private status afterward.
No shared index or refs were involved.

## Recovery and lifecycle handback

`inspect.py` is a read-only offline inventory/identity verifier. It does not
compile, instantiate, install, download or launch the game. `recovery.py` only
prints the prospective argv and required admission checkpoints; it cannot run
the command. The sparse historical donor is not directly runnable until its
manifest is materialized in an authorized new runtime destination. Binary
recovery uses the retained locations in the manifests; Git does not back up
those ignored bytes. Preserve the previously accepted original/zlib recovery
reports rather than repeating archive acquisition.

The prospective command uses explicit `--no-build --wasm`, the exact eight DLLs,
`--vfs-include=airstrikerc --vfs-include=data/**/*`, CWD `C:\`,
`--no-threads --memory-mb=512 --max-seconds=60 --max-batches=200000`.
Original configuration remains windowed 800x600, alpha2, sound1, one human,
relative datapath `data`. There was no input schedule execution. Any future
assignment must observe startup before ordinary Enter/movement/fire and use
matched keyup with meaningfully separated before/during/after captures.

Resume condition: coordinator supplies an authorized existing retained pngjs
7.0.0 package with verified identity and reassigns runtime with fresh complete
resource/ABI/data/codec admission. This report does not authorize package
downloads/installation or box extension. The five unexecuted API risks remain
unexecuted; no production repair is proposed.

Assigned box **bx_jydd4z26** was left running, with Boat API state **idle** and
health **ok** at the final read; expiry **2026-10-24T02:18:31.180Z**,
coordinator shutdown checkpoint **02:08:31 UTC**. No guest process/group or
task-staged remote files were created. Ordinary diagnostic Node completed;
guest watchdog cleanup is not applicable. Shutdown/snapshot remains the
coordinator's responsibility. No old denied box, SSH/resume operation, public
hosting, credential copying, worker launch, Claude action or main integration
occurred.

Only the new report and compact evidence are committed on
`task/airstrike-original-bounded-runtime-oct24`, based on exact main
`e5f45399bc5564a84b6b1428e15ffa412db9e929` in a new focused private repository.
Root tracked files/index/refs and standing donors remain untouched. Background
board watcher cleanup and strict SSH publication receipts remain in the
external task evidence directory. No Airstrike candidate was found in this
base's corpus manifest, so no unrelated/invented dashboard result is published.
Adjacent `results.json` is the investigation's final metadata, written after
the report/artifacts. This single task stops after verified task-branch push.
