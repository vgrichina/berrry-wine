# Original Jedi: ordinary loading and visible player controls

The original installed demo reached a reviewed first-person gameplay view through
**Player / Medium / Single Player / New Game**. Separate ordinary keyboard tests
showed forward movement, horizontal turning, and firing effects (weapon animation
and ammunition consumption). No movie, engine, map, registry or guest bypass was
used. Both original WinExec calls remain: the duplicate child found the surviving
engine HWND `0x20001` and exited through its original ExitProcess(-1) path.

This continues [the shared-desktop investigation](jedi-desktop-window-visibility-20261103.md).
Evidence and reconstruction instructions are in
`scratch/runs/20261103-jedi-original-loading-gameplay/RECOVERY.md`.

## Interrupted worker and original session

Worker93437 exited on model capacity at Single Player, without final.txt.
The coordinator explicitly transferred its sole existing boat `bx_6g6ecnj4`,
supervisor7907 and original08:50:39 Play session to fresh replacement12339.
Recovery checked actual live processes before continuing; no second session,
boat, rebuild or production change occurred. Menu captures were reviewed before
separate pointer/highlight/click operations. Recovery selected New Game only after
reviewing its highlighted state, then observed Fuel Station Launch loading.

The original design bounded guest execution at600s, cleanup at624s, outer at630s.
The supervisor ended at629.224365374s with launcher exit-9, reason
`outer finite deadline`. This is harness termination, not a normal guest exit.
The surviving engine handled SIGTERM long enough to write its final PNG and
reported557.770s engine time. No RuntimeError, unreachable or uncaught exception
appeared in the retrieved log. The later engine start and recovery overhead mean
this was not600 seconds spent loading the level. No loading hang was established.

## Reviewed effects and their limits

`live/recovery-loading-later.png`, batch1149025, shows the courtyard, blaster and
HUD before any movement/look/fire input. Up-arrow down at1220340 and up1241148
produced the close wall/ramp view at1242659: visible forward displacement.
Left-arrow down1278492 and up1294541 produced the courtyard-facing view at1296019:
visible horizontal turning. Ctrl down1331738 changed the weapon pose and reduced
ammunition100→99 at1332715; release1350360 was followed by the resting weapon
and ammunition90 at1351728. Each test was separate and inputs were released.

These establish movement, horizontal view control and a visible firing response.
Projectile impact, target damage, vertical mouse-look, audio and sustained level
completion were not verified. The final engine screenshot contains a close
character in the rendered scene; it is not used as evidence for another control.
`visual-reviews.jsonl`, command intentions, dispatch receipts and capture states
retain the actual steps. Dispatch success alone was not treated as a visual effect.

## Actual inputs, tests and recovery

The tested source was `69acd0c843eacefe5cdc8f848e4ea2d63763dab7`, with5903 sealed
inputs verified unchanged after runtime. The2083613-byte canonical module SHA256
is `215edf1a09894f4b4d4e9d0e89dce47cf66a42597d084ec218772ec46364a293`;
all three actual process compile/instantiate receipts match it. The predecessor's
fresh boat-side locked build passed, as did shell-cli-routing, winexec-readiness,
keyboard-message-lparam and process-desktop tests. Recovery changed documentation
and task evidence only; no new build was required.

All28 installed originals/39900850 bytes,76 baseline registry values, genuine
file-only DSOUND.VXD/DDHELP, builtin DDRAW/DSOUND policy and pathguards were
preserved. All220 staged runtime files match. Across23 checked capture states,
20 child states contain only the allowed guest-generated Version0.1 addition.
Source recovery uses5821 exact git blobs at the tested commit and82 compressed
content-addressed deltas, with full bytes/SHA manifests; no duplicate local
full-source archive was created. The genuine original installer and historical
layout archive have full-SHA recovery recipes. Actual inputs also remain in the
normal stopped boat snapshot.

`retrieved-evidence.tgz` is7381237 bytes, SHA256
`c9cdff26ab060a2b29cd79a8df1521ec67888f1e14942529528a8e008b9ebdd6`.
All113 retrieved members passed stored and decompressed/original full-SHA checks.
Task processes/controllers and ports8143–8159 were absent before shutdown.
The original task's delegated normal stop of ONLY `bx_6g6ecnj4` completed
09:02:57.303Z, operation `stop_734f32ca571ffe09`, error:null, forced:false,
STOPPED with normal snapshot/metadata retained. Original expiry was
2026-11-03T09:28:27.753Z; `shutdownOwner` remains
`jedi-original-loading-gameplay`, with the delegated operator recorded separately.

The next Jedi task can investigate vertical look, visible projectile/impact and
longer play through the same ordinary route. This task releases the serialized
runtime lane to Alice, then GL; no new run is authorized here.
