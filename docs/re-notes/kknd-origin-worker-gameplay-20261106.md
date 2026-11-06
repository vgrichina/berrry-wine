# KKnD original real-origin Worker attempt — 2026-11-06

The sole original registered `kknd_xtreme_demo` now passes the authentic DDRAW file prerequisite and starts in the owning CPU Worker. It stops at its own **“Failed to setup DirectDraw”** dialog. Personally reviewed `startup-01.png` and `terminal.png`; neither is gameplay. Evolved → Walkover, selection, commanded movement, FPS and audio remain unverified. No trusted inputs were sent, no retry was held, and no emulator code was changed.

Evidence: `scratch/runs/20261106-kknd-origin-worker-gameplay/` (ignored). This continues the matched-gameplay note at `2775f3e63`, the VERSION prerequisite note, and the registered-gameplay/payload-recovery notes. It does not repeat page-only interception or cooperative execution.

## Build, prerequisite and actual executor

Tested source commit: `f3a4684200b508515fbd11f5f613d9a4c79b82f4`. Relevant pre-existing uncommitted changes and new files are recorded in `prelaunch-source.binarydiff`, `prelaunch-source.json` and its named new-file patches. Git remains the source archive; no tree/media archive was created.

The ordered AoW0545/Aranna0600 releases and coordinator's explicit final release of stopped D3D9Clip0625 were observed. The coordinator explicitly authorized this existing KKnD assignment without continuing the stopped D3D task. `gate-check.json` independently checked 454 absent PIDs, 41 refused ports, 24 absent profiles, four free locks and no heavy runtime. The immutable active window was 07:26:03.619278–08:11:03.619278 UTC, including cleanup/publication.

Pulled main and passed `flock /tmp/wine-build.lock bash tools/build.sh`. Standard and compat VERSION/authentic DirectX checks, parser fixture and builtin DLL execution policy checks passed (`focused-tests.json`). Both modules match current source, generated/placed layout `fbae3a59c4fddb48` and actual HTTP responses:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| standard | 2178481 | `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f` |
| compat | 2181127 | `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a` |

`recovery-control.cjs` reproduced the previous required-file 404 and proved the recovered production `host.loadFiles` mount without starting a guest. The original server installed `recovery-origin.cjs` before listening; real HEAD/GET/manifest requests return identical pinned bytes to every fetch context, while the existing bundle route falls back normally. The production required-file preflight additionally rejected wrong size and wrong SHA before mounting, before any browser (`same-origin-file-preflight.json`). Builtin execution policy was preserved. No guest memory, executable or DLL was modified.

Unchanged media is referenced by `prelaunch-media.json` and `runtime-end-media.json`: existing 16-file payload at `scratch/game-media/kknd-demo-20261106/installed/`, total 15,653,500 bytes. `KKND.EXE`: SHA-256 `b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a`. Registration manifest remained identical to the released payload-recovery proposal.

Authentic DDRAW is decompressed in memory from existing `scratch/runs/20261031T2029Z-freespace-wininit/candidate-vfs/directx/ddraw.dll.gz`: 352528 bytes, SHA-256 `0a37a508dc6703f0998fb41d8fd5b03d7bbb5d466165dce5b45559d85174ca26`, version 4.7.0.700. Existing DX7a package provenance: `test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe`, 6340040 bytes, SHA-256 `564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189`. Neither was copied. Production `host.loadFiles` mounted the exact authentic bytes at `C:\WINDOWS\SYSTEM\ddraw.dll` before `wine.run`; the original page VFS was rehashed in the live identity capture.

The server ran with `--isolate` and `noAgentInject:true`, normal registered-app route `index.html?app=kknd_xtreme_demo&debug&perf-stream`, Chrome 151.0.7922.108, viewport 1100×850. Actual HTTP source/helper/module hashes and isolation headers were checked before navigation (`http-pre-navigation-identities.json`). Current source and both module identities remained unchanged at runtime end (`runtime-end-identities.json`).

A two-Worker control first proved the existing CDP bytecode identity helper distinguishes different actual WASM modules across Worker targets. The original observer initially read slot/endpoint from the GuestThreadHost facade, producing a false predicate; these failed observer records are retained. The correct owner is `wine.guestWorker.link`. Read-only `capture-live.cjs` corrected that binding in the **same original lifetime**, without reload, guest writes or input. `actual-owning-worker-identity.json` passes: page slot 0/endpoint 1 matches the instantiated lexical executor in the CPU Worker, thread 1, ordinary 536870912-byte memory, and CDP `Debugger.getScriptSource` yields actual WASM bytecode with the standard module SHA above. The actual module bytes are retained. A served-file hash alone was not used as proof.

## First remaining failure

The original started at approximately 07:27:22 UTC. At 07:27:23.237 UTC its MessageBox logged `Error: Failed to setup DirectDraw`. All 16 data files had mounted and the Worker had instantiated. The first dialog, console, register snapshot, stack, original disassembly and terminal capture were preserved. The browser closed normally at 07:30:52 UTC; zero trusted input events were recorded.

`capability-boundary.json` derives the following from the retained read-only modal stack and unchanged original disassembly:

- Modal return address is `0x412023`, following the original MessageBox call at `0x41201d` in common setup failure path `0x412000`.
- Original `0x411af4` calls COM vtable offset `0x2c` (`GetCaps`). The game initializes both 316-byte capability structures. Their retained `dwCaps` values are both `0x00024041` (HAL stack offset `0x30`, HEL offset `0x16c`, measured from modal ESP).
- `0x411afc` tests HAL `dwCaps & 0x80000000`; `0x411b02` tests HEL similarly; `0x411b09` jumps to `0x412000` when neither advertises the bit. ESI remains 316, and the later surface descriptor is entirely zero.
- The unchanged GetCaps implementation in `src/09a8-handlers-directx.wat` writes `0x24041` to both structures. This matches the actual retained values.

This supports rejection at capability admission before cooperative/display/surface setup. It is an inference from original code and retained state, **not an independently captured branch trace**. The actual GetCaps return HRESULT was not captured; the modal EAX is not that result. Cleanup clears the DirectDraw globals, so their zero values must not be called evidence that DirectDrawCreate failed.

Microsoft's [SDK header](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/ddraw.h) defines this bit as `DDCAPS_CANBLTSYSMEM`; the [DDCAPS documentation](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddcaps_dx5) describes blitting to/from system memory. Omission of an optional advertised capability does not itself prove Win32/x86 divergence. No unsupported capability bit was added. Next work should qualify actual system-memory blits and truthful HAL/HEL capability reporting through public COM pixel/ABI controls on both shipped modules before proposing any repair and assigning another original.

## Reproduction and recovery

The executed command was `node scratch/runs/20261106-kknd-origin-worker-gameplay/browser.cjs --isolate`; see `browser-command.json` and `browser.log`. This was the one original permitted for this assignment. Do not run it again as an unassigned retry. The retained helpers reproduce the real-origin recovery without media copies: `verify-media.py`, `recovery-origin.cjs`, `recovery-control.cjs` and `origin-preflight.cjs`. Before a future separately assigned original, preserve the production required-size/hash checks, real-origin manifest/HEAD/GET/bundle fallback and builtin policy; use the correct `guestWorker.link` owner binding already demonstrated by `capture-live.cjs` before input.

The outcome is a precise remaining startup blocker, not successful Walkover gameplay. No selection/displacement pair exists because startup never reached a menu. Local Node/Chrome/server/profile and passive watcher are cleaned independently; `final-cleanup.json` records exact PID/port/profile checks and free locks. No test boxes were assigned (ID/state/expiry: N/A), no workers were launched, and no deployment occurred. Final source evidence and the atomically published `result.json` identify the docs-only publication and retained artifact hashes.
