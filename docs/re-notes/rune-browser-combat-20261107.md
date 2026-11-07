# Rune browser combat attempt — 2026-11-07

**The first blocker is an owned staging error: `Rune.exe` was omitted from the
fresh box, so the browser failed with HTTP 404 before guest startup.** The
reviewed `startup-blocker.png` shows the original app's Download error dialog.
No cave, turning, attack, jump consequence or enemy encounter was observed.
No emulator mismatch was demonstrated and no production code changed.
Evidence: `scratch/runs/20261107-rune-browser-combat/`.

The current registered `rune_demo` route preserves the original first-run wizard,
empty arguments, shipped INIs, relative mouse and `C:\System`. The accepted
Nov 1 Software → Next → Next → Run / Escape / New Game / Easy route in
[rune-demo.md](rune-demo.md) remains historical evidence only. This attempt sent
**zero original native input events** and did not reach that wizard.

## Exact staging failure

The owned preparer enumerated `.wine-assembly-browser.json`, which lists 141
installed files but excludes the launch EXE. It staged those files and the
manifest, without separately including the registry's `exe` path. Consequently
all **607 staged pins** verified successfully while the required EXE was absent.
The original browser log records the fatal request for
`test/binaries/candidates/rune-demo/game/System/Rune.exe` returning **404**.
An earlier optional `stdole2.tlb` request also returned 404; launch continued
until the required EXE fetch failed. The driver later reported
`guest Worker readiness timed out: rune_demo` and closed normally. No retry,
re-pinning, forced state/backend/focus/clock or guest-memory write followed.

The local EXE is present, **233,472 bytes**, SHA-256
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
It and all 141 manifest-listed installed files match accepted Nov 1 hashes;
there is no demonstrated media corruption. `first-blocker.json` retains the
manifest/pin omission and original EXE identity.

## Qualification and actual backend

Outlaws explicitly released the production Worker/NE files at **12:43:30 UTC**
after publishing **c254a3e3ee94728124db63d32550aa44c50ee9e3**. Production
pins were frozen only afterward. The relevant tracked patch is empty; the
relevant untracked source and owned helper patches are retained, with hashes
in `source-recovery.json`. No source or media archives were created.

The hash-identical native input/release, transport, observer and control helpers
were reused. Fresh checks passed the selected deferred observer's missing-file
negative and actual evaluation positive; local Chromium attached the actual
production guest/render Workers and retained their live module. A trusted
ArrowUp down/up pair received exact command ACKs; release was armed before
down and independently attempted **60 ms** later. Quit ACK and local process,
port, profile, writer and held-input clearance passed. The real driver accepted
25 minutes and rejected 35 minutes, expired and NaN deadlines.

The local generated COM fixture used a **legacy WebGL render endpoint**. It is
qualification only. The original page instantiated the production guest Worker
module **e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467**,
**2,182,493 bytes**, but failed before loading Rune's EXE. Its actual game render
backend is **unobserved**. The page's default WebGL selector does not establish
active GL/D3D game coverage; the historical cave route used software rendering.
There is no FPS, audio or general parity claim.

## Custody and next step

One UUID-idempotent 40-minute box, **bx_wxhtmvcu**, was created at
**12:45:15 UTC**, with original expiry **13:25:15 UTC** and immutable driver
deadline **13:10:15 UTC**. The browser naturally terminated on readiness failure;
Chrome exited **0**, with no held input, live own runtime PID, open own port,
profile or writer lock. All 607 remote pins remained unchanged. **23 unique
artifacts / 2,312,092 bytes**, including the live module, screenshot and logs,
were recovered and SHA-verified before the explicitly delegated normal stop.
The final API state is **archived**, stop **completed**, **forced=false**,
expiry **null**, stopped at **12:49:50.853 UTC**. Local cleanup and free disk
above 2 GB were verified.

The next separately assigned attempt must stage the registry EXE/DLL paths as
well as the manifest closure, and verify the actual required HTTP assets before
launch. The local EXE already has accepted original provenance. Gameplay beyond
the Nov 1 cave/W result remains unverified. `rune_demo` is registered in the app
registry but absent from the candidate-corpus manifest; this is investigation
evidence, with no unrelated dashboard candidate attached.
