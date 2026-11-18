# Globe native close: nested DLL unload on the owning Worker

Ordinary title close now reaches native `ExitProcess(0)` and guest/render
retirement in both actual WebGL and software browser originals. Repair commit
`1ad9afd9201b40a3985421906436bd0023c73ba4` changes only `lib/guest-rpc.js` and adds
`test/test-worker-nested-dll-unload.cjs`. Evidence is
`scratch/runs/20261118-dx-globe-native-close-cause-repair/`; its `verification.json`
and final `result.json` index the actual waits and observations.

The preceding paired-rendering note already proves moving scenes. This task used
its retained native destroy-handler, main-loop and cleanup disassembly first;
it did not repeat a rendering campaign or contact the old UNKNOWN runtimes.

## Observed boundary

`WM_DESTROY` enters Globe's `0x402d3b` arm and cleanup `0x403841`. Cleanup clears
initialized (`0x40e9e6`), then releases six objects, and finally sets done
(`0x40e9e2`). The first four Release return sites execute. The fifth return site
`0x40390a` does not. The sixth and cleanup return also remain unexecuted.

The materially extended diagnostic captures the existing synchronous-send
timeout marker, without changing native CPU state:

```
CADE5000 00564AE4 00000005 00000002 00010001 00000000 00000000
```

This is native EIP `0x564ae4`, yield 5, `WM_DESTROY`, hwnd `0x10001` at sync depth
1. The loaded `d3drm.dll` base is `0x514000`, original base `0x64780000`;
the EIP maps to original `0x647d0ae4`. Selected disassembly is retained as
`d3drm-final-release.txt`: the immediately preceding instruction at `0x647d0ade`
calls imported `FreeLibrary`, followed by `ret` at `0x647d0ae4`.

The synchronous USER callback loop services yield 5 through
`host.service_load_library`. The Worker previously brokered this import to the
page. The page explicitly refuses to service DLL yields for a Worker, because
its native instance is idle. After the existing bounded callback loop exhausts,
the callback is abandoned and the caller registers restored. The native main
PeekMessage loop then resumes with initialized 0 and done 0. Window disappearance
alone was never evidence of successful cleanup. The 20-second original deadline
remained unchanged; both diagnostic baseline scopes closed UNKNOWN permanently.

## Repair and qualification

The Worker import now services only pending unloads (yield 5 and null load name)
through the existing synchronous process-boot loader on the owning CPU. This
preserves native detach, loader gates, return value, and `dllRetired` publication.
Loads requiring asynchronous file I/O retain their existing path. No interpreter,
renderer, worker scheduler, timeout, or held diagnostic source was changed.

Before changing a fresh original, the diagnostic was qualified with an authored
real native PE in an actual browser Guest Worker: normal indirect COM Release
returns, sets done and reaches PostQuitMessage/GetMessage WM_QUIT/ExitProcess(0).
A second real PE stalls inside Release and qualifies the native timeout marker.
The exact FreeLibrary fixture then shows baseline callback abandonment at yield 5
and, with the repair, native Release return and done 1 before native exit and
retirement. Its baseline GetMessage synthesizes quit even after callback
abandonment: native exit alone is therefore explicitly insufficient for that
fixture. The done flag and callback-return counter distinguish old from fixed.

The tracked regression runs a real x86 WM_DESTROY in a Node Worker and checks
FreeLibrary TRUE, real DllMain PROCESS_DETACH, module retirement, callback tail,
CPU restoration, invalid-handle FALSE and exactly one retirement event. Against
the old import with an actual page-refusal broker it fails precisely at the
native callback-tail assertion after 64 refusals; with the repair it passes.
Two earlier baseline harness attempts lacked that broker and timed out; they are
retained as unsuccessful harness attempts, not the old-fail proof.

Worker API batching passes. The callback ownership census remains unchanged.
`flock /tmp/wine-build.lock bash tools/build.sh` passes before the code commit.
Strict pull and push both return 0. The published dd9 dual-executor regression
files are byte-identical; known Tunnel ExitProcess(0) controls and their retained
evidence remain intact. No unchanged Tunnel campaign was run.

## Affected originals and individual waits

Both fixed originals serve the same retained native module
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`,
Git runtime graph `f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and published RPC repair.
Only the qualified bounded diagnostic and recorded observer suffixes are added
in memory. HTTP hashes verify the bytes actually served. This isolates the repair
from foreign work in the shared checkout and from the newer locked-build module.

After personally reviewing the whole private display, ordinary trusted mouse
DOWN/UP at page `(306,31)` closes the title button. Both originals execute all
six Release return sites and cleanup return, set done 1, clear all six object
pointers, traverse native main-loop exit, and log direct native ExitProcess(0).
Guest and renderer retirement resolve with no pending retirement error. The
page-side `guestResult` stays null and is not used as exit proof. Globe uses its
done flag to leave PeekMessage; no PostQuitMessage/GetMessage claim is made for
this original (those are covered by the qualified fixture).

Each original has actual separate driver/supervisor, Chrome, Xvfb and openbox
wait receipts: code 0, null signal, both output EOFs. Native supervision reports
no leaked children, no deadline termination, and all tracked PIDs are absent.
Browser tmpfs, display socket, lock and authentication file are removed after
retrieving the unique evidence. The 90-second runtime, 20-second close bound,
independent 105-second supervisor plus 15-second cleanup bound remain finite.
No forced termination counts as native success.

Minimum sampled free /home bytes are 1,556,611,072 (WebGL) and 1,554,309,120
(software). These are 100ms samples, not a continuous-disk claim. An earlier
fixture launch was refused before runtime when disk was below the floor. Only
owned closed text was losslessly compressed with verified round trips.

The first software whole-display capture preceded its visible composition; a
fresh whole-display capture in the same still-open finite scope was reviewed
before close. No artificial warmup, debugger busy attestation, deadline extension,
or old endpoint was used. Other early fixture harness errors (title overwritten,
post-retirement memory observer, unquoted fixture mode) are recorded separately
and do not contribute to the pass.

Recovery uses Git commits, per-scope source manifests, relevant binary diffs,
recorded observer suffixes, diagnostic/config, and owned new-file patches.
Game media and the retained module are referenced by path and hash, never copied.
No source tree snapshots, Python, Wine reference runs, public deployment or box
were used. Box ID/state/expiry/stop receipt: null / NOT_CREATED / null / null.
Foreign WIP and every security hold, including Blood timer work, were preserved.
