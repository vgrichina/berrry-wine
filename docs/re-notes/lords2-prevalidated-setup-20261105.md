# Lords II prevalidated setup observation — 2026-11-05

One fresh original observation reached Install, System Test Yes and Wave No
through production-validated ordinary canvas input. Wave No reproduced the
Win16 indirect far-call trap and retained the actual operand, selector, guest
registers and live segment/module ownership. Installation and gameplay remain
unverified. No causal emulator repair was demonstrated or committed.

Evidence: `scratch/runs/20261105-lords2-prevalidated-setup/`.

## Identity and preparation

The required final releases were Stronghold1425 at 14:49:14 UTC, formats1430
at 15:11:01 and ReturnFire1435 at 15:27:01. Independent inspection then found
175 predecessor PIDs absent, 22 ports refusing connections, 14 profiles absent,
four free locks and no heavy runtime. No shared edit, executable check, build,
browser or module pin preceded those releases.

Tested source was main `7e3bf7788b229993266bb30b0f1d7b813163e04a`.
The browser compiled the standard module, 2,173,299 bytes, SHA-256
`10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031`.
Startup and final readouts agree on its identity. The cooperative backend ran
the faulting child T1 in process 1000. Chrome was Linux x86-64 version 151;
viewport 900 by 720. The local runtime held the existing local/heavy/browser
flock locks.

The published `6a0ce7e7198` diagnostic, host collector and six-case regression
sources were unchanged. Their retained standard/compat NE, collector lifetime,
retirement/interleaving and full-build evidence was reused. Intervening
Stronghold changes concern Win32 IO retry ownership; formats changes concern
GPU mip gradients. The current canonical module also matches ReturnFire1435's
passing full build. No fresh full build or generated NE run was needed for
this observation; no emulator source changed here.

Cheap checks passed: helper JavaScript syntax, production queue-validator
self-test, original SETUP MZ/NE header, all 181 canonical media inventory hashes
(14,382,323 bytes), and browser manifest SHA-256
`a1749143a2de176c4f3fdf314337a1767f6101eed4a88b6d5b0dee4d59012f8e`.
Media remained at `scratch/game-media/lords2-demo-20261105/original`; no media
or source archive was copied. SETUP.EXE SHA-256 was
`c9844241cf6594050cb4cdde5b04d4f994dfa6da83a3c5538dab16e792aa49b7`.

## Live failure

The caller started at 15:28:00.420 UTC, with a 540-second outer bound and the
production queue's 420-second limit. All three clicks and the final quit were
prevalidated by the actual production queue validator. Each click was derived
from the current personally inspected screenshot and live canvas rectangle;
the retained review records and harness output include fractions and geometry.
The screenshots show Main Menu, System Test, Wave question, and the desktop
after the child crash. No pixel-style continuation command was used.

At 15:29:52.365 UTC the diagnostic captured:

| Item | Live value |
| --- | --- |
| Calling module / segment | `_SETUP`, module 15, NE segment 4 |
| CS / base | `005f` / `001a0000` |
| DS = SS / base | `0087` / `001f0000` |
| Block / return | `001aa26c` / `001aa297` |
| ES / BX after LES | `005f` / `869c` |
| Operand address | `001a8700` |
| Operand bytes | `00 eb 29 8b` |
| Target selector:offset | `8b29:eb00` |
| Pre-push ESP | `001f8554` |

The live call bytes include `26 c4 1c` (`LES BX, ES:[SI]`) followed by
`26 ff 5f 64` (`CALL FAR ES:[BX+64h]`). The captured stack object at
`001f88a4` begins `9c 86 5f 00`; LES therefore produces `005f:869c`.
Adding displacement `64h` yields exactly the captured operand address. The
target selector has no mapped segment. The preserved CS rejection traps, and
the crash record shows ESP `001f8550` after the existing four-byte return-frame
push. Guest bytes and CS checks were not altered.

A read-only comparison with the earlier retained generated `_SETUP` image
SHA-256 `7dbf696d4f08464ca1e187686368fe89c5b71b3162c094f463d0e5ec4eaca567`
corroborates the 128 captured bytes beginning at segment 4 offset `869c`.
Every differing byte lies in an ordinary segment-selector relocation and
matches its current mapped selector. In particular, the byte at `8700` is the
high byte of a correctly relocated selector at `86ff`, immediately before
`eb 29`. This is code being read as a far pointer, not evidence of a missing
selector relocation at the operand. This comparison is limited to the saved
window: the full current generated child image was not hashed or copied.

The unresolved producer is the earlier construction or overwrite of the stack
object's `005f:869c` pointer. The captured LES, address calculation and far-call
rejection agree with their inputs. These observations do not identify which
earlier CPU instruction, API or memory behavior diverged from Windows. A future
separately authorized observation should retain the writer/history of that
object and its caller frame. There was no second original attempt, speculative
selector substitution, guest edit, semantic fix or installation/gameplay claim.

## Termination and recovery

The validated quit completed at 15:30:32.666 UTC, followed by the final readout
and `PAGE CLOSED +136.8s`. The outer exec session returned 143. The caller's
terminal/cleanup callbacks and Chrome exit observer did not write receipts;
the signal source and actual probe/Chrome exit codes are unknown. This is
retained explicitly, not reported as an ordinary successful browser exit.
No platform cybersecurity rejection occurred.

Subsequent inspection found all three own runtime PIDs absent and both ports
refusing connections. The residual owned Chrome profile was explicitly removed
after verifying its recorded PID was absent. Four locks were free, with more
than 9 GB free disk. No assigned boxes existed: box ID/state/expiry N/A;
coordinator lifecycle ownership is unchanged. No subworkers or public
deployment were used.

Recovery uses the tested Git SHA, relevant binary diffs, this new note's patch,
and retained small helpers, screenshots, console output and scalar fault
records. Git remains the source archive. The original failure is preserved in
`live-far-fault.json`, `live-operand.json` and `live-crash-detail.json`; the
current child pointer's producer remains the concrete diagnostic blocker.
