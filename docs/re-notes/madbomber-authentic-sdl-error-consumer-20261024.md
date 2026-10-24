# Mad Bomber original SDL error consumer — 2026-10-24

**BLOCKED: the consumer gap is not closed.** Original SDL attach/unpacking and
consumer identification succeeded. The next native execution was refused by fresh
memory admission (2,384,236,544 bytes available; 2,684,354,560 required). No unchanged
retry followed. The new executable fixture has passed syntax, exact input identity,
and source/module rejection checks; its native consumer/output/bounds/stack oracle
and output negative control have **not run**. Coordinator owns rescheduling after
an observable capacity change. No production fix is established or proposed.

## Identified original consumer

The unmodified 86,016-byte original `SDL.dll`, SHA-256
`55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410`, is UPX-packed.
The historical loader mapped it at guest `0x503000`; its original entry at
`0x53a130` executed and the loader reported DllMain EAX=1. The loader restores its
caller's state afterward: `inspect-result.json` EIP/ESP/EAX describe that restored
caller, not a consumer return. This was a native DLL initialization probe, with
no gameplay, EXE startup, window or audio playback.

The retained post-attach bytes identify internal native routine RVA **0xcff0**,
91 bytes through its RET at 0xd04a. It is not an exported C/stdcall function:
the operation label arrives in **EAX**, and MMRESULT is the first stack argument.
The authentic caller at RVA 0xd2c5 pushes EAX (waveOutOpen's return), loads EAX
with the original `waveOutOpen()` label, calls 0xcff0, and removes four argument
bytes. The callee returns with plain RET. The fixture sets EAX explicitly through
the VM's normal host ABI and checks this caller-cleanup convention; it does not
pretend this address is a public SDL API.

The routine allocates 256 local bytes, formats `%s: ` through its original CRT
import, computes the prefix length, and calls IAT RVA **0x2324c** with
`(MMRESULT, buffer+prefixLength, 256-prefixLength)`. Original UPX import metadata
at RVA 0x35746 gives relative IAT offset 0x22210 from UPX's destination
base+0x1000. The 16th name is **WINMM!waveOutGetErrorTextA**, hence slot 0x2324c.
It then calls native **SDL_SetError** RVA 0x14430 with `%s` and the local message.
Public **SDL_GetError** exports native RVA 0x14400. Exact bytes, original caller,
import metadata, relocation operands and focused disassembly are retained beside
this report. The complete 237,568-byte mapped snapshot stays in the task root,
sealed by hash; it is evidence only and never an execution input. Recovery always
starts from the original packed DLL.

## Fixture and present evidence

[`test/test-madbomber-sdl-error-consumer-candidate.js`](../../test/test-madbomber-sdl-error-consumer-candidate.js)
checks a sealed 41-file historical host/PE/loader closure, the original DLL and
the exact normal module before compilation. It executes the packed attach entry,
compares all consumer bytes while normalizing only four actual relocated operands,
resolves WinMM and SDL_GetError through public GetProcAddress, and requires the
original consumer IAT slot to equal the public WinMM address.

The pending native oracle invokes the identified internal routine with supported
MMRESULT32 and two real operation labels. It expects the original local message
and SDL_GetError text to contain `The audio format is not supported.`, checks
termination, untouched trailing bytes in the 256-byte local buffer, the return
sentinel and caller argument, guest ESP, terminal EIP=0 and no unexpected yield.
This does not induce or assert a waveOutOpen failure. The original routine's
unbounded sprintf prefix is preserved; arbitrary oversized labels are outside
this fixture. It does not assert robustness for overflowing native labels.

`--reject-output` changes only the expected text's final word capitalization.
It must fail at the **native SDL consumer output oracle** after real execution;
an identity rejection, loader failure or resource denial cannot count as that
negative control. This control remains pending, so there is no consumer PASS.

Executed checks:

- Original attach: exit0, 0.155s wall, 0.141087s child CPU, fixed shared 512MiB
  arena/oldspace512, fresh MemAvailable3,298,598,912, no output limit, group absent
  and explicitly reaped. Output146 bytes. No original DLL or module patch.
- Fixture syntax and `--verify-only`: exit0; 41 files/2,512,870 bytes also match
  exact historical Git blobs. No native compilation/arena in these checks.
- Wrong expected source and module: exit1 at their respective identity assertions,
  before compilation. Raw stderr and terminal receipts retained.
- Actual modified historical host fixture file: exit1 naming that source input;
  original bytes restored and rehashed. No DLL or wasm mutation was used.
- Offline recovered-byte validator: PASS; changed consumer byte, caller convention
  byte, and imported name each rejected. These controls test retained-byte identity,
  **not native consumer output**.
- Next native probe: memory denial before child creation. `identify-denial.json`
  retains expected/actual memory. The later consumer fixture was never launched.

## Exact inputs and recovery

Input main donor HEAD `9183b84473507ffe7c0598725e080a821c747945`; isolated task
branch `task/madbomber-authentic-sdl-error-consumer-oct24`. Historical host source
**b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a**, normal module **1,879,746 bytes**,
SHA-256 **8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686**,
291 imports/layout9a3bc9149d58209c. Existing accepted producer01dfb0d982bcd2756ae4668ff90b18c1949ecb56
and independent96ce3d9ab4d741c4ab789dea89301d9f8d1f77e8 were verified before reuse.
Their 17-seal producer/53-seal build/140-pin acceptance is reused unchanged;
neither the accepted API tests nor a build was repeated. The 41-file closure adds
the exact historical DLL loader to the accepted 40-file host/fixture closure.
No current-main host code is mixed into the historical module.

After coordinator capacity resolution, make a fresh complete admission for the
task, including external capture/history/SQLite growth. The adjacent `recover.py`
materializes only the explicit historical blobs and small fixture/recipes into a
new directory from a supplied published task revision. It does not build or run
the module. The source recovery alone is approximately 2.6MB; the full task budget
must additionally cover Git, evidence, logs, session history, future growth and
8MiB reserve. Originals and the normal module remain standing read-only inputs.

```sh
python3 recover.py /tmp/madbomber-sdl-recovery READONLY_GIT_REPO PUBLISHED_TASK_COMMIT
```

From that fresh root, use the retained supervisor, with absolute `ROOT` below,
and the existing original/module locations. The supervisor admits every child
fresh, requires native MemAvailable>=2,684,354,560, uses Nodeoldspace512/fixed
512MiB wasm arena, CPU90/wall60, combined stdout/stderr<=131072, process-group
TERM/KILL, subreaper and explicit reaping. Lightweight checks use oldspace256,
MemAvailable>=805,306,368 and CPU/wall60. Denial stops the affected operation.

```sh
python3 ROOT/supervise.py consumer heavy ROOT/test-madbomber-sdl-error-consumer-candidate.js --input-root=ROOT/inputs --binding=ROOT/source-binding.json --sdl=/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/SDL.dll --wasm=/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm
```

Only after a valid consumer exit0, repeat under fresh admission with
`--reject-output`; require exit1 specifically naming the output oracle. Reuse the
retained cheap identity controls unless fixture/inputs change. No default compiler
path exists in this fixture. This route has **no CLI mounts**: exact disk input and
guest module path are enumerated in `input-map.json`; filename-bearing mount argv
and its canonical mount parser do not apply. No comma syntax is constructed.
Only SDL is a native DLL in this isolated probe; MSVCR70 import names use historical
emulated system APIs, without loading the bundled native CRT. This qualification
boundary is explicit and does not replace the original gameplay provider graph.

## Resources and limits

Initial admission measured/projected **55MiB**, including owned Git/source/temp/
evidence, full external session/events/history, positive SQLite growth allowance,
future allowance, 1MiB prebaseline SQLite allowance and 8MiB reserve, under64MiB;
per-file ceiling24MiB, host floor2,982,150,144 after projection. The initial board's
61MiB wording is corrected by this measured receipt. Task-root final resource,
publication and cleanup receipts retain exact final values; internal capture starts
with an80,000-byte conservative charge and retains earlier output/accounting.

No full build, acquisition, browser, box, public deploy, main merge, gameplay
replay, audio listening, current-main build or accepted-gameplay reopening.
Box ID/state/expiry: N/A; coordinator retains lifecycle ownership. Root tracked
files/index/refs and all donor/original inputs are read-only; only the append-only
messageboard is shared. Original gameplay acceptance and historical public WinMM
API acceptance remain intact. The remaining task is real consumer execution plus
the output negative control under fresh adequate resource admission.
