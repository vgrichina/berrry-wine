# Nested DLL attach: current-main qualification

The assigned synchronous nested-load behavior is already implemented on verified
remote main `eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf`. No production repair is
justified by this investigation. This branch adds a focused regression harness;
production loader files are byte-identical to that baseline.

The older root-worktree TODO TG77-PIRATES-DLLMAIN-20261014 mentions remaining
blocking nested-initializer limitations. That entry is absent from the actual
current-main TODOS.md. This finding concerns generic nested attach only, without
revisiting original-game diagnostics, ExitProcess detach or FreeLibrary design.

## Exact existing implementation

* `lib/dll-loader.js`, Git blob
  `b3964ba0ec83ac447b1fd8db0b38f33485198928`: `dllMainSteps` (line 1127)
  owns saved EIP/ESP, registers, SEH, yield/control state and guest callback frame
  per generator invocation. `callDllMainOwned`/`callDllMainAsyncOwned` service
  nested yields before resuming it. The callback gate (line 113) is reentrant for
  its thread identity and excludes other owners. `loadDll` (line 545) deduplicates
  paths; `_waitForDllInitialized` (line 672) exempts the initializing owner while
  checking other owners' generation/state.
* `lib/process-boot.js`, Git blob
  `2c8bc8c70a0297c842bf2d504f329d795e51c970`: `completeLoadLibrarySteps`
  (line 729) owns the requested name, mapped results and return-register policy.
  `serviceLoadLibraryYieldSyncOwned` (line 1017) recursively services nested
  loads with a fresh options object; the async equivalent (line 927) does so
  across host awaits. Completion resolves each original callback's token.

## Executed evidence

`node --max-old-space-size=256 test/test-dll-nested-attach-current-main.js`
passes on the **unchanged exact baseline** and on the test-only branch. This
runs the actual exported JS loader and process-boot functions against an explicit
128 KiB shared-memory native-ABI simulator. It does not interpret x86 or compile
the project. The simulator supplies mapping/guest execution; it does not replace
the production JS continuation, deduplication, gate, generation-token selection,
load dispatch or completion-driver logic.

The synchronous and async cases load A -> B -> C, repeat B, and self-load A/C.
Exactly three mappings/attaches complete in C/B/A order with original generation
tokens. The original caller's EIP, ESP, registers and SEH survive. Actual nested
LoadLibrary completion returns the exact requested HMODULE. Metadata locking is
absent during guest callbacks, all pins/gate depths release, and another callback
owner remains excluded across async lookup and can enter afterward. Additional
FALSE, exception and unfinished-frame cases never publish successful attach and
restore the caller/gate. These failure cases exercise the callback runner, not
native rollback/reclamation.

Two private semantic mutations are rejected by the unchanged harness:

* Disabling synchronous nested-yield service fails with `DLL initializer did not
  return`, an unfinished original frame (ESP 119980), and no silent success.
* Omitting invocation register restoration fails the original caller's EBX check
  (`11255811 !== 84`).

Nearby checks pass: `test/test-dllmain-load-context.js` and
`test/test-scoped-dll-lifecycle.js` (local and actual Node Worker ABI simulation).
The first scoped run failed because this sparse checkout lacked eagerly required
`lib/dib.js`; adding that exact unchanged dependency resolved it. No assertion or
production source was weakened. The broad real-PE callback tests require the
full prebuilt interpreter and 512 MiB arena; they were inspected, not executed.
No native contention, full-VM blocking-wait, unload-generation reuse, Safari,
original game or gameplay acceptance is claimed. There is no baseline-failing /
implementation-candidate-passing pair: the requested baseline already passes.

## Recovery and resource record

Private evidence: `/tmp/dll-nested-initialization-current-main-oct24/` contains
`resource-ledger.json`, append-only `captures.jsonl`, exact baseline/nearby/control
logs, `controls.js`, the mutated source copies, final publication/cleanup receipts
and SHA-256 seals. Retain these alongside the published branch. Recover the
harness from Git and run the Node command above; recover rejecting controls by
running `node controls.js service` and `node controls.js context` with the private
directory layout intact (each must exit 1).

The fresh private Git repository uses explicit non-cone sparse file paths and a
read-only alternate to the authorized released donor. No clone, fetch, repack,
download, install, full build, root index/ref mutation or donor mutation occurred.
Installed tools and inherited donor object bytes are standing inputs. The
single-owner ledger charges checkout/Git, evidence, worker captures/session,
positive observed SQLite growth, conservatively **all** initial SQLite bytes,
32 MiB future growth and an 8 MiB reserve. Latest prepublication projection was
60,397,810 / 67,108,864 bytes; final measured receipts supersede that snapshot.
Each Node invocation is CPU/wall limited to 60 seconds with a 256 MiB old-space
ceiling and MemAvailable checked above 805,306,368 bytes. Maximum new file size
is checked at 24 MiB; postprojection free-space floor is 2,982,150,144 bytes.

Bootstrap combined instruction display exceeded the slice and was conservatively
charged 200,000 bytes. Three later source displays exceeded the internal 8 KiB
slice, were rejected, retained and fully charged; smaller subsequent slices
corrected the bookkeeping mismatch. No platform/user resource denial occurred,
and no capture charges/history were reset. No test boxes were assigned or touched;
box ID/state/expiry are N/A and lifecycle ownership remains with the coordinator.
This branch has no main integration authority.
