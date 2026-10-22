# Shadow Man original installation and bounded launch

**Verdict: INSTALL_VERIFIED_GAME_LAUNCH_QUOTA_BLOCKED.** The original installer accepted the authorized licence, completed installation, and exited with guest code 0. All 1,959 original cabinet payload files (100,354,053 bytes) match the installed files byte-for-byte. The one subsequent original-game launch started its genuine D3D configuration utility, then host VFS export exhausted the hard 400 MiB tmpfs. No game/menu/gameplay success is claimed. No guest retry, capacity increase or repair followed.

## Observed installation and acceptance

One original Setup session, external monotonic elapsed **110.526408314 seconds**, within the aggregate 120-second bound. Owned PGID23832; parent OS23832, installer OS24078/guest0x4004, cleanup helper OS24090/guest0x4008. Two real cp.fork calls, two child preloads, two child module instances. The cleanup helper was retained and executed. Its guest ExitProcess(0), installer guest ExitProcess(0), and installer Node exit0 are separately recorded. Parent Node exit0 followed its configured 110-second run limit; that parent limit is not installation success evidence.

Actual installer-only supported CLI control was added at the existing observer's fork boundary: only `_ins5576._mp` received `--control=49171`, with no control in recursive pipe-child-args. The helper's argument array, fork stdio/environment and normal return stayed unchanged. This is diagnostic/input harness code, not production runner repair. Node Worker isMainThread guard remains. The previous welcome-only stop/timer was removed; no deliberate welcome-stop throw occurred. Ten offline targeting assertions and a real same-box PNG encode/decode passed before guest execution. The attempted low-level input import callbacks recorded no dequeue events; input qualification instead uses the genuine child-prefixed batch logs, installer-only endpoint replies, actual screen changes and installer paint/window records.

Screens were captured and inspected before each action:

| Actual action | Batch | Observed response |
| --- | ---: | --- |
| Welcome Weiter, click414,394 | 746055 | Software-Lizenzvertrag, `03-after-welcome-next.png` |
| Licence Ja, click413,394 | 1191279 | Zielpfad wählen, `04-after-license-yes.png` |
| Default destination Weiter, click414,394 | 1517038 | Default program folder, `05-after-default-path-next.png` |
| Default program folder Weiter, click414,394 | 1837065 | Actual installation/copying, `06-after-default-folder-next.png` |
| Beenden, click415,394 | 3531087 | Installer guest ExitProcess(0), child Node exit0 |

`acceptedInGuest=true` is observed here, not inherited from authorization. The licence was visibly shown with Ja/Nein, Ja was clicked at 20:01:25.326828UTC, and destination selection followed. The checked-in authorization copy remains its original historical `acceptedInGuest:false`; it was not edited. `acceptance.json` records this task's actual acceptance evidence.

`10-install-progress.png` actually shows **Setup abgeschlossen** and “ShadowMan ist auf dem Computer installiert.” Both optional readme/game-launch boxes were left unchecked; defaults preserved. The post-Beenden client requested a follow-up snapshot after the click; the installer had closed its endpoint, yielding connection refused. The click and successful guest exit are in `raw/installer/output.log`, lines28482 onward; there was no retry to obtain another screenshot.

## Installed original payload

Actual directory: `c:\program files\acclaim entertainment\shadowman`. `installed-payload.json` contains every cabinet-to-installed mapping, original and installed SHA256/size, every exported VFS file, and relevant exit/input records. All1959 match, zero mismatches. Native unshield extraction was used only to compare original cabinet bytes after installation, never to replace installation or provide a fallback launch.

Installed original ShadowMan.exe: **1,896,448 bytes**, SHA256 `4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772`. Uninstaller state, shortcuts and registry were retained. Original installer backup:2083files/186399681logical bytes, including complete parent VFS and diagnostics; verified before game launch and again at final handback.

## One game launch and first precise blocker

The separate launch used that installed executable, full saved VFS, original installed registry, authentic working directory and its installed mss32.dll. The exact command/environment is `raw/game/command.json`; no alternative EXE or fixture was used. ShadowMan.exe loaded, read its installed lang.dat, and launched the original **D3DConfigUtility.exe** (573440B SHA256 `850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0`) via a genuine fork. Parent OS26750, config child OS26758/guest0x4004; two real module instances. Original game guest ExitProcess(0) after handing off configuration is not gameplay success. Both observed Node exits were1. Config child did not inherit real-ticks (recorded false), unlike installer descendants. Startup also warned about unavailable real ole32.dll; this was not the first observed failure and was not repaired.

First observed error: **`Error: ENOSPC: no space left on device, write` at saveVfsToHost, lib/vfs-export.js:72**. The game export and ordinary configuration-child input snapshot overlapped the retained installer VFS. Prewrite admission accounted for one full game output, but failed to include actual child-input/parent-export overlap. The observer's extra pre-spawn guard covered process_spawn, not this CreateProcess route. Thus the requested stop-before-overflow protection was **not achieved**; the enforced quota prevented writes beyond400MiB, but the task hit ENOSPC. This is a host harness/storage failure, not an emulator trap, licence block or game compatibility diagnosis.

Post-failure evidence measures child input **2049files/182133271logical bytes**, partial game export62files/38686948B and other diagnostics161015B. Current retained installer runtime footprint192540672B plus two such complete VFS copies gives a **556807214B logical lower envelope**, already137376814B over the existing419430400B tmpfs before further metadata/output growth. This retrospective bound is not authorization to increase the allocation. No payload was trimmed.

The game had a configured independent <=60s watchdog, but its error handling tried to write watchdog-quit-error.txt onto the full tmpfs and raised ENOSPC before completing its kill/exit receipt. Therefore **the game's external watchdog completion/monotonic elapsed is unqualified**. A separate emergency check at20:05:41.806867UTC,27.539370wall seconds after recorded start20:05:14.267497UTC, found no owned game/config commands remaining. Final explicit PGID checks also found neither23832nor26750 live. No further guest execution occurred. Zero-byte game PNGs/summary files are preserved as failed artifacts, not valid screenshots. No game input or gameplay evidence exists.

## Exact source and module identity

One original-media recovery using the known recipe/URL succeeded; no source hopping. ISO GS1199.iso674328576B SHA256 `db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12`; original23members73339636B. Setup.exe73728B SHA256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`. Actual installer557056B SHA256 `a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083`; cleanuphelper27648B SHA256 `b5dc0feb738a91ce3cfa982647fe2779787335c6c2c598d5b49818565d7c3e84`. Genuine six support files531602B recovered from original sys1/user1 cabinets. Pinned23-file pngjs63864B reused, no npm install.

Exact reviewed158-file host closure from13bb92cd2e1bc060ff908722843d1e97a439b1a4, production0a130dc integrated unchanged at main89f1e9d2c67aa94d56d2319115589d07204d42e0. Full staged runtime/codec214files11042602B; adding23originals and6support files gives243pins, verified before/after/handback. Historical module1878971B SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`. **This historical module is not a canonical compilation of current main.** No wasm build/download or production source changes.

## Allocation, preservation and handback

Runtime allocation: fixed85536768B + hard tmpfs419430400B + reserve16777216B = **521744384B <=536870912B**. Installer sampled peak267390976B, final192364544B; exact installer highwater unknown. Game reached the full419430400B. Final tmpfs used192540672B after preservation/cleanup. All mutable cwd/TMPDIR/TMP/TEMP, VFS, registry, logs and screenshots were on the hard tmpfs; actual parent/installer/helper environments are in the installation exit receipt.

Recovery/staging final allocated **1302724608B <2147483648B**; host free47762698240B, above2982150144B floor. Local prepublication whole-task allocation16789504B +8388608B reserve +8388608B publication allowance stays below67108864B; final measured allocation is recorded separately. No ISO, game binaries or guest-output archives were retrieved locally; only small diagnostics/receipts/screenshots. Git does not preserve ignored original media, installed game or partial game VFS.

Remote immutable backups: `/home/user/shadow-man-install-continue-oct22/retained-session` and `retained-game`. Each complete inventory was verified before removing only matching game/tmp and partial game-vfs copies from tmpfs. Game backup preserves220981234logical bytes. Original media, genuine support, historical runtime and native verification extraction remain on the same box. Installer tmp directory is empty. `final-handback.json` records every game retained-file hash, checks and allocations; `installer-preservation.json` records the complete installation inventory.

**bx_m4xrrj5a remains RUNNING** (API idle, healthy, stop null), expiry2026-10-22T21:52:45.530Z. Coordinator owns shutdown/checkpoint20:50UTC. No new/fork/resume/stop/delete compute, workers, source repairs, main merge, public deployment, laptop/HeroesII/Claude-pane actions or approvals. Task ends with this evidence handback; no further game attempt authorized here.
