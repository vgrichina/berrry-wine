# Heretic II playable named checkpoint recovery, 2026-11-11

The genuine dry-corner `gate1315` checkpoint is playable after native load.
Two loads of its original four files returned Corvus to the timber corner;
finite backward movement cleared the wall in both sessions. Staff combat,
pursuer movement, damage and deaths progressed normally. The original dock
checkpoint also loaded alive and responded to backward movement and swimming.
No emulator repair or save alteration was required.

Run: `scratch/runs/20261111-heretic2-named-save-movement-gate-1405/` (ignored).
The original checkpoints and their provenance are documented in
[the parent save handoff](heretic2-native-progress-save-raised-gate-20261111.md).
This result resolves that handoff's untested corner resume and extends its
forward-only dock movement observation. It does not establish a cause for
every earlier stationary frame.

## Exact-byte recovery and native resume

Recover the four named-slot files from the parent's
`corner-save-manifest.json` and lossless `final-recovery-local-map.json`.
Their original contents remain available as hash-addressed gzip objects in
the parent's `recovered-encoded/`. Keep this set together:

| Guest path under `c:\user\save\gate1315\` | Bytes | SHA-256 |
| --- | ---: | --- |
| `server.ssv` | 2752 | `d69b354fde0698e4e7afdca56528472400e19ad79be87a435703588b5d035140` |
| `game.ssv` | 62728 | `faf1282c58fd010345dc76f78c0b2075f8b8bed52977feaf9e1b73760cd373d9` |
| `demodocks.sav` | 1396120 | `506e3ea9a4a0ce10afbb8f618df4527b27ab00b5fc0b2551f936af6a8b7c7095` |
| `demodocks.sv2` | 90112 | `50df980e4e0e11246d5de82eba05d375d431fdde35ee18d63afd82dae019d86d` |

This run verified every original byte count/hash locally, again in the
browser before mounting, and again from the final read-only VFS export.
Mount through the supported resident VFS file-entry interface with
`ensureParentDirs`, preserving the exact guest paths and bytes. This does
not write guest memory or modify a game script, map, configuration or save.

Use the same canonical media, source
`0db20330ccd6761a705eea70c5dd9bfc7704c147` and module
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
Open the native console with backquote, type `load gate1315`, and press Enter.
Allow loading to settle and review the actual screen before further input.
A console/loading frame is not sufficient evidence of a completed playable
resume. In both corner trials, backquote followed by native Escape to Main
and Escape back to the session, with passive settling, exposed the live
corner. Do not blindly repeat toggles: an actual open console shows Paused.

The saved character faces a close timber wall with a pursuing humanoid
immediately nearby. A finite `ArrowDown+Control` hold of 3000 ms, followed
by actual releases and passive settling, moved Corvus away from that wall
in both trials. Equip Sword-staff with `1`; the saved Flying-fist selection
is not the staff. The restored position is unsafe for prolonged inspection.

Decisive full captures in this run's `software2/`:

| Capture | Native observation |
| --- | --- |
| `corner-resume.png` | First restored dry corner, Corvus alive beside wall and pursuer. |
| `corner-back-after.png` | Backward attack clears the wall and reveals the passage. |
| `corner-fight-after.png` | Staff combat leaves visible nearby corpses. |
| `repeat-ready.png`, `repeat-back-after.png` | Second original-byte corner load and repeated displacement into the stone arch. |
| `entering-ready.png`, `entering-forward-after.png` | Native ENTERING control moves forward after its opening camera sequence settles. |
| `dock-unpause-after.png`, `dock-back-after.png`, `dock-swim-after.png` | Original dock load moves backward off the dock, then swims underwater. |

## Gate attempt and limits

The first restored-corner attempt killed nearby pursuers with the staff but
ended in combat death at the low passage. A fresh native ENTERING attempt,
with early staff selection, jumped the starting crate, reached the dry
corner, killed a pursuer and aligned with the low passage; another pursuer
killed Corvus there. The repeated corner restore also ended in close combat
death. Final native state was Load Game, ENTERING — Silverspring Docks.
No new panel activation, raised-gate crossing or onward objective was reached.
The parent's successful fresh Space-1500 panel activation remains the next
route target once pursuit is controlled.

Full current images were reviewed before every dispatched bounded input;
physical releases and passive settles are retained. An unsupported chord
was refused locally before dispatch and replaced with an already supported
chord. A too-large pin-audit argument failed before process creation; the
successful audit read the existing remote pin file instead. Neither failure
replayed uncertain gameplay input. No explicit combat Pause assistance,
cheats, workers or public hosting were used. Native console pause was used
for documented checkpoint loading.

The matching retained locked-build proof was rehashed, eight input-helper
checks passed, all 3,377 provision pins matched, and all 2,460 runtime pins
still matched after gameplay. Source recovery uses exact Git identity,
relevant binary patches, run-input patches and canonical media references;
there is no source-tree or media archive. The runtime's final read-only
save export retains ten files, including the four unchanged corner-slot
files. All 579 artifact references (448 unique contents) were recovered and hash-verified
before shutdown. The final validator passed 68 PNG CRC/IDAT checks, 56
image/module bindings, 56 exact numbered acknowledgments and 29 finite,
balanced direct holds. Three typed load commands completed in 804–807 ms
with balanced trusted key pairs; their helper's nominal 100 ms timer marker
was not the typing-completion timestamp. An initial validator incorrectly
cut those event windows at that marker. The corrected check uses all events
from each typing start, verifies their balance and a finite ten-second cap,
and leaves the original event records intact. This complete event-validation
pass ran after archive; raw-content and save-hash verification passed before
archive.

Browser/controller normal exit code 0, actual parent wait and both EOFs were
recorded. An independent check found controller/browser PIDs, profile and
server port absent, and rehashed the four final corner-slot exports. Private
box `bx_amarqanc` was normally archived at `2026-11-11T14:24:35.823Z`, stop
`stop_89fb8966d3f397e3`, completed nonforced with no error. A separate GET
confirmed archived state and null expiry. Original fixed expiry was
`2026-11-11T14:47:08.181Z`; the prearmed independent watchdog exited unfired
with actual parent wait and both EOFs. The box was neither resumed nor
deleted. Full recovery details are retained in the run's RESULT.md.

Next: restore this now-proven playable corner checkpoint, manage the close
pursuers, clear the low passage, then use the documented fresh close-panel
Space hold and immediately cross the raised gate.
