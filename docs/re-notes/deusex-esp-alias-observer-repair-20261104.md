# Original Render ESP reuse no longer implies Draw unwind

The owning Draw observer now recognizes the original Render save/reuse/restore
sequence through observed execution, checked machine code and saved frame
state. It retains the ordinary ESP termination check everywhere else. Actual
WASM tests reproduce the predecessor's false termination at **Render RVA
`0x327a`, ESP above the Draw return threshold, EBP 7**, then pass through the
unchanged original restoration instructions with the repair. This is controlled
instruction coverage with synthetic data and callers. **Natural Unlock remains
unobserved**; no new original-game execution or successful natural Draw is
claimed.

This follows [the natural terminal](deusex-natural-terminal-run-20261104.md)
at `9bf19ff52d4f25ed5bfdbe6166389074efc8b373` and
[the prior observer repair](deusex-observer-coverage-terminal-20261104.md)
at `b07e2e08c3446cc8e244da6f72c2acbde1a63a38`.
Evidence and runnable small inputs are in
`scratch/runs/20261104-deusex-esp-alias-observer-repair/`.

## Source and execution contract

The original file remains at
`test/binaries/candidates/deus-ex-demo/installed/system/render.dll`, SHA-256
`9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b`.
PE section mapping and disassembly establish:

| Preferred Render VA | Instructions / purpose |
| --- | --- |
| `0x10b03246`, `0x10b0324c` | Save ESP to `[0x10b38a08]`, EBP to `[0x10b34a00]` |
| `0x10b0325e`, `0x10b03263` | Replace ESP with pixel data pointer and EBP with loop count |
| `0x10b0326f`–`0x10b03309` | Pixel loop, two saturation paths, explicit conditional/unconditional edges |
| `0x10b03310`, `0x10b03316` | Restore EBP and ESP from those saved cells |
| `0x10b0331c`–`0x10b03354` | Conventional frame work; JL to `0x10b030cd` or fall through to `0x10b03355` |

The production check covers all **271 bytes** from RVA `0x3246` through
`0x3354`, adjusting only the six original HIGHLOW absolute operands for the
actual loaded base. This is a loaded-code version check, not a full loaded-image
hash or an object-lifetime guarantee. The fixture separately verifies the whole
original file hash and the loader's exact relocated sequence.

An exception can start only after the same observed Draw's successful Lock
return, without a pending viewport call, at the exact Render save-block entry.
The actual Render mapping must be LIVE with matching export name and preferred
PE base. Its ESP/EBP must describe a stack frame below Draw. The observer captures
these actual registers before the save instructions run; a direct landing in
the high-ESP loop gets no exception.

While active, the observer validates the complete sequence, Render
index/base/size/generation, saved Render ESP/EBP cells, and Draw's original
stack-resident caller/EBP pair. These checks run before another guest block,
including across Worker slices. Only the explicit observed edges from the
original disassembly are accepted. Existing cached decoder splits at branch
targets `0x3280` and `0x3310` are included. There is no unchecked address interval.

At either post-restore branch target, actual ESP and EBP must equal the captured
pre-save pair before the exception ends. `renderEspSave` and
`renderEspRestored` are diagnostic events; neither advances any Draw checkpoint
or qualifies a return. Unknown edges or failed checks end incomplete with the
existing `module-changed-or-unobservable` status and a specific diagnostic error.
Budget/time expiry remains effective while ESP is aliased. Engine ownership,
Worker context admission, catch handling, natural viewport call/return pairs,
viewport identity and final caller ESP/EBP checks remain required.

## Tests and limits

`flock /tmp/wine-build.lock bash tools/build.sh` passes. Both freshly built
normal and compatibility WASM pass `test/test-deusex-owning-draw-observer.js`
locally and through the shipped owning Worker/real WorkerLink. The Worker source
needed no change. The required census row documents only this observer delta;
general callback ownership remains pending.

The fixture loads the complete original Render PE through the real loader,
checks its relocated bytes, then executes the original save, data-pointer loop,
both saturation paths, both restore loads, post-restore frame work and original
function return. Widths 1, 2 and 8 cover initial final-pixel, looping and EBP=7
cases. Synthetic prologue, arguments, data, Draw connectors and mock viewport
callees make this isolated instruction execution, not natural game execution.
The existing complete original EXE/Engine zero-guard test still ends as missing
render checkpoints.

Negative fixtures cover direct alias landing without a save witness, budget
expiry during aliasing, Render generation reuse at the same base, retirement,
changed save cells, changed Draw caller, changed restore/loop code, foreign
instance/thread, and post-restore wrong cleanup, unwind, missing call/checkpoint
and viewport mismatch. Shared-memory invalidations are rejected before another
instruction executes in the real owning Worker. Existing Engine retirement/reuse,
pending yield, trap, stop, command, teardown, last-block entry/return and deadline
tests also pass. The classic Worker DLL registry and callback census checks pass.

`reject-predecessor.cjs` obtains the old observer from Git in memory, runs the
same fixture and fails at original RVA `0x327a`, ESP above threshold, EBP 7.
This directly demonstrates the repaired mechanism. It does not reconstruct the
unrecorded terminal of the older 50,000-block session.

The deliberately narrow state machine may end incomplete when an execution
tier hides the save/restore boundaries or introduces an unrecognized split.
Other Render versions and other ESP-aliasing routines receive no exception.
Per-boundary signature/frame checking adds diagnostic overhead; no throughput
or natural render completion guarantee follows from these tests.
`engineRender` and `viewportPlayer` remain null; allocation lifetime and
viewport-to-host binding remain unknown.

## Next bounded original recipe

`collection.cjs` and `next-driver.cjs` in this run directory are runnable small
inputs, retaining the prior genuine selector, actual EXE check, measured
GIsRunning plus visible source-bearing-window gate and one-browser cleanup.
They request **2,000,000 blocks / 15,000 ms** once under ordinary host scheduling.
They send only diagnostic start/status/stop, with no guest write/call, input,
forced Draw, pulse or breakpoint takeover. The assessment now names the first
missing actual checkpoint, so the previously collected entry/Lock evidence
reports `unlockCall`. It never uses a later sample as the terminal PC.

The complete driver is tested offline with modeled DOM/readiness and actual
WASM/owning-Worker execution through the original Render alias fixture:

```
DEUSEX_COLLECTION_DRIVER=scratch/runs/20261104-deusex-esp-alias-observer-repair/collection.cjs \
  node test/test-deusex-owning-draw-observer.js
```

For a later coordinator-authorized runtime, stage current committed observer,
Worker/browser dependency graph and chosen WASM into the assigned checkout;
refresh the provision manifest from actual staged bytes rather than reusing
predecessor hashes. Reuse existing original media by path/SHA, existing corrected
`session.cjs`, `launch-prerequisite.cjs`, `server.cjs`, measured `readiness.cjs`,
and the existing native support-path recipe. Put fresh `provision-manifest.json`
and small `native-paths.json` in a fresh output directory. From the served checkout:

```
DEUSEX_CORRECTED_HELPERS=/absolute/path/to/corrected-helpers \
DEUSEX_READINESS_HELPERS=/absolute/path/to/readiness-helpers \
DEUSEX_OUTPUT=/absolute/path/to/fresh-output DEUSEX_PORT=8123 \
  node /absolute/path/to/this-run/next-driver.cjs
```

Do not interpret fixture viewport returns as natural Unlock. The next runtime
must collect that boundary itself. No browser, game, box access, allocation,
resume, lifecycle action, heavy CLI, successor or subworker ran for this repair.
Predecessor `bx_yvej9qwr` is a reference only; coordinator reported it STOPPED at
07:18:59Z. This worker did not query its state/expiry or take runtime custody.

Evidence records exact Git SHA, relevant binary diff, owned new-file patches,
module/media path and SHA references, disassembly and test logs. Git is the
source archive; no source tree archive, copied game media or full module copy
is included. This is the single assigned repair; runtime scheduling stays with
the coordinator.
