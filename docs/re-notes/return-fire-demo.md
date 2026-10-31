# Return Fire demo

User priority from X post 2108357606242918686, linking https://archive.org/details/Rfire.

## Original media and registration

RFIRE.zip: 942701 bytes; SHA256 8e55e2761753d1773cbf52d86eb30900a977f7b281ccc920ffb80fbb5b5e56be. Original RFIRE/DEMO.EXE: 323072 bytes; SHA256 b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63. Extract unchanged into test/binaries/candidates/return-fire-demo/. All 57 supporting files remain mounted through .wine-assembly-browser.json. No installer or guest edits. Local-only app return_fire_demo uses the existing real desktopColorDepth:8 indexed surface; no public desktop promotion.

## Verified native route, 2026-10-09

Temporary boat bx_5jcbe4c6. Canonical module 65f1f98d4b3545f5141b0be2816e1c9353729dbfa477013fc4baafa3b95ae1a4, runtime source b636d43c7 plus app registration. Native CLI no threads, software renderer, frozen stepping, batch size 100000. These steps do not measure real-time FPS.

Default 32-bit desktop fails the original 256-color requirement: run 20261009T2009Z-return-fire-32bit-control. Real 8-bit desktop reaches normal One Player/Easy launcher. Click Play (175,312), then acknowledge the second informational graphics warning (315,278). Full-screen bunker appears. H (VK72) selects the vehicle; W (VK87) moves it away from the bunker. Terrain scrolls and fuel falls. Further H input reduces ammunition. Enter and Up were tried first but did not deploy the vehicle; the original RFIRE.HLP identifies H/J/K and WASD for player one, Enter/numpad for player two.

Run 20261009T2010Z-return-fire-gameplay retains all numbered input requests, responses, screenshots, log, original controller and hashes. Reviewed step-8.png shows deployed vehicle, step-10.png shows movement into terrain, step-12.png shows subsequent ammunition change. Controller/guest exited cleanly at 20:15:38Z. identity.json describes initial startup only; numbered request files are authoritative for subsequent input.

## Open work

- Browser launch/input on a temporary box; no browser qualification yet.
- The second renderer warning still says it is not in 8-bit mode despite indexed desktop. Full-screen path works, but its separate depth query needs tracing. String VA00472504, reference around00424a2a; do not fake caps or assume DirectDraw without inspecting.
- Sound, logical gameplay FPS, sustained play and additional vehicles remain unverified.
- Build run 20261009T2008Z-return-fire-build pins canonical build and original extraction.

## Browser baseline and depth-query diagnosis

Registered browser route with default guest Worker and WebGL backend also reaches gameplay using trusted Play/OK pointer events, H deployment and five ordinary W keypresses. Browser run 20261009T2018Z-return-fire-browser records before/after movement screenshots. No guest writes or runtime overrides.

The second warning follows IDirectDraw::GetDisplayMode (vtable offset0x30) at00424a0a, comparing DDSURFACEDESC+84 dwRGBBitCount with8 at00424a11. The module's dx_display_bpp_get defaults16 before SetDisplayMode, independently of gdi_desktop_bpp. This identifies the source mismatch, not a tested fix. A regression should cover initial indexed desktop, initial32-bit desktop, and explicit mode overrides; do not call gdi_display_bpp from dx_display_bpp_get (it recurses after mode selection).

Initial browser harness failed on an original zero-byte asset because createReadStream received end=-1. Both controller22191 and Chrome22203 confirmed terminal; retry serves empty files with an empty200 response. This was a harness defect, not a game crash.

Browser controller22557/Chrome22569 stopped cleanly at20:20:38Z. A30.19s sample counted132548.5 presentation events/s and47.00 uploads/s; the inflated presentation counter clearly cannot stand for gameplay FPS. Logical FPS and audible output remain unverified.

## Initial-depth candidate held for windowed palette

Candidate dx_display_bpp_get fallback uses gdi_desktop_bpp (not recursive gdi_display_bpp). New pre-SetDisplayMode test fails on unchanged runtime (actual16bpp/pitch1280, expected8bpp/pitch640), passes candidate initial8/32 and explicit8/16/32. Canonical build, indexed desktop and windowed-primary tests pass; evidence20261009T2021Z-ddraw-initial-depth. Module1ea93020fb928d7f111296c03dfbaeeebb178b1d42179c0de3a7f0b668a7727f.

Original Play now skips warning and enters windowed bunker, but its colors are wrong (red/green vehicle art and gray patterned map borders). Reviewed run20261009T2022Z-return-fire-windowed-palette step-2.png. Native controller25251/guest25258 terminal0 at20:24:25Z. Keep code candidate out of main until windowed palette integration is corrected; current main fullscreen evidence remains valid. Next inspect palette selected/realized into indexed GDI versus DirectDraw primary conversion. No game-memory or caps bypass.

## Palette trace follow-up

Run20261009T2025Z-return-fire-palette-trace (controller26203, terminal0 at20:26:15Z) preserves original startup with filtered API trace. GetSystemPaletteEntries requests slots236..245 and246..255. CreatePalette calls occur at return004269ee and004269fc. No SelectPalette/RealizePalette calls appear in this bounded startup. IDirectDraw_CreatePalette creates object08011168 (flags4, original table074ffa84, return00424ed4), then IDirectDrawSurface_SetPalette attaches it to surface08011008 at return00424f09.

The current SetPalette primary path only stores the DirectDraw palette pointer. Windowed dx_blit_entry_rect_to_hdc converts through an indexed GDI destination using separate gdi_system_palette. Next regression should test actual indexed window pixels after primary palette attachment and subsequent SetEntries, while offscreen palettes must remain isolated. Hardware-palette propagation is the working hypothesis; not yet proven by a failing pixel test. Microsoft API contract: https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-setpalette (attached palette applies immediately to subsequent surface operations).

## Primary palette propagation experiment (not merged)

Actual indexed-window pixel test in test-directdraw-palette-format.js fails control: requested RGB(3,111,218) displays(0,128,128). Candidate synchronizes primary PALETTEENTRY colors into indexed GDI display RGBQUADs, repaints retained pixels, and repeats on primary SetEntries. Tests cover attachment, retained-pixel update without drawing, and offscreen isolation; all pass with indexed-GDI and initial-depth suites. Canonical build passes module1f9972690a21dde3de991933a4c3d9c8378544f29cb491dcb3cbf3150adc31ff; run20261009T2028Z-ddraw-window-palette.

BUT original windowed bunker remains incorrectly colored, run20261009T2030Z-return-fire-palette-candidate. Controller28030/guest28037 terminal0 at20:30:42Z. This does not fix the game; all runtime changes remain held WIP.

Further original-code clue:00424e41 builds236 palette entries from RGBQUAD table0045f8a8, storing them at local palette+40 (physical indices10..245), while00424e81 stores the same entries at palette+0 for the other mode branch. Inspect mode00463450 and the guest's pixel-index translation/8-bit blit path next; a ten-entry mismatch could persist even with coherent display palettes. This is a hypothesis, not a confirmed emulator fault. GDI palette initializer00426900 separately creates236 colors then static tail entries.

## Index addition observed

Run20261009T2035Z-return-fire-add-trace armed trace-at atbatch510 (arming at0 yielded no hits in earlier probes). At403240 batch526 sourceESI004a1514 starts00 and destinationEAX501fd000 starts00; next hit batch527 destination first byte is0a, EBX1. Mode00463450 is6. Original403253 ADD DL,10 executes correctly for that iteration; do not claim a general byte-add decoder fault. Offscreen pitch640, pointer501fd000. Earlier API run2032 confirms Lock08011018 and Blt to primary08011008. Next extend the pixel test through actual DirectDraw primary presentation, rather than only GDI SetPixel; inspect later sprite translations separately if that passes. All probes terminal.

## Root semantic contract found: windowed realization

Microsoft Game SDK KB140588, original Microsoft article archived at https://www.betaarchive.com/wiki/index.php/Microsoft_KB_Archive/140588 (also indexed by https://jeffpar.github.io/kbarchive/id/miscsdk/), explains windowed DDSCL_NORMAL palette realization: the logical DirectDraw palette maps into physical system slots; first/last10 are reserved. PC_NOCOLLAPSE entries occupy the236 dynamic slots, and bitmap indices must be incremented by10. Return Fire follows precisely that convention.

Static jump table424f34/selectors424f40 maps modes1..3 to424e1c (already-shifted table) and modes5..7 to424e7a (unshifted logical table). Actual mode6 uses the latter and adds10 to bitmap bytes. Aligned screenshot color-index comparison found44002 pixels with observed-minus-expected palette index+10 (other differences include animation/alignment). This supports missing realization, not a missing CPU addition.

The proposed WM_QUERYNEWPALETTE explanation is unsupported: DEMO.EXE does not import SelectPalette or RealizePalette. Do not add messages as a game fix on this evidence. DirectDraw itself must implement the realization contract.

Expanded regression through dx_blit_entry_rect_to_hdc passes current candidate, confirming the test's raw-table expectation is insufficient. Replace the candidate's raw256-entry copy with normal palette realization (reuse GDI logic, PC_NOCOLLAPSE/static entries, retain logical GetPalette/GetEntries), and present windowed primary physical indices through the realized system table. Update tests to logical entry37 => physical47 for PC_NOCOLLAPSE, retain offscreen isolation, SetEntries repaint and exclusive unshifted behavior. Full candidate still held out of main.

## Resolution: windowed palette and gameplay verified

The final implementation replaces the earlier raw-copy experiment with shared GDI palette realization and a cached physical PALETTEENTRY view. DirectDraw initial depth follows the configured desktop until SetDisplayMode. Normal indexed primary attachment/SetEntries realizes logical colors into system slots; both WAT blits and host direct presentation consume the physical table. Exclusive mode and logical GetEntries remain unchanged. Offscreen palette changes cannot recolor the primary.

Canonical build module527004d9512965c6b9488799baf90ed8d6ec4e867b7accd6ae32eba09b16d363 passes depth, palette-format, force-present and window-placement tests (run20261009T2045Z-return-fire-realized-build). Indexed-GDI/windowed-primary tests also passed during development. Tests cover physical slot47 for logical37, reserved black/white, retained SetEntries repaint, offscreen isolation, and unshifted exclusive behavior.

Original native and browser gameplay now have correct colors without the secondary warning. Ordinary H deploys and W moves across terrain. Reviewed runs20261009T2046Z-return-fire-realized-native and20261009T2050Z-return-fire-realized-browser preserve exact tested source patch, module hash, input and cleanup. Browser uses default Worker/WebGL and trusted keyboard input. Controller35053/Chrome35065 stopped cleanly20:49:51Z. Audio and logical gameplay FPS remain unverified; diagnostic stepping/presentation counters are not FPS. Local-only candidate, no public deployment.

## Browser audio output observed

Run20261009T2052Z-return-fire-browser-audio uses main c7e568b90 and the same527004d9 module. Ordinary Play/H reaches gameplay; an analyser and MediaRecorder tap the existing master bus without guest changes. AudioContext runs at44100Hz;99/100 windows are non-silent over20.1201 audio-clock seconds. Maximum pre-destination peak1.0234375 is recorded, not diagnosed as an audible clipping defect. gameplay-audio.webm retains the20-second capture. Sound quality, loop correctness and synchronization require listening review; logical gameplay FPS still unqualified. Controller37218/Chrome37230 terminal0 at20:52:44Z.

## Automated original-media recovery, 2026-10-14

Fresh RFIRE.zip download passed recorded942701-byte size and SHA2568e55e2761753d1773cbf52d86eb30900a977f7b281ccc920ffb80fbb5b5e56be; derived SHA1d0adc4af348f0e255d60d59c8ba24b760d3cb729 is now pinned in the fetch recipe. Run `node tools/fetch-candidate-corpus.js --id=return-fire-demo`, then `node test/test-return-fire-recovery.js`. All58 original payload files are pinned in test/candidate-corpus/return-fire-demo-files.json. Each 7z-extracted file was compared byte-for-byte with its original ZIP member using independent unzip extraction; DEMO.EXE matches the previously recorded hash. No installer/configuration synthesis or original file changes. Pristine recovery is verified, not new gameplay/audio/FPS or redistribution rights. Archive and receipts retained separately from Git.

## Current-main browser attempt, 2026-10-31: gameplay not accepted

Run `scratch/runs/20261031T2206Z-return-fire-current/` retains a fresh original-media browser attempt for NEW-GAME-RETURN-FIRE-DEMO-20261009. The four historical gameplay directories checked in `historical-availability.json` are absent locally; the older descriptions above are historical reports, not retained current-main acceptance. This attempt does **not** replace them with successful deployment/movement evidence.

Runtime main was `eccebf738b0180895fb9bbeb811fb5bd20ad9716` (input `6a01ff869` plus intervening documentation commits). All 58 actual original files match `test/candidate-corpus/return-fire-demo-files.json`, including DEMO.EXE `b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63`; the registered manifest supplies 57 supporting files. No download, guest edits, old palette experiment, production change or rebuild. All 528 source and 867 compiler pins remained unchanged. The actual uncached HTTP module response was 200, 1,898,762 bytes, SHA256 `d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8` (`actual-http-loaded-module.json`).

Cheap recovery, opt-in selector/indexed8 registration, exact response guard (14 cases), isolation headers (five server cases), displayed geometry helper and durable child-wait prerequisites passed. The route was `/index.html?candidates&app=return_fire_demo&no-log`, Chrome 151.0.7922.108, isolated default guest Worker/WebGL, default audio and ordinary clock. Actual native browser viewport was 1024×768 through Play/H. One Player/Easy native launcher is visible in `01-native-launcher.png`; the reviewed Play button was clicked at browser client (368,456) using balanced trusted mouse edges.

First actual failure: Play opens a 328×286 Return Fire window with 320×240 client, but `02-play-bunker.png` and settled `04-predeployment.png` show a partial monochrome scene in the upper left and a large black remainder. `03-bunker-settled.png` momentarily shows only the teal desktop despite the window remaining marked visible. Trusted H down/up was delivered; `05-h-deployment.png` still shows the partial monochrome/black scene. No usable colored bunker, H deployment or subsequent terrain movement is accepted. No guest crash or defined generic API violation was established; these captures do not justify another palette patch or a title-specific bypass.

Later scratch inspection has a separate, explicit harness limitation: `inspect.cjs` attached with Puppeteer's default viewport, unintentionally changing this existing page to 800×600 at 22:08:52Z. The first Play/H failure precedes that attachment. Subsequent trusted W held/released and idle captures (`06-w-held.png`, `07-w-released.png`, `08-idle-after-release.png`) are retained but excluded from ordinary viewport/gameplay acceptance. `inspection-viewport-error.json` records the mistake; future attachments must use `defaultViewport:null` and assert geometry before and after inspection. The read-only surface snapshot found an 8-bit 640×480 surface with exactly 76,800 nonzero bytes and a separate empty 97×480 surface; this is an observation, not a proven cause. No audio-quality or logical-FPS claim.

Sole runtime 22:07:02–22:09:45Z ended through normal browser close, without signals. `full-release-final.json` records all 23 recorded own PID/start identities absent, whole Chrome/crashpad scan empty at release, ports 38807/37781 closed, own profile gone, all seven trusted input events balanced/released and FD9 free. Controller, supervisor, launcher, monitor, completion watcher and attached inspection helper have durable wait0 receipts; six adopted Chrome children were durably reaped with status0, Chrome exit0/no signal. The in-process HTTP server was closed. Minimum observed runtime free disk was 2,604,490,752 bytes. Boat ID/state/expiry N/A; own local shutdown was explicitly delegated. The prior Slave Zero supervisor wait remains missing in its predecessor receipt; this run does not repair or claim that closure.

Next: establish a generic failing presentation/geometry/palette contract from the retained first-failure evidence before changing the emulator, then use a newly authorized bounded ordinary browser run to retain successful H deployment and W movement/release. `RECOVERY.txt` preserves pins, executed driver, evidence boundaries and the attachment correction. No additional runtime or successor was launched by this worker.

## Generic primary-surface caps repair and current gameplay, 2026-10-31

Run `scratch/runs/20261031T2213Z-return-fire-presentation/` establishes and repairs the cause of the preceding partial monochrome/black client. Commit `531d5b98487bcc807d59694ec9dfeaea4a765944` made CreateSurface discard `ddsCaps.dwCaps` unless `DDSD_CAPS` was present. Native DirectDraw consumes caps1 even without that flag: Wine's [dsurface no_ddsd_caps_test](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/tests/dsurface.c) explicitly creates a primary with dwFlags=0, and [DDSD_to_DDSD2](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/utils.c) documents the unconditional caps1 read. Extended caps remain flag-gated.

The original DEMO.EXE at 00424af7..00424b20 requests exactly that legacy primary: descriptor size108, flags0, caps0x200. Discarding caps misclassified it as an offscreen surface, consumed the unused width97 and fallback height480, and prevented primary palette realization. The valid 640×480, 8-bit, pitch640 offscreen contains the 320×240 image (76,800 nonzero bytes). Without a primary, host fallback selected that unpaletted offscreen and cropped it using client screen origin(160,139), leaving precisely 160×101 pixels before black remainder. A cheap reproducer through the unchanged host presentation code reproduces this grayscale/crop geometry. Neither pitch640 nor the larger backing allocation is itself defective.

The repair restores the generic unconditional caps1 read in `src/09a8-handlers-directx.wat`; it adds no host heuristic, palette repair, forced mode or title-specific path. Tiny-WASM extraction of the production expression and the full DirectDraw regression both fail on old code (primary flags0 yields caps0 instead of512), then pass with the repair. Coverage includes primary flags0/1 and offscreen flags6/7, primary display dimensions/pitch/8-bit format, and preservation of the extended-caps guard. Surface47 ABI, palette-format and initial-depth tests pass. Three existing fixture issues were corrected: required descriptor dwSize initialization in caps/depth tests, and COM interface-view identity/refcounts in the caps test. Four prerequisite fixture-failure supervisors exited1 before Chrome; their logs and durable waits are retained rather than reported as successful runs.

`flock /tmp/wine-build.lock bash tools/build.sh` passed in the same original 22:17:28 allocation. All58 original file hashes and the original supporting-file manifest remain unchanged; EXE SHA256 remains `b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63`. The 528-file source manifest differs from the preceding input only in the owned DirectDraw fragment; all867 compiler pins remain unchanged. The actual uncached HTTP200 module was 1,898,751 bytes, SHA256 `aee254644f33f5710b4786abd1073f14da6d2dcadf0de2fe0b6467d3b753da57` (`actual-http-loaded-module.json`), not merely a local build hash.

The isolated default Worker/WebGL browser route `/index.html?candidates&app=return_fire_demo&no-log` used Chrome151.0.7922.108, ordinary clock/audio and trusted balanced native input. `defaultViewport:null` and before/after assertions kept actual viewport1024×768 throughout; no attachment changed it. Reviewed `02-native-play.png` shows the complete colored bunker; `03-h-deployment.png` shows ordinary H deployment; `04-w-held.png`, `05-w-released.png` and `06-idle-after-release.png` retain W movement/release and subsequent idle. The read-only snapshot now records a proper 1024×768 indexed primary, pitch1024, flags1, alongside the valid 640×480 offscreen, pitch640, flags1028. Both contain76,800 nonzero bytes. The native window remains328×286 with320×240 client. Before/after original-failure copies02/04/05 are retained in this run. Initial launcher captures showed only teal despite the internal visible window; they are preserved as a separate unresolved capture limitation, not claimed as successful launcher evidence. No logical-FPS or audio-quality claim is made.

Chrome closed normally at22:24:42Z, before the unchanged17-minute target. `full-release-final.json` verifies all32 recorded own PID/start identities absent, whole Chrome/globalcrashpad scan empty, ports43983/35297 closed, profile gone, seven trusted input events balanced, server closed and FD9 free. Controller/supervisor/launcher/monitor/completion watcher and adopted children have durable successful waits; prerequisite failures remain explicitly separate. Minimum observed runtime free disk was2,566,049,792 bytes. Boat ID/state/expiry N/A. No public deployment or successor. `RECOVERY.txt` preserves the exact reproducer, source/compiler/media pins and recovery path. The requested presentation repair and native H/W screenshots are complete; launcher capture visibility and sustained gameplay/audio qualification remain separate future work.
