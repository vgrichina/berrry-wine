# Neverhood LS32 QT implementation

Evidence: `scratch/runs/20261117-neverhood-ls32-qt-implementation/`.
This implements native LS32 QT publication and execution. Installation, Play,
room entry and native Quit require the separately authorized original pipeline;
the native fixture alone does not establish those outcomes.

## Recovered contract

The predecessor proof is commit `972125ca472c2cff0b457daa9425885fcdb5a9e7`,
`docs/re-notes/neverhood-ft-word-stack-20261117.md`, and its `caller-proof.json`.
The retained ISO is `scratch/media/neverhood-original.iso`, SHA-256
`94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3`.
Its DSETUPE member at bytes 650446848..650492927 hashes to
`bdb0ec0953570355b9d6995f8c70e067bd314911090acf32fbe9883f33875945`.
The source media is referenced, never copied into this evidence directory.

Genuine `1000476a CALL [10004719]` selects QT at `1000959c`, rather than
FT at `100095bc`. With EBP `074fd490`, flags plus 60 scratch bytes, a WORD,
eight DWORDs and the near return produce ESP `074fd42a`. The following
`10004770` continuation assembles a DWORD from DX:AX, unmaps four slots,
then performs LEAVE / RET 36. It contains no FT compiler frame or bitmap.

[Wine's pinned primary implementation](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/thunk.c)
establishes the LS32 header fields and generated relay instructions: clear
ECX, read the byte index at EBP-4, load EDX from the relocated FAR table,
load EAX with QT_Thunk and jump through EAX. QT exposes independent EAX,
EDX and ECX results and the actual callee stack adjustment. Wine's older
copying strategy is not evidence for Windows stack alias semantics.

[Matt Pietrek's primary Windows 95 account](https://jacobfilipp.com/DrDobbs/articles/DDJ/1996/9614/9614c/9614c.htm)
describes an alias of the existing stack, at least 0x3c disposable bytes below
EBP, preservation of EBX/ESI/EDI, clearing DS/ES/FS/GS, adjusted BP, and the
old SS / old FS / new SS in DI / SI / DX. The article omits some stack
arithmetic and complete high-half/flags rules. Preserving unspecified high
halves and suspended lazy flags is this emulator's existing convention, not
a claim that all undocumented Microsoft behavior has been recovered.

## Native implementation

Both relays publish in the same checked connection transaction. The QT API
address comes from the ordinary generated KERNEL32 thunks, using a generated
named API constant. QT publication installs the 19-byte relay and a local UD2
after its JMP. Connection validation checks both complete 32-byte slots.
Retirement restores both original byte sequences and invalidates decoded code.
Global INT3 decoding is unchanged. A connection cannot publish FT while leaving
QT as executable INT3 padding.

The existing native QT gateway now binds a connected call to its PE source
CALL, exact LS32 pair, byte index, retained target table and generations.
Original source forms supported here are near relative CALL and absolute
indirect CALL. Other source forms in a connected image fail closed. Independent
direct QT exports without an LS32 connection retain the existing gateway.

The invocation owns the active connection chain and PE/NE executable pins.
The gateway aliases the real stack, preserves its return slot, clears the data
segments and executes the actual NE target. Successful settlement revalidates
the connection, target and source CALL before merging actual return registers
and RETF-adjusted ESP. Fault/cancel teardown restores the suspended CPU and
return slot and releases only that frame's pins and aliases. Caller scratch
writes remain visible. A QT continuation cannot acquire an FT parent even if
its packet is accidentally DWORD aligned. FT alignment is not relaxed.

## Qualification

`test/test-neverhood-qt-thunk.cjs` builds independent executable PE/NE inputs.
Its original-like eight-DWORD/WORD packet runs at both alignments against two
distinct NE targets. Tests check every argument WORD, empty data selectors,
SS/DX agreement, SI/DI, scratch alias writes, preserved nonvolatile registers
and segments, independent output registers, partial/full cleanup, final LEAVE
and RET 36. A real MapLS alias is dereferenced and changed by NE instructions,
then explicitly unmapped by PE instructions.

Negative controls include local guard execution, invalid QT-as-FT at both
alignments, mutated header/table/relay/index/source CALL/source pointer, foreign
actor, mutation during execution, odd/excess cleanup, trap, bad FAR return,
bounded infinite loop, cancellation and busy retirement. An owned outer scope
survives the nested QT frame. Actual CPUWorkers execute mapped packed callers
at both alignments and propagate faults; stop joins them and checks retirement.
Full FT regression independently includes compiler-body nested/reentrant calls,
cooperative ownership, packet conversion/copyback, lifetime faults and Workers.
These are not proof of arbitrary NE-to-PE callback reentrancy through QT.

The tested module is compiled from the recorded main commit plus only the owned
WAT changes; existing foreign NE/lifecycle WIP is excluded. Git diffs, new-file
patches, module/source hashes and actual command waits are retained in the run.
Canonical shared-tree build and focused regressions are required before the
material commit. The original outcome and publication receipts are recorded in
`result.json`; do not infer them from the fixture results.

## Publication boundary

Material capability commit: `655fd301db04fbc5432961a961a4a1bb52a9079c`.
The canonical flock build and all focused native suites passed. Strict pull
returned exit 2 because incoming main would overwrite foreign WIP in
`lib/d3d-render-worker.js`, `lib/guest-thread-host.js`, the two GL composition
tests and the callback census. No push followed. Foreign NE/lifecycle changes
were preserved exactly and excluded from the capability commit and module.

The fresh original pipeline was not started: publication and the current
published helper qualification are prerequisites. Installation, Play, room and
native Quit remain unqualified. Next, the respective owners must reconcile
the incoming main changes; then publish and qualify the immutable current
runtime before consuming the single authorized original run.
