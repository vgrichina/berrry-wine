# Quake II authoritative capture, 2026-11-20

Run: `scratch/runs/20261120-quake2-authoritative-capture-enemy/`.

The production browser guard now reads the authoritative shared CPUWorker
capture publication. It checks the stable even serial, HWND, generation,
actor TID and PID against the current native scene and live window exports.
The main HWND's lifetime is checked even with zero capture. Those freshly read
scalars join the existing immutable binding, module, context, memory, actor,
Worker, endpoint, window and focus fences. Release, transfer and transfer back,
retirement, numeric reuse or ambiguous publication permanently invalidate the
binding. Quake II explicitly requires authoritative exports; an actor-local
zero cannot stand in for unknown capture. Older-module callers retain their
existing contract. No Hexen, MCM, region or mirror files were edited.

The released Quake II native session, independent release child, receiver and
tests are adopted from the previous uncommitted WIP. Actual close/exit/signal
and both pipe EOFs remain preserved, including the repaired idle release timer.
The 250 ms scene, 500 ms native, 5 second review, 1,500 ms hold and 1,750 ms
independent UP bounds are unchanged. The previous real native positive and
fault campaign and authoritative APIWorker controls are reused, not rerun.

Twenty-two focused guard cases passed, including old zero-capture refusal vs
valid authoritative admission and the previous same-HWND wrong-actor admission
vs new refusal. Focused Quake II lifecycle/receiver, GLTron, legacy input,
native-scene attribution and 42 Hexen compatibility controls passed. The locked
full build passed; actual check child waits and both EOFs are retained. Sampled
free disk during checks/build stayed above 1.5 GB (minimum 1,520,693,248 bytes).

One fresh original used guest graph `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af`
plus the published `72dc77da0` authoritative capture changes. Its actual
CPUWorker compiled module was retrieved exactly once and SHA-256 verified as
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`.
This is not module a600. The source graph, renderer repair, RPC/pointer and
new guard/host overlays are individually recorded. The 67 media references
were verified without copying media. CPUWorker and real render endpoint roles
were read once before input; the main Worker had slot 0/TID 1/PID 1000 and
authoritative capture `[2,65537,1,0,1,1000]`.

The original main menu and host fullscreen consent were personally reviewed.
An expired first Enter choice was locally NOT_SENT with no DOWN. A fresh
complete frame then justified Enter on selected GAME. The guard returned
token 1 at the native USER boundary: **PeekMessage, PM_NOREMOVE**, HWND 65537,
WM_KEYDOWN/Enter. Independent trusted UP arrived 127 ms after ARM, before the
1,750 ms fallback, with the key neutral. This proves the native peek receipt;
it does not prove GetMessage removal, guest dispatch, opening the difficulty
menu, or gameplay consumption. The next observed native consequence was
`ExitProcess(0)` at 05:12:12.893 UTC, followed by Worker retirement at
05:12:12.919. The higher guest cause is UNKNOWN. No living-enemy consequence or
ordinary Quit was established, and no further endpoint request or successor
scope was made. No WAT rewrite or speculative GetMessage repair was attempted.

The scope is CLOSED FOREVER. A secondary disk boundary closed at 05:12:30.019
with 1,499,852,800 bytes free; this runtime does not claim the floor held through
cleanup. All owned runtime children joined, both EOFs were recorded, the native
supervisor reports no leaks and its 20 tracked PIDs are nonlive. The private
browser tmpfs was removed. Host cleanup is not ordinary Quit.

A local helper-loader preparation mistake selected the older guest graph for
a later helper file. That failed before creating a disk boundary or browser;
the empty directory and real invocation failure are retained. Pinning helper
code to the already released f696 graph corrected preparation before the sole
runtime scope. The runtime source/module remained 34c plus capture changes.

Git plus relevant owned binary diff and new-file patches retain source;
selected complete consent/menu PNGs and native receipts retain evidence. No
source snapshot, media copy, solver, cheat, replay, fake clock, forced capture,
deadline increase, agent, worker, Python, Wine or deployment was used. Localhost
box ID null, state NOT_CREATED, expiry null, stop receipt null; coordinator
retains shutdown ownership of any unrelated boxes.
