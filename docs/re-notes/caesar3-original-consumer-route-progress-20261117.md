# Caesar III actual USER consumer and printable-input boundary

Evidence: `scratch/runs/20261117-caesar3-original-consumer-route-progress/result.json`.

One original ran from exact published main `457318f70f3130bce9587f5f59e2e2d0a6786eff`,
with module SHA-256 `4a5a343182dd68c141d2d7646880186f555e83169b8fb493d9b61272815bc356`.
The sealed Git-only main/CPUWorker/OS-child inheritance and full authored native
qualification passed before startup. All 114 installed files were recursively
hashed before the native clock and matched afterward. Defaults and real ticks
were retained; the original EXE/media/config were not edited for this task.

The first observed main-thread USER consumer was
`PeekMessageA(MSG, NULL, 0, 0, PM_NOREMOVE)` on native thread 1, at 31.364 s
after observer initialization (31.807 s after native launch). The successful
Peek/Get/TranslateMessage/DispatchMessage pattern appears before any input.
This establishes an actual usable USER route, without asserting that no other
input API exists. Static imports alone were not treated as consumption proof.
The opt-in observer retains at most 8192 public call/handler-exit rows plus a
summary, reads only public API arguments/MSG outputs, and labels every handler
exit as **not a receipt**, with callback return unmeasured. The ordinary filtered
API log is additionally retained for this finite, watchdog-bounded invocation.

After observing the pump and personally inspecting a fresh full title image,
the first finite mouse DOWN received an exact owner USER-return receipt in
72.948 ms: main HWND 0x10001, thread 1, WM_LBUTTONDOWN, token 1, matching nonce,
Peek API kind 2, removal false. Independent physical UP completed in 194.673 ms;
the entire intent completed in 246.205 ms. A later complete image shows the
actual Start new game menu. The next click similarly reached name entry.
This is genuine visible title dismissal, beyond host application or an API entry.

The next concrete boundary is printable input. A C key DOWN received a genuine
native WM_KEYDOWN receipt in 292.672 ms, with independent UP at 527.646 ms and
completion at 911.155 ms, but the custom name field remained empty. The existing
TranslateMessage implementation expects browser-generated printable WM_CHAR;
the CLI guarded command whitelist accepts physical key/pointer edges, and its
primary-message matcher has no WM_CHAR case. A qualified physical key receipt
therefore cannot claim character entry. No unqualified keypress was sent to the
original. A qualified Escape DOWN also returned but did not visibly leave the
custom name screen. There was no visible Quit action available on that screen.

The authored text diagnostic uses actual x86 callbacks and an actual CPUWorker.
It proves native WM_KEYDOWN changes a public caption to `KEYDOWN C only`, guarded
keypress is refused before effects, and an ordinary **unarmed, authored-only**
WM_CHAR reference changes the caption to `WM_CHAR C observed`. The final diagnostic
prearms independent physical release and records child waits and both EOFs.
This proves the missing guarded character route; the unarmed reference is not a
new receipt mechanism or permission for original input. Implementing that route
requires a whole-file handoff of the guard/context sources currently leased to VB,
then actor/memory/generation/lifetime/filter/cancellation qualification. No foreign
guard or context source was edited here.

There was no new original UNKNOWN; all four original finite intents had native
owner receipts and met the unchanged 500/1750/3000 ms limits. The old UNKNOWN run
was read from retained files only and remains closed: no HTTP, query, rebind, or
replay. The old original's no-dequeue cause remains **unproved**. This run's later
consumer onset is not retrospective causal evidence about the old run, and the
39ed wait-flag fix is not claimed to explain it.

Host cleanup was requested at the unsupported text boundary. The native process
wrote a SIGTERM cancellation record. The outer supervisor then exited with tool
status 143 before retaining native wait/EOF receipts; the sender and cause of
that outer SIGTERM are unknown. Native process absence was recorded separately,
not substituted for wait or normal exit. Its own orphaned watchdog was stopped
with a command-line-verified pidfd signal and observed termination, without an
invented child wait/EOF claim. There was no second original and no box, worker,
or deployment. City, Victory, Assignment 2 food, and original native Quit remain
unproved.

Canonical flock builds, focused broker/GetMessage/Peek/teardown checks, full
authored controls, exact published pre-original qualification, and the authored
text boundary diagnostic passed. An earlier exploratory qualification accidentally
included legacy overlay paths and is explicitly excluded from admission. A later
source-check refusal caught a helper edit during qualification; the frozen rerun
passed. Evidence records these limitations rather than promoting either run.
