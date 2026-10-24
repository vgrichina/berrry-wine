# Original Penguin Command scheduled-input gameplay, 2026-10-24

**Normal Game opens and advances to Wave #2 with a changing score.** One
pre-scheduled ordinary-input execution passed beyond the previously accepted
menu. The batch-45,000 capture visibly reads **Score: 160 / Wave Scoring**;
batch 60,000 reads **Score: 240 / Starting Wave #2 / Defend Cities!**.
The batch-85,000 frame is the Hiscores screen; subsequent frames return to
the main menu. This verifies bounded original gameplay progression, not a
complete game, sustained play or a particular projectile's response to a key.

Evidence is adjacent in `penguin-command-scheduled-input-gameplay-20261024/`.
Worker session `01a16bc8-e2ab-7941-98ac-8e205008daa9` owns the single task,
on `task/penguin-command-scheduled-input-gameplay-oct24`. Its explicit sparse
checkout started at main `e29c89251e917bb15d549c9eb921d32e6f7aa4c1`, confirmed
with strict SSH `ls-remote`. This task does not integrate to main. Root tracked
files, index, refs and all standing donors remain read-only.

## Observed sequence and limits

The prior inspected menu places Normal Game around desktop (420,360).
All actions were supplied through this exact runner's supported `--input=`
before launch; none depended on a later live click. `scheduled-inputs.json`
and `run/command.json` retain the complete schedule and actual argv.

| Batch | Actual action / reviewed result |
| --- | --- |
| 32,000 | `menu.png`: original title and Normal Game menu |
| 33,000 / 34,000 / 34,500 | Move to (420,360), left button down, left button up |
| 45,000 | `after-selection.png`: Score 160, Wave Scoring, two city images |
| 50,000 / 51,000 / 55,000 | Aim (260,220), A down/up, delivered to focused SDL window |
| 60,000 | `aim-fire-left.png`: Score 240, Starting Wave #2, red aiming cross at (260,220) |
| 70,000 / 71,000 / 75,000 | Aim (440,180), S down/up, delivered |
| 85,000 | `aim-fire-centre.png`: authentic Hiscores screen |
| 100,000 / 101,000 / 105,000 | Aim (550,250), D down/up, delivered |
| 120,000 | `aim-fire-right.png`: main menu with red aiming cross at (550,250) |
| 140,000 / 141,000 / 143,000 | Aim (330,160), left button down/up, delivered |
| 160,000 / 190,000 / exit | Identical final menu with cross at (330,160) |

The bundled original README documents mouse aiming and A/S/D for the three
cannons. `run/output.log` records each down/up and the actual Win32 input
messages entering hwnd `0x10001`, including keyboard focus. The selection
transition, score and wave are directly visible. The score increase spans a
wave-scoring transition and must not be attributed specifically to the A
press. No capture isolates the state at the S press; D and the final click
arrived after the reviewed Hiscores frame. No isolated
fired projectile, enemy destruction or causal firing success is claimed.
The thin green line in the wave-scoring image is not used as projectile proof.

Seven scheduled captures and the exit capture succeeded. The 640x480 host
canvas clips the right and bottom of the window at (20,20), as in the prior
menu run; this is not full-client-area coverage. Guest clock values are in
the log (6,400,000 ms at the menu, 12,000,000 ms at Wave #2); batch-clock
progress is not real play time. There is no long-session or audio claim.

The sole guest execution naturally reached 200,000 batches in **7.136 s**,
730,061 API calls, exit 0, without an observed trap or unimplemented API.
The supervisor completed in **7.330 s**, TERM=false, KILL=false,
remainingGroup=false. Its actual API command is `cmd_92guomz6atbd`.
No second run, build, installation, patched guest, fake input state or
alternative module was used. `input-events.json` is empty because it records
only live controls; the scheduled commands are proved by argv and output.

## Exact inputs and fresh gates

This qualifies historical source **b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a**,
not current main. The complete module is 1,879,746 bytes, SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
The runner is 685,960 bytes, SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
The original EXE is 107,008 bytes, SHA-256
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`.
MSVCRT SHA-256 is
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.

`manifest.json` binds all **287 files / 15,719,953 bytes**, including seven
authentic DLLs, all 83 graphics, the region helper, fonts and 23 pngjs 7.0.0
files. Local hashes passed before transfer; the complete destination rehash
passed before guest launch. Streaming wrote one final remote tree, with no
archive or intermediate payload tree. All **431 serialized requests** were
at most **35,976 bytes**, below the 36,000-byte limit; segment data was at
most 18,000 bytes. Metadata and helper requests used the same bound.

The fresh ordinary-UID1000 probe ran from the actual runner directory:
PNG encode/decode returned [1,2,3,255], production rasterCanvas and renderer
resolved, and all subset-font mounts were readable. Region stamp
`9a3bc9149d58209c` includes DIRECT_WINDOW. A separate sequential native
WebAssembly linkage probe instantiated all 291 imports with a fixed shared
512 MiB arena. It invokes no guest export; its throwing host placeholders
are only an ABI test, never the gameplay host. That process ended before
the real runner and its authentic host/DLL initialization began. The actual
runner initialized all seven DLL providers successfully. No threads, skia
or headlessGL route was selected.

## Recovery, resources and lifecycle

`admit.py`, `stage.py`, `prepare-run.py`, `preflight.py`, `supervise.py` and
`collect.py` preserve the executed recovery/transfer/supervision recipes.
Do not replay them over retained output paths. A future authorized recovery
must choose fresh task/output paths and its assigned box, repeat admission,
then run admission, stage, prepare-run, the supervisor once, and collection
in order. Historical Git reads use `GIT_NO_LAZY_FETCH=1 git show` from
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23` at the exact
revision above. Local absolute file donors are individually named and hashed
in the manifest. The original retained release is at
`/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11`;
codec is under
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`.
Ignored module/original bytes are recovered from these immutable inputs,
not from Git evidence files. The accepted ABI contract is retained verbatim.

Initial admission was 59,760,145 bytes; before guest launch it explicitly
retained 5,327,752 bytes of prior local failed/menu task history, totaling
**65,087,897 / 67,108,864 bytes**. No previous result or charge was reset.
Final accounting retains current checkout/Git, both hosts' outputs, launcher
events, the actual worker session, positive SQLite growth, future transport
and evidence allowances, and the 8 MiB reserve inside the allocation.
Installed tools and immutable input donors are separately identified.
`resource-final.json` records measured charges and the remaining projection;
both hosts preserve the 2,982,150,144-byte post-projection free-space floor,
and all task files are below 25,165,824 bytes. Internal text capture is
conservatively charged at 400,000 / 1,048,576 bytes; raster artifacts and
their session growth are separately charged in full.

Fresh native MemAvailable was 7,198,261,248 bytes before the dependency probe;
the supervisor rechecked >=2,684,354,560 immediately before gameplay. The
actual guest uses fixed 512 MiB shared memory and oldspace512, CPU/wall90 s,
guest60 s, max200000 batches, quiet API/block flags and the unchanged
524,288-byte output guard. `remote-final.json` records no remaining exact
runner process and 20,429,551 owned remote bytes. The supervisor reaps its
group; only retained staging/evidence remains.

Box **bx_ts27jq5e** is left **RUNNING**, API state `idle`, health `ok`, expiry
**2026-10-24T03:18:12.037Z**. The coordinator owns shutdown at **03:08 UTC**.
`watchdog-observed.json` records actual live watchdog PID3197673, its source
hash and deadline. That deadline has not arrived; a shutdown receipt is not
claimed. No stop, delete, resume, expiry extension or other box allocation
occurred. The prior denied bx_9nngcsvf resume was never retried.
The board watcher is stopped at handback. There is no Penguin corpus card;
this evidence remains with the investigation note. No public hosting,
Claude, workers, unrelated edits or main integration were performed.
