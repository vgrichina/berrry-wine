# Shadow Man targeted capture: observer blocker before extraction

**Diagnosis incomplete. The first failing operation in the original Error112 extraction path remains UNKNOWN.** The one authorized original Setup launch ran at 15:31:46 UTC and exited 1 after 0.322 seconds, before extractor 0x404278, any WriteFile, resource 0x1b98 or MessageBoxA was observed. No retry was made. No installer error or emulator mismatch is established by this attempt.

The capture itself failed: `sealed/observer.cjs:14` rejects a buffer longer than 65,536 bytes. Its ReadFile return observer attempted to hash the unrelated startup bitmap's complete 493,016-byte buffer and threw `Error: observer buffer bound` at batch 6. The bounded guard became an exception through the live API callback, interrupting Setup. The original startup read succeeded. This instrumentation mistake should have been caught by testing a large unrelated startup read before launch; the initial small fixture did not cover it.

## Actual operation and return evidence

The final observer entry is ReadFile, original call instruction **0x401730**, return address **0x401736**:

```
ReadFile(hFile=0x7000000a,
         lpBuffer=0x00688bc4,
         nNumberOfBytesToRead=0x000785d8 /*493016*/,
         lpNumberOfBytesRead=0x074ffa24,
         lpOverlapped=NULL)
```

The preceding CreateFileA names `C:\setup.bmp`, access 0x80000000, share 1, security NULL, disposition 3, flags 128, template NULL, and returns **0x7000000a**. At the thrown observer exception, the runner's crash dump records **EAX=1** and **[0x074ffa24]=0x785d8**. Its host filesystem log independently records `n=0x785d8, read=0x785d8, pos=0x0, path=c:\setup.bmp`. Thus this was a successful full read; its return event was never emitted because hashing threw first. These observations must not be presented as an extraction failure.

Earlier archive operations were observed: opening `C:\_INST32I.EX_` returned handle 0x70000008; SetFilePointer(handle,0,NULL,FILE_BEGIN) returned 0; ReadFile(handle,0x6859c8,6192,0x4107e8,NULL), caller return 0x404583, returned BOOL 1/count 6192; immediately following GetLastError returned 0. These do not establish later extraction behavior. The initial optional `_delis32.ini` open returned INVALID_HANDLE_VALUE; no evidence links it to Error112.

`raw/observer.jsonl` contains 43 entry/return events, 15,763 bytes. `raw/output.log` contains the actual runner trace and full crash dump, 7,674 bytes. `raw/observer-summary.json` has no selected extractor-PC hits. There is no child attempt, installer-error dialog, extraction output length/hash or screenshot from this launch. The exception path exited before the runner's final PNG write. No screenshot has been fabricated or recovered from the historical run as if current.

## Additional capture limitation

Every observed file-attribution field is null. The observer wrapped `VirtualFS.prototype.createFile`, but the authentic retained filesystem bridge calls **createFileResult directly**, bypassing that wrapper. The actual output-snapshot hook therefore had no VFS reference, and `outputs.json` is absent. `blocker-replay.cjs` reproduces this direct-call bypass against the exact historical filesystem bytes read in place. No different module instance or inaccessible runtime is claimed as the cause.

The exact missing causal evidence is: member/extractor entry and return status; output open/write arguments, BOOL/count and output position; full relevant read data/offset checks; decoder/progress/cancel returns and the actual resource caller; failed-write mapping spans if applicable; output length/hash at failure. Those remain **UNKNOWN**. Literal Error112 still comes only from the independently accepted earlier report, not a GetLastError112 observation in this attempt.

## Admission and immutable identities

Assigned runtime only **bx_2rhkq9ny**, using Boat exec API. No lifecycle calls or denied-access retries. The preflight compared all actual remote hashes independently to local retained pins: 199 runtime files, 28 runner dependency files, 23 authentic source files totaling 73,339,636 bytes. Including old setup-run/receipt evidence, **390 files** were sealed and unchanged immediately before and after execution and at final audit. The entire preserved original media/runtime was reused in place: no download, extraction, archive recovery, package installation, rebuild, or input copy.

This was explicitly **HISTORICAL diagnostic** source `c26252c4a95babe583ade1d1c6e2da0c050be45c`, WASM SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`, 1,878,971 bytes. Original Setup SHA256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`, 73,728 bytes. `src/api_table.json` SHA256 `562acd9c5870750d29cc88ed1ec12112c9da7164b8d9c3fe470a109842d39486` matches the retained runner/module closure. Node v24.18.1. Required WASM observation exports/imports and Node dependencies were checked without executing the original guest in preflight. This is not current-main `324cc4f` runtime qualification; the accepted equality of relevant filesystem/WriteFile source blobs retains its earlier limited scope.

The exact command is in `raw/command.json`. It reuses the donor original command and original runner/module bytes with an isolated `--require` observer. Changes: fresh evidence paths; 60-second bound; focused API filter/dedup; no child execution; omitted launch-state/VFS/registry exports to avoid copying source payloads into this capture. `--quiet-api` was retained because explicit tracing works with it. The observer uses existing host log/exit/block-entry callbacks and exported observation controls; no guest/module bytes or production repository code were patched.

## Bounds, tests and failures

One original Setup launch, zero retries, zero children/Accept/licence/gameplay, zero builds, zero production repairs or deployments, zero worker launches. The live guest's only failure was observer-induced. Execution was well below 60 seconds; no quota hit, external TERM or KILL was needed. The unused stop mechanism requests snapshot/PNG/observer snapshot/quit at first dialog or 54 seconds, and forcibly bounds the owned process group before 60 seconds. Child APIs/host spawning are stopping events.

Raw quota 8 MiB; observer quota 4 MiB/6,000 events; stdout quota 256 KiB; output snapshots cap 2 MiB. Diagnostic file writes check aggregate size before writing with stdout/receipt reserve, and the supervisor monitors aggregate usage. Remote task allocation was **234,333 bytes** at final audit (logical bytes before that audit receipt), against 128 MiB maximum with 16 MiB additional reserve. Remote free bytes **44,263,059,456**, above the 4 GiB floor. No source overlays/temp payload copies were created.

Prelaunch offline fixture passed return/out-memory capture, nested filtered API ownership, short-write control, read hash, status observation, irrelevant-PC filter, event and byte quota rejection. It passed locally and on the assigned runtime against the sealed observer. Its scope was a synthetic host fixture, not proof of complete original startup. Postfailure minimal offline replay reproduces the exact 493,016-byte observer exception, confirms no false return emission, tests the proposed caller filter, and confirms the VFS hook bypass. `verify.py` verifies raw seals, observed arguments/failure, preservation/cleanup, sealed launched scripts, both fixtures and two rejecting evidence controls (forged success, false seal pass). No second guest is involved.

Preparation failures: one remote inventory Python syntax error (unmatched parenthesis), one local fixture syntax error (`exports` redeclaration), both corrected before guest launch. Retrieval of absent `outputs.json` failed once, retained as explicit absence. The historical Git donor emitted an existing alternate-nesting warning during read-only inspection; no alternates were created/changed. No runtime admission denial occurred. The bounded launch is counted as **one failed capture**, not a successful diagnosis.

The first ordinary local Git commit attempt refused missing inherited blob objects in the deliberately tree-only store. Publication uses `write-tree --missing-ok` and `commit-tree` with the exact accepted parent, after reviewing that every changed path is this evidence folder; inherited source remains unchanged and already exists remotely. No full checkout, borrowed alternates or shared ref/config/index changes were used.

## Recovery, next-plan boundary and handoff

The sealed scripts, raw logs and manifest remain at `/home/user/shadow-man-error112-targeted-capture-oct22` on bx_2rhkq9ny. `raw/manifest.json` records per-file hashes; the compact raw logs and receipts are also committed here. Recover via Boat exec reading only those explicit paths and verify against that manifest; no archived paths, new compute or installer launch is authorized by this recipe. The old `/home/user/shadow-man-original-oct22` tree remains untouched. Once this box expires, uncollected remote-only bytes require coordinator-managed snapshot recovery; Git is not a backup of ignored runtime binaries.

Before any separately authorized future run, scope buffer hashing to ReadFile return 0x404583 and WriteFile return 0x404779 (metadata only for unrelated startup reads); an oversize unrelated read must never throw through the guest callback. Bind VFS attribution through the actual createFileResult/host-context path, with a fixture asserting a real open/write/output snapshot. The minimal offline scope and direct-path checks pass in `blocker-replay.cjs`; **no revised live observer has been implemented or qualified**. Full module integration, error/cancel/decoder PC visibility and screenshot-on-failure still need prelaunch proof. This plan is a precise next capture gate, not a repair or permission to retry.

Final Boat metadata at 15:35:31 UTC: **idle (running), health ok, stop null**. Assigned expiry remains **17:20:46.919 UTC**, coordinator shutdown checkpoint **16:15 UTC**. The API's createdAt+7200s computes 17:20:46.976, 57ms later; use the stricter assigned expiry. No owned guest process remains; 8123/8124 closed. The coordinator owns shutdown. Original-file seals match. Own task branch only, no main merge or protected root edits. Worker ends this single task after publication; no replacement assignment or refill.
