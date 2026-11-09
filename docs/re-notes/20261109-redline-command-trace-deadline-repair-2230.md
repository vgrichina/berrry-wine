# Redline command/capture-trace boundary repair

Evidence: `scratch/runs/20261109-redline-command-trace-deadline-repair-2230/`.
Code on main: `b454987afd4272a335e2ebd3af8ab2f0dee0b2f8`.

The generated consumer previously awaited diagnostic worker traces after the
required image proof and publication, before returning to the numbered ACK
consumer. The retained 2210 resume image completed at 22:19:26.843Z; command 9
failed its work deadline at 22:19:31.797Z. Both guest-worker snapshots survive.
The next worker in the actual sequential consumer is D3D render worker
`F53ED06D5E3EB7AC68AA136AC7C3C719`; its resume snapshot is absent, and the
pending diagnostic later rejected on runtime closure. This locates the third
await by consumer order. The raw wire ring had exhausted its capacity, so the
exact stalled CDP request ID and browser service delay remain unknown. These
facts do not establish a guest-death, blank-frame or startup cause.

The current-publication route now collects diagnostic traces concurrently with
a maximum 1,000 ms wait and a 100 ms command reserve. It permits only one
outstanding diagnostic read per worker and records incomplete reads explicitly.
Late results cannot publish trace artifacts or issue another protocol request.
The existing CDP guard still owns each pending read. Required state, image,
identity and current-lock proof remain awaited. Late images and terminal work
are discarded, and the command checks its original work deadline before ACK.
No work, CDP, admission, mouse-release, custody or cleanup guard was extended.
Shared providers remain unchanged.

The focused test executes the actual composed capture/execute functions with
the deployed numbered transport. The old sequential trace tail reproduces a
completed-image/no-ACK deadline failure. The repaired held-trace control returns
an exact image ACK with an explicitly incomplete diagnostic receipt. Success,
late image, required-capture refusal, terminal interruption, sticky later-command
refusal, duplicate outstanding-read suppression and late-result publication
controls pass. Existing current-lock planning and terminal-close/review tests
pass, along with four durable-journal tests, six bounded-custody tests, exact
provision/media/barrier preflight, actual generated parent/controller/caller
preflight, conditional-original preflight and
`flock /tmp/wine-build.lock bash tools/build.sh`.

Both phase manifests and all task inputs were sealed and independently reread
before the sole allocation. The native manifest contains 906 providers and has
SHA-256 `584e82ddbf7739a0c6531024811a6c412552d03085c6c07e3cbe530efa9a958d`.
Source recovery uses exact Git commits and small patches, including a verified
reference to the preceding run's reconstructed non-Git inputs. No source or
media archive was created. Durable CONT/EXIT handling and physical reaping were
retained unchanged.

The one changed native fixture passed. Chrome published in 505 ms / 5 polls
of the unchanged 100 x 100 ms gate. Startup and comma images were separately
reviewed before dependent input/close. Ordinary quit ACK and parent exit 0 have
separate stdout/stderr EOF; custody reaped all 177 tasks.

Only after that pass, the one conditional original published in 705 ms / 7
polls. Each returned image was separately viewed before dependent input. The
launcher click used this image's saved canvas geometry. Reviewed ordinary Enter
selections reached New Game and Stadium City; passive captures followed the
changing introduction into the on-foot health100/ammo200 HUD. Ordinary arrow
controls produced reviewed garage views and visible car front/side geometry.
The retained short Right control includes 83 positive guest VK39 reads. Short
turns sometimes left the scene nearly unchanged, while longer turns crossed
the garage; no movement or entry was inferred from an ACK alone.

There are 23 successful exact numbered ACKs, each with a hash-matched complete
image. Seven of their diagnostic receipts explicitly report incomplete traces.
Every successful image completed at least 5,128 ms before its command work
deadline. The first terminal failure is command 23, `focus-world`, at
22:50:22.409Z: `mouse delivery exceeded hold bound`. The reviewed current image
was unlocked; its saved canvas geometry was checked before an ordinary center
click. The unchanged mouse helper independently invoked release at its hold
boundary, then refused because the press had not returned before release was
invoked. Its three mouse request records each retain one reply, but raw wire
capacity was exhausted; the exact service delay is unknown. No command work
deadline or capture-trace failure was reported for this command. No subsequent
capture ran, no failed-command image/ACK exists, and no later numbered input,
capture, retry or quit was requested. Side-door entry and driving remain
unverified. Further work must discriminate this mouse service boundary before
a fresh entry attempt; this runtime must not be resumed or replayed.

Original custody reaped all 348 tasks. Its parent actually exited 1 with
separate stdout/stderr EOF. Chrome cleanup reports SIGKILL, truncated stderr
and streamEOF false; browser EOF is not claimed. The surrounding original tool
session returned 143, separately from the durable parent wait. Both lanes'
server/DevTools ports were independently closed, no profile processes survived,
and the remaining original profile was removed after physical drain.

Before shutdown, 573 remote artifacts / 491 distinct hashes / 21,177,418 bytes
were retrieved and independently reread for SHA-256 and size. PNG CRCs and gzip
CRC/EOF were checked. Original Chrome stderr is retained as explicitly invalid
gzip/EOF cleanup evidence. Unique logs, captures and modules remain in the run.

The sole box was `bx_u92q6cbf`, UUID
`f5f28deb-fc68-4048-ac65-1a334b1db1c6`. Initial expiry was
2026-11-09T22:57:14.734Z; the immutable independent watchdog deadline was
22:57:14.782Z. Exactly one delegated normal unforced stop completed at
22:52:34.627Z, receipt `stop_09f7bff61bc5c8af`. Independent API reread reports
archived with archiveAfter null. The watchdog was actually waited, exit 0,
with separate stdout/stderr EOF, unchanged configuration hash and no surviving
PID. Its allocator tool also returned 0. No owned box remains running. Free
`/home` remained above 1.5 GB.
