# Redline current-lock menu planning

Evidence: `scratch/runs/20261109-redline-current-lock-menu-route-2210/`.

The current Redline publication composition binds pointer-lock state to each
returned exact-image capture. It checks that state at both capture boundaries,
includes it in the review token, and compares it with a fresh live observation
inside the existing admission callback before native input. A changed lock state
refuses the command. A locked menu supports bounded relative movement and a
reviewed zero-displacement cursor-only click; an absolute target is refused.
No forced unlock, admission relaxation, deadline extension or shared-provider
change is introduced. The existing mouse release implementation is retained.

Code commit: `7c473d9fa64d218e006983081cf4f5f89fe6e58b` on main.

The focused test executes the actual generated capture and command consumer,
using deployed relative and ordinary mouse helpers. Its unlocked menu click
transitions to a locked level grid, then a newly reviewed image permits relative
movement and a newly reviewed cursor-only selection. Controls refuse lock changes
in both directions, stale review references, wrong/missing review lock metadata,
locked absolute clicks, unlocked relative/cursor-only commands and lock changes
during capture. They produce no native input or later capture. The actual
transport consumer makes lock refusals sticky and rejects a later capture.

Also passed: existing menu helper controls, terminal-close and external-image
review gates, four durable journal tests, six bounded custody tests, exact
provision/media/barrier offline preflight, actual generated parent/controller/
caller preflight with joined custody, conditional original preflight, and
`flock /tmp/wine-build.lock bash tools/build.sh`.

The final native manifest has 905 individually reread providers and SHA-256
`9d966fb3d818cabcabbea91e01dfad99c85155e560c9801f5480617d2423af6c`.
Thirteen task inputs were separately sealed and reread before allocation.
The retained GL provider versions were recovered by exact Git SHA without
editing the shared checkout. Source recovery uses Git plus small patches;
no source or media archive was created.

One native fixture passed: Chrome published in 7,228 ms / 72 polls of the
unchanged 100 × 100 ms gate. Startup and comma images were separately reviewed
by the model before dependent input/close. The comma-only control completed
ordinary quit ACK and parent exit 0 with separate stdout/stderr EOF. Custody
actually reaped all 176 owned tasks. The fixture images show the desktop and
Read Me dialog, not original gameplay.

The one conditional original published in 5,424 ms / 54 polls. Each returned
image was separately viewed before its dependent action. The first launcher
click landed above Play because I used the wrong canvas geometry; it was
acknowledged without a runtime fault and left the launcher visible. The next
selection used that current image's saved geometry and launched the game.
The Start Up menu produced the level grid. That grid's own capture reports
pointerLocked true; the current reviewed pixels show Stadium City highlighted
with the software cursor over its label. The supported cursor-only click used
the last submitted CDP point (485.73, 539.305), zero displacement and the existing
150 ms independent release. Its exact ACK passed. New images then show loading,
rendered Stadium City introduction and an in-game pause menu. This verifies
native progress beyond the preceding locked-absolute refusal, not vehicle entry.

The first runtime failure is command 9, `resume`, at 22:19:31.798Z: unchanged
command work deadline, `never resend`. The key down and independently scheduled
key up returned successfully; the delivery observation completed in 2.340 s.
The returned image completed at 22:19:26.843Z and shows the pause menu. Capture
trace retrieval was still unfinished at the work deadline; its later rejected
operation records `runtime closed; no replay`. These records locate the command
boundary but do not establish a general cause. There is no startup-cause claim,
guest-death claim or blank-frame claim. No later input, protocol capture, retry
or quit was requested after the first failure. No visible side door, entry or
driving was reached. The requested entry goal remains blocked by this terminal
command failure; it requires a separately assigned consumer-boundary repair
before another native attempt.

Original custody actually reaped all 353 tasks and the parent exited 1 with
separate stdout/stderr EOF. Its browser cleanup reports SIGKILL, truncated
streams and streamEOF false; parent/custody EOF is separate from browser EOF.
Both lanes' server and DevTools ports were independently closed and no profile
processes survived. The remaining original profile was removed after that drain.

Before shutdown, 326 remote artifacts / 296 distinct hashes / 15,224,747 bytes
were retrieved and independently reread for SHA-256 and size. PNG CRCs and gzip
CRC/EOF were checked. The original Chrome stderr gzip is truncated and retained
as failed cleanup evidence, not a valid browser EOF. Unique logs, captures and
modules remain in the run folder.

The sole box was `bx_96mqhknv`, UUID
`13e369e1-8ce7-4f47-89a2-5efd87cdc48b`. Initial expiry was
2026-11-09T22:35:49.091Z; its independently observed immutable watchdog deadline
was 2026-11-09T22:35:49.443Z. Exactly one delegated normal unforced stop completed
at 22:20:59.353Z, receipt `stop_7d02c841a1aefbc9`. Independent API reread reports
archived, archiveAfter null. The watchdog was actually waited, exit 0, with
separate stdout/stderr EOF, unchanged configuration hash and no surviving PID.
The surrounding allocator tool session returned 143 after the durable watchdog
join; it is not represented as a successful shell exit. No box remains running
for this task. Free `/home` remained above 1.5 GB.
