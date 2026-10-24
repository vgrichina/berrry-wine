# Independent original SDL consumer qualification, 2026-10-24

**BLOCKED: corrected native baseline passes; output negative control remains unrun.**
Fresh admission for `--reject-output` failed at **2,639,024,128 bytes MemAvailable**,
below **2,684,354,560**. No child was created for that control and no retry followed.
The scoped qualification requires that unchanged control to exit 1 specifically at
`original SDL consumer output oracle`; a resource denial cannot satisfy it.

**Publication is also blocked.** The final fresh disk gate measured host free
**1,348,165,632**, projected after incremental growth **1,312,895,432**, below the
required **2,982,150,144**. Owned bytes were only **5,293,711** and total projected
task allocation **40,563,911** of64MiB. No stage, commit or push was attempted
after that actual denial. The local branch
`task/madbomber-sdl-consumer-independent-qualification-oct24` remains at its main
base with the reviewed changes retained as unpublished WIP. There is no new commit
or verified remote backup. Coordinator must resolve actual host capacity, then
review and publish these exact files; do not retry unchanged or delete donor data.

Input producer commit `ce17debea05b1e40c2359a25cf1d3d2c41266649` was reviewed in
its read-only donor. This branch starts at immutable main donor
`979042c93eec78095d0e4ee078d4efb25a55a5ff`, and makes no production change or main merge.

## Independent review and owned fixture repair

Verified all 35 producer evidence seals against actual published Git blobs, the
41-file/2,512,870-byte historical host/loader closure against its Git blobs, the
unmodified original packed SDL.dll, the exact historical module, recovery recipe,
supervisor, consumer bytes, original caller, import metadata and VM call setup.
The prior producer denial **2,384,236,544** remains preserved separately.
Existing identity/source/module/static corruption controls and accepted historical
WinMM API/build qualifications are reused unchanged, not rerun as SDL acceptance.

The retained 237,568-byte post-attach snapshot hashes to
`7f3c130a9a520867fa96ffecdc04df8270f87838f7e1d0a51c405481db592846`.
It is evidence only; execution always starts from the original packed DLL.
The complete 91-byte internal consumer RVA `0xcff0` subtracts 256 from ESP,
passes EAX as the operation label to original `%s: ` formatting, reads MMRESULT
at ESP+0x104, calls imported WinMM, calls native SDL_SetError RVA `0x14430`, then
adds 0x108 and returns with plain RET. The authentic caller at RVA `0xd2c5`
pushes the waveOutOpen result, loads EAX with `waveOutOpen()`, calls this routine,
and adds four to ESP. This is a supported internal ABI, not a public SDL entry.

Recovered UPX import metadata places waveOutOpen at WinMM index 10/IAT RVA
`0x23238`, and waveOutGetErrorTextA at index 15/IAT RVA `0x2324c`.
The original caller context contains CALL through `0x23238`; the original consumer
contains CALL through `0x2324c`. Native execution rechecks every consumer byte,
normalizing only its four relocated address operands. SDL_GetError is resolved
publicly and must point to original native RVA `0x14400`.

The first unmodified baseline failed before the consumer at
`authentic resolved consumer IAT`: original slot `0x075013f0` versus fresh public
lookup `0x075013f8`. Actual historical GetProcAddress source reserves a new
eight-byte dispatch record on every system-API lookup. Pointer equality was a
fixture defect. The repair checks both records' range/alignment, exact imported
name and pinned API ID **4590**, derived from the historical API table. It changes
no guest code, DLL, module, host input or output oracle. The focused regression
accepts distinct records for the same API and rejects altered ID/name, invalid
range/alignment and an out-of-bounds name. The old equality assertion's false
rejection is retained. `fixture-repair.patch` and `independent-review.py` verify
that only this identity check and its diagnostic output changed.

## Actual native baseline

Initial three samples, five seconds apart: **2,980,253,696; 2,960,617,472;
2,974,568,448** bytes. Fresh supervisor admission for the original failing fixture:
**2,978,680,832**. After the routine repair and cheap controls, a new three-sample
gate passed: **3,162,718,208; 3,114,184,704; 2,920,574,976**.
The corrected baseline supervisor independently admitted **2,957,946,880**.

Corrected baseline **exit 0**, wall **0.311s**, child CPU **0.202227s**, combined
output **793 bytes**, no supervisor limit, process group absent and explicitly
reaped. Node oldspace512, fixed shared 512MiB arena, CPU90/wall60, combined output
cap131072, original retained TERM/KILL/subreaper supervision. No build occurred.

The fixture executes the original packed attach, internal native consumer and
original SDL_GetError, with MMRESULT32 and two labels. Native local text and
SDL_GetError agree exactly:

```text
waveOutOpen(): The audio format is not supported.
waveOutPrepareHeader(): The audio format is not supported.
```

Native local capacity is 256; remaining WinMM capacities are 241 and 232. The
fixture checks exact local text/NUL, every trailing A5 canary, unchanged caller
MMRESULT and zero return sentinel, actual guest ESP according to each ABI,
terminal EIP=0 and yield=0. Historical call_func pushes four argument slots and
a zero sentinel; the consumer receives code32 in the first slot and EAX is set
after call setup. Its plain RET leaves ESP at entry+4, as expected for caller cleanup.
SDL_GetError reads are capped at 1024. These are the actual guest assertions,
not host-formatted substitute messages or a WinMM-only test.

Only after this exit0, fresh admission for the unchanged output control sampled
**2,873,339,904**, then **2,639,024,128** five seconds later. The second failed;
the sequence stopped immediately, without a third sample or native child.
`capacity-reject-output.json` records the exact stop. There is no output-control
exit1 and no completed consumer qualification.

## Recovery and limits

Evidence and recovery scripts are in the adjacent
[`madbomber-sdl-consumer-independent-qualification-20261024/`](madbomber-sdl-consumer-independent-qualification-20261024/)
directory. The full snapshot remains in the read-only producer task root and is
recoverable by its original packed-attach recipe; it is never a runtime input.
From a repository exposing the published review and historical source Git objects:

```sh
python3 recover-qualification.py NEW_ROOT READONLY_REPO REVIEW_COMMIT
```

Do not execute native work until the coordinator observes material recovery and
records fresh complete disk/history/SQLite/reserve admission and the required
three >=2,684,354,560 samples five seconds apart. If any fail, stop without retry.
Use unchanged `supervise.py`; explicit original SDL/module paths and flags appear
in `consumer-repaired.json`. The remaining command is that same reviewed fixture
with `--reject-output`, under fresh admission. Its required result is exit1 at
`original SDL consumer output oracle`, with no supervisor failure and no descendants.
Source identities, fixture and baseline evidence must still match before reuse.
No CLI mounts exist on this route; the reused exact input-map enumerates the
disk input and guest DLL pathname. No filename-bearing mount argv is constructed,
so the canonical mount parser is inapplicable. Strict SSH configuration is retained.

Historical source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; normal module
1,879,746 bytes SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`, 291 imports,
layout `9a3bc9149d58209c`; original SDL.dll 86,016 bytes SHA-256
`55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410`.
No current-main host code is mixed into the historical module. Historical
emulated CRT imports service the original consumer; bundled native MSVCR70 is
not loaded in this isolated fixture. Native prefix sprintf remains unbounded;
oversized labels and general overflow resistance are outside this test.

This is internal consumer scope only: no induced or claimed real waveOutOpen
failure, public SDL_OpenAudio failure qualification, original gameplay replay,
audio listening, current-main build qualification or Windows parity. Existing
gameplay and WinMM API acceptances remain intact. No other heavy local work,
workers, acquisition, box operation, browser, deploy or main merge occurred.
Box ID/state/expiry: N/A; coordinator owns lifecycle.

Resource receipts retain focused owned manifests, standing tools/inputs separately,
full external session/events files, positive SQLite growth, future allowances and
8MiB reserve within64MiB, per-file24MiB, host-after-increment floor2,982,150,144.
The first source-read command accidentally emitted bounded alternate-depth Git
stderr; all later Git stderr is retained in a task-owned file. The review script's
first label-slice assertion was one byte short, corrected using literal length;
this was a review accounting error, not a consumer ABI defect. Both are charged
to the retained capture/history. Final resource, publication and cleanup receipts
are in the task root. The ops result is written last.
